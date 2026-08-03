import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { ArcChainService, borrowerIdFor, usdcUnits } from './arc-chain.service';
import { LedgerChainService } from './chain.service';
import type { BroadcastResult, ContractExecution } from './circle-wallet.service';
import { ChainSigner } from './circle-wallet.service';

const MANAGER = '0x00000000000000000000000000000000000000aa';
const REGISTRY = '0x00000000000000000000000000000000000000bb';

/**
 * What the tests pin down is the wire format: the calldata Circle is asked to
 * broadcast and the typed data it is asked to sign. Those are the two places
 * where this service and the deployed Solidity can silently disagree — the
 * contract's own behaviour is Foundry's job.
 */
class FakeSigner extends ChainSigner {
  executions: ContractExecution[] = [];
  typedData: Record<string, unknown>[] = [];

  async executeContract(execution: ContractExecution): Promise<BroadcastResult> {
    this.executions.push(execution);
    return { txHash: '0xabc123', blockNumber: 42, confirmed: false };
  }

  async signTypedData(typedData: object): Promise<string> {
    this.typedData.push(typedData as Record<string, unknown>);
    return '0xsigned';
  }
}

function config(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    creditVaultAddress: '0x00000000000000000000000000000000000000cc',
    creditManagerAddress: MANAGER,
    riskRegistryAddress: REGISTRY,
    circleApiKey: 'key',
    circleEntitySecret: 'secret',
    circleWalletId: 'wallet-1',
    chainId: 5042002,
    arcRpcUrl: 'https://rpc.testnet.arc.io',
    ...overrides,
  };
  return { get: (key: string) => values[key] } as ConfigService;
}

function build() {
  const signer = new FakeSigner();
  const service = new ArcChainService(config(), signer, async () => 7n);
  return { service, signer };
}

describe('borrowerIdFor', () => {
  it('matches the contract-test derivation: keccak256 of the raw handle', async () => {
    // The exact value `keccak256("quotestream")` yields in the Foundry suite.
    // Pinned as a constant so a drift in derivation (hex encoding, trimming,
    // casing) fails here rather than as an onchain UnknownBorrower.
    expect(await borrowerIdFor('quotestream')).toBe(
      '0x8bfa34ff9736d791991983d4810bb151d007995847b16bd805894f7cbaa86f5a',
    );
    expect(await borrowerIdFor('quotestream')).not.toBe(await borrowerIdFor('other'));
  });
});

describe('usdcUnits', () => {
  it('converts USDC to 6-decimal integer strings without float drift', () => {
    expect(usdcUnits(1)).toBe('1000000');
    expect(usdcUnits(253.17)).toBe('253170000');
    // The classic float trap: 0.1 + 0.2 style inputs must still be exact.
    expect(usdcUnits(19.99)).toBe('19990000');
    expect(usdcUnits(0)).toBe('0');
  });
});

describe('ArcChainService boot', () => {
  it('refuses to construct without the Circle credentials, naming them', () => {
    expect(
      () => new ArcChainService(config({ circleApiKey: '', circleWalletId: '' })),
    ).toThrow(/CIRCLE_API_KEY, CIRCLE_WALLET_ID/);
  });

  it('refuses to construct without the contract addresses', () => {
    expect(() => new ArcChainService(config({ creditManagerAddress: '' }))).toThrow(
      /CREDIT_MANAGER_ADDRESS/,
    );
  });
});

describe('fundDraw', () => {
  it('calls Manager.draw with the borrower id and a 6-decimal amount', async () => {
    const { service, signer } = build();

    const ref = await service.fundDraw({
      borrowerHandle: 'quotestream',
      amount: 1_500.5,
      recipient: '0xoperating',
    });

    expect(signer.executions).toEqual([
      {
        contractAddress: MANAGER,
        abiFunctionSignature: 'draw(bytes32,uint256)',
        abiParameters: [await borrowerIdFor('quotestream'), '1500500000'],
      },
    ]);
    expect(ref.txHash).toBe('0xabc123');
  });
});

describe('receiveRepayment', () => {
  it('hands Manager.repay the principal and interest as one total', async () => {
    const { service, signer } = build();

    await service.receiveRepayment({
      borrowerHandle: 'quotestream',
      principal: 200.1,
      interest: 30.02,
    });

    expect(signer.executions[0]!.abiFunctionSignature).toBe('repay(bytes32,uint256)');
    expect(signer.executions[0]!.abiParameters).toEqual([
      await borrowerIdFor('quotestream'),
      '230120000',
    ]);
  });
});

describe('distributeRevenue', () => {
  it('refuses: no revenue router is deployed', async () => {
    const { service } = build();
    await expect(service.distributeRevenue('quotestream')).rejects.toThrow(
      /no revenue router is deployed/,
    );
  });
});

describe('submitAssessment', () => {
  const request = {
    borrowerHandle: 'quotestream',
    score: 72,
    limit: 2_400,
    tier: 'Standard',
    evidence: '{"model":"riv-uw-2.1"}',
  };

  it('signs typed data the registry domain will verify', async () => {
    const { service, signer } = build();
    await service.submitAssessment(request);

    const typed = signer.typedData[0] as {
      domain: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    };

    expect(typed.primaryType).toBe('RiskAssessment');
    expect(typed.domain).toEqual({
      name: 'RivoraRiskRegistry',
      version: '1',
      chainId: 5042002,
      verifyingContract: REGISTRY,
    });
    expect(typed.message.borrowerId).toBe(await borrowerIdFor('quotestream'));
    expect(typed.message.riskScore).toBe('72');
    expect(typed.message.recommendedLimit).toBe('2400000000');
    // Standard is index 2 in RivoraTypes.sol's Tier enum.
    expect(typed.message.tier).toBe(2);
    // The nonce the fake registry reported, not a local counter.
    expect(typed.message.nonce).toBe('7');
    expect(typed.message.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(Number(typed.message.validUntil)).toBeGreaterThan(Date.now() / 1000);
  });

  it('submits the signed tuple to the registry', async () => {
    const { service, signer } = build();
    await service.submitAssessment(request);

    const execution = signer.executions[0]!;
    expect(execution.contractAddress).toBe(REGISTRY);
    expect(execution.abiFunctionSignature).toBe(
      'submitAssessment((bytes32,uint256,uint256,uint8,bytes32,uint256,uint256),bytes)',
    );

    const [tuple, signature] = execution.abiParameters as [(string | number)[], string];
    expect(signature).toBe('0xsigned');
    expect(tuple).toEqual([
      await borrowerIdFor('quotestream'),
      '72',
      '2400000000',
      2,
      tuple[4], // evidenceHash, asserted by shape above
      tuple[5], // validUntil, time-dependent
      '7',
    ]);
  });

  it('rejects a tier the registry does not know rather than guessing', async () => {
    const { service } = build();
    await expect(service.submitAssessment({ ...request, tier: 'Platinum' })).rejects.toThrow(
      /not a tier the registry knows/,
    );
  });
});

describe('LedgerChainService.submitAssessment', () => {
  it('returns an obviously-offchain confirmed stand-in', async () => {
    const ref = await new LedgerChainService().submitAssessment({
      borrowerHandle: 'quotestream',
      score: 72,
      limit: 2_400,
      tier: 'Standard',
      evidence: '{}',
    });

    expect(ref.confirmed).toBe(true);
    expect(ref.blockNumber).toBeNull();
    expect(ref.txHash).toContain('…');
  });
});
