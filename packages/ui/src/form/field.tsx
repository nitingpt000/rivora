'use client';

import type { CSSProperties, ReactNode } from 'react';

export function Field({
  label,
  children,
  hint,
  style,
}: {
  label?: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="field" style={style}>
      {label ? <label>{label}</label> : null}
      {children}
      {hint ? (
        <p style={{ fontSize: 12, color: 'var(--color-neutral-600)', margin: '6px 0 0' }}>{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  mono = false,
  tabular = false,
  placeholder,
  inputMode,
  style,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  tabular?: boolean;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric' | 'text' | 'url';
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <input
      id={id}
      className="input"
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        fontSize: mono ? 13 : undefined,
        fontVariantNumeric: tabular ? 'tabular-nums' : undefined,
        ...style,
      }}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  style,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <select
      id={id}
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={style}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/**
 * The system builds radios on native inputs with a drawn dot. Reimplemented
 * here rather than reused from `.radio` because these appear as full-width
 * selectable cards on the custody step, not inline choices.
 */
export function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        height: 14,
        border: '1px solid var(--color-accent)',
        borderRadius: '50%',
        position: 'relative',
        display: 'inline-block',
        flexShrink: 0,
        marginTop: 2,
      }}
    >
      {checked ? (
        <span
          style={{
            position: 'absolute',
            inset: 3,
            background: 'var(--color-accent)',
            borderRadius: '50%',
          }}
        />
      ) : null}
    </span>
  );
}

export function RadioRow({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onSelect}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <RadioDot checked={checked} />
      <span>{children}</span>
    </label>
  );
}

/** The square checkbox used by the onboarding terms list. */
export function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        cursor: 'pointer',
        fontSize: 13.5,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden
        style={{
          width: 15,
          height: 15,
          border: '1px solid var(--color-accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--color-accent-700)',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {checked ? '✕' : ''}
      </span>
      <span>{children}</span>
    </label>
  );
}

/** Amount presets — 25 / 50 / MAX. */
export function PresetRow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>{children}</div>;
}
