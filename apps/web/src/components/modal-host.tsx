'use client';

import {
  ORIGINATION_FEE_PCT,
  VAULT,
  applyRepayment,
  num,
  pct,
  planWithdrawal,
  evaluateSpend,
  quoteDraw,
  usdc,
  withdrawalFeeRate,
} from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  Button,
  ButtonRow,
  Callout,
  CheckLine,
  Dialog,
  DialogPanel,
  DialogReceipt,
  Field,
  KeyValue,
  Mono,
  PresetRow,
  Select,
  TextInput,
  TxChip,
  checkMarkFor,
} from '@rivora/ui';

/**
 * Every money movement in the product happens here.
 *
 * Draw, repay, deposit and withdraw are modals rather than routes because each
 * is an action taken *against* the screen behind it — the borrower needs the
 * dashboard's numbers still visible while deciding, and the receipt has to land
 * back on the same context.
 */
export function ModalHost() {
  const modal = useProtocol((s) => s.modal);

  return (
    <>
      <DrawDialog open={modal === 'draw'} />
      <RepayDialog open={modal === 'repay'} />
      <DepositDialog open={modal === 'deposit'} />
      <WithdrawDialog open={modal === 'withdraw'} />
    </>
  );
}

function DrawDialog({ open }: { open: boolean }) {
  const s = useProtocol();
  const d = useDerived();
  const receipt = s.receipt?.kind === 'draw' ? s.receipt : null;

  const quote = quoteDraw({
    amount: parseFloat(s.drawAmount) || 0,
    available: d.available,
    status: s.status,
    tier: s.tier,
    owed: d.owed,
    dailyRevenue: s.dailyRevenue,
    repaymentBps: s.repaymentBps,
    borrowerRatePct: d.borrowerRatePct,
    vaultLiquidity: s.vaultLiquidity,
    vaultAssets: s.vaultAssets,
    bindingOk: s.bindingOk,
    // A draw is paid to the registered operating wallet, which is the
    // destination by construction — there is nothing here for an allowlist
    // to permit or refuse.
    destinationAllowed: true,
    // Previewed with the same function the server enforces with. These were
    // hardcoded `true`, so the dialog told every borrower their category was
    // permitted and the server never checked at all.
    categoryAllowed:
      !s.policy ||
      evaluateSpend(
        { amount: parseFloat(s.drawAmount) || 0, category: s.drawCategory, ownerAuthorised: true },
        {
          maxPayment: Number.POSITIVE_INFINITY,
          maxDaily: Number.POSITIVE_INFINITY,
          spentToday: 0,
          humanApprovalThreshold: Number.POSITIVE_INFINITY,
          allowedCategories: s.policy.allowedCategories,
          blockedCategories: s.policy.blockedCategories,
        },
      ).outcome === 'allowed',
    humanApprovalThreshold: s.policy?.humanApprovalThreshold ?? 0,
  });

  return (
    <Dialog open={open} onClose={s.closeModal} title={receipt ? undefined : 'Borrow USDC'}>
      {receipt ? (
        <DialogReceipt
          title={`${usdc(receipt.amount)} USDC transferred`}
          tx={<TxChip hash={receipt.tx} meta="Arc · finalized 0.6s" />}
          onDone={s.dismissReceipt}
        >
          <KeyValue label="Outstanding principal" value={`→ ${usdc(s.principal)} USDC`} />
          <KeyValue label="Available credit" value={`→ ${usdc(d.available)} USDC`} />
          <KeyValue label="Vault liquidity" value={`→ ${usdc(s.vaultLiquidity)} USDC`} />
          <KeyValue
            label="Projected payback"
            value={d.paybackDays ? `→ ${d.paybackDays} days` : '—'}
          />
        </DialogReceipt>
      ) : (
        <>
          <div style={{ fontSize: 13.5, marginBottom: 12 }}>
            Available credit <strong>{usdc(d.available)} USDC</strong>
          </div>

          <Field label="Amount (USDC)" style={{ marginBottom: 8 }}>
            <TextInput
              value={s.drawAmount}
              onChange={(v) => s.setDraft('drawAmount', v)}
              tabular
              inputMode="decimal"
            />
          </Field>
          <PresetRow>
            <Button variant="ghost" compact onClick={() => s.setDraft('drawAmount', '25')}>
              25
            </Button>
            <Button variant="ghost" compact onClick={() => s.setDraft('drawAmount', '50')}>
              50
            </Button>
            <Button
              variant="ghost"
              compact
              onClick={() => s.setDraft('drawAmount', String(Math.floor(d.available)))}
            >
              MAX
            </Button>
          </PresetRow>

          <div
            className="riv-grid riv-grid-2"
            style={{ gap: 12, marginBottom: 16 }}
          >
            <Field label="Use of funds">
              <Select
                value={s.drawCategory}
                onChange={(v) => s.setDraft('drawCategory', v)}
                options={[
                  'Model and data API expenses',
                  'Compute',
                  'Storage',
                  'Security & monitoring',
                  'Devops',
                ]}
              />
            </Field>
            <Field label="Destination">
              <Select
                value="operating"
                onChange={() => undefined}
                options={[`${s.profile?.operatingWallet ?? '—'} Operating wallet (registered)`]}
              />
            </Field>
          </div>

          <DialogPanel title="Policy and protocol checks">
            {quote.checks.map((c) => (
              <CheckLine
                key={c.key}
                mark={checkMarkFor(c.pass, c.severity)}
                value={c.value}
                detail={c.detail}
              >
                {c.label}
              </CheckLine>
            ))}
          </DialogPanel>

          {quote.needsHumanApproval ? (
            <Callout severity="warn">
              <strong>Human approval required.</strong> {usdc(quote.principal)} exceeds the{' '}
              {usdc(s.policy?.humanApprovalThreshold ?? 0)} agent policy threshold. This draw will be
              queued for owner-wallet signature from <Mono>{s.profile?.ownerWallet ?? '—'}</Mono>.
            </Callout>
          ) : null}

          <DialogPanel title="Cost of this draw">
            <KeyValue label="Principal" value={`${usdc(quote.principal)} USDC`} />
            <KeyValue
              label={`Origination fee ${pct(ORIGINATION_FEE_PCT * 100, 2)}`}
              value={`${usdc(quote.originationFee)} USDC`}
            />
            <KeyValue
              label={`Interest at ${pct(d.borrowerRatePct)} over ${quote.postPaybackDays ?? 0} days`}
              value={`${usdc(quote.estimatedInterest)} USDC`}
            />
            <KeyValue
              label="Estimated total repayment"
              value={`${usdc(quote.estimatedTotal)} USDC`}
              strong
              divider
            />
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 6 }}>
              Repaid automatically from ~{usdc(d.dailyRepayment)}/day of routed revenue.
            </div>
          </DialogPanel>

          {s.mutationError ? <Callout severity="danger">{s.mutationError}</Callout> : null}

          <ButtonRow>
            <Button variant="ghost" onClick={s.closeModal} disabled={s.pending}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!quote.permitted || s.pending} onClick={s.draw}>
              {s.pending ? 'Requesting…' : `Request ${usdc(quote.principal)} USDC`}
            </Button>
          </ButtonRow>
        </>
      )}
    </Dialog>
  );
}

function RepayDialog({ open }: { open: boolean }) {
  const s = useProtocol();
  const d = useDerived();
  const receipt = s.receipt?.kind === 'repay' ? s.receipt : null;

  const requested = Math.min(parseFloat(s.repayAmount) || 0, d.owed);
  const applied = applyRepayment(requested, s.principal, s.accruedInterest);

  return (
    <Dialog
      open={open}
      onClose={s.closeModal}
      title={receipt ? undefined : 'Repay manually'}
      maxWidth={600}
    >
      {receipt ? (
        <DialogReceipt
          title={`${usdc(receipt.amount)} USDC repaid`}
          tx={<TxChip hash={receipt.tx} meta="Arc · finalized 0.6s" />}
          onDone={s.dismissReceipt}
        >
          <KeyValue label="Outstanding debt" value={`→ ${usdc(d.owed)} USDC`} />
          <KeyValue label="Available credit" value={`→ ${usdc(d.available)} USDC`} />
          {receipt.clearsDebt ? (
            <KeyValue label="Status" value="REPAID · reassessment triggered" />
          ) : null}
        </DialogReceipt>
      ) : (
        <>
          <div style={{ fontSize: 13.5, marginBottom: 12 }}>
            Total owed <strong>{usdc(d.owed)} USDC</strong>{' '}
            <span style={{ color: 'var(--color-neutral-600)' }}>
              — interest {usdc(s.accruedInterest)} · principal {usdc(s.principal)}
            </span>
          </div>

          <Field label="Amount (USDC)" style={{ marginBottom: 8 }}>
            <TextInput
              value={s.repayAmount}
              onChange={(v) => s.setDraft('repayAmount', v)}
              tabular
              inputMode="decimal"
            />
          </Field>
          <PresetRow>
            <Button variant="ghost" compact onClick={() => s.setDraft('repayAmount', '500')}>
              500
            </Button>
            <Button variant="ghost" compact onClick={() => s.setDraft('repayAmount', '1000')}>
              1,000
            </Button>
            <Button
              variant="secondary"
              compact
              onClick={() => s.setDraft('repayAmount', d.owed.toFixed(2))}
            >
              Repay in full
            </Button>
          </PresetRow>

          <Field label="From wallet" style={{ marginBottom: 16 }}>
            <Select
              value="operating"
              onChange={() => undefined}
              options={[`${s.profile?.operatingWallet ?? '—'} Operating wallet`]}
            />
          </Field>

          <DialogPanel title="Application order">
            <KeyValue label="1  Accrued interest" value={`${usdc(applied.toInterest)} USDC`} />
            <KeyValue label="2  Outstanding principal" value={`${usdc(applied.toPrincipal)} USDC`} />
            <KeyValue
              label="3  Excess returned to operating wallet"
              value={`${usdc(applied.excess)} USDC`}
            />
            <KeyValue
              label="Outstanding debt after"
              value={`${usdc(d.owed)} → ${usdc(Math.max(0, d.owed - requested))} USDC`}
              divider
            />
            <KeyValue
              label="Available credit after"
              value={`${usdc(d.available)} → ${usdc(Math.min(s.limit, d.available + applied.toPrincipal))} USDC`}
            />
            {applied.clearsDebt ? (
              <KeyValue label="Status" value="→ REPAID · allocation 20/2/78 → 0/2/98" />
            ) : null}
          </DialogPanel>

          {applied.clearsDebt ? (
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginBottom: 14 }}>
              ⓘ Full repayment triggers reassessment and updates your reputation record.
            </div>
          ) : null}

          {s.mutationError ? <Callout severity="danger">{s.mutationError}</Callout> : null}

          <ButtonRow>
            <Button variant="ghost" onClick={s.closeModal} disabled={s.pending}>
              Cancel
            </Button>
            <Button variant="primary" disabled={requested <= 0 || s.pending} onClick={s.repay}>
              {s.pending ? 'Repaying…' : `Repay ${usdc(requested)} USDC`}
            </Button>
          </ButtonRow>
        </>
      )}
    </Dialog>
  );
}

function DepositDialog({ open }: { open: boolean }) {
  const s = useProtocol();
  const d = useDerived();
  const receipt = s.receipt?.kind === 'deposit' ? s.receipt : null;

  const amount = Math.min(parseFloat(s.depositAmount) || 0, s.lpWallet);
  const shares = amount / s.sharePrice;
  const postAssets = s.vaultAssets + amount;
  const postUtilization =
    d.outstandingProtocolWide / (s.vaultLiquidity + amount + d.outstandingProtocolWide);

  return (
    <Dialog
      open={open}
      onClose={s.closeModal}
      title={receipt ? undefined : 'Deposit USDC'}
      maxWidth={620}
    >
      {receipt ? (
        <DialogReceipt
          title={`${usdc(receipt.amount)} USDC deposited`}
          tx={<TxChip hash={receipt.tx} meta="Arc · finalized 0.6s" />}
          onDone={s.dismissReceipt}
        >
          <div style={{ fontSize: 13.5 }}>
            You received {usdc(receipt.shares ?? 0)} RIV-USDC shares. New vault total{' '}
            {usdc(s.vaultAssets)} USDC.
          </div>
        </DialogReceipt>
      ) : (
        <>
          <div style={{ fontSize: 13.5, marginBottom: 12 }}>
            Wallet balance <strong>{usdc(s.lpWallet)} USDC</strong>{' '}
            <Mono>{s.portfolio?.address ?? s.user?.address ?? '—'}</Mono>
          </div>

          <Field label="Amount (USDC)" style={{ marginBottom: 8 }}>
            <TextInput
              value={s.depositAmount}
              onChange={(v) => s.setDraft('depositAmount', v)}
              tabular
              inputMode="decimal"
            />
          </Field>
          <PresetRow>
            {[0.25, 0.5, 0.75, 1].map((p) => (
              <Button
                key={p}
                variant="ghost"
                compact
                onClick={() => s.setDraft('depositAmount', (s.lpWallet * p).toFixed(2))}
              >
                {p === 1 ? 'MAX' : `${p * 100}%`}
              </Button>
            ))}
          </PresetRow>

          <div style={{ fontSize: 13, marginBottom: 14 }}>
            You receive <strong>{usdc(shares)} RIV-USDC</strong> shares at{' '}
            {s.sharePrice.toFixed(6)} per share.
          </div>

          <DialogPanel title="After deposit">
            <KeyValue
              label="Total vault assets"
              value={`${usdc(s.vaultAssets)} → ${usdc(postAssets)} USDC`}
            />
            <KeyValue
              label="Utilization"
              value={`${pct(d.utilization * 100)} → ${pct(postUtilization * 100)}`}
            />
            <KeyValue
              label="Your share of the vault"
              value={pct(postAssets > 0 ? (amount / postAssets) * 100 : 0)}
            />
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 8 }}>
              ⓘ Depositing lowers utilization, which lowers the rate for everyone. Your yield
              estimate reflects the post-deposit rate, not the current one.
            </div>
          </DialogPanel>

          <DialogPanel title="What you are underwriting">
            <CheckLine mark="pass">
              Loans amortize continuously — ~2.2% of principal returns daily
            </CheckLine>
            <CheckLine mark="pass">Protocol first-loss tranche covers 10.0% of vault assets</CheckLine>
            <CheckLine mark="pass">
              {pct(VAULT.bufferFloorPct * 100, 0)} liquidity buffer is enforced by the vault contract
            </CheckLine>
            <CheckLine mark="warn">
              Withdrawals above the buffer enter a FIFO queue funded by repayments
            </CheckLine>
            <CheckLine mark="warn">
              Losses are socialized proportionally, including to queued positions
            </CheckLine>
            <CheckLine mark="warn">
              Vault shares may be securities in your jurisdiction. Testnet only.
            </CheckLine>
          </DialogPanel>

          {s.mutationError ? <Callout severity="danger">{s.mutationError}</Callout> : null}

          <ButtonRow>
            <Button variant="ghost" onClick={s.closeModal} disabled={s.pending}>
              Cancel
            </Button>
            <Button variant="primary" disabled={amount <= 0 || s.pending} onClick={s.deposit}>
              {s.pending ? 'Depositing…' : `Deposit ${usdc(amount)} USDC`}
            </Button>
          </ButtonRow>
        </>
      )}
    </Dialog>
  );
}

function WithdrawDialog({ open }: { open: boolean }) {
  const s = useProtocol();
  const d = useDerived();
  const receipt = s.receipt?.kind === 'withdraw' ? s.receipt : null;

  const positionValue = s.lpShares * s.sharePrice;
  const requested = Math.min(parseFloat(s.withdrawAmount) || 0, positionValue);
  const plan = planWithdrawal(requested, s.vaultLiquidity, s.vaultAssets, d.utilization);
  const feeRate = withdrawalFeeRate(d.utilization);

  return (
    <Dialog
      open={open}
      onClose={s.closeModal}
      title={receipt ? undefined : 'Withdraw'}
      maxWidth={620}
    >
      {receipt ? (
        <DialogReceipt
          title={`${usdc(receipt.amount)} USDC withdrawn`}
          tx={<TxChip hash={receipt.tx} meta="Arc · finalized 0.6s" />}
          onDone={s.dismissReceipt}
        >
          {receipt.queued ? (
            <div style={{ fontSize: 13.5 }}>
              ⏱ {usdc(receipt.queued)} USDC entered the FIFO queue. Track it on the
              vault dashboard.
            </div>
          ) : null}
        </DialogReceipt>
      ) : (
        <>
          <div style={{ fontSize: 13.5, marginBottom: 12 }}>
            Your position <strong>{usdc(positionValue)} USDC</strong> · {num(s.lpShares)} shares
          </div>

          <Field label="Amount (USDC)" style={{ marginBottom: 8 }}>
            <TextInput
              value={s.withdrawAmount}
              onChange={(v) => s.setDraft('withdrawAmount', v)}
              tabular
              inputMode="decimal"
            />
          </Field>
          <PresetRow>
            {[0.25, 0.5, 1].map((p) => (
              <Button
                key={p}
                variant="ghost"
                compact
                onClick={() => s.setDraft('withdrawAmount', (positionValue * p).toFixed(2))}
              >
                {p === 1 ? 'MAX' : `${p * 100}%`}
              </Button>
            ))}
          </PresetRow>

          <DialogPanel title="How this will be served">
            <KeyValue
              label={`Available now (liquidity − ${usdc(plan.bufferFloor)} buffer)`}
              value={`${usdc(plan.availableNow)} USDC`}
            />
            <KeyValue label="Your request" value={`${usdc(requested)} USDC`} />

            {plan.queued <= 0 ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--color-ok)', marginTop: 10 }}>
                  ✓ Served immediately in full. No queue.
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 6 }}>
                  Withdrawal fee at {pct(d.utilization * 100)} utilization:{' '}
                  {usdc(plan.fee)} USDC ({pct(feeRate * 100)}). The fee applies only above 80%
                  utilization, rising linearly to 1.00% at 95%, and is paid to remaining liquidity
                  providers.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--color-warn)', marginTop: 10 }}>
                  ⏱ Partially queued — immediate {usdc(plan.immediate)} · queued {usdc(plan.queued)}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: 4,
                    fontSize: 12.5,
                    marginTop: 8,
                    color: 'var(--color-neutral-700)',
                  }}
                >
                  <div>
                    Funded from repayments at ~{usdc(VAULT.queueFundingRatePerDay)} USDC/day
                    (trailing 7-day rate). Queued withdrawals are funded before any new borrower
                    draw is approved.
                  </div>
                  <CheckLine mark="warn">
                    Queued shares stop accruing interest at the moment of queue entry.
                  </CheckLine>
                  <CheckLine mark="warn">
                    Queued positions still bear their proportional share of any loss realized before
                    the claim is made.
                  </CheckLine>
                  <CheckLine mark="pass">
                    You may cancel at any time before claiming. Shares and accrual resume.
                  </CheckLine>
                </div>
              </>
            )}
          </DialogPanel>

          {s.mutationError ? <Callout severity="danger">{s.mutationError}</Callout> : null}

          <ButtonRow>
            <Button variant="ghost" onClick={s.closeModal} disabled={s.pending}>
              Cancel
            </Button>
            <Button variant="primary" disabled={requested <= 0 || s.pending} onClick={s.withdraw}>
              {s.pending
                ? 'Withdrawing…'
                : plan.queued > 0
                  ? `Withdraw ${usdc(plan.immediate)} and queue ${usdc(plan.queued)}`
                  : `Withdraw ${usdc(requested)} USDC`}
            </Button>
          </ButtonRow>
        </>
      )}
    </Dialog>
  );
}
