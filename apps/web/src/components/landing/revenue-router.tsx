'use client';

import { usdc } from '@rivora/core';
import { useEffect, useMemo, useRef, useState } from 'react';

import styles from '@/app/landing.module.css';

/**
 * The revenue router — the landing page's signature.
 *
 * Everything Rivora claims rests on one mechanism: revenue arrives in
 * fractions of a cent, accumulates into a batch, and a fixed share of that
 * batch is split off *at settlement, before the money reaches the borrower*.
 * A static diagram states that; watching a batch fill and clear demonstrates
 * it, which is why this is the hero rather than a headline figure.
 *
 * The animation is not decoration and it is not a chart — it is the product's
 * only irreducible idea, running.
 */

/**
 * Per-request prices, in USDC.
 *
 * A fixed cycle rather than `Math.random()`: the house rule holds here for the
 * same reason it holds in the fixtures — a screen that renders differently on
 * every load cannot be screenshotted or reviewed. Real per-request pricing
 * clusters around a price point anyway, so a repeating sequence reads truer
 * than noise would.
 */
const PRICES = [0.04, 0.04, 0.02, 0.06, 0.04, 0.03, 0.05, 0.04, 0.02, 0.04];

/** Payments per batch before it settles. */
const BATCH_SIZE = 6;

/** Milliseconds between arrivals, and the length of the settle beat. */
const ARRIVAL_MS = 620;
const SETTLE_MS = 760;

/** Tick heights for the incoming signal trace, as a fraction of the track. */
const TRACE = [
  0.45, 0.7, 0.3, 0.85, 0.5, 0.35, 0.95, 0.4, 0.6, 0.25, 0.75, 0.45, 0.55, 0.9, 0.35, 0.65, 0.3,
  0.8, 0.5, 0.4, 0.7, 0.28, 0.6, 0.85, 0.42, 0.52, 0.33, 0.78, 0.46, 0.62,
];

export interface RevenueRouterProps {
  /** Basis points of settled revenue routed to repayment. */
  repaymentBps: number;
  /** Basis points routed to the loss reserve. */
  reserveBps: number;
  /** Revenue routed protocol-wide in the trailing 30 days, for the footer. */
  routed30d: number;
}

export function RevenueRouter({ repaymentBps, reserveBps, routed30d }: RevenueRouterProps) {
  const reduced = usePrefersReducedMotion();
  const [received, setReceived] = useState(0);
  const [settling, setSettling] = useState(false);
  const [cleared, setCleared] = useState(0);

  const repaymentPct = repaymentBps / 100;
  const reservePct = reserveBps / 100;
  const operatingPct = 100 - repaymentPct - reservePct;

  /**
   * The batch cycle: fill, clear, repeat.
   *
   * Paused entirely when the tab is hidden — an ambient loop on a background
   * tab is a battery cost with no viewer — and frozen at a representative
   * mid-batch state when the visitor has asked for reduced motion.
   */
  useEffect(() => {
    if (reduced) {
      setReceived(BATCH_SIZE - 2);
      return;
    }
    if (typeof document === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const step = () => {
      setReceived((n) => {
        if (n + 1 < BATCH_SIZE) return n + 1;

        // Batch full: clear it, bank it, and start the next one.
        setSettling(true);
        setCleared((c) => c + 1);
        timer = setTimeout(() => {
          if (!stopped) setSettling(false);
        }, SETTLE_MS);
        return 0;
      });
    };

    // Not started when the page mounts on a background tab — a loop nobody is
    // watching is pure cost, and the visibility handler starts it on arrival.
    let interval = document.hidden ? null : setInterval(step, ARRIVAL_MS);

    const onVisibility = () => {
      if (interval) clearInterval(interval);
      interval = !document.hidden && !stopped ? setInterval(step, ARRIVAL_MS) : null;
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  /** Value of the batch currently accumulating. */
  const batchValue = useMemo(
    () => PRICES.slice(0, received).reduce((sum, p) => sum + p, 0) * 380,
    [received],
  );

  const batchFull = PRICES.slice(0, BATCH_SIZE).reduce((sum, p) => sum + p, 0) * 380;
  const fillPct = (received / BATCH_SIZE) * 100;

  /** Running totals, seeded from the protocol's own routed figure. */
  const routedLive = routed30d + cleared * batchFull;

  const channels = [
    {
      key: 'repayment',
      name: 'Repayment',
      share: repaymentPct,
      className: styles.channelRepayment,
      value: (routedLive * repaymentPct) / 100,
    },
    {
      key: 'reserve',
      name: 'Reserve',
      share: reservePct,
      className: styles.channelReserve,
      value: (routedLive * reservePct) / 100,
    },
    {
      key: 'operating',
      name: 'Operating',
      share: operatingPct,
      className: styles.channelOperating,
      value: (routedLive * operatingPct) / 100,
    },
  ];

  return (
    <div
      className={`${styles.router} ${settling ? styles.settling : ''}`}
      /* The instrument is a live demonstration, not data the reader must
         track. Announcing every batch would flood a screen reader with
         numbers that carry no obligation. The static diagram in "Every 100
         USDC that settles" states the same split in text. */
      aria-hidden="true"
    >
      <div className={styles.routerHead}>
        <span className={styles.routerTitle}>Revenue router</span>
        <span className={styles.routerState}>
          <i className={`${styles.routerDot} ${reduced ? '' : styles.routerDotLive}`} />
          {settling ? 'settling' : 'receiving'}
        </span>
      </div>

      <div className={styles.trace}>
        <div className={styles.traceTrack}>
          {/* Duplicated end to end so the -50% translation loops seamlessly. */}
          {[...TRACE, ...TRACE].map((height, i) => (
            <i
              key={i}
              className={`${styles.tick} ${i % 4 === 0 ? styles.tickSettled : ''}`}
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>
      </div>

      <div className={styles.traceMeta}>
        <span>x402 · Circle Nanopayments</span>
        <span>0.04 mean / request</span>
      </div>

      <div className={styles.batch}>
        <span className={styles.batchLabel}>Batch</span>
        <span className={styles.batchBar}>
          <i className={styles.batchFill} style={{ width: `${fillPct}%` }} />
        </span>
        <span className={styles.batchValue}>{usdc(batchValue)}</span>
      </div>

      <div className={styles.channels}>
        {channels.map((channel) => (
          <div key={channel.key} className={styles.channel}>
            <span className={styles.channelName}>{channel.name}</span>
            <span className={styles.channelShare}>{channel.share.toFixed(0)}%</span>
            <span className={styles.channelTrack}>
              <i
                className={`${styles.channelBar} ${channel.className}`}
                style={{ width: `${channel.share}%` }}
              />
            </span>
            <span className={styles.channelValue}>{usdc(channel.value)}</span>
          </div>
        ))}
      </div>

      <div className={styles.routerFoot}>
        <span>Routed, trailing 30d</span>
        <span className={styles.routerFootValue}>{usdc(routedLive)} USDC</span>
      </div>
    </div>
  );
}

/**
 * Tracks the reduced-motion preference, including a change mid-session.
 *
 * Starts false so the server render and the first client render agree; the
 * effect corrects it before paint matters. The CSS honours the preference on
 * its own — this exists so the JS cycle stops too, rather than mutating state
 * behind animations that are no longer running.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  const query = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    query.current = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.current.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.current.addEventListener('change', onChange);
    return () => query.current?.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
