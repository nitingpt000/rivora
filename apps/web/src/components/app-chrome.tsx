'use client';

import { NAV_GROUPS, PERSONAS, PUBLIC_NAV } from '@rivora/nav';
import { useProtocol, useProtocolSync } from '@rivora/protocol-sim';
import { Button, StatusPill } from '@rivora/ui';
import { useWallet } from '@rivora/wallet';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

/**
 * The persistent frame: testnet strip, wordmark, surface navigation, identity.
 *
 * One component rather than a per-surface header, because the four surfaces are
 * the same protocol seen from different seats — the chrome changes what it
 * lists, not how it looks.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  useProtocolSync();
  useWalletSession();

  const persona = useProtocol((s) => s.persona);
  const pathname = usePathname();

  // The signed-in role decides the chrome. A deep link into a role's surface
  // no longer adopts that role: the API answers to the token, so dressing the
  // page as a borrower would only mean nav that 403s.
  const definition = persona ? PERSONAS[persona] : null;
  const nav = definition?.nav ?? PUBLIC_NAV;

  return (
    <>
      <TestnetStrip />
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-neutral-300)',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--measure-wide)',
            margin: '0 auto',
            padding: '0 var(--gutter)',
            minHeight: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            flexWrap: 'wrap',
          }}
        >
          <Link
            href={definition?.home ?? '/'}
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '0.14em',
              color: 'var(--color-text)',
              textDecoration: 'none',
            }}
          >
            RIVORA
            {definition?.chromeSuffix ? (
              <span style={{ fontWeight: 400, color: 'var(--color-accent-700)' }}>
                {' '}
                {definition.chromeSuffix}
              </span>
            ) : null}
          </Link>

          <nav
            aria-label="Primary"
            style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap', minWidth: 0 }}
          >
            {nav.map((item) => {
              const group = NAV_GROUPS[pathname] ?? pathname;
              const active = group === item.href || (item.href !== '/' && group.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 14,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '6px 10px',
                    color: active ? 'var(--color-accent-700)' : 'var(--color-text)',
                    borderBottom: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {definition ? <IdentityChip /> : <LaunchButton />}
        </div>
      </header>

      <NetworkBanner />
      <main>{children}</main>
    </>
  );
}

/**
 * Ends the session when the wallet switches to a different address.
 *
 * The token was issued against a signature from one address, so a wallet that
 * changes account must not keep reading the previous one's position.
 *
 * Deliberately *not* triggered by a disconnected wallet. The session outlives
 * the connection on purpose: a token in session storage is what survives a
 * page refresh, and wagmi reports `isConnected: false` for the first moments
 * of every load while it reconnects. Signing out on that would log the user
 * out of every refresh — and would make the app unusable to anyone reading it
 * without a browser wallet at all.
 */
function useWalletSession(): void {
  const { address } = useWallet();
  const signedInAs = useProtocol((s) => s.user?.address);
  const signOut = useProtocol((s) => s.signOut);

  useEffect(() => {
    if (!signedInAs || !address) return;
    if (address.toLowerCase() === signedInAs.toLowerCase()) return;

    signOut();
  }, [address, signedInAs, signOut]);
}

function TestnetStrip() {
  const sync = useProtocol((s) => s.sync);

  return (
    <div
      style={{
        background: 'var(--color-accent-900)',
        color: 'var(--color-accent-100)',
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        padding: '5px var(--gutter)',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        fontFamily: 'var(--font-heading)',
      }}
    >
      <span>Arc Testnet — test assets only, no real value</span>
      <span>
        {sync === 'loading' ? '◌ syncing protocol state' : null}
        {sync === 'error' ? '⚠ protocol state unavailable' : null}
        {sync === 'ready' ? '● live' : null}
      </span>
    </div>
  );
}

/**
 * Wrong-network and failed-sync notices.
 *
 * Both are conditions where the figures on screen cannot be acted on, so they
 * sit above the content rather than inside whichever card happens to notice.
 */
function NetworkBanner() {
  const { isWrongNetwork, switchToArc, isSwitching } = useWallet();
  const sync = useProtocol((s) => s.sync);
  const syncError = useProtocol((s) => s.syncError);
  const load = useProtocol((s) => s.load);

  if (isWrongNetwork) {
    return (
      <Notice tone="warn">
        <span>Your wallet is connected to a different network.</span>
        <Button variant="secondary" compact onClick={switchToArc} disabled={isSwitching}>
          {isSwitching ? 'Switching…' : 'Switch to Arc Testnet'}
        </Button>
      </Notice>
    );
  }

  if (sync === 'error') {
    return (
      <Notice tone="danger">
        <span>Could not load protocol state{syncError ? ` — ${syncError}` : '.'}</span>
        <Button variant="secondary" compact onClick={() => void load()}>
          Retry
        </Button>
      </Notice>
    );
  }

  return null;
}

function Notice({ tone, children }: { tone: 'warn' | 'danger'; children: ReactNode }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : 'var(--color-warn)';

  return (
    <div
      role="status"
      style={{
        borderBottom: `1px solid ${color}`,
        background: 'var(--color-bg)',
        padding: '8px var(--gutter)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexWrap: 'wrap',
        fontSize: 13,
        color,
      }}
    >
      {children}
    </div>
  );
}

function IdentityChip() {
  const persona = useProtocol((s) => s.persona);
  const status = useProtocol((s) => s.status);
  const tier = useProtocol((s) => s.tier);
  const score = useProtocol((s) => s.score);
  const signOut = useProtocol((s) => s.signOut);
  // The session's address, not the wallet's: they are the same address, but
  // only the first survives a reload before wagmi has reconnected.
  const signedInAs = useProtocol((s) => s.user?.address);
  const { shortAddress, isConnected, disconnect: disconnectWallet, balance } = useWallet();

  if (!persona) return null;
  const definition = PERSONAS[persona];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ textAlign: 'right' }}>
        <div className="mono" style={{ fontSize: 12 }}>
          {shortAddress ?? shorten(signedInAs)}
        </div>
        {persona === 'borrower' ? (
          <div style={{ fontSize: 11 }}>
            <StatusPill status={status} tier={tier} score={score} size={11} />
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
            {balance ?? definition.title}
          </div>
        )}
      </div>
      <Link
        href="/connect"
        onClick={() => {
          signOut();
          if (isConnected) disconnectWallet();
        }}
      >
        <Button variant="ghost" compact>
          {isConnected ? 'Disconnect' : 'Switch'}
        </Button>
      </Link>
    </div>
  );
}

/** `0x7099…79c8` — the form used throughout the product. */
function shorten(address: string | undefined): string {
  if (!address) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function LaunchButton() {
  return (
    <Link href="/connect">
      <Button variant="primary">Connect wallet</Button>
    </Link>
  );
}
