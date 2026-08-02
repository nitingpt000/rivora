import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service';

/** Global: any module taking a privileged action needs to record it. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
