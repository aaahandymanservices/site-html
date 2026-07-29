/**
 * Builds public/css/icons.css: a Font Awesome stylesheet trimmed to the icons
 * this site actually renders.
 *
 * Upstream `all.min.css` ships ~2,000 icon definitions and pulls two extra
 * origins (cdnjs + its webfonts) into the critical path. This site uses ~160
 * icons, so the generated file is a fraction of the size, self-hosted, and
 * cacheable alongside the rest of the CSS.
 *
 * The base rules get the same treatment as the icon definitions: Font Awesome's
 * sizing, list, rotation, stacking, and animation utilities are around 14kB of
 * the output and this site applies almost none of them, yet the stylesheet is
 * render-blocking on every page. Rules whose every selector is a `fa-*` utility
 * the markup never uses are dropped, along with any @keyframes left with
 * nothing referencing it.
 *
 * Run after the service and city pages are generated so their markup is
 * included in the usage scan.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collectIconUsage, UTILITY_CLASSES } from './icon-usage.mjs';

const VENDOR = join(ROOT, 'vendor/font-awesome');
const OUTPUT = join(ROOT, 'public/css/icons.css');

/** Split a stylesheet into its top-level rules, ignoring braces inside strings. */
function splitTopLevelRules(css) {
  const rules = [];
  let depth = 0;
  let start = 0;
  let quote = null;

  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        rules.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
  }
  return rules.filter(Boolean);
}

function stripLicenseComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const ICON_SELECTOR = /^\.fa-([a-z0-9-]+):before$/;

/**
 * Partition a Font Awesome stylesheet into the base rules (kept wholesale) and
 * the per-icon `content` rules (kept only when the icon is referenced).
 *
 * A single rule can define several aliases at once
 * (`.fa-times:before,.fa-xmark:before{content:"\f00d"}`), so the whole rule is
 * kept when any one of its names is used.
 */
function partition(css) {
  const base = [];
  const iconRules = [];

  for (const rule of splitTopLevelRules(stripLicenseComments(css))) {
    const brace = rule.indexOf('{');
    const selectors = rule.slice(0, brace).split(',').map((s) => s.trim());
    const names = selectors.map((s) => (s.match(ICON_SELECTOR) || [])[1]);

    if (names.every(Boolean) && rule.includes('content:')) {
      iconRules.push({ rule, names });
    } else {
      base.push(rule);
    }
  }
  return { base, iconRules };
}

/** Rewrite upstream `../webfonts/*` sources to this site's self-hosted, woff2-only paths. */
function localiseFontFace(css) {
  return css
    .replace(/font-display:block/g, 'font-display:swap')
    .replace(
      /src:url\(\.\.\/webfonts\/([\w-]+)\.woff2\) format\("woff2"\)(?:,url\([^)]+\) format\("truetype"\))?/g,
      'src:url(/fonts/$1.woff2) format("woff2")',
    );
}

/**
 * True when a selector targets nothing but Font Awesome utility classes that
 * the markup never applies.
 *
 * Everything left after the `.fa-*` class tokens are removed has to be
 * structural -- combinators, element names, pseudo-classes. A leftover `.` or
 * `#` means some other class or an id is involved, and the rule stays.
 */
function isDeadUtilitySelector(selector, usedUtilities) {
  const tokens = [...selector.matchAll(/\.fa-([a-z0-9-]+)/g)].map((m) => m[1]);
  if (tokens.length === 0) return false;
  if (!/^[\s>+~a-z0-9:()-]*$/.test(selector.replace(/\.fa-[a-z0-9-]+/g, ''))) return false;
  return tokens.every((token) => UTILITY_CLASSES.has(token) && !usedUtilities.has(token));
}

/**
 * Drop the unused selectors from one rule, returning null when nothing is left.
 * Upstream groups selectors freely (one rule can carry both an animation this
 * site uses and three it does not), so a rule is usually thinned rather than
 * removed outright.
 */
function pruneRule(rule, usedUtilities) {
  const brace = rule.indexOf('{');
  if (brace === -1) return rule;

  const head = rule.slice(0, brace).trim();
  const body = rule.slice(brace);

  // Conditional group rules (@media, @supports) wrap rules of their own.
  if (/^@(?:media|supports)/i.test(head)) {
    const inner = splitTopLevelRules(body.slice(1, body.lastIndexOf('}')))
      .map((nested) => pruneRule(nested, usedUtilities))
      .filter(Boolean);
    return inner.length ? `${head}{${inner.join('')}}` : null;
  }

  // @font-face, @keyframes and friends have no selector list to thin out.
  if (head.startsWith('@')) return rule;

  const kept = head.split(',').map((s) => s.trim()).filter(
    (selector) => !isDeadUtilitySelector(selector, usedUtilities),
  );
  return kept.length ? `${kept.join(',')}${body}` : null;
}

/** Names of the animations the surviving rules still reference. */
function referencedAnimations(rules) {
  const names = new Set();
  for (const rule of rules) {
    for (const match of rule.matchAll(/animation-name:\s*([a-z0-9-]+)/gi)) names.add(match[1]);
  }
  return names;
}

const { icons: used, utilities: usedUtilities } = collectIconUsage();

const classic = partition(readFileSync(join(VENDOR, 'fontawesome.min.css'), 'utf8'));
const brands = partition(readFileSync(join(VENDOR, 'brands.min.css'), 'utf8'));
const solid = partition(readFileSync(join(VENDOR, 'solid.min.css'), 'utf8'));

const keptIconRules = [];
const keptNames = new Set();
const codepoints = new Set();

for (const { rule, names } of [...classic.iconRules, ...brands.iconRules]) {
  if (!names.some((name) => used.has(name))) continue;
  keptIconRules.push(rule);
  names.forEach((name) => keptNames.add(name));
  for (const match of rule.matchAll(/content:"((?:\\[0-9a-fA-F]+)+)"/g)) {
    for (const escape of match[1].split('\\').filter(Boolean)) {
      codepoints.add(parseInt(escape, 16));
    }
  }
}

const baseRules = [
  ...classic.base,
  ...solid.base.map(localiseFontFace),
  ...brands.base.map(localiseFontFace),
];

// Two passes: thin out the utility rules first, then drop the @keyframes blocks
// whose animation is no longer named by anything that survived.
const prunedBase = baseRules.map((rule) => pruneRule(rule, usedUtilities)).filter(Boolean);
const animations = referencedAnimations(prunedBase);
const keptBase = prunedBase.filter((rule) => {
  const name = rule.match(/^@(?:-\w+-)?keyframes\s+([a-z0-9-]+)/i);
  return !name || animations.has(name[1]);
});

const droppedBytes = baseRules.join('\n').length - keptBase.join('\n').length;

const output = [
  '/*!',
  ' * Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com',
  ' * License - https://fontawesome.com/license/free',
  ' * (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)',
  ' *',
  ` * Generated subset - ${keptNames.size} icon names in use.`,
  ' * Do not edit by hand; run scripts/build-icon-css.mjs instead.',
  ' */',
  ...keptBase,
  ...keptIconRules,
].join('\n');

writeFileSync(OUTPUT, `${output}\n`);

// Input for scripts/subset-icon-fonts.py, which trims the webfonts to match.
writeFileSync(
  join(VENDOR, 'required-codepoints.json'),
  `${JSON.stringify([...codepoints].sort((a, b) => a - b))}\n`,
);

// The webfonts are subsetted to these same glyphs (see scripts/subset-icon-fonts.py).
// If markup starts using an icon whose glyph was left out, it renders blank, so
// surface the mismatch here rather than letting it ship silently.
const coverage = join(VENDOR, 'subset-codepoints.json');
if (existsSync(coverage)) {
  const shipped = new Set(JSON.parse(readFileSync(coverage, 'utf8')));
  const missing = [...codepoints].filter((cp) => !shipped.has(cp));
  if (missing.length) {
    const names = [...keptNames].filter((name) => {
      const rule = keptIconRules.find((r) => r.includes(`.fa-${name}:before`));
      return rule && missing.some((cp) => rule.includes(cp.toString(16)));
    });
    console.warn(
      `\n  WARNING: ${missing.length} icon glyph(s) are referenced but missing from the\n` +
      `  subsetted webfonts and will render blank: ${names.join(', ')}\n` +
      '  Re-run: python3 scripts/subset-icon-fonts.py\n',
    );
  }
}

const unresolved = [...used].filter((name) => !keptNames.has(name));
console.log(
  `Wrote ${OUTPUT} (${keptIconRules.length} rules, ${keptNames.size} icon names, ` +
  `${(Buffer.byteLength(output) / 1024).toFixed(1)} kB)`,
);
console.log(
  `  Dropped ${baseRules.length - keptBase.length} unused base rule(s) ` +
  `(${(droppedBytes / 1024).toFixed(1)} kB) off the render path.`,
);
if (unresolved.length) {
  console.log(`  Ignored ${unresolved.length} fa-* token(s) with no matching icon.`);
}
