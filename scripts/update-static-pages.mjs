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
  { path: 'public/rates.html', active: 'rates', removeSectionNav: true },
  { path: 'public/guarantee.html', active: 'guarantee' },
  { path: 'public/reviews.html', active: 'reviews' },
  { path: 'public/careers.html', active: 'careers' },
  { path: 'public/contact.html', active: 'contact' },
  { path: 'public/book.html', active: 'none' },
  { path: 'public/privacy.html', active: 'none' },
  { path: 'public/terms.html', active: 'none' },
  { path: 'public/services/aging-in-place-guide.html', active: 'services' }
];

function replaceNavBlock(content, newNavHtml) {
  // Option 1: Existing <header class="sticky top-0 z-50 ..."> ... </header>
  const headerMatch = content.match(/<header[^>]*class="[^"]*sticky top-0 z-50[^"]*"[\s\S]*?<\/header>/);
  if (headerMatch) {
    return content.replace(headerMatch[0], newNavHtml);
  }

  // Option 2: Existing <nav class="bg-white shadow-md sticky top-0 z-50 ..."> ... </nav>
  const navStartMatch = content.match(/<nav[^>]*class="bg-white shadow-md sticky top-0 z-50 border-b-\[3px\] border-red-600"[^>]*>/);
  if (navStartMatch) {
    const startIndex = navStartMatch.index;
    const nextSectionMatch = content.slice(startIndex).match(/(\n\s*<noscript>|\n\s*<header class="bg-gradient|\n\s*<main)/);
    if (nextSectionMatch) {
      const endIndex = startIndex + nextSectionMatch.index;
      return content.slice(0, startIndex) + newNavHtml + content.slice(endIndex);
    }
  }

  console.warn('Could not match nav block');
  return content;
}

for (const { path, active, removeSectionNav } of STATIC_PAGES) {
  const fullPath = join(ROOT, path);
  let content = readFileSync(fullPath, 'utf8');

  content = replaceNavBlock(content, getUnifiedNav(active));

  if (removeSectionNav) {
    const sectionNavRegex = /\s*<nav\s+id="section-nav"[\s\S]*?<\/nav>/;
    content = content.replace(sectionNavRegex, '');
  }

  writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated navigation in ${path}`);
}
