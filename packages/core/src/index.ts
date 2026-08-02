/**
 * @rivora/core — the protocol's domain logic.
 *
 * Pure functions and constants only: no React, no DOM, no I/O. Everything the
 * PRD specifies as arithmetic lives here so that the UI, the simulation and
 * any future contract-facing code compute the same numbers from one place.
 */

export * from './types';
export * from './constants';
export * from './format';
export * from './rates';
export * from './underwriting';
export * from './scoring';
export * from './repayment';
export * from './vault';
export * from './status';
export * from './draw';
