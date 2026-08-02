import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

@Module({
  imports: [LedgerModule],
  controllers: [RiskController],
  providers: [RiskService],
})
export class RiskModule {}
