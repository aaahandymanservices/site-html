import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');

// Font Awesome utility/base classes share the `fa-` prefix with real icon
// names. They are defined in the core stylesheet, never as `content` rules, so
// they only add noise to the usage scan.
const NON_ICON_CLASSES = new Set([
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
 * Collect every Font Awesome icon name referenced anywhere the browser could
 * end up rendering it: the built pages, the client scripts that inject markup
 * at runtime, and the generators that emit pages.
 */
export function collectUsedIcons() {
  const files = [
    ...walk(join(ROOT, 'public')),
    ...walk(join(ROOT, 'scripts')),
    ...walk(join(ROOT, 'netlify')),
  ];

  const used = new Set();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bfa-([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)) {
      const name = match[1];
      if (!NON_ICON_CLASSES.has(name)) used.add(name);
    }
  }
  return used;
}
