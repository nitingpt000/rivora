import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';

@Module({
  imports: [SnapshotModule, LedgerModule],
  controllers: [VaultController],
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}
