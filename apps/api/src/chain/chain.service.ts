import { Injectable } from '@nestjs/common';

/**
 * The seam between the API's accounting and the chain.
 *
 * `CreditService`, `SettlementService` and `AssessmentService` ask this for a
 * settlement reference, and do not know or care whether one came from Arc or
 * from a counter.
 *
 * Two implementations, chosen by configuration:
 *  - `LedgerChainService` — the default. Deterministic references, no chain.
 *  - `ArcChainService` — broadcasts through a Circle Developer-Controlled
 *    Wallet. Selected when `CHAIN_MODE=arc`, and refuses to boot without the
 *    contract addresses and Circle credentials.
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
  /**
   * Where the borrower expects the funds. Advisory on Arc: the Manager pays
   * the operating wallet registered onchain, and if the two disagree the
   * registration is what wins — by design, not by accident.
   */
  recipient: string;
}

export interface RepaymentRequest {
  borrowerHandle: string;
  principal: number;
  interest: number;
}

export interface AssessmentSubmission {
  borrowerHandle: string;
  /** Composite score, 0–100. The registry rejects anything above 100. */
  score: number;
  /** Recommended limit in USDC. */
  limit: number;
  /** Score band name — Prime, Strong, Standard, Restricted or Ineligible. */
  tier: string;
  /**
   * The evidence bundle, canonicalised. Only its hash goes onchain; the
   * bundle itself is the caller's to retain, and the hash is what makes a
   * retained copy tamper-evident.
   */
  evidence: string;
}

export abstract class ChainService {
  /** Human-readable mode, surfaced by `/health` so it is never a guess. */
  abstract readonly mode: 'ledger' | 'arc';

  abstract fundDraw(request: DrawRequest): Promise<SettlementRef>;
  abstract receiveRepayment(request: RepaymentRequest): Promise<SettlementRef>;
  abstract distributeRevenue(borrowerHandle: string): Promise<SettlementRef>;
  /** Records a signed assessment in the onchain risk registry. */
  abstract submitAssessment(request: AssessmentSubmission): Promise<SettlementRef>;
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

  async submitAssessment(request: AssessmentSubmission): Promise<SettlementRef> {
    return this.reference(`assess:${request.borrowerHandle}`);
  }

  private reference(seed: string): SettlementRef {
    this.seq += 1;
    return { txHash: deterministicTxHash(seed, this.seq), blockNumber: null, confirmed: true };
  }
}
