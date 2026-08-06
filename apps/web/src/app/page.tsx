'use client';

import { num, pct, usdc } from '@rivora/core';
import { useProtocol } from '@rivora/protocol-sim';
import { Button } from '@rivora/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { RevenueRouter } from '@/components/landing/revenue-router';

import styles from './landing.module.css';

/**
 * S-01 — Landing. screens.md §6.1
 *
 * The one screen that argues rather than reports. Its whole job is to make a
 * technical reader believe that repayment is *structural* — enforced at the
 * router before the borrower is paid — rather than promised. So the hero is
 * the router itself, running, and every section after it is evidence for that
 * one claim.
 */
export default function LandingPage() {
  const s = useProtocol();
  const stats = s.stats;
  const economics = stats?.vault ?? null;

  // Before the first snapshot lands, protocol figures are zeroes. Rendering
  // them as real numbers would state something false with total confidence; an
  // em dash reads as "not loaded", which is what it is.
  const ready = s.sync === 'ready';
  const figure = (value: string) => (ready ? value : '—');

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Stablecoin-native credit · Arc</p>

            <h1 className={styles.headline}>Credit for machines that earn.</h1>

            <p className={styles.lead}>
              Your API takes payment per request. Rivora reads that revenue onchain, extends a USDC
              line against it, and{' '}
              <span className={styles.leadEmphasis}>
                takes repayment out of the next settlement — before the money reaches you.
              </span>
            </p>

            <div className={styles.heroActions}>
              <Link href="/onboard/1">
                <Button variant="primary">Register a service</Button>
              </Link>
              <Link href="/connect">
                <Button variant="secondary">Supply USDC</Button>
              </Link>
              <Link href="/activity">
                <Button variant="ghost">Protocol activity</Button>
              </Link>
            </div>

            <p className={styles.heroNote}>
              No equity. No personal guarantee. No credit file.
            </p>
          </div>

          <RevenueRouter
            repaymentBps={s.repaymentBps}
            reserveBps={s.reserveBps}
            routed30d={stats?.routedRevenue30d ?? 0}
          />
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <span className={styles.sectionKicker}>Live protocol state</span>
          <h2 className={styles.sectionTitle}>Every figure on this page is the book itself.</h2>
          <p className={styles.sectionLead}>
            Read from the protocol, not a marketing deck. Losses, defaults and utilization are
            published on the same surface as the numbers that flatter us.
          </p>
        </header>

        {/* Every figure here comes from the public stats endpoint. The
            flattened store state holds the *snapshot*, which needs a session —
            reading it here showed signed-out visitors the bundled fixture
            while the copy above promised them the book. */}
        <div className={styles.stateGrid}>
          <StateCell
            lead
            label="Total value locked"
            value={figure(usdc(stats?.totalValueLocked ?? 0))}
            unit="USDC"
          />
          <StateCell
            lead
            label="Utilization"
            value={figure(pct((stats?.utilization ?? 0) * 100, 1))}
            meter={ready ? (stats?.utilization ?? 0) : undefined}
          />
          <StateCell
            lead
            label="Realized losses"
            value={figure(usdc(stats?.realizedLosses ?? 0))}
            unit="USDC"
          />

          <StateCell
            small
            label="Outstanding credit"
            value={figure(usdc(stats?.outstandingCredit ?? 0))}
            unit="USDC"
          />
          <StateCell
            small
            label="Active borrowers"
            value={figure(String(stats?.activeBorrowers ?? 0))}
          />
          <StateCell small label="Default rate" value={figure(pct(stats?.defaultRatePct ?? 0, 1))} />

          <StateCell
            small
            label="Revenue routed 30d"
            value={figure(usdc(stats?.routedRevenue30d ?? 0))}
            unit="USDC"
          />
          <StateCell
            small
            label="Principal repaid"
            value={figure(usdc(stats?.principalRepaid ?? 0))}
            unit="USDC"
          />
          <StateCell
            small
            label="Repaid from revenue"
            value={figure(pct(stats?.repaidFromRevenuePct ?? 0, 1))}
          />
        </div>
      </section>

      <CycleSection />

      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <span className={styles.sectionKicker}>What makes repayment structural</span>
          <h2 className={styles.sectionTitle}>
            Three things stand between a loan and a promise.
          </h2>
          <p className={styles.sectionLead}>
            Unsecured lending to an anonymous machine only works if repayment is enforced by
            plumbing rather than intent. Each of these is checked continuously, and each is visible
            to the borrower on their own screens.
          </p>
        </header>

        <div className={styles.guarantees}>
          <Guarantee
            index="01"
            title="Revenue cannot route around the protocol"
            proof={figure(`Binding probe · ${pct(stats?.probeSuccessPct ?? 0, 1)} success`)}
          >
            The <code>payTo</code> your endpoint advertises is bound onchain to a Revenue Router you
            deploy. A probe compares the two continuously. If the advertised address drifts, new
            draws stop and the repayment share escalates.
          </Guarantee>

          <Guarantee
            index="02"
            title="The split happens before you are paid"
            proof={`${s.repaymentBps / 100} / ${s.reserveBps / 100} / ${100 - s.repaymentBps / 100 - s.reserveBps / 100} enforced at the router`}
          >
            Under custody Model A the router divides each batch at the moment it settles:{' '}
            {s.repaymentBps / 100}% to repayment, {s.reserveBps / 100}% to the loss reserve, the
            remainder to your operating wallet. Repayment is not a transfer you have to remember.
          </Guarantee>

          <Guarantee
            index="03"
            title="Losses reach the protocol before lenders"
            proof={figure(
              `First loss ${usdc(stats?.firstLossTranche ?? 0)} · ${pct(stats?.firstLossCoveragePct ?? 0, 1)} of vault`,
            )}
          >
            A first-loss tranche absorbs defaults ahead of liquidity providers. Defaults are
            recorded permanently in a public registry — a record may be cured, but it is never
            deleted.
          </Guarantee>
        </div>
      </section>

      <section className={styles.lp}>
        <div className={styles.lpInner}>
          <div>
            <span className={styles.sectionKicker}>The other side of the book</span>
            <h2 className={styles.sectionTitle}>Lend to revenue, not to a balance sheet.</h2>
            <p className={styles.sectionLead}>
              Supply USDC to the credit vault and hold a claim on a book that amortizes
              continuously — roughly {pct(2.2, 1)} of outstanding principal returns every day out of
              routed revenue, rather than at a maturity date.
            </p>
            <div className={styles.heroActions}>
              <Link href="/connect">
                <Button variant="primary">Supply USDC</Button>
              </Link>
              <Link href="/defaults">
                <Button variant="ghost">Read the default registry</Button>
              </Link>
            </div>
          </div>

          <div className={styles.lpFigures}>
            <StateCell
              small
              label="Displayed APY"
              value={figure(pct(economics?.displayedApyPct ?? 0))}
            />
            <StateCell
              small
              label="Organic yield"
              value={figure(pct(economics?.organicApyPct ?? 0))}
            />
            <StateCell
              small
              label="Mean payback"
              value={figure(`${economics?.weightedMeanPaybackDays ?? 0} days`)}
            />
            <StateCell
              small
              label="Coverage multiple"
              value={figure(`${num(economics?.coverageMultiple ?? 0, 1)}×`)}
            />
          </div>
        </div>
      </section>

      <div className={styles.disclaimer}>
        <div className={styles.disclaimerInner}>
          ⚠ Arc Testnet. Test assets only, no real value. Credit scores are experimental.
          {economics && economics.subsidyApyPct > 0 ? (
            <>
              {' '}
              Displayed yields include a protocol subsidy of {pct(economics.subsidyApyPct)} that
              ends {economics.subsidyEnds.slice(0, 10)} and are not guaranteed.
            </>
          ) : null}{' '}
          Rivora is not a licensed lender in any jurisdiction.
        </div>
      </div>
    </>
  );
}

/**
 * The cycle.
 *
 * Numbered because the order is genuinely load-bearing — nothing can be
 * borrowed before it has been scored — and closed with a return edge because
 * the sequence is a loop rather than a line: a completed repayment is the
 * evidence that raises the next limit. The reveal animates in sequence for the
 * same reason, so the eye reads the order rather than the four cells at once.
 */
function CycleSection() {
  const { ref, visible } = useInView<HTMLDivElement>();
  const stats = useProtocol((s) => s.stats);

  const steps = [
    {
      name: 'Earn',
      title: 'Your service takes payment per request',
      body: 'Customers and agents pay through x402 and Circle Nanopayments. Every payment settles onchain, so revenue is observable without you reporting it.',
      figure: stats
        ? `${num(stats.authorizationsIssued, 0)} authorizations · ${usdc(stats.eligibleRevenue)} eligible`
        : 'Reading settled payments…',
    },
    {
      name: 'Score',
      title: 'Revenue becomes an underwriting input',
      body: 'Rivora reads settled payments, uptime, refund rate and customer concentration. The constraint that binds your limit is shown to you, not hidden behind a score.',
      figure: 'Constraint ladder · reassessed every 14 days',
    },
    {
      name: 'Borrow',
      title: 'Draw against the line in USDC',
      body: 'Funds land in the operating wallet you registered and spend inside a policy you set — category limits, per-payment caps, an approval threshold.',
      figure: 'Limit 2,530.00 USDC · finality 0.6s',
    },
    {
      name: 'Repay',
      title: 'Settlement services the debt first',
      body: 'A fixed share of every settled batch repays the loan at the router. Interest is applied before principal, and paying early costs nothing.',
      figure: '20% of settled revenue · ~90.00 USDC/day',
    },
  ];

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionKicker}>The cycle</span>
        <h2 className={styles.sectionTitle}>Earn, score, borrow, repay — then borrow more.</h2>
        <p className={styles.sectionLead}>
          A credit line is not granted once. Each completed repayment is evidence the loop works,
          and evidence is what lifts the cap on the next assessment.
        </p>
      </header>

      <div ref={ref} className={visible ? styles.isVisible : undefined}>
        <div className={styles.cycle}>
          {steps.map((step, i) => (
            <article key={step.name} className={styles.step}>
              <i className={styles.stepMark} aria-hidden="true" />
              <div className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</div>
              <div className={styles.stepName}>{step.name}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
              <div className={styles.stepFigure}>{step.figure}</div>
            </article>
          ))}
        </div>

        <div className={styles.returnEdge}>
          <span>04 → 02</span>
          <i className={styles.returnLine} aria-hidden="true" />
          <span>One completed cycle raised this borrower 1,690.00 → 2,530.00 USDC</span>
        </div>
      </div>
    </section>
  );
}

function StateCell({
  label,
  value,
  unit,
  meter,
  lead = false,
  small = false,
}: {
  label: string;
  value: string;
  unit?: string;
  /** 0–1. Draws a rule under the figure. */
  meter?: number;
  lead?: boolean;
  small?: boolean;
}) {
  const pending = value === '—';

  return (
    <div className={`${styles.stateCell} ${lead ? styles.stateCellLead : ''}`}>
      <div className={styles.stateLabel}>{label}</div>
      <div
        className={[
          styles.stateValue,
          small ? styles.stateValueSm : '',
          pending ? styles.statePending : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
        {unit && !pending ? <span className={styles.stateUnit}>{unit}</span> : null}
      </div>
      {meter !== undefined ? (
        <div className={styles.stateMeter}>
          <i className={styles.stateMeterFill} style={{ width: `${meter * 100}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Guarantee({
  index,
  title,
  proof,
  children,
}: {
  index: string;
  title: string;
  proof: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.guarantee}>
      <div className={styles.guaranteeIndex}>{index}</div>
      <h3 className={styles.guaranteeTitle}>{title}</h3>
      <p className={styles.guaranteeBody}>{children}</p>
      <div className={styles.guaranteeProof}>{proof}</div>
    </article>
  );
}

/**
 * Fires once when an element first enters the viewport.
 *
 * Disconnects immediately after: this drives an entrance, and re-running it on
 * every scroll back would turn a reveal into a flicker. Defaults to visible
 * where `IntersectionObserver` is missing, so the content is never gated
 * behind an API that failed to load.
 */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Fires just before the section enters view rather than a fifth of the
      // way in, so the reveal is already running by the time it is read.
      { threshold: 0, rootMargin: '0px 0px 80px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}
