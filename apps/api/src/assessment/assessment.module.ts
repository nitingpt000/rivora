import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { AssessmentService } from './assessment.service';
import { ExplanationService } from './explanation.service';

/**
 * The underwriter, shared.
 *
 * Exported rather than duplicated: the borrower surface explains a limit, the
 * keeper moves it, and an operator can force one. All three go through the
 * same computation so none of them can disagree about what it decided.
 */
@Module({
  imports: [LedgerModule],
  providers: [AssessmentService, ExplanationService],
  exports: [AssessmentService],
})
export class AssessmentModule {}
