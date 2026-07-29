import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';

/*
 * Browser scripts get the same treatment as the stylesheets (see
 * scripts/build-css.mjs): the readable copy with its comments lives in
 * scripts/js/, and the build emits the minified file that pages actually load.
 *
 * Filenames are kept byte for byte, so every <script src>, the service worker
 * precache list, and the dynamic import inside chat-loader.js all keep working
 * without a rewrite step. What changes is the payload: comments and whitespace
 * are roughly a third of these files, and site.js plus chat-loader.js are
 * requested on every page of the site.
 *
 * These are plain scripts, not modules, and bundling is deliberately off. Each
 * one is already a self-contained IIFE, and the handful of names they share
 * across files are explicit window properties (window.AAAGiftCertificate,
 * window.__aaaOpenChat), which a minifier never renames. Adding --bundle would
 * only change how the files are parsed, with nothing to gain.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE_DIR = join(ROOT, 'scripts/js');
const OUTPUT_DIR = join(ROOT, 'public/js');
const esbuild = join(ROOT, 'node_modules/.bin/esbuild');

if (!existsSync(SOURCE_DIR)) {
  throw new Error(`Script sources are missing at ${SOURCE_DIR}.`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const sources = readdirSync(SOURCE_DIR)
  .filter((name) => name.endsWith('.js'))
  .sort();

if (sources.length === 0) {
  throw new Error(`No scripts found in ${SOURCE_DIR}.`);
}

let savedTotal = 0;

for (const name of sources) {
  const source = join(SOURCE_DIR, name);
  const output = join(OUTPUT_DIR, name);

  if (existsSync(esbuild)) {
    execFileSync(
      esbuild,
      [source, '--minify', `--outfile=${output}`, '--charset=utf8', '--log-level=warning'],
      { cwd: ROOT, stdio: 'inherit' },
    );

    const saved = statSync(source).size - statSync(output).size;
    savedTotal += saved;
    console.log(`Wrote public/js/${name} (${saved} bytes smaller than source)`);
  } else {
    // Serving the unminified source is a size regression, not a broken page, so
    // a missing minifier must not fail the build.
    copyFileSync(source, output);
    console.log(`esbuild unavailable; copied public/js/${name} unminified`);
  }
}

if (savedTotal > 0) {
  console.log(`Minified ${sources.length} script(s), ${savedTotal} bytes saved in total.`);
}
