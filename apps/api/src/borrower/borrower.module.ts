import { Module } from '@nestjs/common';

import { AssessmentModule } from '../assessment/assessment.module';

import { LedgerModule } from '../ledger/ledger.module';
import { BorrowerController, ServiceRegistrationController } from './borrower.controller';
import { BorrowerService } from './borrower.service';

@Module({
  imports: [AssessmentModule, LedgerModule],
  controllers: [BorrowerController, ServiceRegistrationController],
  providers: [BorrowerService],
  exports: [BorrowerService],
})
export class BorrowerModule {}
