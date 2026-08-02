/**
 * @rivora/ui — the Rivora component library.
 *
 * Built on the Industry design system (`@rivora/tokens`). Nothing in here
 * hard-codes a colour, a font or a spacing value the tokens already carry, and
 * nothing re-implements a class the system already ships — components compose
 * `.btn`, `.card`, `.table`, `.tag`, `.input` and `.blueprint` rather than
 * shadowing them.
 *
 * The rule the library exists to enforce: a screen may lay things out, but it
 * may not decide what a figure, a status, a check mark or a framed panel looks
 * like. Those decisions live here once.
 */

// primitives
export { Blueprint, Card } from './primitives/blueprint';
export type { BlueprintProps, CardProps } from './primitives/blueprint';
export { Button, ButtonRow } from './primitives/button';
export type { ButtonProps, ButtonVariant } from './primitives/button';
export { Tag } from './primitives/tag';
export type { TagTone } from './primitives/tag';
export { Kicker, Mono, Muted, Note } from './primitives/text';

// data display
export { Money, Figure, Percent, Delta } from './data/figure';
export { Meter, SegmentedMeter, BarRow, Progress } from './data/meter';
export { DataTable } from './data/table';
export type { Column, DataTableProps } from './data/table';
export { KeyValue, KeyValueList, StatCell, Stat } from './data/key-value';
export { CheckLine, checkMarkFor } from './data/check-line';
export type { CheckMark } from './data/check-line';
export { Sparkbars, ThresholdPlot, StepChart } from './data/sparkbars';
export { Terminal, TerminalLine, CodeBlock } from './data/terminal';

// feedback
export { Banner, Callout } from './feedback/banner';
export { StatusPill, TierBadge, TxChip } from './feedback/status';

// layout
export { Page, PageHeader, Section, Grid, Stack } from './layout/page';
export type { Measure } from './layout/page';

// form
export {
  Field,
  TextInput,
  Select,
  RadioDot,
  RadioRow,
  CheckRow,
  PresetRow,
} from './form/field';

// overlay
export { Dialog, DialogReceipt, DialogPanel } from './overlay/dialog';
