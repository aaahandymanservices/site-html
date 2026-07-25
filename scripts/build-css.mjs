import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

mkdirSync(join(ROOT, 'public/css'), { recursive: true });

const input = join(ROOT, 'scripts/tailwind-input.css');
const output = join(ROOT, 'public/css/tailwind.css');
const config = join(ROOT, 'tailwind.config.cjs');
const tailwind = join(ROOT, 'node_modules/.bin/tailwindcss');

if (existsSync(tailwind)) {
  execFileSync(
    tailwind,
    ['-c', config, '-i', input, '-o', output, '--minify'],
    { cwd: ROOT, stdio: 'inherit' },
  );

  console.log('Wrote', output);
} else if (existsSync(output)) {
  console.log('Tailwind CLI unavailable; using precompiled stylesheet at', output);
} else {
  throw new Error('Tailwind CLI and precompiled stylesheet are both unavailable.');
}

/*
 * The hand-authored theme stylesheet gets the same treatment as the Tailwind
 * output: the readable copy with its comments lives in scripts/, and the build
 * emits the minified file that pages actually link.
 *
 * It is render-blocking on every page, so the comments and indentation that
 * make it maintainable were costing roughly 2KB over the wire on the critical
 * path of every first visit.
 */
const themeSource = join(ROOT, 'scripts/site-theme.css');
const themeOutput = join(ROOT, 'public/css/site-theme.css');
const esbuild = join(ROOT, 'node_modules/.bin/esbuild');

if (!existsSync(themeSource)) {
  throw new Error(`Theme stylesheet source is missing at ${themeSource}.`);
}

if (existsSync(esbuild)) {
  execFileSync(
    esbuild,
    [themeSource, '--minify', `--outfile=${themeOutput}`, '--log-level=warning'],
    { cwd: ROOT, stdio: 'inherit' },
  );

  const saved = statSync(themeSource).size - statSync(themeOutput).size;
  console.log(`Wrote ${themeOutput} (${saved} bytes smaller than source)`);
} else {
  // Serving the unminified source is a size regression, not a broken page, so
  // a missing minifier must not fail the build.
  copyFileSync(themeSource, themeOutput);
  console.log('esbuild unavailable; copied theme stylesheet unminified to', themeOutput);
}

