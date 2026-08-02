import type { CSSProperties, ReactNode } from 'react';

export type TagTone = 'accent' | 'neutral' | 'outline';

export function Tag({
  children,
  tone = 'neutral',
  color,
  style,
}: {
  children: ReactNode;
  tone?: TagTone;
  /** Re-inks an outline tag with a semantic role. */
  color?: string;
  style?: CSSProperties;
}) {
  const inked: CSSProperties = color ? { color, borderColor: color } : {};
  return (
    <span className={`tag tag-${tone}`} style={{ ...inked, ...style }}>
      {children}
    </span>
  );
}
