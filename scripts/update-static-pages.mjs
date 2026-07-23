import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getUnifiedNav } from './unified-nav.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const STATIC_PAGES = [
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

for (const { path, active, removeSectionNav } of STATIC_PAGES) {
  const fullPath = join(ROOT, path);
  let content = readFileSync(fullPath, 'utf8');

  // Regex to match the main top navbar
  const mainNavRegex = /(?:<header[^>]*class="sticky top-0 z-50 bg-white[\s\S]*?<\/header>|<nav[^>]*class="bg-white shadow-md sticky top-0 z-50 border-b-\[3px\] border-red-600"[\s\S]*?<\/nav>)/;
  
  if (mainNavRegex.test(content)) {
    const unifiedNavHtml = getUnifiedNav(active);
    content = content.replace(mainNavRegex, unifiedNavHtml);
  } else {
    console.warn(`Main nav regex did not match in ${path}`);
  }

  // On rates.html, remove secondary sub-nav #section-nav if present
  if (removeSectionNav) {
    const sectionNavRegex = /\s*<nav\s+id="section-nav"[\s\S]*?<\/nav>/;
    content = content.replace(sectionNavRegex, '');
  }

  writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated navigation in ${path}`);
}
