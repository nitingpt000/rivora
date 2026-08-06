import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { WebhookModule } from '../webhook/webhook.module';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';

@Module({
  imports: [SnapshotModule, LedgerModule, WebhookModule],
  controllers: [CreditController],
  providers: [CreditService],
})
export class CreditModule {}
