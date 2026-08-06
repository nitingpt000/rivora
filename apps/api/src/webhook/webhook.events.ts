/**
 * The webhook event catalogue. PRD §27.
 *
 * Exactly the ten event names the PRD specifies, and nothing else: a receiver
 * integrates against this list, so growing it is an API change to be made
 * deliberately, not a side effect of some service inventing a string.
 */
export const WEBHOOK_EVENTS = [
  'revenue.received',
  'revenue.settled',
  'risk.assessment.completed',
  'credit.limit.updated',
  'credit.draw.completed',
  'credit.repayment.completed',
  'borrower.watchlisted',
  'borrower.restricted',
  'borrower.defaulted',
  'vault.utilization.changed',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];
