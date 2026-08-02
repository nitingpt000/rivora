import { Module } from '@nestjs/common';

import { PublicService } from '../public/public.service';
import { PartnerController } from './partner.controller';
import { SandboxService } from './sandbox.service';

@Module({
  controllers: [PartnerController],
  providers: [PublicService, SandboxService],
})
export class PartnerModule {}
