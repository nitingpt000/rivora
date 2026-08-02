import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ApiErrorDto } from '../contracts/operations.dto';
import {
  AuthTokenResponseDto,
  NonceRequestDto,
  NonceResponseDto,
  SessionUserDto,
  VerifyRequestDto,
} from './auth.dto';
import { CurrentUser, Public } from './auth.decorators';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('nonce')
  @Public()
  @HttpCode(HttpStatus.OK)
  // Tighter than the global limit. Each call writes a row, so an unthrottled
  // endpoint is a free way to grow the table.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request a sign-in challenge',
    description:
      'Returns a single-use nonce to embed in an EIP-4361 message. Nonces expire after five minutes and are consumed on first successful verification, so a captured message cannot be replayed.',
  })
  @ApiOkResponse({ type: NonceResponseDto })
  @ApiTooManyRequestsResponse({ type: ApiErrorDto, description: '10 requests per minute.' })
  nonce(@Body() body: NonceRequestDto): Promise<NonceResponseDto> {
    return this.auth.issueNonce(body.address);
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Exchange a signed message for a session token',
    description: [
      'Verifies an EIP-4361 signature and issues a JWT. The message must carry a nonce from `/auth/nonce`, name a domain this API accepts, and target the configured chain.',
      '',
      'A wallet that has registered nothing still receives a valid token, with a null role — that is a new user, not a failure.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description:
      'Signature did not verify (`invalid_signature`), or the nonce was unknown, reused or expired (`invalid_nonce`).',
  })
  verify(@Body() body: VerifyRequestDto): Promise<AuthTokenResponseDto> {
    return this.auth.verify(body.message, body.signature, {
      domains: this.config.get<string[]>('siweDomains') ?? [],
      chainId: this.config.get<number>('chainId') ?? 0,
      ttlSeconds: this.config.get<number>('jwtTtlSeconds') ?? 3600,
    });
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Read the current session',
    description: 'Resolves the role fresh rather than trusting the token, so a grant or revocation takes effect without re-signing.',
  })
  @ApiOkResponse({ type: SessionUserDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  me(@CurrentUser() user: SessionUserDto): Promise<SessionUserDto> {
    return this.auth.resolve(user.address);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'End the session',
    description:
      'Provided for symmetry and for clients that want an explicit end. Tokens are stateless and self-expiring, so the client must discard its copy — this call cannot invalidate one that has already been handed out. Short token lifetimes are what bound the exposure.',
  })
  logout(): void {
    // Intentionally empty. See the description above: a revocation list is the
    // honest fix, and is deliberately not pretended at here.
  }
}
