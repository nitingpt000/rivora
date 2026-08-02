import { Page } from '@rivora/ui';

/**
 * What a surface shows before its data arrives.
 *
 * Deliberately a distinct state rather than a page of zeroes: a screen that
 * renders `0.00 USDC` while it is still fetching states something false with
 * complete confidence, and the reader has no way to tell it apart from a
 * position that really is empty.
 */
export function Loading({ label }: { label: string }) {
  return (
    <Page measure="mid" paddingTop={64}>
      <div
        role="status"
        aria-live="polite"
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 14,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-neutral-600)',
        }}
      >
        ◌ {label}…
      </div>
    </Page>
  );
}

/**
 * What a role-gated surface shows to a wallet that has no such grant.
 *
 * The API would answer 403; saying so here means the reader learns why the
 * page is empty rather than watching it fail to load.
 */
export function NotPermitted({ surface }: { surface: string }) {
  return (
    <Page measure="mid" paddingTop={64}>
      <div style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>
        This wallet has no {surface} grant. Connect one that does.
      </div>
    </Page>
  );
}
