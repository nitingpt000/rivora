import type {
  CSSProperties,
  ElementType,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from 'react';

/**
 * The wireframe frame every card, panel, figure and primary button wears.
 *
 * The Industry design system's central idiom (DESIGN-SYSTEM.md §Direction):
 * square-cornered, hairline-bordered, transparent, with `+` registration marks
 * at each corner. The four `<i class="corner">` children are not decoration —
 * the system's "Don't" list explicitly forbids dropping them from a framed
 * element, which is exactly the kind of rule that erodes when 41 screens each
 * hand-write the markup. So no screen does: they use this.
 */
export interface BlueprintProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick' | 'style'> {
  children?: ReactNode;
  /** Render as a different element. Defaults to `div`. */
  as?: ElementType;
  /** Omits the hairline border when the caller supplies its own. */
  bare?: boolean;
  /** Border colour override — accepts a token reference. */
  borderColor?: string;
  background?: string;
  padding?: CSSProperties['padding'];
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  /** Accessible name for a clickable frame. Falls back to its text content. */
  label?: string;
  /** Elevation step, for dialogs and floating surfaces. */
  elevation?: 'sm' | 'md' | 'lg';
  /**
   * Set when the frame renders as a `<button>`.
   *
   * `Button` renders its primary variant *through* a Blueprint, so this and the
   * inherited HTML attributes have to reach the element — otherwise a disabled
   * primary button still fires.
   */
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

export function Blueprint({
  children,
  as: Tag = 'div',
  bare = false,
  borderColor = 'var(--color-neutral-400)',
  background,
  padding,
  className,
  style,
  onClick,
  label,
  elevation,
  ...rest
}: BlueprintProps) {
  const classes = ['blueprint', elevation ? `elev-${elevation}` : null, className]
    .filter(Boolean)
    .join(' ');

  /**
   * A clickable frame is an interactive control, so it has to behave like one.
   *
   * Persona cards, custody options and sandbox fixtures are all selected by
   * clicking a framed panel. Rendering those as bare divs would put them out of
   * reach of the keyboard entirely — so when `onClick` is supplied the frame
   * takes a button role, enters the tab order, and responds to Enter and Space.
   */
  const interactive = Boolean(onClick) && Tag !== 'button';
  const onKeyDown = interactive
    ? (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }
    : undefined;

  return (
    <Tag
      {...rest}
      className={classes}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      style={{
        position: 'relative',
        border: bare ? undefined : `1px solid ${borderColor}`,
        background,
        padding,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {CORNERS.map((c) => (
        <i key={c} className={`corner ${c}`} />
      ))}
      {children}
    </Tag>
  );
}

/**
 * A blueprint-framed card. The `.card` class supplies the column layout and
 * the `.card-kicker` / `.card-title` type treatments.
 */
export interface CardProps extends Omit<BlueprintProps, 'as' | 'bare' | 'title'> {
  /** Uppercase tracked label above the card's figure. */
  kicker?: ReactNode;
  title?: ReactNode;
  /** Rendered at the top right of the kicker row. */
  aside?: ReactNode;
}

export function Card({ kicker, title, aside, children, className, ...rest }: CardProps) {
  return (
    <Blueprint className={['card', className].filter(Boolean).join(' ')} {...rest}>
      {(kicker || aside) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          {kicker ? <div className="card-kicker">{kicker}</div> : <span />}
          {aside}
        </div>
      )}
      {title && <div className="card-title">{title}</div>}
      {children}
    </Blueprint>
  );
}
