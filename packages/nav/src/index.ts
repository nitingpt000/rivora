/**
 * @rivora/nav — who is looking, and what they can navigate to.
 *
 * The four surfaces (borrower, LP, operator, partner) share one design system
 * but not one navigation set. Modelling that here keeps the chrome from
 * hard-coding who is looking at it.
 *
 * No protocol data lives here. Every figure the product displays comes from
 * the API — this is structure, not state.
 */

export * from './personas';
