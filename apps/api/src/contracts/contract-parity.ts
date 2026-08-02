import type {
  BorrowerPosition,
  HealthMetrics,
  LpPosition,
  ProtocolSnapshot,
  Receipt,
  RevenueMetrics,
  SessionResponse,
  SnapshotMeta,
  VaultState,
} from '@rivora/api-client';

import type {
  BorrowerPositionDto,
  HealthMetricsDto,
  LpPositionDto,
  ProtocolSnapshotDto,
  RevenueMetricsDto,
  SnapshotMetaDto,
  VaultStateDto,
} from './snapshot.dto';
import type { ReceiptDto, SessionResponseDto } from './operations.dto';

/**
 * Compile-time proof that the API's DTOs still satisfy the wire contract the
 * web client compiles against.
 *
 * Swagger builds its schema from decorator metadata, and decorators cannot be
 * attached to an interface — so the DTO classes are necessarily a second
 * statement of the same shape. That duplication is only safe if drift is
 * caught, and this catches it: add a field to `@rivora/api-client` without
 * adding it here and `pnpm typecheck` fails with the missing property named.
 *
 * Type-only. Nothing in this file is emitted.
 */

/** Fails to compile unless `T` is assignable to `Shape`. */
type Satisfies<Shape, T extends Shape> = T;

export type _BorrowerParity = Satisfies<BorrowerPosition, BorrowerPositionDto>;
export type _RevenueParity = Satisfies<RevenueMetrics, RevenueMetricsDto>;
export type _HealthParity = Satisfies<HealthMetrics, HealthMetricsDto>;
export type _VaultParity = Satisfies<VaultState, VaultStateDto>;
export type _LpParity = Satisfies<LpPosition, LpPositionDto>;
export type _MetaParity = Satisfies<SnapshotMeta, SnapshotMetaDto>;
export type _SnapshotParity = Satisfies<ProtocolSnapshot, ProtocolSnapshotDto>;
export type _ReceiptParity = Satisfies<Receipt, ReceiptDto>;
export type _SessionParity = Satisfies<SessionResponse, SessionResponseDto>;
