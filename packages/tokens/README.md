# @rivora/tokens

The visual foundation. Two stylesheets and a set of typed handles onto their custom properties.

## What is in here

| File | Origin | May you edit it? |
| --- | --- | --- |
| `src/industry.css` | Vendored from the design-system handoff | **No.** Re-sync with `ds:sync` instead. |
| `src/rivora.css` | Written here | Yes — this is the application layer. |
| `src/index.ts` | Written here | Yes. |
| `DESIGN-SYSTEM.md` | Vendored | No. |

`industry.css` is the design system's own source of truth: the palette, the 100–900 tonal ramps, Barlow Condensed over Barlow, the spacing and radius scales, and the base component classes (`.btn`, `.card`, `.table`, `.tag`, `.input`, `.blueprint`). It is copied byte-for-byte from the handoff apart from a single documented edit — the Google Fonts `@import` is stripped, because the app loads Barlow through `next/font` and re-points `--font-heading` / `--font-body` at it.

`rivora.css` adds only what the product needs and the design system does not define:

- **Semantic status roles** — `--color-ok`, `--color-warn`, `--color-restrict`, `--color-danger` and their tinted grounds. The Industry palette is deliberately mono steel; borrower lifecycle states and check outcomes need meaning-bearing hues. These are the only non-accent colours in the product.
- **`--font-mono`** — addresses, hashes and machine output.
- **Layout measures** — the four content widths every screen is laid out on.
- **`.riv-grid-*`** — the responsive collapse from screens.md §13.3, so no screen writes its own media query.
- **`.tabular`, `.mono`, `.kicker`** — the three text treatments that appear on nearly every screen.

## Re-syncing the design system

```bash
pnpm --filter @rivora/tokens ds:sync -- /path/to/unzipped-handoff
```

Then diff `src/industry.css`. If a token was renamed, `src/index.ts` will still compile but will emit `var()` references that resolve to nothing — check the ramp names before shipping.

## Using the tokens from TypeScript

```tsx
import { color, font } from '@rivora/tokens';

<span style={{ color: color.ok, fontFamily: font.mono }}>✓</span>;
```

Prefer this over writing `var(--color-ok)` inline. A renamed token then fails at compile time rather than rendering the CSS default.
