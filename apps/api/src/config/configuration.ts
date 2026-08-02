import { randomBytes } from 'node:crypto';

/**
 * Environment, read once and validated at boot.
 *
 * A missing or weak secret should stop the process with a sentence a human can
 * act on, not surface later as a subtle authentication failure — or worse, as
 * a working system signing tokens with a guessable key.
 */
export interface AppConfig {
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  nodeEnv: string;
  isProduction: boolean;
  jwtSecret: string;
  jwtTtlSeconds: number;
  /** Domains accepted in the `domain` field of a SIWE message. */
  siweDomains: string[];
  chainId: number;
  /** Requests per window per IP, applied globally. */
  throttleLimit: number;
  throttleTtlMs: number;
  /**
   * `ledger` keeps money movement in the database; `arc` broadcasts to the
   * chain. Defaults to `ledger` because the alternative moves real value, and
   * that should never be something a missing environment variable turns on.
   */
  chainMode: 'ledger' | 'arc';
  /** Deployed contract addresses. Empty until a deployment has happened. */
  creditVaultAddress: string;
  creditManagerAddress: string;
  riskRegistryAddress: string;
}

const MIN_SECRET_LENGTH = 32;

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env, or run the compose stack which sets it for you.',
    );
  }

  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, received "${process.env.PORT}".`);
  }

  const jwtSecret = resolveJwtSecret(isProduction);

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  /**
   * SIWE domains default to the hosts of the allowed CORS origins.
   *
   * The domain in a signed message is what stops a signature harvested by
   * another site being replayed here, so it must never silently accept
   * anything — deriving it from an already-explicit list keeps one source of
   * truth instead of two that can drift.
   */
  const siweDomains = (
    process.env.SIWE_DOMAINS ??
    corsOrigins
      .map((origin) => {
        try {
          return new URL(origin).host;
        } catch {
          return '';
        }
      })
      .filter(Boolean)
      .join(',')
  )
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);

  if (siweDomains.length === 0) {
    throw new Error(
      'No SIWE domains could be determined. Set SIWE_DOMAINS, or give CORS_ORIGINS absolute URLs.',
    );
  }

  return {
    port,
    databaseUrl,
    corsOrigins,
    // Defaults on, and expected to be turned off in production: the schema
    // describes every mutation the protocol accepts.
    swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'true') !== 'false',
    nodeEnv,
    isProduction,
    jwtSecret,
    jwtTtlSeconds: Number(process.env.JWT_TTL_SECONDS ?? 3600),
    siweDomains,
    chainId: Number(process.env.ARC_CHAIN_ID ?? 5042002),
    throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 120),
    throttleTtlMs: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
    // Opt-in, never inferred. Broadcasting real transactions must be a
    // deliberate choice, not what happens when a variable is unset.
    chainMode: process.env.CHAIN_MODE === 'arc' ? 'arc' : 'ledger',
    creditVaultAddress: process.env.CREDIT_VAULT_ADDRESS ?? '',
    creditManagerAddress: process.env.CREDIT_MANAGER_ADDRESS ?? '',
    riskRegistryAddress: process.env.RISK_REGISTRY_ADDRESS ?? '',
  };
}

/**
 * A weak signing key is the difference between a session token and a forgeable
 * one, so production refuses to start without a real secret. Development gets
 * an ephemeral one — regenerated per boot, which invalidates existing tokens
 * on restart and is the correct trade for never shipping a default.
 */
function resolveJwtSecret(isProduction: boolean): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (isProduction) {
      throw new Error(
        'JWT_SECRET is not set. Generate one with `openssl rand -base64 48` and set it in the environment.',
      );
    }
    return randomBytes(48).toString('base64');
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters; received ${secret.length}.`,
    );
  }

  return secret;
}
