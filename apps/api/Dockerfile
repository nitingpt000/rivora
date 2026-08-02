# syntax=docker/dockerfile:1

# Rivora API.
#
# Built from the monorepo root, not from apps/api — the app depends on
# workspace packages, and a build context narrower than the workspace could not
# see them:
#
#   docker build -f apps/api/Dockerfile -t rivora-api .
#
# Four stages so the runtime image carries no compiler, no dev dependency and
# no source. Only `dist`, production `node_modules` and the Prisma schema.

ARG NODE_VERSION=22-alpine

# ── deps ───────────────────────────────────────────────────────────────────
# Manifests only, so this layer is cached until a dependency actually changes.
# Copying the whole tree here would rebuild node_modules on every source edit.
FROM node:${NODE_VERSION} AS deps
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/api-client/package.json packages/api-client/
COPY packages/core/package.json packages/core/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/nav/package.json packages/nav/
COPY packages/protocol-sim/package.json packages/protocol-sim/
COPY packages/tokens/package.json packages/tokens/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/
COPY packages/wallet/package.json packages/wallet/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ── build ──────────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /repo

COPY packages/typescript-config packages/typescript-config
COPY packages/core packages/core
COPY packages/api-client packages/api-client
COPY apps/api apps/api

# The trailing `...` selects the API *and everything it depends on*, so the
# workspace packages that ship TypeScript source for bundlers emit the
# CommonJS artifacts this app resolves through their `require` condition.
# Naming them individually would silently rot the first time one is added.
RUN pnpm --filter "@rivora/api..." build

# Prune to production dependencies for the runtime stage. `deploy` flattens the
# workspace links into a self-contained node_modules.
RUN pnpm --filter @rivora/api deploy --prod --legacy /out

# Generate the Prisma client *into the pruned tree*. `deploy` builds a fresh
# node_modules from the store, which discards the client generated earlier in
# this stage — leaving the image to fail at boot with "@prisma/client did not
# initialize yet". This is why the Prisma CLI is a runtime dependency.
RUN cd /out && ./node_modules/.bin/prisma generate --schema ./prisma/schema.prisma

# ── migrate ────────────────────────────────────────────────────────────────
# Applies migrations and seeds, then exits. Keeps the build stage's full
# node_modules because the Prisma CLI and tsx are dev dependencies — the
# runtime image prunes them, which is why migration is a separate job rather
# than something the API does on start. It also means N API replicas cannot
# race to migrate the same database.
FROM build AS migrate
WORKDIR /repo/apps/api
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec tsx prisma/seed.ts"]

# ── runtime ────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Prisma's engine needs OpenSSL, which the Alpine base does not carry.
RUN apk add --no-cache openssl tini

# Runs unprivileged. The node image already provides uid/gid 1000.
USER node

COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/prisma ./prisma
COPY --from=build --chown=node:node /repo/apps/api/package.json ./package.json

EXPOSE 4000

# Targets the versioned path. `/api/health` stopped existing when URI
# versioning was added, and a healthcheck pointed at a 404 reports a healthy
# process as unhealthy — which is at least the safe direction to fail.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps zombies and forwards SIGTERM, so Nest's shutdown hooks run and the
# Prisma pool closes instead of the process being killed mid-query.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
