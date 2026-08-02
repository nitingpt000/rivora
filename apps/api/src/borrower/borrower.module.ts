import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { BorrowerController, ServiceRegistrationController } from './borrower.controller';
import { BorrowerService } from './borrower.service';

@Module({
  imports: [LedgerModule],
  controllers: [BorrowerController, ServiceRegistrationController],
  providers: [BorrowerService],
  exports: [BorrowerService],
})
export class BorrowerModule {}
