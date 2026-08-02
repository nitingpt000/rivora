# @rivora/api

The protocol backend: NestJS, Prisma, PostgreSQL.

Serves the same wire contract as `@rivora/api-client`, which is what the web app compiles against — so pointing the frontend here is a base-URL change, not a rewrite.

---

## Run it

```bash
docker compose up --build
```

From the repository root. Postgres starts, migrations apply, the canonical dataset seeds, and the API listens on `:4000`.

| | |
| --- | --- |
| API | http://localhost:4000/api/v1 |
| Swagger UI | http://localhost:4000/docs |
| OpenAPI JSON | http://localhost:4000/docs-json |

Verify it end to end — this signs in for real, with a generated wallet and a genuine EIP-4361 signature:

```bash
node apps/api/scripts/smoke.mjs
```

Both published ports are overridable, because 5432 is usually already taken:

```bash
POSTGRES_PORT=5435 API_PORT=4100 docker compose up --build
```

### Without Docker

Needs a PostgreSQL 16 server reachable from `DATABASE_URL`.

```bash
cp apps/api/.env.example apps/api/.env
pnpm --filter @rivora/api prisma:deploy
pnpm --filter @rivora/api db:seed
pnpm --filter @rivora/api dev
```

---

## Commands

```bash
pnpm --filter @rivora/api test        # 58 unit tests
pnpm --filter @rivora/api typecheck
pnpm --filter @rivora/api build
pnpm --filter @rivora/api openapi     # writes openapi.json
pnpm --filter @rivora/api db:reset    # drop, migrate, reseed
```

---

## Security

**Authentication is Sign-In With Ethereum** (EIP-4361). Request a nonce, sign a message containing it, exchange the signature for a JWT. What makes it a login rather than just a valid signature is everything checked around it: the recovered key must be the address the message claims, the domain must be one this API serves (otherwise a signature harvested by any other site could be replayed here), the chain must match, and the nonce is consumed with a conditional update — so two requests racing the same signature cannot both win.

**Authorization is on by default.** The auth and role guards are registered as `APP_GUARD`s, so a new route is protected unless it opts out with `@Public()`. The inverse fails open: a route added without a decorator would be world-readable and nothing would flag it.

**Borrower routes resolve from the session, never a path parameter.** There is no `/borrowers/:id`, because an endpoint that takes an id is one somebody will eventually call with someone else's.

**The public surface is drawn deliberately.** Aggregate protocol health, reputation bands and the default registry are readable without a wallet — a credit protocol that hides its loss record is not worth trusting. Individual positions are not: `/protocol/stats` is public, `/snapshot` is not, because the latter carries a named borrower's outstanding balance and the LP's wallet balance.

**Partner keys are stored as SHA-256 only.** A database dump does not hand an attacker working credentials. Keys carry scopes, and the Score API returns strictly less than the borrower's own view.

**Money mutations accept `Idempotency-Key`.** A retry replays the first response instead of drawing twice. The record is written *before* the response is emitted — a fire-and-forget write leaves a window where a fast retry finds nothing and performs the operation again.

**Privileged actions are audited.** Declaring a default and advancing settlement write an append-only row with the actor, request id, IP and evidence. There is no update or delete path.

Also: Helmet headers, per-route rate limits (120/min globally, 10/min on auth, 60/min on the Score API), request correlation ids on every response, a global exception filter that never leaks a stack trace, and a validation pipe that rejects unknown properties rather than ignoring them.

**Production refuses to start without a real `JWT_SECRET`.** A shipped default is a forgeable session token for everyone who has read the repository.

---

## What it owns

Persistence, transactions, and the checks that have to hold. Not arithmetic — every formula comes from `@rivora/core`, the same functions the web app uses to *preview* a draw. Two implementations of `applyRepayment` would eventually disagree, and the one the borrower saw would be the wrong one.

**Every mutation is a transaction.** A draw that moves principal but fails to move vault liquidity would leave the book unbalanced, so both happen or neither does.

**Refusals are answers, not errors.** A well-formed request the protocol declines returns `422` with a machine-readable `code` and a message written to be shown to a person:

```json
{ "error": "Requested 99999.00 exceeds available credit of 530.00.", "code": "exceeds_available", "statusCode": 422 }
```

A malformed request returns `400` from the validation pipe, which also rejects unknown properties — a client sending a field the API does not read is either stale or confused, and ignoring it silently hides both.

**Mutations return the whole snapshot,** not a patch, so the client either holds the server's state or knows the call failed.

**Settlement is a keeper endpoint.** `POST /api/settlement/tick` accrues interest, routes the repayment share and funds the exit queue. Nothing a user clicks moves the protocol clock, which is why it has no UI.

---

## Money

Stored as `Decimal(20,6)`, never as a float. USDC has six decimal places, and a repayment split that drifts by a millionth leaves a loan that never quite closes.

Amounts round-trip through `number` to reach `@rivora/core`'s pure functions and are rounded back to six places before storage. Safe at these magnitudes — a USDC figure below a billion needs 15 significant digits, inside a double's exact range — and `usdc6` pins the result to what the column holds. Share prices carry eight places because they compound.

---

## Tests

58 unit tests, plus a 51-check end-to-end smoke run.

The services are tested with Prisma faked: the behaviour worth pinning down is the arithmetic and the refusals, and both are decided before any SQL is generated — a test that needs Postgres to prove interest is applied before principal is testing Postgres.

The SIWE tests are the exception and sign with real keys, because the property under test is that *a message signed by one key cannot authenticate another*. Mocking the signature would test nothing. They cover a wrong signer, a body altered after signing, a message signed for another site, a wrong chain, expiry, and a malformed signature.

The guard tests mostly assert on denials — a guard that lets the wrong caller through is the bug that does not announce itself. One asserts that a route with no decorators at all is closed.

Vitest rather than the Jest setup the Nest CLI scaffolds, to match the rest of the workspace. That works because of SWC: Vitest transforms TypeScript with esbuild, which does not implement `emitDecoratorMetadata`, so Nest's `design:paramtypes` would be missing and every injected dependency would resolve to `Object`. `unplugin-swc` does implement it.

One test resolves a service through Nest's actual container. Every other test constructs services directly and would pass even if the metadata pipeline were broken — that one fails loudly instead.

---

## The contract

`src/contracts/*.dto.ts` mirrors the interfaces in `@rivora/api-client`. The duplication is unavoidable: Swagger builds its schema from decorator metadata, and decorators cannot be attached to an interface.

It is kept honest by `src/contracts/contract-parity.ts`, which asserts at compile time that every DTO is assignable to its interface. Add a field to the wire contract without adding it here and `pnpm typecheck` fails, naming the missing property.

---

## Build notes

Two things about this app differ from the rest of the workspace, both forced:

**CommonJS, not ESM.** Nest's DI reads metadata that only the legacy decorator transform emits, and that transform is only available on a tsc CommonJS pipeline.

**`@rivora/core` and `@rivora/api-client` are consumed as built artifacts.** Both ship TypeScript source for bundlers, which is what keeps the web app free of a rebuild step. A Node server cannot read that, so each also emits a CommonJS build reached through the `require` condition in its `exports` map. Anything resolving the `default` condition — every bundler — still gets source, unchanged.

---

## Not implemented

**Token revocation.** JWTs are stateless and self-expiring; `POST /auth/logout` cannot invalidate one already handed out. A short lifetime is what bounds the exposure. A denylist or refresh-token rotation is the honest fix.

**Operator quorum.** PRD §33 requires 2-of-3 operator approval to declare a default. Today a single `ops` session is sufficient. The action is fully audited, but audit is detection, not prevention.

**Live endpoint probing.** `POST /services/verify-endpoint` reports against stored state rather than making a real outbound request. The network probe needs egress rules and a timeout budget before it can run in production.

**Rate limiting is per-instance.** The throttler stores counters in memory, so N replicas allow N× the limit. Move it to Redis before scaling out.

**Contract calls.** Wallet connection is real, but no transaction is signed or broadcast — money movement is a database write, not a settlement onchain.
