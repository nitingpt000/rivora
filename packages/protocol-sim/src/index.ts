/**
 * @rivora/protocol-sim — client state for the protocol surfaces.
 *
 * A zustand store holding what the screens read: the signed-in session, a
 * flattened copy of the server's snapshot, per-surface data loaded from its
 * own endpoint, and the UI state that belongs to the client alone.
 *
 * The boundaries are deliberate. `@rivora/core` holds arithmetic,
 * `@rivora/api-client` holds the wire contract, the API holds the book, and
 * this holds what is on screen. No protocol state originates here.
 */

export { useProtocol, useDerived } from './store';
export type { SimStore, SimActions } from './store';
// The wire types travel with the store, so a screen imports the shape it reads
// from the same place it reads the data — one import, not two.
export type * from '@rivora/api-client';
export { derive } from './derive';
export type { Derived } from './derive';
export { applySnapshot, initialState } from './state';
export type {
  SimState,
  OnboardingState,
  ModalKind,
  Receipt,
  SyncState,
  WatchReason,
  RestrictReason,
} from './state';
export type { AuthStatus, StoredSession } from './session';
export { useProtocolSync } from './sync';
