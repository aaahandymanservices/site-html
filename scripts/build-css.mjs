import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';

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
 * It is render-blocking on every page because it carries the @font-face rules
 * for the self-hosted brand fonts and the icon glyph box reservations the
 * first paint depends on, so the comments and indentation that make it
 * maintainable were costing roughly 2KB over the wire on the critical path of
 * every first visit.
 */
const themeSource = join(ROOT, 'scripts/site-theme.css');
const themeOutput = join(ROOT, 'public/css/site-theme.css');
// The printable aging-in-place assessment's styles live in their own source
// file and are linked only by that one page, so the @media print rules no
// longer count as unused CSS on the other 89 documents.
const printSource = join(ROOT, 'scripts/print-assessment.css');
const printOutput = join(ROOT, 'public/css/print-assessment.css');
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

  /*
   * Purge unused CSS rules from the minified theme stylesheet.
   *
   * The theme source carries rules for every component the site has ever
   * shipped, but not every component appears on every page -- and not every
   * rule still has matching markup at all. Rather than prune the source by
   * hand (fragile, and easy to miss a class that only a JS module adds), the
   * build collects every class name the live site actually uses -- from every
   * HTML file under public/, every browser script under scripts/js/, and
   * every build module under scripts/*.mjs that generates markup -- and drops
   * any minified rule whose selector is built entirely from classes that never
   * appear in that set. @font-face, @keyframes, @media, element, and pseudo-
   * element rules are kept regardless: they do not carry class selectors that
   * can go stale, and the purge only ever removes a rule whose class selectors
   * are all un referenced.
   */
  const beforePurge = statSync(themeOutput).size;
  const purged = purgeThemeCss(themeOutput);
  if (purged !== null) {
    writeFileSync(themeOutput, purged, 'utf8');
    const afterPurge = statSync(themeOutput).size;
    console.log(`Purged ${beforePurge - afterPurge} bytes of unused CSS from ${themeOutput}`);
  }

  const saved = statSync(themeSource).size - statSync(themeOutput).size;
  console.log(`Wrote ${themeOutput} (${saved} bytes smaller than source)`);

  if (existsSync(printSource)) {
    execFileSync(
      esbuild,
      [printSource, '--minify', `--outfile=${printOutput}`, '--log-level=warning'],
      { cwd: ROOT, stdio: 'inherit' },
    );
    console.log('Wrote', printOutput);
  } else {
    throw new Error(`Print stylesheet source is missing at ${printSource}.`);
  }
} else {
  // Serving the unminified source is a size regression, not a broken page, so
  // a missing minifier must not fail the build.
  copyFileSync(themeSource, themeOutput);
  console.log('esbuild unavailable; copied theme stylesheet unminified to', themeOutput);
  if (existsSync(printSource)) copyFileSync(printSource, printOutput);
}

/*
 * Purge implementation.
 *
 * Walks the minified CSS, collecting the set of class names the live site
 * uses, then removes top-level rules (and rules inside @media blocks) whose
 * selector contains at least one class and whose *every* class is un
 * referenced. A selector with a used class is kept even if it also lists an
 * unused one, so a compound `.a .b` where `.a` is live stays. @-rules,
 * element selectors, and selector lists without a class are always kept.
 */
function collectUsedClassNames() {
  const names = new Set();
  const scanDir = (dir) => {
    let r = [];
    try { for (const f of readdirSync(dir)) { const p = join(dir, f); const s = statSync(p); if (s.isDirectory()) r = r.concat(scanDir(p)); else r.push(p); } } catch {}
    return r;
  };
  // Collect class names from `class="a b c"`, `class='a b c'`, and unquoted
  // `class=a` attributes. The quoted forms can carry several classes separated
  // by spaces, so the whole attribute value is captured before splitting.
  const addClassesFromString = (text) => {
    for (const m of text.matchAll(/class=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      const val = m[1] ?? m[2] ?? m[3] ?? '';
      for (const cls of val.split(/\s+/)) if (cls) names.add(cls);
    }
  };
  const htmlFiles = scanDir(join(ROOT, 'public')).filter((f) => f.endsWith('.html'));
  for (const f of htmlFiles) {
    const c = readFileSync(f, 'utf8');
    addClassesFromString(c);
    // Inline <script> blocks in HTML carry class names the purge also needs to
    // see: `className="web-checkbox ..."` and `classList.add("checked")` in
    // the aging-in-place guide's checklist, and the same patterns in every
    // other page-embedded script. The HTML class-attribute scan above only
    // matches `class=`, not `className=` or `classList.*`, so the same JS
    // patterns used for standalone scripts are run against the HTML text too.
    for (const m of c.matchAll(/classList\.(?:add|toggle|remove|contains)\(["'`]([^"'`]+)["'`]/g)) names.add(m[1]);
    for (const m of c.matchAll(/className\s*=\s*["'`]([^"'`]+)["'`]/g)) for (const cls of m[1].split(/\s+/)) if (cls) names.add(cls);
    for (const m of c.matchAll(/["'`]([^"'`]{1,120})["'`]/g)) {
      const s = m[1];
      for (const cm of s.matchAll(/\.([a-zA-Z_][\w-]*(?:\\:[\w-]*)*)/g)) names.add(cm[1].replace(/\\:/g, ':'));
      if (/^[a-zA-Z_][\w-]*(?:\s+[a-zA-Z_][\w-]*)*$/.test(s)) for (const cls of s.split(/\s+/)) if (cls) names.add(cls);
    }
  }
  const jsDirs = [join(ROOT, 'public/js'), join(ROOT, 'scripts/js')];
  for (const dir of jsDirs) {
    for (const f of scanDir(dir).filter((f) => f.endsWith('.js'))) {
      const c = readFileSync(f, 'utf8');
      for (const m of c.matchAll(/classList\.(?:add|toggle|remove|contains)\(["'`]([^"'`]+)["'`]/g)) names.add(m[1]);
      for (const m of c.matchAll(/className\s*=\s*["'`]([^"'`]+)["'`]/g)) for (const cls of m[1].split(/\s+/)) if (cls) names.add(cls);
      // Class names that only appear inside quoted strings in JS are not
      // caught by the patterns above: `querySelectorAll('.svc-filter-chip')`
      // carries the class behind a dot in a selector string, and a ternary
      // like `el.className = ok ? 'a' : 'a b'` assigns a bare class name
      // (no dot, no className= match because of the ternary). Both shapes
      // are common in the booking widget (the `bw-window__status--taken`
      // variant) and the service-area filter (`svc-filter-chip`). Collect
      // every dotted token inside a quoted string (the selector-string case)
      // and every space-separated token of a quoted string that matches a
      // class name the CSS already declares (the bare-name assignment case),
      // so rules that are live only through JS injection are kept.
      for (const m of c.matchAll(/["'`]([^"'`]{1,120})["'`]/g)) {
        const s = m[1];
        for (const cm of s.matchAll(/\.([a-zA-Z_][\w-]*(?:\\:[\w-]*)*)/g)) names.add(cm[1].replace(/\\:/g, ':'));
        if (/^[a-zA-Z_][\w-]*(?:\s+[a-zA-Z_][\w-]*)*$/.test(s)) for (const cls of s.split(/\s+/)) if (cls) names.add(cls);
      }
      addClassesFromString(c);
    }
  }
  const mjsFiles = readdirSync(join(ROOT, 'scripts')).filter((f) => f.endsWith('.mjs'));
  for (const f of mjsFiles) {
    const c = readFileSync(join(ROOT, 'scripts', f), 'utf8');
    addClassesFromString(c);
  }
  return names;
}

function purgeThemeCss(filePath) {
  let css = readFileSync(filePath, 'utf8');
  const used = collectUsedClassNames();

  // Parse the minified CSS into top-level blocks, tracking @media groups so
  // rules inside them are purged too. A block is kept unless its selector is
  // a class-only rule whose every class is unused.
  const isUnused = (selector) => {
    // Tailwind utility classes escape the variant colon in CSS as `\:` (e.g.
    // `.focus\:outline-none:hover`). The class names collected from HTML/JS
    // carry the literal colon (`focus:outline-none`), so the class-name
    // pattern has to keep the escaped colon in the match and then unescape
    // it for the lookup -- a bare `:` in the selector is a CSS pseudo
    // separator (`:hover`, `:after`), not part of the class name, so it has
    // to stay as the boundary it is. Without this, every Tailwind variant
    // rule reads as a single un-prefixed class (e.g. `focus`) that is never
    // in the used set, and rules that are live get purged.
    const classes = [...selector.matchAll(/\.([a-zA-Z_][\w-]*(?:\\:[a-zA-Z_][\w-]*)*)/g)].map((m) => m[1].replace(/\\:/g, ':'));
    if (classes.length === 0) return false;
    return classes.every((c) => !used.has(c));
  };

  let out = '';
  let i = 0;
  while (i < css.length) {
    // skip whitespace
    while (i < css.length && /\s/.test(css[i])) { out += css[i]; i++; }
    if (i >= css.length) break;
    // find the next selector boundary
    const brace = css.indexOf('{', i);
    if (brace === -1) { out += css.slice(i); break; }
    const selector = css.slice(i, brace).trim();
    // find the matching close brace
    let depth = 1, j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    if (selector.startsWith('@media') || selector.startsWith('@supports')) {
      // recurse into the media query body
      const inner = css.slice(brace + 1, j - 1);
      let innerOut = '';
      let k = 0;
      while (k < inner.length) {
        while (k < inner.length && /\s/.test(inner[k])) { innerOut += inner[k]; k++; }
        if (k >= inner.length) break;
        const ib = inner.indexOf('{', k);
        if (ib === -1) { innerOut += inner.slice(k); break; }
        const isel = inner.slice(k, ib).trim();
        let d2 = 1, l2 = ib + 1;
        while (l2 < inner.length && d2 > 0) { if (inner[l2] === '{') d2++; else if (inner[l2] === '}') d2--; l2++; }
        if (!isel.startsWith('@') && isUnused(isel)) {
          // drop the rule
        } else {
          innerOut += inner.slice(k, l2);
        }
        k = l2;
      }
      if (innerOut.trim()) {
        out += css.slice(i, brace + 1) + innerOut + '}';
      }
    } else if (selector.startsWith('@')) {
      // @font-face, @keyframes, @charset, @layer -- keep verbatim
      out += css.slice(i, j);
    } else {
      if (isUnused(selector)) {
        // drop the rule
      } else {
        out += css.slice(i, j);
      }
    }
    i = j;
  }
  return out;
}


