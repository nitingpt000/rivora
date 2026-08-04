import { Module } from '@nestjs/common';

import { AssessmentModule } from '../assessment/assessment.module';
import { LedgerModule } from '../ledger/ledger.module';
import { DetectionModule } from '../risk/detection.module';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

@Module({
  imports: [AssessmentModule, LedgerModule, DetectionModule],
  controllers: [IngestController],
  providers: [IngestService],
})
export class IngestModule {}
