'use client';

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

import { Blueprint } from './blueprint';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  children: ReactNode;
  /** Compact 12px type, used for inline and table-row actions. */
  compact?: boolean;
  style?: CSSProperties;
}

/**
 * The primary button is the one solid object on the board and keeps its
 * registration marks (DESIGN-SYSTEM.md §Direction) — so it renders inside a
 * Blueprint. Every other variant is a line drawing.
 *
 * `danger` is not an Industry variant: it is the secondary button re-inked with
 * the semantic danger role, used for destructive operator actions.
 */
export function Button({
  variant = 'secondary',
  children,
  compact = false,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const base: CSSProperties = {
    fontSize: compact ? 12 : undefined,
    ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : null),
    ...style,
  };

  if (variant === 'primary') {
    // The primary button is the one solid object on the board and still wears
    // its registration marks, so it renders through a Blueprint. `onClick` is
    // passed explicitly because Blueprint's own click handler is a plain
    // callback, not a mouse-event handler; everything else is forwarded so
    // `disabled`, `type` and aria attributes reach the element.
    const { onClick, type, ...html } = rest;
    return (
      <Blueprint
        as="button"
        bare
        className="btn btn-primary"
        style={base}
        disabled={disabled}
        type={type ?? 'button'}
        onClick={onClick as (() => void) | undefined}
        {...(html as Record<string, never>)}
      >
        {children}
      </Blueprint>
    );
  }

  const className =
    variant === 'ghost' ? 'btn btn-ghost' : variant === 'danger' ? 'btn btn-secondary' : 'btn btn-secondary';

  const dangerInk: CSSProperties =
    variant === 'danger' ? { color: 'var(--color-danger)', borderColor: 'var(--color-danger)' } : {};

  return (
    <button className={className} disabled={disabled} style={{ ...dangerInk, ...base }} {...rest}>
      {children}
    </button>
  );
}

/** A right-aligned row of actions. The footer of nearly every panel and modal. */
export function ButtonRow({
  children,
  align = 'end',
  style,
}: {
  children: ReactNode;
  align?: 'start' | 'center' | 'end' | 'between';
  style?: CSSProperties;
}) {
  const justify =
    align === 'between'
      ? 'space-between'
      : align === 'center'
        ? 'center'
        : align === 'start'
          ? 'flex-start'
          : 'flex-end';

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: justify, flexWrap: 'wrap', ...style }}>
      {children}
    </div>
  );
}
