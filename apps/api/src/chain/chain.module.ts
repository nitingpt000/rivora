import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ArcChainService, ChainService, LedgerChainService } from './chain.service';

/**
 * Binds the chain seam to one implementation, chosen by configuration.
 *
 * Global because every money-moving service needs it and none should import a
 * concrete implementation — the point of the abstraction is that `CreditService`
 * cannot tell which one it has.
 */
@Global()
@Module({
  providers: [
    {
      provide: ChainService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ChainService =>
        config.get<string>('chainMode') === 'arc'
          ? new ArcChainService(config)
          : new LedgerChainService(),
    },
  ],
  exports: [ChainService],
})
export class ChainModule {}
