import { Module } from '@nestjs/common';

import { AssessmentModule } from '../assessment/assessment.module';
import { LedgerModule } from '../ledger/ledger.module';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

@Module({
  imports: [AssessmentModule, LedgerModule],
  controllers: [RiskController],
  providers: [RiskService],
})
export class RiskModule {}
