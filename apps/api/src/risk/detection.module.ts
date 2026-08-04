import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { DetectionService } from './detection.service';

/**
 * Separate from `RiskModule` because ingestion needs the detector and the
 * risk console needs it too — importing `RiskModule` from `IngestModule`
 * would pull in the whole operator surface and its controller to reach one
 * service.
 */
@Module({
  imports: [LedgerModule],
  providers: [DetectionService],
  exports: [DetectionService],
})
export class DetectionModule {}
