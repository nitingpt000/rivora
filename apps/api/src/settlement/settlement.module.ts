import { Module } from '@nestjs/common';

import { AssessmentModule } from '../assessment/assessment.module';
import { LedgerModule } from '../ledger/ledger.module';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { VaultModule } from '../vault/vault.module';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';

@Module({
  imports: [AssessmentModule, SnapshotModule, LedgerModule, VaultModule],
  controllers: [SettlementController],
  providers: [SettlementService],
})
export class SettlementModule {}
