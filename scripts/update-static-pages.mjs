import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getUnifiedNav } from './unified-nav.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const STATIC_NAV_PAGES = [
  { path: 'public/index.html', active: 'none' },
  { path: 'public/services.html', active: 'services' },
  { path: 'public/service-areas.html', active: 'service-areas' },
  { path: 'public/rates.html', active: 'rates', removeSectionNav: false },
  { path: 'public/guarantee.html', active: 'guarantee' },
  { path: 'public/reviews.html', active: 'reviews' },
  { path: 'public/careers.html', active: 'careers' },
  { path: 'public/contact.html', active: 'contact' },
  { path: 'public/book.html', active: 'none' },
  { path: 'public/privacy.html', active: 'none' },
  { path: 'public/terms.html', active: 'none' },
  { path: 'public/services/aging-in-place-guide.html', active: 'services' }
];

/**
 * Normalise asset loading: fonts and icons are self-hosted now, so strip any
 * page that still reaches out to fonts.googleapis.com or cdnjs and point it at
 * the local subset instead. See public/css/site-theme.css for the @font-face
 * rules and scripts/build-icon-css.mjs for the icon stylesheet.
 */
function optimizeFontsAndAssets(html) {
  // Resource hints for origins the site no longer contacts.
  html = html.replace(/[ \t]*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>\r?\n/gi, '');
  html = html.replace(/[ \t]*<link\s+rel="preconnect"\s+href="https:\/\/cdnjs\.cloudflare\.com"[^>]*>\r?\n/gi, '');

  // Google Fonts, in every form these pages have used.
  html = html.replace(/[ \t]*<!-- Brand fonts?: [^\n]*-->\r?\n/gi, '');
  html = html.replace(/[ \t]*<link\s+rel="(?:preload|stylesheet)"\s+href="https:\/\/fonts\.googleapis\.com\/[^"]*"[^>]*>\r?\n/gi, '');
  html = html.replace(/[ \t]*<noscript><link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com\/[^"]*"><\/noscript>\r?\n/gi, '');
  html = html.replace(/[ \t]*@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com\/[^)]*\);\r?\n/gi, '');

  // Font Awesome from cdnjs -> generated local subset.
  html = html.replace(/[ \t]*<!-- FontAwesome icons -->\r?\n/gi, '');
  html = html.replace(
    /[ \t]*<link\s+rel="stylesheet"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]*"[^>]*>\r?\n/gi,
    '    <link rel="stylesheet" href="/css/icons.css?v=20260728">\n',
  );
  html = html.replace(/[ \t]*<link\s+rel="preload"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]*"[^>]*>\r?\n/gi, '');
  html = html.replace(/[ \t]*<noscript><link\s+rel="stylesheet"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]*"><\/noscript>\r?\n/gi, '');

  return html;
}

// 1. Update Navigation on key static pages
for (const { path, active, removeSectionNav } of STATIC_NAV_PAGES) {
  const fullPath = join(ROOT, path);
  let content = readFileSync(fullPath, 'utf8');

  // Regex to match the main top navbar and clean up any orphaned fragments
  const mainNavRegex = /(?:<header[^>]*class="sticky top-0 z-50 bg-white[\s\S]*?<\/header>|<nav[^>]*class="bg-white shadow-md sticky top-0 z-50 border-b-\[3px\] border-red-600"[\s\S]*?<\/nav>(?:\s*<div class="pt-3 border-t border-gray-100 flex items-center justify-center space-x-6 text-2xl">[\s\S]*?<\/div>\s*<\/div>\s*<\/nav>)*)/;
  
  if (mainNavRegex.test(content)) {
    const unifiedNavHtml = getUnifiedNav(active);
    content = content.replace(mainNavRegex, unifiedNavHtml);
  } else {
    console.warn(`Main nav regex did not match in ${path}`);
  }

  if (removeSectionNav) {
    const sectionNavRegex = /\s*<nav\s+id="section-nav"[\s\S]*?<\/nav>/;
    content = content.replace(sectionNavRegex, '');
  }

  writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated navigation in ${path}`);
}

// 2. Optimize Font & Asset links across ALL HTML files in public/
function getAllHtmlFiles(dir) {
  let results = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllHtmlFiles(filePath));
    } else if (file.endsWith('.html')) {
      results.push(filePath);
    }
  }
  return results;
}

const allHtmlFiles = getAllHtmlFiles(join(ROOT, 'public'));
let optimizedCount = 0;

for (const filePath of allHtmlFiles) {
  let content = readFileSync(filePath, 'utf8');
  const updated = optimizeFontsAndAssets(content);
  if (updated !== content) {
    writeFileSync(filePath, updated, 'utf8');
    optimizedCount++;
  }
}

console.log(`Optimized font & asset loading in ${optimizedCount} HTML file(s).`);
