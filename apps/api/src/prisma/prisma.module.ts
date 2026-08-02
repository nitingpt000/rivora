import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global so feature modules inject `PrismaService` without each re-importing
 * this one. The database is genuinely cross-cutting; making every module
 * declare it would be ceremony, not architecture.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
