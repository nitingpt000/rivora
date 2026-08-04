import { Module } from '@nestjs/common';

import { IngestModule } from '../ingest/ingest.module';
import { X402Controller } from './x402.controller';
import { X402Service } from './x402.service';

/**
 * The demo borrower's paid API, not a protocol surface.
 *
 * Depends on `IngestModule` because a payment it accepts becomes revenue the
 * underwriter reads — through the same path an external indexer would use,
 * rather than a private one that could drift from it.
 */
@Module({
  imports: [IngestModule],
  controllers: [X402Controller],
  providers: [X402Service],
})
export class X402Module {}
