import { Module } from '@nestjs/common';

import { PublicService } from '../public/public.service';
import { PartnerConsoleController } from './console.controller';
import { PartnerController } from './partner.controller';
import { SandboxService } from './sandbox.service';
import { UsageService } from './usage.service';

@Module({
  controllers: [PartnerController, PartnerConsoleController],
  providers: [PublicService, SandboxService, UsageService],
})
export class PartnerModule {}
