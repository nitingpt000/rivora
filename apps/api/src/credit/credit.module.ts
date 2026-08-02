import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';

@Module({
  imports: [SnapshotModule, LedgerModule],
  controllers: [CreditController],
  providers: [CreditService],
})
export class CreditModule {}
