'use client';

import { useProtocol } from '@rivora/protocol-sim';
import { Blueprint, Button, Callout, Mono, Page, PageHeader, Stack, Tag } from '@rivora/ui';
import { buildSiweMessage, useWallet } from '@rivora/wallet';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';

/**
 * S-01 — Connect.
 *
 * Two steps that the wallet makes feel like one: connect, then prove control
 * of the address by signing. The signature is what the API trusts — an address
 * alone proves nothing, since anyone can claim one.
 *
 * A wallet with no registered service still signs in successfully and lands on
 * a null role. That is a new user, not a failure.
 */
export default function ConnectPage() {
  const {
    address,
    isConnected,
    isConnecting,
    connectors,
    isWrongNetwork,
    switchToArc,
    isSwitching,
    signMessage,
    error: walletError,
  } = useWallet();

  const signIn = useProtocol((s) => s.signIn);
  const authStatus = useProtocol((s) => s.authStatus);
  const authError = useProtocol((s) => s.authError);
  const user = useProtocol((s) => s.user);
  const router = useRouter();

  const attemptedFor = useRef<string | null>(null);

  const startSignIn = useCallback(async () => {
    if (!address) return;

    const home = await signIn(address, signMessage, ({ address: a, nonce }) =>
      buildSiweMessage({ address: a, nonce }),
    );

    if (home) router.push(home);
  }, [address, signIn, signMessage, router]);

  /**
   * Prompt to sign as soon as a wallet connects on the right network.
   *
   * Guarded per address so a declined prompt is not immediately re-issued —
   * a wallet popup that reappears every render is indistinguishable from a
   * malfunction.
   */
  useEffect(() => {
    if (!isConnected || !address || isWrongNetwork) return;
    if (authStatus !== 'anonymous') return;
    if (attemptedFor.current === address) return;

    attemptedFor.current = address;
    void startSignIn();
  }, [isConnected, address, isWrongNetwork, authStatus, startSignIn]);

  const error = authError ?? walletError;

  return (
    <Page measure="tight" paddingTop={64}>
      <PageHeader
        eyebrow="Connect a wallet"
        title="Enter the protocol"
        size={40}
        lead="Rivora runs on Arc Testnet. Connect the wallet that holds your service registration, your vault position or your operator grant."
      />

      {error ? <Callout severity="danger">{error}</Callout> : null}

      {/* 1 — connect */}
      {!isConnected ? (
        <>
          <Stack>
            {connectors.map((connector) => (
              <Blueprint
                key={connector.id}
                onClick={connector.connect}
                label={`Connect with ${connector.name}`}
                style={row}
              >
                <Glyph>{connector.name.slice(0, 2).toUpperCase()}</Glyph>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Title>{connector.name}</Title>
                  <Sub>
                    {connector.pending ? 'Check your wallet to approve…' : 'Connect this wallet'}
                  </Sub>
                </div>
                {connector.pending ? <Tag tone="accent">Pending</Tag> : null}
              </Blueprint>
            ))}
          </Stack>

          {connectors.length === 0 ? (
            <Callout severity="warn">
              No wallet connector is available in this browser. Install a browser wallet, or set{' '}
              <Mono>NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</Mono> to enable WalletConnect.
            </Callout>
          ) : null}

          {isConnecting ? <Sub>Waiting for the wallet to respond…</Sub> : null}
        </>
      ) : null}

      {/* 2 — right network */}
      {isConnected && isWrongNetwork ? (
        <Callout severity="warn">
          <strong>Wrong network.</strong> This wallet is connected to another chain. Switch to Arc
          Testnet to continue.
          <div style={{ marginTop: 12 }}>
            <Button variant="primary" onClick={switchToArc} disabled={isSwitching}>
              {isSwitching ? 'Switching…' : 'Switch to Arc Testnet'}
            </Button>
          </div>
        </Callout>
      ) : null}

      {/* 3 — prove it */}
      {isConnected && !isWrongNetwork && authStatus === 'signing' ? (
        <Blueprint style={{ padding: 20, marginTop: 16 }}>
          <Title>Confirm in your wallet</Title>
          <Sub>
            Signing proves you control <Mono>{address}</Mono>. It authorises no transaction and
            costs no gas.
          </Sub>
        </Blueprint>
      ) : null}

      {isConnected && !isWrongNetwork && authStatus !== 'signing' && authStatus !== 'authenticated' ? (
        <Blueprint style={{ padding: 20, marginTop: 16 }}>
          <Title>Sign in</Title>
          <Sub>
            Connected as <Mono>{address}</Mono>. Sign a message to prove you control it.
          </Sub>
          <div style={{ marginTop: 14 }}>
            <Button variant="primary" onClick={() => void startSignIn()}>
              Sign in with Ethereum
            </Button>
          </div>
        </Blueprint>
      ) : null}

      {/* 4 — signed in, but nothing registered */}
      {authStatus === 'authenticated' && user && !user.role ? (
        <Callout severity="info">
          <strong>This wallet is not registered yet.</strong> <Mono>{user.address}</Mono> holds no
          service registration, vault position or operator grant.{' '}
          <Link href="/onboard/1">Register a service</Link> to get started.
        </Callout>
      ) : null}

      <p style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 24 }}>
        Testnet only. No real value moves. New to Rivora?{' '}
        <Link href="/onboard/1">Register a service</Link> to walk the onboarding flow from zero.
      </p>
    </Page>
  );
}

const row = {
  padding: '18px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  flexWrap: 'wrap' as const,
};

function Glyph({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        border: '1px solid var(--color-accent-400)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-heading)',
        fontSize: 16,
        color: 'var(--color-accent-700)',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, letterSpacing: '0.04em' }}>
      {children}
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>{children}</div>
  );
}
