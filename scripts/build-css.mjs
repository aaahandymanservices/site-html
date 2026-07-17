/*
 * build-css.mjs
 *
 * Compiles the site's Tailwind stylesheet once, ahead of time, into
 * public/css/tailwind.css (minified). This replaces the Tailwind Play CDN,
 * which shipped a ~400KB JavaScript runtime that recompiled the CSS in every
 * visitor's browser on every page load.
 *
 * Run it after adding new utility classes to any page or template:
 *
 *     node scripts/build-css.mjs
 *
 * It scans the content globs declared in tailwind.config.cjs, so only the
 * classes actually used on the site end up in the output.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

mkdirSync(join(ROOT, 'public/css'), { recursive: true });

const input = join(ROOT, 'scripts/tailwind-input.css');
const output = join(ROOT, 'public/css/tailwind.css');
const config = join(ROOT, 'tailwind.config.cjs');

execFileSync(
  'npx',
  ['--yes', 'tailwindcss@3.4.19', '-c', config, '-i', input, '-o', output, '--minify'],
  { cwd: ROOT, stdio: 'inherit' },
);

console.log('Wrote', output);
