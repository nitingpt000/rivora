/**
 * Operational transactions signed by the Circle wallet — the protocol's own
 * signer, so unlike `arc-grant.mjs` nothing here needs a human key. Reads the
 * same CIRCLE_* credentials the API uses:
 *
 *   node --env-file=apps/api/.env apps/api/scripts/arc-ops.mjs fund 10
 *   node --env-file=apps/api/.env apps/api/scripts/arc-ops.mjs sync
 *   node --env-file=apps/api/.env apps/api/scripts/arc-ops.mjs balances
 *
 * `fund N` — approve the vault and manager, then deposit N USDC of vault
 *            liquidity. The manager approval is for repayments, which pull
 *            from this wallet.
 * `sync`   — `syncLimitFromRegistry`: adopt the latest signed assessment as
 *            the onchain limit. Permissionless by design; run it after the
 *            API has exported an assessment.
 * `balances` — read-only look at where the USDC sits.
 */
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { createPublicClient, http, keccak256, parseAbi, stringToBytes } from 'viem';

const RPC_URL = process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.io';
const USDC = '0x3600000000000000000000000000000000000000';
const VAULT = '0xa0fd0db6b2418d2bc9e445f50fa620bb547e9407';
const MANAGER = '0xeecb677e45e9d53d94af0fc0edbf99a2f94ff5a1';
const CIRCLE_WALLET = '0xc863804818a7131e46079de5b56e6c5d157603e7';

// Must match the database handle to the byte — the API derives the same id.
const BORROWER_HANDLE = '0x9c4e…a7f1';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. Run with: node --env-file=apps/api/.env ...`);
    process.exitCode = 1;
    return null;
  }
  return value;
};

const apiKey = required('CIRCLE_API_KEY');
const entitySecret = required('CIRCLE_ENTITY_SECRET');
const walletId = required('CIRCLE_WALLET_ID');
const command = process.argv[2];

if (apiKey && entitySecret && walletId) {
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  const read = createPublicClient({ transport: http(RPC_URL) });

  /** Broadcast one contract call and wait until it is confirmed onchain. */
  const send = async (label, contractAddress, abiFunctionSignature, abiParameters) => {
    const created = await client.createContractExecutionTransaction({
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    });
    const id = created.data?.id;
    if (!id) throw new Error(`${label}: Circle returned no transaction id.`);

    const settled = await client.getTransaction({ id, waitForState: 'CONFIRMED' });
    const tx = settled.data?.transaction;
    console.log(`${label} — ${tx?.txHash ?? `state ${tx?.state}`}`);
    return tx;
  };

  const balances = async () => {
    const balanceOf = parseAbi(['function balanceOf(address) view returns (uint256)']);
    const show = async (label, address) => {
      const raw = await read.readContract({
        address: USDC,
        abi: balanceOf,
        functionName: 'balanceOf',
        args: [address],
      });
      console.log(`  ${label.padEnd(14)} ${(Number(raw) / 1e6).toFixed(6)} USDC`);
    };
    await show('circle wallet', CIRCLE_WALLET);
    await show('vault', VAULT);
  };

  if (command === 'fund') {
    const amount = Number(process.argv[3]);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error('Usage: arc-ops.mjs fund <usdc amount>');
      process.exitCode = 1;
    } else {
      const units = String(Math.round(amount * 1e6));
      // A generous standing allowance on testnet: repayments pull from this
      // wallet continuously and re-approving per settlement would be noise.
      const allowance = String(1_000 * 1e6);

      await send('approve vault  ', USDC, 'approve(address,uint256)', [VAULT, allowance]);
      await send('approve manager', USDC, 'approve(address,uint256)', [MANAGER, allowance]);
      await send(`deposit ${amount} USDC`, VAULT, 'deposit(uint256)', [units]);
      console.log('');
      await balances();
    }
  } else if (command === 'sync') {
    const borrowerId = keccak256(stringToBytes(BORROWER_HANDLE));
    await send('syncLimitFromRegistry', MANAGER, 'syncLimitFromRegistry(bytes32)', [borrowerId]);

    const account = await read.readContract({
      address: MANAGER,
      abi: parseAbi([
        'function accountOf(bytes32) view returns ((address owner,address revenueRouter,address operatingWallet,uint256 creditLimit,uint256 principal,uint256 accruedInterest,uint256 repaymentBps,uint256 reserveBps,uint256 riskScore,uint8 tier,uint8 status,uint256 lastAccrualAt,uint256 lastAssessmentAt,bool exists))',
      ]),
      functionName: 'accountOf',
      args: [borrowerId],
    });
    console.log(
      `\nonchain limit ${(Number(account.creditLimit) / 1e6).toFixed(2)} USDC · score ${account.riskScore} · status ${account.status} (2 = ACTIVE)`,
    );
  } else if (command === 'balances') {
    await balances();
  } else {
    console.error('Usage: arc-ops.mjs fund <amount> | sync | balances');
    process.exitCode = 1;
  }
}
