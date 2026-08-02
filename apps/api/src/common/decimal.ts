import { Prisma } from '@prisma/client';

/**
 * Conversion between the database's decimals and the API's numbers.
 *
 * Money is stored as `Decimal` because USDC arithmetic has to be exact — a
 * repayment split that drifts by a millionth leaves a loan that never quite
 * closes. It crosses the wire as a JSON number because every value the product
 * displays is already rounded to two or six places, well inside a double's
 * exact-integer range once scaled.
 *
 * The rule this file exists to enforce: compute in `Decimal`, serialise in
 * `number`, and never the other way round.
 */

export type DecimalLike = Prisma.Decimal | number | string;

export function dec(value: DecimalLike): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** Serialises a stored decimal for the wire. */
export function toNumber(value: DecimalLike): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

/**
 * Rounds to USDC's six decimal places, the precision the ledger stores.
 *
 * Applied before every write so a computed value cannot carry more precision
 * than the column can hold — Postgres would round it silently on insert, and
 * the in-memory value would then disagree with the stored one.
 */
export function usdc6(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);
}

/** Rounds share prices, which carry two extra places because they compound. */
export function shares8(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_UP);
}
