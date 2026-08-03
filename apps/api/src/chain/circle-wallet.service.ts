import { Logger } from '@nestjs/common';

/**
 * The signing seam under `ArcChainService`.
 *
 * Broadcasting needs a key with authority over protocol funds, and this
 * protocol keeps that key inside a Circle Developer-Controlled Wallet — the
 * API holds an API key and an entity secret, Circle holds the private key,
 * and no key material ever touches this process. Everything above this seam
 * is testable against a fake; everything below it is Circle's SDK.
 */

export interface ContractExecution {
  contractAddress: string;
  /** Solidity signature, e.g. `draw(bytes32,uint256)`. */
  abiFunctionSignature: string;
  /** Parameters in order. Integers as decimal strings; tuples as arrays. */
  abiParameters: (string | number | (string | number)[])[];
}

export interface BroadcastResult {
  txHash: string;
  blockNumber: number | null;
  confirmed: boolean;
}

export abstract class ChainSigner {
  abstract executeContract(execution: ContractExecution): Promise<BroadcastResult>;
  /** EIP-712. `typedData` is the standard four-field payload. */
  abstract signTypedData(typedData: object): Promise<string>;
}

/**
 * Structural view of the Circle SDK client — only the three calls used here.
 * Typed by hand so the fake in the tests and the real client satisfy the same
 * contract without importing the SDK's generated Axios plumbing.
 */
interface CircleWalletsClient {
  createContractExecutionTransaction(input: {
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: (string | number | (string | number)[])[];
    fee: { type: 'level'; config: { feeLevel: 'LOW' | 'MEDIUM' | 'HIGH' } };
  }): Promise<{ data?: { id?: string } }>;
  getTransaction(input: {
    id: string;
    waitForTxHash: true;
    pollingInterval?: number;
  }): Promise<{ data?: { transaction?: { txHash?: string; blockHeight?: number; state?: string } } }>;
  signTypedData(input: {
    walletId: string;
    data: string;
  }): Promise<{ data?: { signature?: string } }>;
}

export class CircleWalletSigner extends ChainSigner {
  private readonly logger = new Logger(CircleWalletSigner.name);
  private client: CircleWalletsClient | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly entitySecret: string,
    private readonly walletId: string,
  ) {
    super();
  }

  async executeContract(execution: ContractExecution): Promise<BroadcastResult> {
    const client = await this.connect();

    const created = await client.createContractExecutionTransaction({
      walletId: this.walletId,
      contractAddress: execution.contractAddress,
      abiFunctionSignature: execution.abiFunctionSignature,
      abiParameters: execution.abiParameters,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    });

    const id = created.data?.id;
    if (!id) {
      throw new Error(
        `Circle accepted ${execution.abiFunctionSignature} but returned no transaction id.`,
      );
    }

    /**
     * Wait for the hash, not for finality. The hash is what the ledger rows
     * record; confirmation is the reconciler's job (backlog item 7), and
     * holding a database transaction open across block confirmation would
     * stall every draw behind Arc's block time.
     */
    const settled = await client.getTransaction({ id, waitForTxHash: true });
    const tx = settled.data?.transaction;
    if (!tx?.txHash) {
      throw new Error(
        `Circle transaction ${id} (${execution.abiFunctionSignature}) reached state ${tx?.state ?? 'unknown'} without a hash.`,
      );
    }

    this.logger.log(`${execution.abiFunctionSignature} broadcast as ${tx.txHash}`);
    return {
      txHash: tx.txHash,
      blockNumber: tx.blockHeight ?? null,
      confirmed: tx.state === 'CONFIRMED' || tx.state === 'COMPLETE',
    };
  }

  async signTypedData(typedData: object): Promise<string> {
    const client = await this.connect();
    const response = await client.signTypedData({
      walletId: this.walletId,
      data: JSON.stringify(typedData),
    });

    const signature = response.data?.signature;
    if (!signature) {
      throw new Error('Circle returned no signature for the typed-data request.');
    }
    return signature;
  }

  /**
   * Imported lazily so ledger mode never loads the SDK — the module costs
   * nothing to deployments that keep money movement in the database.
   */
  private async connect(): Promise<CircleWalletsClient> {
    if (!this.client) {
      const sdk = await import('@circle-fin/developer-controlled-wallets');
      this.client = sdk.initiateDeveloperControlledWalletsClient({
        apiKey: this.apiKey,
        entitySecret: this.entitySecret,
      }) as unknown as CircleWalletsClient;
    }
    return this.client;
  }
}
