import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { dec } from '../common/decimal';
import type {
  AssessmentSubmission,
  DrawRequest,
  RepaymentRequest,
  SettlementRef,
} from './chain.service';
import { ChainService } from './chain.service';
import { ChainSigner, CircleWalletSigner } from './circle-wallet.service';

type Hex = `0x${string}`;

/**
 * `viem` is ESM-only and this app compiles to CommonJS, so it is loaded with
 * a dynamic import and typed structurally — the same treatment `siwe.ts`
 * gives it, for the same reason.
 */
interface ViemModule {
  keccak256(value: Uint8Array): Hex;
  stringToBytes(value: string): Uint8Array;
  createPublicClient(config: { transport: unknown }): {
    readContract(args: {
      address: Hex;
      abi: unknown;
      functionName: string;
      args: readonly unknown[];
    }): Promise<unknown>;
  };
  http(url: string): unknown;
  parseAbi(signatures: readonly string[]): unknown;
}

let viemPromise: Promise<ViemModule> | null = null;

function viem(): Promise<ViemModule> {
  viemPromise ??= import('viem') as unknown as Promise<ViemModule>;
  return viemPromise;
}

/**
 * A borrower's onchain identity — keccak of the handle, the same derivation
 * the contract tests use (`keccak256("quotestream")`). One function so the
 * API and anything reading the contracts can never disagree about it.
 */
export async function borrowerIdFor(handle: string): Promise<Hex> {
  const { keccak256, stringToBytes } = await viem();
  return keccak256(stringToBytes(handle));
}

/** USDC amounts move onchain as 6-decimal integers, never floats. */
export function usdcUnits(amount: number): string {
  return dec(amount).times(1_000_000).toFixed(0);
}

/**
 * Mirrors `Tier` in `RivoraTypes.sol`. An unknown band throws rather than
 * defaulting — submitting the wrong tier index would price a real borrower
 * at the wrong rate.
 */
const TIER_INDEX: Record<string, number> = {
  Prime: 0,
  Strong: 1,
  Standard: 2,
  Restricted: 3,
  Ineligible: 4,
};

/** How long a signed assessment stays submittable. The registry only checks
 * the deadline the underwriter signed; this is that deadline. */
const ASSESSMENT_VALIDITY_SECONDS = 24 * 60 * 60;

/**
 * The Arc implementation, over a Circle Developer-Controlled Wallet.
 *
 * The wallet is the protocol signer: it must be registered as each borrower's
 * `owner` in the Manager (so `draw` passes the owner check) and hold
 * `UNDERWRITER_ROLE` in the registry (so its EIP-712 assessments verify).
 * Granting those is a deployment step, not something this service can do for
 * itself — the admin key deliberately does not live here.
 *
 * Failure stays loud: a method that cannot broadcast throws, and nothing
 * falls back to the database pretending it did. An operator who sets
 * `CHAIN_MODE=arc` believes transactions are being broadcast, and quietly
 * writing to a database instead would be the worst possible outcome.
 */
@Injectable()
export class ArcChainService extends ChainService {
  readonly mode = 'arc' as const;
  private readonly logger = new Logger(ArcChainService.name);

  private readonly managerAddress: string;
  private readonly registryAddress: string;
  private readonly rpcUrl: string;
  private readonly chainId: number;
  private readonly signer: ChainSigner;
  private readonly readNonce: (borrowerId: Hex) => Promise<bigint>;
  private rpc: ReturnType<ViemModule['createPublicClient']> | null = null;

  constructor(
    config: ConfigService,
    signer?: ChainSigner,
    readNonce?: (borrowerId: Hex) => Promise<bigint>,
  ) {
    super();

    /**
     * Fail at boot, not at the first draw.
     *
     * An operator who selects `arc` without deploying the contracts or
     * provisioning the wallet has made a configuration mistake, and the
     * useful moment to tell them is while they are still looking at the
     * deployment — not when a borrower's draw errors an hour later.
     */
    const missing = (
      [
        ['CREDIT_VAULT_ADDRESS', 'creditVaultAddress'],
        ['CREDIT_MANAGER_ADDRESS', 'creditManagerAddress'],
        ['RISK_REGISTRY_ADDRESS', 'riskRegistryAddress'],
        ['CIRCLE_API_KEY', 'circleApiKey'],
        ['CIRCLE_ENTITY_SECRET', 'circleEntitySecret'],
        ['CIRCLE_WALLET_ID', 'circleWalletId'],
      ] as const
    )
      .filter(([, key]) => !config.get<string>(key))
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `CHAIN_MODE=arc requires the deployed contract addresses and the Circle wallet credentials. Missing: ${missing.join(', ')}. Deploy with \`pnpm --filter @rivora/contracts deploy:arc\` and copy the CIRCLE_* values into apps/api/.env, or set CHAIN_MODE=ledger.`,
      );
    }

    this.managerAddress = config.get<string>('creditManagerAddress')!;
    this.registryAddress = config.get<string>('riskRegistryAddress')!;
    this.rpcUrl = config.get<string>('arcRpcUrl')!;
    this.chainId = config.get<number>('chainId')!;

    this.signer =
      signer ??
      new CircleWalletSigner(
        config.get<string>('circleApiKey')!,
        config.get<string>('circleEntitySecret')!,
        config.get<string>('circleWalletId')!,
      );

    this.readNonce = readNonce ?? ((borrowerId) => this.nonceFromRegistry(borrowerId));
  }

  /**
   * `RivoraCreditManager.draw` — funds go to the operating wallet registered
   * onchain, and the caller must be the account owner, which is why the
   * Circle wallet has to be registered as owner for every borrower.
   */
  async fundDraw(request: DrawRequest): Promise<SettlementRef> {
    return this.signer.executeContract({
      contractAddress: this.managerAddress,
      abiFunctionSignature: 'draw(bytes32,uint256)',
      abiParameters: [await borrowerIdFor(request.borrowerHandle), usdcUnits(request.amount)],
    });
  }

  /**
   * `RivoraCreditManager.repay` — pulls USDC from the caller, so the Circle
   * wallet is where routed revenue must sit before settlement runs. The
   * contract does its own interest-first split; it is handed the total.
   */
  async receiveRepayment(request: RepaymentRequest): Promise<SettlementRef> {
    return this.signer.executeContract({
      contractAddress: this.managerAddress,
      abiFunctionSignature: 'repay(bytes32,uint256)',
      abiParameters: [
        await borrowerIdFor(request.borrowerHandle),
        usdcUnits(request.principal + request.interest),
      ],
    });
  }

  /**
   * Not implementable yet, and honest about why: no `RivoraRevenueRouter` is
   * deployed, because whether nanopayment proceeds can settle into one at all
   * is the open Circle question (backlog item 8). Revenue reaches the ledger
   * through `POST /ingest/revenue` until that is answered.
   */
  distributeRevenue(borrowerHandle: string): Promise<SettlementRef> {
    return Promise.reject(
      new Error(
        `distributeRevenue(${borrowerHandle}) has no onchain target: no revenue router is deployed. Gated on the Gateway custody question — see backlog item 8.`,
      ),
    );
  }

  /**
   * Signs the assessment as EIP-712 typed data and submits it to
   * `RivoraRiskRegistry`. The registry accepts the call from anyone — the
   * authority is the signature, which must come from an `UNDERWRITER_ROLE`
   * holder. Here signer and submitter are the same Circle wallet.
   */
  async submitAssessment(request: AssessmentSubmission): Promise<SettlementRef> {
    const tier = TIER_INDEX[request.tier];
    if (tier === undefined) {
      throw new Error(`"${request.tier}" is not a tier the registry knows.`);
    }

    const { keccak256, stringToBytes } = await viem();
    const borrowerId = await borrowerIdFor(request.borrowerHandle);
    const nonce = await this.readNonce(borrowerId);
    const limitUnits = usdcUnits(request.limit);
    const evidenceHash = keccak256(stringToBytes(request.evidence));
    const validUntil = Math.floor(Date.now() / 1000) + ASSESSMENT_VALIDITY_SECONDS;

    const signature = await this.signer.signTypedData({
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        RiskAssessment: [
          { name: 'borrowerId', type: 'bytes32' },
          { name: 'riskScore', type: 'uint256' },
          { name: 'recommendedLimit', type: 'uint256' },
          { name: 'tier', type: 'uint8' },
          { name: 'evidenceHash', type: 'bytes32' },
          { name: 'validUntil', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      primaryType: 'RiskAssessment',
      domain: {
        name: 'RivoraRiskRegistry',
        version: '1',
        chainId: this.chainId,
        verifyingContract: this.registryAddress,
      },
      message: {
        borrowerId,
        riskScore: String(request.score),
        recommendedLimit: limitUnits,
        tier,
        evidenceHash,
        validUntil: String(validUntil),
        nonce: nonce.toString(),
      },
    });

    this.logger.log(
      `submitting assessment for ${request.borrowerHandle}: score ${request.score}, limit ${request.limit.toFixed(2)}, nonce ${nonce}`,
    );

    return this.signer.executeContract({
      contractAddress: this.registryAddress,
      abiFunctionSignature:
        'submitAssessment((bytes32,uint256,uint256,uint8,bytes32,uint256,uint256),bytes)',
      abiParameters: [
        [borrowerId, String(request.score), limitUnits, tier, evidenceHash, String(validUntil), nonce.toString()],
        signature,
      ],
    });
  }

  /**
   * The registry's per-borrower nonce, read over plain RPC. Read fresh per
   * submission rather than counted locally — the registry accepts submissions
   * from anyone with a valid signature, so its counter is the only truth.
   */
  private async nonceFromRegistry(borrowerId: Hex): Promise<bigint> {
    const v = await viem();
    this.rpc ??= v.createPublicClient({ transport: v.http(this.rpcUrl) });
    const nonce = await this.rpc.readContract({
      address: this.registryAddress as Hex,
      abi: v.parseAbi(['function nonces(bytes32) view returns (uint256)']),
      functionName: 'nonces',
      args: [borrowerId],
    });
    return nonce as bigint;
  }
}
