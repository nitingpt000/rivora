import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';

import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The reconciler. Once money moves onchain, the database is a read model of
 * the chain, and this is the process that keeps the claim honest: it reads
 * every event the deployed contracts emit, records each one, and compares
 * the money movements against the ledger by transaction hash.
 *
 * A divergence is an alarm, never a silent patch — in either direction:
 *
 *  - An onchain money event no ledger row carries: something moved value
 *    without the API recording it (an out-of-band transaction, or a write
 *    that failed after its broadcast succeeded).
 *  - A ledger row whose real-looking hash never appears onchain: the API
 *    recorded a movement the chain never confirmed (a dropped transaction,
 *    or a reorg).
 *
 * Polling rather than a websocket subscription, because the public RPC is
 * rate-limited and offers no subscription guarantees — one `getLogs` per
 * tick is the entire read budget. The `ChainSync` cursor advances in the
 * same database transaction that records the events, so a crash between
 * batches resumes exactly where it stopped rather than replaying or
 * skipping; replayed logs are absorbed by the `(txHash, logIndex)` unique
 * key regardless.
 */

/** One decoded log, however it was fetched. The seam the tests fake. */
export interface ObservedLog {
  blockNumber: bigint;
  logIndex: number;
  txHash: string;
  address: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ChainLogSource {
  latestBlock(): Promise<bigint>;
  logs(fromBlock: bigint, toBlock: bigint): Promise<ObservedLog[]>;
}

/**
 * Everything the deployed contracts can say. Kept in one place so a new
 * event added in Solidity has exactly one line to add here.
 */
const EVENT_ABI = [
  // RivoraCreditVault
  'event Deposited(address indexed owner, uint256 assets, uint256 shares)',
  'event Withdrawn(address indexed owner, uint256 assets, uint256 shares, uint256 fee, uint256 queued)',
  'event DrawFunded(bytes32 indexed borrowerId, address indexed recipient, uint256 amount)',
  'event RepaymentReceived(bytes32 indexed borrowerId, uint256 principal, uint256 interest)',
  'event LossRecorded(bytes32 indexed borrowerId, uint256 amount)',
  'event QueueEntryFunded(uint256 indexed index, uint256 amount)',
  'event QueueEntryClaimed(uint256 indexed index, address indexed owner, uint256 amount)',
  // RivoraCreditManager
  'event BorrowerRegistered(bytes32 indexed borrowerId, address indexed owner, address router)',
  'event LimitUpdated(bytes32 indexed borrowerId, uint256 previousLimit, uint256 newLimit, uint256 riskScore)',
  'event Drawn(bytes32 indexed borrowerId, uint256 amount, address recipient)',
  'event Repaid(bytes32 indexed borrowerId, uint256 amount, uint256 toInterest, uint256 toPrincipal, bool cleared)',
  'event InterestAccrued(bytes32 indexed borrowerId, uint256 amount, uint256 elapsed)',
  'event StatusChanged(bytes32 indexed borrowerId, uint8 previous, uint8 current, string reason)',
  // RivoraRiskRegistry
  'event AssessmentRecorded(bytes32 indexed borrowerId, address indexed underwriter, uint256 riskScore, uint256 recommendedLimit, bytes32 evidenceHash, uint256 nonce)',
];

/**
 * Events that mean value moved or a permanent record was written — the ones
 * whose absence from the ledger is a divergence. The rest are bookkeeping
 * the contracts narrate along the way; they are stored for audit but a
 * missing ledger row for them is not an alarm.
 */
const MONEY_EVENTS = new Set([
  'Deposited',
  'Withdrawn',
  'DrawFunded',
  'RepaymentReceived',
  'LossRecorded',
  'QueueEntryClaimed',
  'Drawn',
  'Repaid',
  'AssessmentRecorded',
]);

/** A hash the chain could actually know — not a ledger-mode stand-in. */
const REAL_HASH = /^0x[0-9a-f]{64}$/;

/** Blocks fetched per tick, bounding the getLogs response. */
const CHUNK = 10_000n;

/** How long a ledger row's hash may stay unseen before it is a divergence.
 * Covers broadcast-to-inclusion latency plus one full indexer lag. */
const GRACE_MS = 5 * 60 * 1000;

/** How far back the reverse check looks. Older rows have had their chance
 * to alarm; re-scanning all history every tick would grow without bound. */
const REVERSE_WINDOW_MS = 24 * 60 * 60 * 1000;

const DIVERGENCE_ONCHAIN = 'Onchain event with no ledger record';
const DIVERGENCE_LEDGER = 'Ledger record with no onchain event';

interface ViemLogsModule {
  createPublicClient(config: { transport: unknown }): {
    getBlockNumber(): Promise<bigint>;
    getLogs(args: {
      address: `0x${string}`[];
      events: unknown;
      fromBlock: bigint;
      toBlock: bigint;
    }): Promise<
      {
        blockNumber: bigint;
        logIndex: number;
        transactionHash: string;
        address: string;
        eventName: string;
        args: Record<string, unknown>;
      }[]
    >;
  };
  http(url: string): unknown;
  parseAbi(signatures: readonly string[]): unknown;
}

class RpcLogSource implements ChainLogSource {
  private client: ReturnType<ViemLogsModule['createPublicClient']> | null = null;
  private abi: unknown;
  private module: ViemLogsModule | null = null;

  constructor(
    private readonly rpcUrl: string,
    private readonly addresses: `0x${string}`[],
  ) {}

  async latestBlock(): Promise<bigint> {
    return (await this.connect()).getBlockNumber();
  }

  async logs(fromBlock: bigint, toBlock: bigint): Promise<ObservedLog[]> {
    const client = await this.connect();
    const raw = await client.getLogs({
      address: this.addresses,
      events: this.abi,
      fromBlock,
      toBlock,
    });
    return raw.map((log) => ({
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      txHash: log.transactionHash.toLowerCase(),
      address: log.address.toLowerCase(),
      name: log.eventName,
      args: log.args,
    }));
  }

  private async connect() {
    if (!this.client) {
      this.module = (await import('viem')) as unknown as ViemLogsModule;
      this.abi = this.module.parseAbi(EVENT_ABI);
      this.client = this.module.createPublicClient({
        transport: this.module.http(this.rpcUrl),
      });
    }
    return this.client;
  }
}

@Injectable()
export class IndexerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(IndexerService.name);
  private readonly enabled: boolean;
  private readonly fromBlock: bigint | null;
  private readonly intervalMs: number;
  private readonly source: ChainLogSource;

  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastSeenLatest: bigint | null = null;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    // The test seam. Nest never provides one — the token exists so a spec
    // can hand in a fake without a network.
    @Optional() @Inject('CHAIN_LOG_SOURCE') source?: ChainLogSource,
  ) {
    this.enabled = config.get<string>('chainMode') === 'arc';
    const configured = config.get<number | null>('arcIndexerFromBlock');
    this.fromBlock = configured != null ? BigInt(configured) : null;
    this.intervalMs = config.get<number>('arcIndexerIntervalMs') ?? 15_000;

    this.source =
      source ??
      new RpcLogSource(config.get<string>('arcRpcUrl') ?? 'https://rpc.testnet.arc.io', [
        config.get<string>('creditVaultAddress') as `0x${string}`,
        config.get<string>('creditManagerAddress') as `0x${string}`,
        config.get<string>('riskRegistryAddress') as `0x${string}`,
      ]);
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.safeTick(), this.intervalMs);
    void this.safeTick();
    this.logger.log(`indexing every ${this.intervalMs}ms`);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** What /health reports. Strings because bigint does not survive JSON. */
  async snapshot(): Promise<{ enabled: boolean; lastBlock: string | null; latest: string | null }> {
    if (!this.enabled) return { enabled: false, lastBlock: null, latest: null };
    const sync = await this.prisma.chainSync.findUnique({ where: { id: 'singleton' } });
    return {
      enabled: true,
      lastBlock: sync ? String(sync.lastBlock) : null,
      latest: this.lastSeenLatest === null ? null : String(this.lastSeenLatest),
    };
  }

  private async safeTick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.tick();
    } catch (cause) {
      // The next tick retries from the same cursor. Persistent failure is a
      // stream of these lines, which is exactly what it should look like.
      this.logger.error(`indexing tick failed: ${String(cause)}`);
    } finally {
      this.running = false;
    }
  }

  /** One indexing pass. Public for the tests; the timer is just a caller. */
  async tick(): Promise<void> {
    const latest = await this.source.latestBlock();
    this.lastSeenLatest = latest;

    let sync = await this.prisma.chainSync.findUnique({ where: { id: 'singleton' } });
    if (!sync) {
      /**
       * First run. With no configured start, begin at the tip: silently
       * indexing an unbounded past on a rate-limited RPC would never catch
       * up, and the operator who wants history states where it starts.
       */
      const lastBlock = this.fromBlock !== null ? this.fromBlock - 1n : latest;
      sync = await this.prisma.chainSync.create({ data: { id: 'singleton', lastBlock } });
      this.logger.log(`cursor initialised at block ${lastBlock}`);
    }

    const from = sync.lastBlock + 1n;
    if (from <= latest) {
      const to = from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest;
      const logs = await this.source.logs(from, to);
      await this.record(logs, to);
      if (logs.length > 0) {
        this.logger.log(`blocks ${from}–${to}: ${logs.length} event(s)`);
      }
    }

    // Only when caught up: judging a ledger row against a chain view that is
    // known to be behind would raise false alarms about the gap itself.
    if (from + CHUNK > latest) {
      await this.reverseCheck();
    }
  }

  /**
   * Records a batch and advances the cursor in one transaction — a crash
   * leaves either both or neither, so the resume point is always truthful.
   */
  private async record(logs: ObservedLog[], to: bigint): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const log of logs) {
        const money = MONEY_EVENTS.has(log.name);
        let reconciled = 'recorded';
        if (money) {
          const row = await tx.activityEvent.findFirst({
            where: { txHash: log.txHash },
            select: { id: true },
          });
          reconciled = row ? 'matched' : 'unmatched';
        }

        const created = await tx.chainEvent
          .create({
            data: {
              blockNumber: log.blockNumber,
              logIndex: log.logIndex,
              txHash: log.txHash,
              address: log.address,
              name: log.name,
              args: serialisable(log.args),
              reconciled,
            },
          })
          .catch((cause: { code?: string }) => {
            // Unique (txHash, logIndex) — a replayed log after a partial
            // failure. Already recorded, already judged; nothing to redo.
            if (cause.code === 'P2002') return null;
            throw cause;
          });

        if (created && reconciled === 'unmatched') {
          this.logger.error(
            `onchain ${log.name} in ${log.txHash} has no ledger record — value moved without the API recording it`,
          );
          await this.ledger.recordAlert(tx, {
            icon: '⚠',
            title: DIVERGENCE_ONCHAIN,
            body: `${log.name} in block ${log.blockNumber}. Either an out-of-band transaction or a ledger write that failed after its broadcast succeeded.`,
            txHash: log.txHash,
          });
        }
      }

      await tx.chainSync.update({ where: { id: 'singleton' }, data: { lastBlock: to } });
    });
  }

  /**
   * The other direction: ledger rows whose real-looking hash the chain has
   * never shown us. Alerted once per hash — the divergence does not become
   * more true by being repeated every fifteen seconds.
   */
  private async reverseCheck(): Promise<void> {
    const now = Date.now();
    const candidates = await this.prisma.activityEvent.findMany({
      where: { at: { gte: new Date(now - REVERSE_WINDOW_MS), lte: new Date(now - GRACE_MS) } },
      select: { txHash: true },
      distinct: ['txHash'],
    });

    for (const { txHash } of candidates) {
      if (!REAL_HASH.test(txHash)) continue;

      const seen = await this.prisma.chainEvent.findFirst({
        where: { txHash },
        select: { id: true },
      });
      if (seen) continue;

      const alreadyAlerted = await this.prisma.alert.findFirst({
        where: { txHash, title: DIVERGENCE_LEDGER },
        select: { id: true },
      });
      if (alreadyAlerted) continue;

      this.logger.error(
        `ledger row ${txHash} has no onchain event — the chain never confirmed a movement the API recorded`,
      );
      await this.ledger.recordAlert(this.prisma, {
        icon: '⚠',
        title: DIVERGENCE_LEDGER,
        body: 'The transaction was recorded in the ledger but has not appeared onchain. A dropped broadcast or a reorg.',
        txHash,
      });
    }
  }
}

/** Prisma's Json column cannot hold bigint; decoded args often do. */
function serialisable(args: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [
      key,
      typeof value === 'bigint' ? value.toString() : (value as Prisma.InputJsonValue),
    ]),
  );
}
