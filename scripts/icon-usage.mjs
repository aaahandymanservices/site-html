import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');

// Font Awesome utility/base classes share the `fa-` prefix with real icon
// names. They are defined in the core stylesheet, never as `content` rules, so
// they only add noise to the icon-name scan -- but the icon stylesheet also
// drops the ones the markup never applies, so which of them appear is worth
// reporting separately (see collectIconUsage).
export const UTILITY_CLASSES = new Set([
  'solid', 'regular', 'brands', 'light', 'thin', 'duotone', 'sharp',
  '2xs', 'xs', 'sm', 'lg', 'xl', '2xl', '1x', '2x', '3x', '4x', '5x',
  '6x', '7x', '8x', '9x', '10x',
  'fw', 'ul', 'li', 'border', 'pull-left', 'pull-right', 'inverse',
  'stack', 'stack-1x', 'stack-2x', 'layers',
  'spin', 'spin-reverse', 'spin-pulse', 'pulse', 'beat', 'beat-fade',
  'fade', 'bounce', 'shake', 'flip', 'flip-horizontal', 'flip-vertical',
  'flip-both', 'rotate-90', 'rotate-180', 'rotate-270', 'rotate-by',
  'sr-only', 'sr-only-focusable', 'swap-opacity',
  // Webfont filenames (/fonts/fa-solid-900.woff2), not icon names.
  'solid-900', 'brands-400', 'regular-400',
]);

// The style family classes are what selects the font itself. They are always
// kept regardless of the scan: `fas`/`fab` shorthands are what most of this
// site's markup uses, and a page that renders no icons still costs nothing for
// three font-family rules.
const ALWAYS_KEEP = new Set(['solid', 'regular', 'brands', 'classic', 'sharp', 'light', 'thin', 'duotone']);

const SCAN_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.mts', '.json']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

/**
 * Scan every place the browser could end up rendering an icon -- the built
 * pages, the client scripts that inject markup at runtime, and the generators
 * that emit pages -- and split the `fa-*` tokens found there into icon names
 * and Font Awesome utility classes.
 */
export function collectIconUsage() {
  const files = [
    ...walk(join(ROOT, 'public')),
    ...walk(join(ROOT, 'scripts')),
    ...walk(join(ROOT, 'netlify')),
  ];

  const icons = new Set();
  const utilities = new Set(ALWAYS_KEEP);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bfa-([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)) {
      const name = match[1];
      if (UTILITY_CLASSES.has(name)) utilities.add(name);
      else icons.add(name);
    }
  }
  return { icons, utilities };
}

/** Icon names only; see collectIconUsage for the full result. */
export function collectUsedIcons() {
  return collectIconUsage().icons;
}
