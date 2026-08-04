import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LedgerModule } from '../ledger/ledger.module';
import { ArcChainService } from './arc-chain.service';
import { ChainService, LedgerChainService } from './chain.service';
import { IndexerService } from './indexer.service';

/**
 * Binds the chain seam to one implementation, chosen by configuration.
 *
 * Global because every money-moving service needs it and none should import a
 * concrete implementation — the point of the abstraction is that `CreditService`
 * cannot tell which one it has.
 */
@Global()
@Module({
  imports: [LedgerModule],
  providers: [
    {
      provide: ChainService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ChainService =>
        config.get<string>('chainMode') === 'arc'
          ? new ArcChainService(config)
          : new LedgerChainService(),
    },
    // Registered in every mode; it starts polling only in arc mode. The
    // provider existing offchain keeps /health's shape stable.
    IndexerService,
  ],
  exports: [ChainService, IndexerService],
})
export class ChainModule {}
