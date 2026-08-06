import { Module } from '@nestjs/common';

import { AssessmentModule } from '../assessment/assessment.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WebhookModule } from '../webhook/webhook.module';
import { DetectionModule } from './detection.module';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

@Module({
  imports: [AssessmentModule, LedgerModule, DetectionModule, WebhookModule],
  controllers: [RiskController],
  providers: [RiskService],
})
export class RiskModule {}
