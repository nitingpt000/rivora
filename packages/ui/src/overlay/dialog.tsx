'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { Blueprint } from '../primitives/blueprint';
import { Button } from '../primitives/button';

/**
 * A modal over a scrim.
 *
 * Every money movement in the product happens in one of these — draw, repay,
 * deposit, withdraw. Closing on Escape and on backdrop click, restoring focus,
 * and trapping the initial focus are handled here so the four call sites cannot
 * each get it half right.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  maxWidth = 640,
  labelledBy = 'riv-dialog-title',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-scrim)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflow: 'auto',
      }}
    >
      <Blueprint
        elevation="lg"
        borderColor="var(--color-neutral-500)"
        background="var(--color-bg)"
        style={{ maxWidth, width: '100%', padding: '26px 30px' }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? labelledBy : undefined}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          style={{ outline: 'none' }}
        >
          {title ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 16,
              }}
            >
              <div
                id={labelledBy}
                style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600 }}
              >
                {title}
              </div>
              <Button variant="ghost" onClick={onClose} aria-label="Close" compact>
                ✕
              </Button>
            </div>
          ) : null}
          {children}
        </div>
      </Blueprint>
    </div>
  );
}

/** The panel shown after a transaction settles, in place of the form. */
export function DialogReceipt({
  title,
  tx,
  children,
  onDone,
}: {
  title: ReactNode;
  tx?: ReactNode;
  children?: ReactNode;
  onDone: () => void;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--color-accent-800)',
          marginBottom: 10,
        }}
      >
        ✓ {title}
      </div>
      {tx ? <div style={{ marginBottom: 16 }}>{tx}</div> : null}
      {children ? <div style={{ marginBottom: 18 }}>{children}</div> : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** A bordered sub-panel inside a dialog: checks, costs, application order. */
export function DialogPanel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-neutral-300)',
        padding: '14px 18px',
        marginBottom: 12,
      }}
    >
      <div
        className="kicker"
        style={{ fontSize: 11, marginBottom: 8 }}
      >
        {title}
      </div>
      <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>{children}</div>
    </div>
  );
}
