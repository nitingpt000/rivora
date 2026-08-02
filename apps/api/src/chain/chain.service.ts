import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The seam between the API's accounting and the chain.
 *
 * Money movement is currently a database write. It has to become a contract
 * call, and the way to get there without rewriting the services is to put the
 * boundary in first: `CreditService` and `VaultService` ask this for a
 * settlement reference, and do not know or care whether one came from Arc or
 * from a counter.
 *
 * Two implementations, chosen by configuration:
 *  - `LedgerChainService` — the default. Deterministic references, no chain.
 *  - `ArcChainService` — broadcasts real transactions. Selected when
 *    `CHAIN_MODE=arc` and the contract addresses are configured.
 *
 * The database-backed implementation is the ledger of record until the chain
 * one is switched on, and both satisfy the same interface — so the swap is a
 * config change, not a rewrite.
 */
export interface SettlementRef {
  /** Transaction hash, or a deterministic stand-in while offchain. */
  txHash: string;
  /** Block the transaction landed in. Null while offchain or unconfirmed. */
  blockNumber: number | null;
  /** True once the chain has confirmed it. Always true offchain. */
  confirmed: boolean;
}

export interface DrawRequest {
  borrowerHandle: string;
  amount: number;
  recipient: string;
}

export interface RepaymentRequest {
  borrowerHandle: string;
  principal: number;
  interest: number;
}

export abstract class ChainService {
  /** Human-readable mode, surfaced by `/health` so it is never a guess. */
  abstract readonly mode: 'ledger' | 'arc';

  abstract fundDraw(request: DrawRequest): Promise<SettlementRef>;
  abstract receiveRepayment(request: RepaymentRequest): Promise<SettlementRef>;
  abstract distributeRevenue(borrowerHandle: string): Promise<SettlementRef>;
}

/**
 * Deterministic transaction hashes.
 *
 * `Math.random()` would make every response differ, which breaks snapshot
 * diffing and makes a screenshot worthless as a record. A counter hashed into
 * hex looks the same to the eye and is reproducible — the same rule the
 * fixtures and the mock backend follow.
 */
function deterministicTxHash(seed: string, seq: number): string {
  let h = 2166136261 >>> 0;
  const input = `${seed}:${seq}`;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const a = h.toString(16).padStart(8, '0').slice(0, 4);
  const b = ((h ^ 0x9e3779b9) >>> 0).toString(16).padStart(8, '0').slice(0, 4);
  return `0x${a}…${b}`;
}

/**
 * The offchain implementation.
 *
 * Records nothing on a chain and returns a reference that is obviously not a
 * real transaction hash — truncated with an ellipsis, exactly as the seeded
 * fixtures are. A stand-in that *looked* like a 32-byte hash would invite
 * somebody to paste it into an explorer and conclude the protocol is broken.
 */
@Injectable()
export class LedgerChainService extends ChainService {
  readonly mode = 'ledger' as const;
  private seq = 0;

  async fundDraw(request: DrawRequest): Promise<SettlementRef> {
    return this.reference(`draw:${request.borrowerHandle}`);
  }

  async receiveRepayment(request: RepaymentRequest): Promise<SettlementRef> {
    return this.reference(`repay:${request.borrowerHandle}`);
  }

  async distributeRevenue(borrowerHandle: string): Promise<SettlementRef> {
    return this.reference(`route:${borrowerHandle}`);
  }

  private reference(seed: string): SettlementRef {
    this.seq += 1;
    return { txHash: deterministicTxHash(seed, this.seq), blockNumber: null, confirmed: true };
  }
}

/**
 * The Arc implementation.
 *
 * Deliberately not wired to a signer yet. Broadcasting requires a key with
 * authority over protocol funds, and where that key lives — a Circle
 * Developer-Controlled Wallet, an HSM, a keeper service — is a decision that
 * has to be made before the code that uses it, not after.
 *
 * Throwing rather than silently falling back: an operator who sets
 * `CHAIN_MODE=arc` believes transactions are being broadcast, and quietly
 * writing to a database instead would be the worst possible outcome.
 */
@Injectable()
export class ArcChainService extends ChainService {
  readonly mode = 'arc' as const;
  private readonly logger = new Logger(ArcChainService.name);

  constructor(config: ConfigService) {
    super();

    /**
     * Fail at boot, not at the first draw.
     *
     * An operator who selects `arc` without deploying the contracts has made a
     * configuration mistake, and the useful moment to tell them is while they
     * are still looking at the deployment — not when a borrower's draw errors
     * an hour later.
     */
    const missing = (
      [
        ['CREDIT_VAULT_ADDRESS', 'creditVaultAddress'],
        ['CREDIT_MANAGER_ADDRESS', 'creditManagerAddress'],
        ['RISK_REGISTRY_ADDRESS', 'riskRegistryAddress'],
      ] as const
    )
      .filter(([, key]) => !config.get<string>(key))
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `CHAIN_MODE=arc requires the deployed contract addresses. Missing: ${missing.join(', ')}. Deploy with \`pnpm --filter @rivora/contracts deploy:arc\`, or set CHAIN_MODE=ledger.`,
      );
    }

    this.logger.warn(
      'CHAIN_MODE=arc is selected but no signer is configured. Money movement will fail until one is.',
    );
  }

  fundDraw(_request: DrawRequest): Promise<SettlementRef> {
    return this.unimplemented('fundDraw');
  }

  receiveRepayment(_request: RepaymentRequest): Promise<SettlementRef> {
    return this.unimplemented('receiveRepayment');
  }

  distributeRevenue(_borrowerHandle: string): Promise<SettlementRef> {
    return this.unimplemented('distributeRevenue');
  }

  private unimplemented(operation: string): Promise<never> {
    return Promise.reject(
      new Error(
        `${operation} cannot be broadcast: no signer is configured for Arc. Set CHAIN_MODE=ledger, or provision a signer and finish ArcChainService.`,
      ),
    );
  }
}
