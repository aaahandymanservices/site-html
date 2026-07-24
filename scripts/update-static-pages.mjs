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

function optimizeFontsAndAssets(html) {
  // 1. Remove redundant <link rel="preload" ... as="style"> for Google Fonts and FontAwesome
  html = html.replace(/\s*<link\s+rel="preload"\s+href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"\s+as="style">\s*/gi, '\n');
  html = html.replace(/\s*<link\s+rel="preload"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]*"\s+as="style">\s*/gi, '\n');

  // 2. Replace Google Fonts links (Roboto only or older) with combined Archivo & Roboto async font links
  const oldGoogleFontsRegex = /(?:<!-- Brand font[s]?: [^>]*-->\s*)?(?:<link\s+rel="preload"\s+href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"\s+as="style">\s*)?<link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"\s+media="print"\s+onload="this\.media='all'">\s*<noscript><link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"><\/noscript>/gi;

  const newGoogleFontsHtml = `<!-- Brand fonts: Archivo & Roboto -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Roboto:wght@400;700&display=swap" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Roboto:wght@400;700&display=swap"></noscript>`;

  if (oldGoogleFontsRegex.test(html)) {
    html = html.replace(oldGoogleFontsRegex, newGoogleFontsHtml);
  }

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
