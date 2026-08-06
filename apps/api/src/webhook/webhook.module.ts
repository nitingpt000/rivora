import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WebhookController } from './webhook.controller';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookEmitter } from './webhook-emitter.service';
import { WebhookService } from './webhook.service';

/**
 * Outbound webhooks. PRD §27.
 *
 * Split the way the chain layer is: `WebhookEmitter` is the seam the domain
 * services call inside their transactions, and the dispatcher is a
 * background loop that drains what they wrote. Only the emitter is exported
 * — no domain service has any business talking to a receiver directly.
 */
@Module({
  imports: [AuditModule, LedgerModule],
  controllers: [WebhookController],
  providers: [WebhookEmitter, WebhookDispatcherService, WebhookService],
  exports: [WebhookEmitter],
})
export class WebhookModule {}
