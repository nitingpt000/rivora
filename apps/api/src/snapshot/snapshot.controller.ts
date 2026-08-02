import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../contracts/operations.dto';
import { ProtocolSnapshotDto } from '../contracts/snapshot.dto';
import { SnapshotService } from './snapshot.service';

@ApiTags('protocol')
@ApiBearerAuth('bearer')
@Controller()
export class SnapshotController {
  constructor(private readonly snapshots: SnapshotService) {}

  @Get('snapshot')
  @ApiOperation({
    summary: 'Read all protocol state',
    description: [
      'One consistent read of the borrower position, revenue, health, vault, LP position and the event and alert streams. The surfaces share a moment in time rather than each fetching their own slice, so two screens can never disagree about utilization.',
      '',
      '**Requires authentication.** This carries individual positions — a named borrower’s outstanding balance and the LP’s wallet balance. For aggregate protocol health with no position data, use the public `/protocol/stats`.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: ProtocolSnapshotDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  getSnapshot(): Promise<ProtocolSnapshotDto> {
    return this.snapshots.getSnapshot();
  }
}
