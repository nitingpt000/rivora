#!/usr/bin/env node
/**
 * Re-vendors the Industry design system from a handoff bundle.
 *
 *   pnpm --filter @rivora/tokens ds:sync -- <path-to-unzipped-handoff>
 *
 * The bundle's styles.css is copied verbatim except for one edit: the
 * Google Fonts @import is removed, because the app loads Barlow through
 * next/font and re-points --font-heading / --font-body at it. Keeping the
 * edit here — rather than by hand — means a future handoff can be re-synced
 * in one command without losing it or silently reintroducing a
 * render-blocking external stylesheet.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;700&family=Barlow+Condensed:wght@400;600&display=swap');\n";

const REPLACEMENT = `/* NOTE: the upstream @import of Barlow from Google Fonts is stripped on sync.
   Fonts are loaded by the app with next/font, which sets --font-heading and
   --font-body. See scripts/sync-design-system.mjs and README.md. */\n`;

const handoff = process.argv[2];
if (!handoff) {
  console.error('usage: ds:sync <path-to-unzipped-handoff>');
  process.exit(1);
}

const dsRoot = join(handoff, 'project', '_ds');
if (!existsSync(dsRoot)) {
  console.error(`no _ds directory under ${dsRoot}`);
  process.exit(1);
}

const themeDir = readdirSync(dsRoot).find((d) => d.startsWith('industry-'));
if (!themeDir) {
  console.error(`no industry-* theme found in ${dsRoot}`);
  process.exit(1);
}

const src = join(dsRoot, themeDir, 'styles.css');
let css = readFileSync(src, 'utf8');

if (css.includes(FONT_IMPORT)) {
  css = css.replace(FONT_IMPORT, REPLACEMENT);
} else {
  console.warn('warning: font @import not found — upstream may have changed it');
}

writeFileSync(join(pkgRoot, 'src', 'industry.css'), css);
writeFileSync(
  join(pkgRoot, 'DESIGN-SYSTEM.md'),
  readFileSync(join(dsRoot, themeDir, 'readme.md'), 'utf8'),
);

console.log(`synced ${themeDir} → packages/tokens/src/industry.css`);
