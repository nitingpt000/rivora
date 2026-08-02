import { Module } from '@nestjs/common';

import { SnapshotModule } from '../snapshot/snapshot.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [SnapshotModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
