import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const citiesData = JSON.parse(readFileSync(join(ROOT, 'public/data/service-areas.json'), 'utf8'));
const servicesData = JSON.parse(readFileSync(join(ROOT, 'public/data/services.json'), 'utf8'));

const SITE = 'https://aaahandyman.services';
const currentDate = new Date().toISOString().split('T')[0];

const staticPages = [
  { path: '', priority: '1.0', changefreq: 'monthly' },
  { path: 'rates', priority: '0.8', changefreq: 'monthly' },
  { path: 'services', priority: '0.9', changefreq: 'monthly' },
  { path: 'service-areas', priority: '0.8', changefreq: 'monthly' },
  { path: 'guarantee', priority: '0.8', changefreq: 'monthly' },
  { path: 'reviews', priority: '0.8', changefreq: 'weekly' },
  { path: 'careers', priority: '0.7', changefreq: 'monthly' },
  { path: 'book', priority: '0.9', changefreq: 'monthly' },
  { path: 'contact', priority: '0.9', changefreq: 'monthly' },
  { path: 'services/aging-in-place-guide', priority: '0.8', changefreq: 'monthly' },
  { path: 'terms', priority: '0.3', changefreq: 'yearly' },
  { path: 'privacy', priority: '0.3', changefreq: 'yearly' }
];

const urls = [];

for (const page of staticPages) {
  const loc = page.path ? `${SITE}/${page.path}` : `${SITE}/`;
  let imagesMarkup = '';
  if (!page.path) {
    imagesMarkup = `
    <image:image>
      <image:loc>${SITE}/logo-banner.jpg</image:loc>
      <image:title>AAA Handyman Services serving Oakland County, Michigan</image:title>
    </image:image>
    <image:image>
      <image:loc>${SITE}/logo-circular.png</image:loc>
      <image:title>AAA Handyman Services logo</image:title>
    </image:image>`;
  }
  urls.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>${imagesMarkup}
  </url>`);
}

for (const city of citiesData.cities) {
  urls.push(`  <url>
    <loc>${SITE}/handyman/${city.slug}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
}

for (const service of servicesData.services) {
  urls.push(`  <url>
    <loc>${SITE}/services/${service.slug}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
}

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`;

writeFileSync(join(ROOT, 'public/sitemap.xml'), sitemapContent, 'utf8');
console.log('Successfully regenerated sitemap.xml dynamically!');
