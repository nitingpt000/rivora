/**
 * The two admin transactions that make CHAIN_MODE=arc functional.
 *
 * The API's signer is a Circle Developer-Controlled Wallet, but granting it
 * authority is deliberately not something the API can do for itself — the
 * admin key lives with a person, not on the machine. This script is that
 * person's one required action, kept to a single run:
 *
 *   1. Grant the Circle wallet UNDERWRITER_ROLE on the risk registry, so the
 *      EIP-712 assessments it signs verify.
 *   2. Register the borrower in the credit manager with the Circle wallet as
 *      owner, so `draw` passes the owner check. On this testnet the Circle
 *      wallet also stands in as operating wallet and revenue router — one
 *      wallet playing the whole borrower treasury, which keeps the demo loop
 *      self-contained. The router slot must be non-zero and no real router
 *      exists yet (backlog item 8).
 *
 * Run it from your own terminal with the admin key in the environment:
 *
 *   ADMIN_PRIVATE_KEY=0x... node apps/api/scripts/arc-grant.mjs
 *
 * The key is read from the environment, used to sign, and never printed or
 * written anywhere. Both steps check the chain first and skip work already
 * done, so re-running is safe.
 */
import { createPublicClient, createWalletClient, http, keccak256, parseAbi, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL = process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.io';
const CHAIN = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const ADMIN = '0xea830ac3972f950F73bb59067dA76ad1273F613c';
const CIRCLE_WALLET = '0xc863804818a7131e46079de5b56e6c5d157603e7';
const REGISTRY = '0x151259fd145bf22289a625169d7c99036ad1b01b';
const MANAGER = '0xeecb677e45e9d53d94af0fc0edbf99a2f94ff5a1';

// The seeded borrower, exactly as the database spells it — the API derives
// the onchain id as keccak256 of this string, so it must match to the byte.
const BORROWER_HANDLE = '0x9c4e…a7f1';
const REPAYMENT_BPS = 2000n;
const RESERVE_BPS = 200n;

const REGISTRY_ABI = parseAbi([
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function grantRole(bytes32 role, address account)',
]);

const MANAGER_ABI = parseAbi([
  'function accountOf(bytes32 borrowerId) view returns ((address owner,address revenueRouter,address operatingWallet,uint256 creditLimit,uint256 principal,uint256 accruedInterest,uint256 repaymentBps,uint256 reserveBps,uint256 riskScore,uint8 tier,uint8 status,uint256 lastAccrualAt,uint256 lastAssessmentAt,bool exists))',
  'function registerBorrower(bytes32 borrowerId, address owner, address revenueRouter, address operatingWallet, uint256 repaymentBps, uint256 reserveBps)',
]);

const key = process.env.ADMIN_PRIVATE_KEY;
if (!key) {
  console.error(
    '\nADMIN_PRIVATE_KEY is not set.\n\n' +
      '  ADMIN_PRIVATE_KEY=0x... node apps/api/scripts/arc-grant.mjs\n\n' +
      'Use the key for the protocol admin address; the script refuses any other.\n',
  );
  process.exitCode = 1;
} else {
  const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`);

  if (account.address.toLowerCase() !== ADMIN.toLowerCase()) {
    console.error(
      `\nThat key controls ${account.address}, not the protocol admin ${ADMIN}.\n` +
        'Refusing to send anything — the wrong key succeeding would be worse than failing.\n',
    );
    process.exitCode = 1;
  } else {
    const transport = http(RPC_URL);
    const read = createPublicClient({ chain: CHAIN, transport });
    const write = createWalletClient({ chain: CHAIN, transport, account });

    const underwriterRole = keccak256(stringToBytes('UNDERWRITER_ROLE'));
    const borrowerId = keccak256(stringToBytes(BORROWER_HANDLE));

    console.log(`\nSigning as protocol admin ${account.address}`);
    console.log(`Borrower "${BORROWER_HANDLE}" → ${borrowerId}\n`);

    // 1 — the underwriter grant.
    const hasRole = await read.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'hasRole',
      args: [underwriterRole, CIRCLE_WALLET],
    });

    if (hasRole) {
      console.log('1. UNDERWRITER_ROLE — already granted, skipping.');
    } else {
      const hash = await write.writeContract({
        address: REGISTRY,
        abi: REGISTRY_ABI,
        functionName: 'grantRole',
        args: [underwriterRole, CIRCLE_WALLET],
      });
      await read.waitForTransactionReceipt({ hash });
      console.log(`1. UNDERWRITER_ROLE granted to the Circle wallet — ${hash}`);
    }

    // 2 — the borrower registration.
    const existing = await read.readContract({
      address: MANAGER,
      abi: MANAGER_ABI,
      functionName: 'accountOf',
      args: [borrowerId],
    });

    if (existing.exists) {
      console.log('2. Borrower — already registered, skipping.');
    } else {
      const hash = await write.writeContract({
        address: MANAGER,
        abi: MANAGER_ABI,
        functionName: 'registerBorrower',
        args: [borrowerId, CIRCLE_WALLET, CIRCLE_WALLET, CIRCLE_WALLET, REPAYMENT_BPS, RESERVE_BPS],
      });
      await read.waitForTransactionReceipt({ hash });
      console.log(`2. Borrower registered, owner = Circle wallet — ${hash}`);
    }

    console.log('\nDone. The API can now be switched to CHAIN_MODE=arc.\n');
  }
}
