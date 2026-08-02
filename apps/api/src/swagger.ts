import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * The OpenAPI description.
 *
 * Built in one place and used twice: served at `/docs` by the running app, and
 * written to `openapi.json` by the export script. Two builders would drift,
 * and the exported file is what client generators consume.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Rivora Protocol API')
    .setDescription(
      [
        'Credit underwritten from verifiable machine revenue.',
        '',
        'The backend behind the four Rivora surfaces — borrower, liquidity provider, risk operator and partner.',
        '',
        '## Authentication',
        '',
        'Sign-In With Ethereum (EIP-4361), in three calls:',
        '',
        '1. `POST /auth/nonce` with your address → a single-use challenge.',
        '2. Sign an EIP-4361 message containing that nonce with your wallet.',
        '3. `POST /auth/verify` with the message and signature → a JWT.',
        '',
        'Send the token as `Authorization: Bearer <token>`. Signatures are checked against the address in the message, the domain is pinned to origins this API serves, and the nonce is consumed on first use — so a signature captured elsewhere cannot be replayed here.',
        '',
        'Partner services authenticate instead with an API key in `x-api-key`. Only the hash of a key is stored.',
        '',
        '## Authorization',
        '',
        'Every route requires a session unless marked otherwise. Roles are enforced server-side:',
        '',
        '| Role | May reach |',
        '| --- | --- |',
        '| `borrower` | Its own revenue, credit, custody, policy, reserve and alerts |',
        '| `lp` | Vault portfolio, performance and money movement |',
        '| `ops` | Cross-borrower risk views, default declaration, settlement |',
        '| `partner` | The Score API, by API key |',
        '',
        'Borrower routes resolve the record from the *session*, never from a path parameter — there is no `/borrowers/:id`, because an endpoint that takes an id is one somebody will eventually call with someone else’s.',
        '',
        '## Conventions',
        '',
        '**Money.** Every amount is USDC to six decimal places, carried as a JSON number. Values are stored as exact decimals and rounded once, at this boundary.',
        '',
        '**Refusals.** A well-formed request the protocol declines returns `422` with a `code` for branching and a message written to be shown to a person. A malformed one returns `400`. Every error body is `{ error, code, statusCode, requestId }`.',
        '',
        '**Mutations return the whole snapshot,** not a patch, so a client either holds the server’s state or knows the call failed.',
        '',
        '**Retries.** Money mutations accept an `Idempotency-Key` header. A retry with the same key replays the first response instead of moving money twice.',
        '',
        '**Rate limits.** 120 requests per minute per IP by default; auth endpoints allow 10, the partner Score API 60. Exceeding a limit returns `429`.',
        '',
        '**Tracing.** Every response carries `x-request-id`. Quote it when reporting a problem — it appears in the error body and in the server log.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addTag('auth', 'Sign-In With Ethereum and session management')
    .addTag('public', 'Readable without a wallet')
    .addTag('protocol', 'Full protocol state')
    .addTag('borrower', 'A borrower’s own record')
    .addTag('credit', 'Borrower money movement')
    .addTag('vault', 'Liquidity-provider money movement')
    .addTag('risk', 'Risk-operator console')
    .addTag('partner', 'Score API, authenticated by API key')
    .addTag('settlement', 'Keeper operations')
    .addTag('health', 'Liveness and readiness')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'A token from `POST /auth/verify`.',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Partner API key. Requires the `score:read` scope.',
      },
      'api-key',
    )
    .addServer('http://localhost:4000', 'Local')
    .build();

  return SwaggerModule.createDocument(app, config);
}
