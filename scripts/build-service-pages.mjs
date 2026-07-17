/*
 * build-service-pages.mjs
 *
 * Generates the per-service landing pages under public/services/<slug>.html
 * from the single source of truth at public/data/services.json.
 *
 * This mirrors scripts/build-city-pages.mjs: it is a plain content generator,
 * NOT part of the Netlify build. Run it by hand after editing the service data
 * or the template below:
 *
 *     node scripts/build-service-pages.mjs
 *
 * The generated .html files are committed and served statically. Clean URLs
 * (/services/<slug>) are handled by the splat rule in public/_redirects.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = JSON.parse(readFileSync(join(ROOT, 'public/data/services.json'), 'utf8'));
const OUT_DIR = join(ROOT, 'public/services');

const SITE = 'https://aaahandyman.services';
const PHONE_DISPLAY = '(248) 385-3432';
const PHONE_TEL = '+12483853432';

const CATEGORIES = DATA.categories;
const SERVICES = DATA.services;
const bySlug = Object.fromEntries(SERVICES.map((s) => [s.slug, s]));

const enc = (s) => encodeURIComponent(s);
// Minimal HTML-attribute/entity escaping for text pulled into markup.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Ampersands in display names -> &amp; for valid HTML, but leave other text alone.
const amp = (s) => String(s).replace(/&/g, '&amp;');
const quoteHref = (service) => `/contact?service=${enc(service)}`;

// Up to three related services: prefer the same category, then fall back to the
// next services in the catalog so every page has a full "related" row.
function relatedServices(service) {
  const sameCat = SERVICES.filter((s) => s.slug !== service.slug && s.category === service.category);
  const others = SERVICES.filter((s) => s.slug !== service.slug && s.category !== service.category);
  return [...sameCat, ...others].slice(0, 3);
}

// Load service area cities list for dynamic local cross-linking
let CITIES_LIST = [];
try {
  const citiesPath = join(ROOT, 'public/data/service-areas.json');
  const citiesData = JSON.parse(readFileSync(citiesPath, 'utf8'));
  CITIES_LIST = citiesData.cities || [];
} catch (err) {
  console.warn('Could not load service areas list for cross-linking', err);
}

function serviceFaq(service) {
  const faqs = [
    {
      q: `Do you offer ${service.name.replace(/ Services$/, '')} in Oakland County, MI?`,
      a: `Yes. AAA Handyman Services is based in Waterford and provides ${service.name.toLowerCase().replace(/ services$/, '')} services for homeowners throughout Oakland County, Michigan, from Waterford and Clarkston to Troy, Royal Oak, Novi, and the surrounding communities.`
    },
    {
      q: `How much does ${service.name.toLowerCase().replace(/ services$/, '')} cost?`,
      a: `Pricing starts with a minimum service call: $100 in Zone A (within about 20 miles of our Waterford base) or $145 in Zone B (extended county, 20+ miles). That covers travel, diagnostics, and up to the first hour of labor. Continuous labor after the first hour is billed at a flat $70 per hour in quarter-hour increments, and materials are billed separately.`
    }
  ];
  if (service.faq) faqs.push({ q: service.faq.q, a: service.faq.a });
  faqs.push({
    q: `Do you offer emergency service for urgent issues?`,
    a: `Yes. After-hours emergency service is available 7 days a week for urgent repairs that affect home safety or security, such as leaks or door and window problems. Call ${PHONE_DISPLAY} for priority response.`
  });
  return faqs;
}

function jsonLd(service) {
  const url = `${SITE}/services/${service.slug}`;
  const catLabel = CATEGORIES[service.category];
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: service.name,
    name: `${service.name} — AAA Handyman Services`,
    '@id': `${url}#service`,
    url,
    category: catLabel,
    description: service.intro[0],
    provider: {
      '@type': 'HomeAndConstructionBusiness',
      name: 'AAA Handyman Services',
      image: `${SITE}/logo-circular.png`,
      telephone: '+1-248-385-3432',
      email: 'contact@aaahandyman.services',
      priceRange: '$$',
      address: { '@type': 'PostalAddress', addressLocality: 'Waterford', addressRegion: 'MI', addressCountry: 'US' },
      sameAs: [
        'https://www.facebook.com/AAAHandymanServices',
        'https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960',
        'https://www.yelp.com/biz/aaa-handyman-services-waterford-township'
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        'ratingValue': '4.9',
        'reviewCount': '85'
      }
    },
    areaServed: CITIES_LIST.map((city) => ({ '@type': 'City', name: `${city.name}, MI` })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${service.name} Options`,
      itemListElement: service.features.map((f) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: f }
      }))
    }
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE}/services` },
      { '@type': 'ListItem', position: 3, name: service.name, item: url }
    ]
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: serviceFaq(service).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };
  return [serviceSchema, breadcrumb, faq]
    .map((obj) => `    <script type="application/ld+json">\n${JSON.stringify(obj, null, 2).split('\n').map((l) => '    ' + l).join('\n')}\n    </script>`)
    .join('\n');
}

function navLink(href, label, active) {
  const cls = active
    ? 'nav-link text-red-600 font-bold border-b-2 border-red-600'
    : 'nav-link text-gray-700 hover:text-red-600 transition';
  return `<a href="${href}" class="${cls}">${label}</a>`;
}

function featureCard(f) {
  return `                <div class="flex items-start gap-3 bg-white border-[2px] border-red-600 ring-1 ring-red-600 p-4 rounded-2xl shadow-sm">
                    <span class="w-8 h-8 flex-shrink-0 bg-red-100 rounded-lg flex items-center justify-center text-red-600" aria-hidden="true"><i class="fas fa-check"></i></span>
                    <span class="font-semibold text-gray-800">${amp(f)}</span>
                </div>`;
}

function relatedCard(s) {
  return `                <a href="/services/${s.slug}" class="service-card group flex items-center gap-3 bg-white border-[2px] border-red-600 ring-1 ring-red-600 p-4 rounded-2xl shadow-sm hover:text-red-600">
                    <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600" aria-hidden="true"><i class="fas ${s.icon}"></i></span>
                    <span class="font-semibold text-gray-800 group-hover:text-red-600">${amp(s.name)}</span>
                </a>`;
}

function serviceAreasSection(service) {
  if (!CITIES_LIST.length) return '';
  const links = CITIES_LIST
    .map((c) => `<a href="/handyman/${c.slug}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-xl transition border border-gray-200 text-sm font-semibold text-gray-800"><i class="fas fa-map-marker-alt text-red-500 text-xs"></i> ${c.name}</a>`)
    .join('\n                    ');
  return `
            <!-- Service Area locations: internal links for discovery + local SEO -->
            <div class="max-w-5xl mx-auto mt-12 sm:mt-16 border-t border-gray-200 pt-10">
                <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-6">Our ${amp(service.name)} Service Area</h2>
                <p class="text-center text-gray-600 mb-6 max-w-2xl mx-auto">We provide expert ${amp(service.name.toLowerCase())} in the following Oakland County, Michigan communities:</p>
                <div class="flex flex-wrap justify-center gap-2.5">
                    ${links}
                </div>
            </div>`;
}

// Per-service cost guide: a one-off explainer that lives only on select service
// pages. Kept here (rather than in the generic template) because it is specific
// to a single service, mirroring how the senior-care checklist callout is
// handled. Each branch returns the full section for its slug.
function costGuideSection(service) {
  if (service.slug === 'power-washing') return powerWashingCostGuide();
  if (service.slug !== 'gutters') return '';
  return `
            <!-- Understanding gutter cleaning costs: market context + factors -->
            <div class="max-w-6xl mx-auto mt-14 sm:mt-20">
                <div class="text-center mb-8">
                    <div class="uppercase text-blue-600 font-semibold tracking-widest text-sm">Cost Guide</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">Understanding Gutter Cleaning Costs in Southeast Michigan</h2>
                    <p class="mt-3 text-gray-600 max-w-3xl mx-auto">Gutter cleaning is priced a few different ways across the metro Detroit area. Here is how the common models compare so you know what a fair quote looks like, and how our own <a href="/rates" class="text-red-600 font-semibold underline underline-offset-2">transparent flat rates</a> stack up.</p>
                </div>

                <!-- Linear foot pricing model -->
                <div class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-3xl p-6 sm:p-8 shadow-sm">
                    <div class="flex items-center gap-3 mb-5">
                        <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600" aria-hidden="true"><i class="fas fa-ruler-horizontal"></i></span>
                        <h3 class="text-xl sm:text-2xl font-bold text-blue-900">The Linear-Foot Pricing Model</h3>
                    </div>
                    <p class="text-gray-600 mb-6">Gutter cleaning in Southeast Michigan is often priced directly by the foot. Rates vary mostly with the height and reach of the work:</p>
                    <div class="grid sm:grid-cols-2 gap-4">
                        <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                            <div class="text-sm font-bold uppercase tracking-wider text-blue-600 mb-1">Standard Rate</div>
                            <div class="text-2xl font-extrabold text-gray-900 mb-2">$0.95&ndash;$1.25 <span class="text-base font-semibold text-gray-500">/ linear foot</span></div>
                            <p class="text-sm text-gray-600">Typical for a single-story home.</p>
                        </div>
                        <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                            <div class="text-sm font-bold uppercase tracking-wider text-red-600 mb-1">Multi-Story Rate</div>
                            <div class="text-2xl font-extrabold text-gray-900 mb-2">$1.00&ndash;$1.80+ <span class="text-base font-semibold text-gray-500">/ linear foot</span></div>
                            <p class="text-sm text-gray-600">Two-story homes, reflecting the extra ladder work and safety equipment required.</p>
                        </div>
                    </div>
                    <div class="mt-5 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
                        <i class="fas fa-calculator text-blue-600 mt-1" aria-hidden="true"></i>
                        <p class="text-sm text-gray-700"><strong>Example:</strong> Cleaning 150 linear feet of gutters on a single-story ranch usually runs about <strong>$140 to $185</strong> under this model &mdash; right in line with AAA Handyman's flat <strong>$135 (Zone A) / $180 (Zone B)</strong> gutter-cleaning rate for a comparable home.</p>
                    </div>
                </div>

                <!-- Key factors that adjust the price -->
                <div class="mt-6">
                    <h3 class="text-xl sm:text-2xl font-bold text-blue-900 mb-4 text-center">Key Factors That Can Adjust the Price</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-2xl p-5 shadow-sm">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-house-chimney"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Roof Pitch &amp; Height</h4>
                            <p class="text-sm text-gray-600">Un-walkable, steep roofs or multi-story homes require extra safety harnesses and setup time, which can add a premium of 15% or more.</p>
                        </div>
                        <div class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-2xl p-5 shadow-sm">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-seedling"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Severity of Clogs</h4>
                            <p class="text-sm text-gray-600">Gutters that are severely overflowing, packed with dirt, or hosting growing weeds must be scooped by hand instead of flushed &mdash; expect a 10% to 50% heavy-debris surcharge.</p>
                        </div>
                        <div class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-2xl p-5 shadow-sm">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-screwdriver-wrench"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Gutter Guards</h4>
                            <p class="text-sm text-gray-600">Mesh or surface-tension guards that must be unscrewed and re-secured to clean underneath add labor time, and usually increase the cost.</p>
                        </div>
                    </div>
                    <p class="mt-5 text-sm text-gray-500 text-center max-w-3xl mx-auto"><i class="fas fa-circle-info text-red-600 mr-1" aria-hidden="true"></i> AAA Handyman keeps it simple: rather than charging by the foot, we quote a flat rate up front, then bill continuous labor at <strong>$70/hour</strong> in quarter-hour increments for anything beyond a standard clean. You will always know the price before we start.</p>
                </div>
            </div>
`;
}

// Power washing cost guide: mirrors the gutters explainer, but built around the
// per-square-foot model that dominates exterior-cleaning pricing.
function powerWashingCostGuide() {
  return `
            <!-- Understanding power washing costs: market context + factors -->
            <div class="max-w-6xl mx-auto mt-14 sm:mt-20">
                <div class="text-center mb-8">
                    <div class="uppercase text-blue-600 font-semibold tracking-widest text-sm">Cost Guide</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">Understanding Power Washing Costs in Southeast Michigan</h2>
                    <p class="mt-3 text-gray-600 max-w-3xl mx-auto">Power washing is priced a few different ways across the metro Detroit area, and most pros quote by the square foot. Here is how the common models compare so you know what a fair quote looks like, and how our own <a href="/rates" class="text-red-600 font-semibold underline underline-offset-2">transparent flat rates</a> stack up.</p>
                </div>

                <!-- Per-square-foot pricing model -->
                <div class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-3xl p-6 sm:p-8 shadow-sm">
                    <div class="flex items-center gap-3 mb-5">
                        <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600" aria-hidden="true"><i class="fas fa-ruler-combined"></i></span>
                        <h3 class="text-xl sm:text-2xl font-bold text-blue-900">The Per-Square-Foot Pricing Model</h3>
                    </div>
                    <p class="text-gray-600 mb-6">In the Oakland County area, professional power washing typically runs <strong>$0.10 to $0.60 per square foot</strong>. Where you land depends heavily on the surface being cleaned &mdash; flat, accessible concrete costs less than delicate wood or high-up roofs:</p>
                    <div class="grid sm:grid-cols-2 gap-4">
                        <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                            <div class="text-sm font-bold uppercase tracking-wider text-blue-600 mb-1">Concrete Driveways, Walks &amp; Patios</div>
                            <div class="text-2xl font-extrabold text-gray-900 mb-2">$0.10&ndash;$0.25 <span class="text-base font-semibold text-gray-500">/ sq. ft.</span></div>
                            <p class="text-sm text-gray-600">A standard 2-car driveway (about 400&ndash;600 sq. ft.) usually averages $100 to $250.</p>
                        </div>
                        <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                            <div class="text-sm font-bold uppercase tracking-wider text-blue-600 mb-1">Vinyl House Siding</div>
                            <div class="text-2xl font-extrabold text-gray-900 mb-2">$0.20&ndash;$0.50 <span class="text-base font-semibold text-gray-500">/ sq. ft.</span></div>
                            <p class="text-sm text-gray-600">A 1,500 sq. ft. home typically runs $150 to $750.</p>
                        </div>
                        <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                            <div class="text-sm font-bold uppercase tracking-wider text-red-600 mb-1">Decks &amp; Fences (Wood or Composite)</div>
                            <div class="text-2xl font-extrabold text-gray-900 mb-2">$0.30&ndash;$0.55 <span class="text-base font-semibold text-gray-500">/ sq. ft.</span></div>
                            <p class="text-sm text-gray-600">Higher because soft wood needs a gentle low-pressure &ldquo;soft wash&rdquo; and specialized detergents, not raw force.</p>
                        </div>
                        <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                            <div class="text-sm font-bold uppercase tracking-wider text-red-600 mb-1">Roofs</div>
                            <div class="text-2xl font-extrabold text-gray-900 mb-2">$0.20&ndash;$1.00 <span class="text-base font-semibold text-gray-500">/ sq. ft.</span></div>
                            <p class="text-sm text-gray-600">Highest of all: pitch, steepness, and height demand safety gear plus slow, gentle chemical algae treatment.</p>
                        </div>
                    </div>
                    <div class="mt-5 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
                        <i class="fas fa-calculator text-blue-600 mt-1" aria-hidden="true"></i>
                        <p class="text-sm text-gray-700"><strong>Example:</strong> Washing the vinyl siding on a 1,500 sq. ft. home runs roughly <strong>$150 to $750</strong> by the square foot, and many companies set a job minimum of around $150. Rather than a rigid per-foot measure, AAA Handyman uses a simple hybrid: a flat service-call minimum that covers the first hour, then continuous labor billed by the quarter-hour.</p>
                    </div>
                </div>

                <!-- Key factors that adjust the price -->
                <div class="mt-6">
                    <h3 class="text-xl sm:text-2xl font-bold text-blue-900 mb-4 text-center">Key Factors That Can Adjust the Price</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-2xl p-5 shadow-sm">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-soap"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Surface Condition</h4>
                            <p class="text-sm text-gray-600">Heavy oil stains on driveways or thick green mold on north-facing siding need chemical pre-treatments, which add to material costs.</p>
                        </div>
                        <div class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-2xl p-5 shadow-sm">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-faucet-drip"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Water Access</h4>
                            <p class="text-sm text-gray-600">Rates assume a hookup to an outdoor spigot with strong pressure. If a technician must bring a water truck, the price scales up sharply.</p>
                        </div>
                        <div class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-2xl p-5 shadow-sm">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-couch"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Obstacles &amp; Protection</h4>
                            <p class="text-sm text-gray-600">Moving heavy patio furniture or wrapping delicate landscaping, lighting, and outlets in protective plastic adds prep labor to the final cost.</p>
                        </div>
                    </div>
                    <p class="mt-5 text-sm text-gray-500 text-center max-w-3xl mx-auto"><i class="fas fa-circle-info text-red-600 mr-1" aria-hidden="true"></i> AAA Handyman keeps it simple: a <strong>$100 (Zone A) / $145 (Zone B)</strong> minimum covers travel and the first hour, then continuous washing is billed at a flat <strong>$70/hour</strong> in quarter-hour increments. You will always know the price before we start.</p>
                </div>
            </div>
`;
}

function page(service) {
  const url = `${SITE}/services/${service.slug}`;
  const catLabel = CATEGORIES[service.category];
  const displayName = amp(service.name);
  const title = `${service.name} in Oakland County, MI | AAA Handyman Services`;
  const desc = `${service.tagline} Professional ${service.name.toLowerCase().replace(/ services$/, '')} for homeowners across Oakland County, Michigan. Backed by our 1-Year Workmanship Guarantee. Call ${PHONE_DISPLAY}.`;
  const faqs = serviceFaq(service);
  const related = relatedServices(service);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Resource hints -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>

    <title>${esc(title)}</title>

    <!-- Search Engine Optimization (SEO) Metadata -->
    <meta name="description" content="${esc(desc)}">
    <meta name="theme-color" content="#8e1f26">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
    <meta name="geo.region" content="US-MI">
    <meta name="geo.placename" content="Oakland County, Michigan">
    <link rel="canonical" href="${url}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:site_name" content="AAA Handyman Services">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:image" content="${SITE}/logo-banner.jpg">
    <meta property="og:locale" content="en_US">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${SITE}/logo-banner.jpg">

    <!-- Structured Data (JSON-LD) -->
${jsonLd(service)}

    <!-- Tailwind CSS (precompiled, see scripts/build-css.mjs) -->
    <link rel="stylesheet" href="/css/tailwind.css">

    <!-- Brand font: Roboto -->
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" as="style">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap"></noscript>

    <!-- FontAwesome icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"></noscript>

    <style>
        html { scroll-behavior: smooth; }
        body { font-family: 'Roboto', sans-serif; }
        .service-card { transition: all 0.3s; }
        .service-card:hover { transform: translateY(-6px); box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
        @keyframes pulse-attention-green {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7); }
            50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(22, 163, 74, 0); }
        }
        .pulse-btn-green { animation: pulse-attention-green 2s infinite; }
        @media (prefers-reduced-motion: reduce) {
            html { scroll-behavior: auto; }
            .pulse-btn-green, .service-card { animation: none !important; transition: none !important; }
            .service-card:hover { transform: none !important; }
        }
    </style>
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
</head>
<body class="bg-gray-50 text-gray-900 flex flex-col min-h-screen">
    <!-- Navbar -->
    <nav class="bg-white shadow-md sticky top-0 z-50 border-b-[3px] border-red-600">
        <div class="max-w-7xl mx-auto px-4 py-2 sm:px-6 sm:py-3 flex justify-between items-center">
            <a href="/" class="flex min-w-0 items-center space-x-3" aria-label="AAA Handyman Services home">
                <img src="/.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80" srcset="/.netlify/images?url=/icon.jpg&amp;w=48&amp;fm=avif&amp;q=80 1x, /.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80 2x" width="48" height="48" alt="AAA Handyman Services Logo" class="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0 border-2 border-red-600">
                <div class="min-w-0">
                    <p class="text-base min-[390px]:text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-red-600 leading-tight truncate">AAA Handyman Services</p>
                    <p class="text-[10px] sm:text-xs text-gray-500">Oakland County, Michigan</p>
                </div>
            </a>
            <div class="hidden md:flex space-x-6 lg:space-x-8 text-lg font-medium items-center">
                ${navLink('/services', 'Services', true)}
                ${navLink('/service-areas', 'Service Areas', false)}
                ${navLink('/rates', 'Rates', false)}
                ${navLink('/guarantee', 'Guarantee', false)}
                ${navLink('/reviews', 'Reviews', false)}
                ${navLink('/careers', 'Careers', false)}
                ${navLink('/contact', 'Contact', false)}
                <div class="flex flex-col items-center space-y-1">
                    <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" aria-label="Follow AAA Handyman Services on Facebook" class="nav-link text-gray-700 hover:text-[#1877F2] text-xl transition leading-none"><i class="fab fa-facebook"></i></a>
                    <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Yelp" class="nav-link text-gray-700 hover:text-[#FF1A1A] text-sm transition leading-none"><i class="fa-brands fa-yelp"></i></a>
                    <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Nextdoor" class="nav-link text-gray-700 hover:text-[#00B24F] text-sm transition leading-none"><i class="fa-solid fa-house-chimney"></i></a>
                </div>
            </div>
            <div class="flex items-center space-x-2 sm:space-x-3">
                <button id="mobile-menu-btn" class="md:hidden text-gray-700 hover:text-red-600 focus:outline-none p-1 sm:p-2" aria-label="Toggle Navigation Menu">
                    <i class="fas fa-bars text-xl sm:text-2xl"></i>
                </button>
            </div>
        </div>
        <div id="mobile-menu" class="hidden md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-inner">
            <a href="/services" class="block text-red-600 font-bold py-2 border-b border-gray-100">Services</a>
            <a href="/service-areas" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Service Areas</a>
            <a href="/rates" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Rates</a>
            <a href="/guarantee" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Guarantee</a>
            <a href="/reviews" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Reviews</a>
            <a href="/careers" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Careers</a>
            <a href="/contact" class="block text-gray-700 hover:text-red-600 py-2 transition">Contact</a>
            <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-gray-700 hover:text-[#1877F2] py-2 transition"><i class="fab fa-facebook"></i> Facebook Page</a>
            <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-gray-700 hover:text-[#FF1A1A] py-2 transition"><i class="fa-brands fa-yelp"></i> Yelp Page</a>
            <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-gray-700 hover:text-[#00B24F] py-2 transition"><i class="fa-solid fa-house-chimney"></i> Nextdoor Page</a>
        </div>
    </nav>

    <!-- Floating Call Action -->
    <a href="tel:${PHONE_TEL}" class="fixed bottom-5 right-5 z-50 flex bg-green-600 hover:bg-green-700 text-white px-5 py-3 sm:px-6 rounded-full font-bold items-center justify-center gap-2 sm:gap-3 transition pulse-btn-green shadow-2xl focus:outline-none focus:ring-4 focus:ring-green-300" title="Call AAA Handyman Services Now">
        <i class="fas fa-phone" aria-hidden="true"></i>
        <span>Call Now! <span class="hidden sm:inline">${PHONE_DISPLAY}</span></span>
    </a>

    <!-- Header / Hero -->
    <header class="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-950 text-white py-16 sm:py-20 relative overflow-hidden">
        <div class="absolute inset-0 opacity-10">
            <div class="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        </div>
        <div class="max-w-4xl mx-auto px-6 relative z-10 text-center">
            <!-- Breadcrumb -->
            <nav aria-label="Breadcrumb" class="text-sm text-blue-200 mb-4">
                <a href="/" class="hover:text-white">Home</a>
                <span class="mx-2">/</span>
                <a href="/services" class="hover:text-white">Services</a>
                <span class="mx-2">/</span>
                <span class="text-white font-semibold">${displayName}</span>
            </nav>
            <div class="w-16 h-16 mx-auto bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-3xl text-red-400 mb-5" aria-hidden="true"><i class="fas ${service.icon}"></i></div>
            <div class="uppercase tracking-widest text-red-500 font-semibold text-sm sm:text-base mb-3">${amp(catLabel)} &middot; Oakland County, MI</div>            <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">${displayName}</h1>
            <p class="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
                ${amp(service.tagline)}
            </p>
            <div class="mt-8 flex flex-wrap justify-center gap-4">
                <a href="tel:${PHONE_TEL}" class="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-green-600/30 transition flex items-center gap-2">
                    <i class="fas fa-phone"></i> Call Now! ${PHONE_DISPLAY}
                </a>
                <a href="${quoteHref(service.formService)}" class="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2">
                    <i class="fas fa-calendar-check"></i> Get a Free Quote
                </a>
            </div>
        </div>
    </header>

    <main class="flex-grow py-12 sm:py-16">
        <div class="max-w-7xl mx-auto px-6">
            <!-- Intro + pricing -->
            <div class="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
                <div class="lg:col-span-2 prose prose-lg max-w-none text-gray-600">
                    <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">${displayName} in Oakland County, MI</h2>
${service.intro.map((p) => `                    <p>${amp(p)}</p>`).join('\n')}
                </div>
                <aside class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-3xl p-6 shadow-lg">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="text-2xl text-red-600" aria-hidden="true"><i class="fas fa-tag"></i></span>
                        <div>
                            <h3 class="text-lg font-bold text-gray-900">Simple, Upfront Pricing</h3>
                            <p class="text-sm text-gray-500">${amp(service.name)}</p>
                        </div>
                    </div>
                    <ul class="space-y-3 text-sm text-gray-700">
                        <li class="flex items-start gap-2"><i class="fas fa-location-dot text-red-600 mt-1"></i><span><strong>$100 minimum</strong> in Zone A (within ~20 miles) &middot; <strong>$145</strong> in Zone B (extended county).</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-clock text-red-600 mt-1"></i><span>Then a flat <strong>$70/hour</strong> in quarter-hour increments.</span></li>                        <li class="flex items-start gap-2"><i class="fas fa-shield-halved text-red-600 mt-1"></i><span>Every job backed by our <a href="/guarantee" class="text-red-600 font-semibold underline underline-offset-2">1-Year Workmanship Guarantee</a>.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-map text-red-600 mt-1"></i><span>Available across <a href="/service-areas" class="text-red-600 font-semibold underline underline-offset-2">Oakland County</a>.</span></li>
                    </ul>
                    <a href="${quoteHref(service.formService)}" class="mt-6 w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-red-600/30">
                        <i class="fas fa-calendar-check"></i> Request This Service
                    </a>
                    <a href="/rates" class="mt-3 block text-center text-sm text-gray-500 hover:text-red-600 underline underline-offset-2">See full rates &amp; packages</a>
                </aside>
            </div>
${costGuideSection(service)}
            <!-- What's included -->
            <div class="max-w-6xl mx-auto mt-14 sm:mt-20">
                ${service.slug === 'senior-care' ? `<!-- Checklist Callout Section -->
                <div class="bg-red-50 border-2 border-red-600 rounded-3xl p-6 sm:p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
                    <div class="max-w-2xl text-center md:text-left">
                        <h3 class="text-xl sm:text-2xl font-bold text-blue-900 flex items-center justify-center md:justify-start gap-2.5">
                            <i class="fas fa-clipboard-list text-red-600"></i>
                            Complete Aging-in-Place Checklist
                        </h3>
                        <p class="text-gray-600 mt-2 text-sm sm:text-base leading-relaxed">
                            Planning a home renovation or build? Explore our comprehensive guide covering exterior layout, room dimensions, countertops, bathroom wall-bracing, stairways, and electrical controls.
                        </p>
                    </div>
                    <div class="flex-shrink-0 w-full md:w-auto text-center">
                        <a href="/services/aging-in-place-guide" class="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-4 rounded-xl transition shadow-lg shadow-red-600/30">
                            View Checklist &amp; Guide <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </div>` : ''}
                <div class="text-center mb-8">
                    <div class="uppercase text-blue-600 font-semibold tracking-widest text-sm">What's Included</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">${displayName} Services We Provide</h2>
                    <p class="mt-3 text-gray-600 max-w-2xl mx-auto">A few of the most requested tasks in this category. Do not see yours? Just ask, no job too small.</p>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
${service.features.map(featureCard).join('\n')}
                </div>
                <div class="mt-8 text-center">
                    <a href="/services" class="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-base sm:text-lg px-8 py-4 rounded-xl font-semibold transition shadow-lg">
                        View All Services <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>

            <!-- Related services: internal links for discovery + SEO -->
            <div class="max-w-5xl mx-auto mt-12 sm:mt-16">
                <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-6">Related Services</h2>
                <p class="text-center text-gray-600 mb-6 max-w-2xl mx-auto">Homeowners who booked ${service.name.toLowerCase().replace(/ services$/, '')} also asked about:</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
${related.map(relatedCard).join('\n')}
                </div>
                <div class="mt-6 text-center">
                    <a href="/services" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white hover:bg-blue-800 rounded-xl transition font-semibold"><i class="fas fa-list"></i> Browse All Services</a>
                </div>
            </div>

${serviceAreasSection(service)}

            <!-- FAQ -->
            <div class="max-w-4xl mx-auto mt-14 sm:mt-20">
                <div class="text-center mb-8">
                    <div class="uppercase text-red-600 font-semibold tracking-widest text-sm">${displayName} FAQ</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">Common Questions</h2>
                </div>
                <div class="space-y-4">
${faqs.map((f) => `                    <article class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 p-6 rounded-3xl shadow-sm">
                        <h3 class="text-lg sm:text-xl font-bold text-blue-900 mb-2">${amp(f.q)}</h3>
                        <p class="text-gray-600">${amp(f.a)}</p>
                    </article>`).join('\n')}
                </div>
            </div>

            <!-- CTA band -->
            <div class="max-w-5xl mx-auto mt-14 sm:mt-20 text-center bg-blue-900 text-white py-12 px-8 sm:py-16 sm:px-16 rounded-3xl">
                <p class="text-xl sm:text-2xl md:text-3xl font-medium">Ready for ${displayName.toLowerCase()}?</p>
                <p class="mt-4 text-base sm:text-lg opacity-90">Call for availability and same-week scheduling, or request a free quote online. No job too small.</p>
                <div class="mt-8 flex flex-wrap justify-center gap-4">
                    <a href="tel:${PHONE_TEL}" class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-green-600/30">
                        <i class="fas fa-phone"></i> ${PHONE_DISPLAY}
                    </a>
                    <a href="${quoteHref(service.formService)}" class="inline-flex items-center gap-2 bg-white text-blue-900 hover:bg-gray-100 font-semibold px-6 py-3 rounded-xl transition shadow-lg">
                        <i class="fas fa-calendar-check"></i> Get a Free Quote
                    </a>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-black text-gray-400 pt-14 pb-10">
        <div class="max-w-7xl mx-auto px-6">
            <div class="grid gap-10 md:grid-cols-3 md:gap-8 text-center md:text-left">
                <div class="flex flex-col items-center md:items-start">
                    <img src="/.netlify/images?url=/logo-circular.png&amp;w=160&amp;fm=avif&amp;q=80" srcset="/.netlify/images?url=/logo-circular.png&amp;w=80&amp;fm=avif&amp;q=80 1x, /.netlify/images?url=/logo-circular.png&amp;w=160&amp;fm=avif&amp;q=80 2x" width="80" height="80" loading="lazy" decoding="async" alt="AAA Handyman Services Circular Logo" class="h-20 w-20 rounded-full object-cover shadow-lg border-2 border-red-600 mb-4">
                    <p class="text-sm max-w-xs">Reliable minor home repairs, maintenance, and small-scale projects for homeowners across Oakland County, Michigan.</p>
                    <div class="mt-4 flex items-center gap-4">
                        <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" aria-label="Follow AAA Handyman Services on Facebook" class="text-2xl hover:text-[#1877F2] transition"><i class="fab fa-facebook"></i></a>
                        <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Nextdoor" class="text-2xl hover:text-[#00B24F] transition"><i class="fa-solid fa-house-chimney"></i></a>
                        <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Yelp" class="text-2xl hover:text-[#FF1A1A] transition"><i class="fa-brands fa-yelp"></i></a>
                    </div>
                </div>
                <nav aria-label="Footer">
                    <h3 class="text-white font-bold uppercase tracking-widest text-sm mb-4">Explore</h3>
                    <ul class="space-y-2 text-sm">
                        <li><a href="/services" class="hover:text-white transition">Services</a></li>
                        <li><a href="/rates" class="hover:text-white transition">Rates &amp; Packages</a></li>
                        <li><a href="/guarantee" class="hover:text-white transition">Our Guarantee</a></li>
                        <li><a href="/reviews" class="hover:text-white transition">Reviews</a></li>
                        <li><a href="/careers" class="hover:text-white transition">Careers</a></li>
                        <li><a href="/service-areas" class="hover:text-white transition">Service Areas</a></li>
                        <li><a href="/#faq" class="hover:text-white transition">FAQ</a></li>
                    </ul>
                </nav>
                <div>
                    <h3 class="text-white font-bold uppercase tracking-widest text-sm mb-4">Get in Touch</h3>
                    <ul class="space-y-3 text-sm">
                        <li><a href="tel:${PHONE_TEL}" class="inline-flex items-center gap-3 hover:text-white transition"><i class="fas fa-phone text-green-500 w-4 text-center"></i>${PHONE_DISPLAY}</a></li>
                        <li><a href="mailto:contact@aaahandyman.services" class="inline-flex items-center gap-3 hover:text-white transition break-all"><i class="fas fa-envelope text-blue-500 w-4 text-center"></i>contact@aaahandyman.services</a></li>
                        <li class="flex items-center justify-center md:justify-start gap-3"><i class="fas fa-map-marker-alt text-red-500 w-4 text-center"></i>Waterford, MI &middot; Oakland County</li>
                    </ul>
                    <a href="${quoteHref(service.formService)}" class="mt-5 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-red-600/30"><i class="fas fa-calendar-check"></i>Get a Free Quote</a>
                </div>
            </div>
            <!-- Quick-access sitemap: popular services + service areas reachable in one click from any page -->
            <div class="mt-12 pt-10 border-t border-gray-800 grid gap-10 sm:grid-cols-2 text-center sm:text-left">
                <nav aria-label="Popular services">
                    <h3 class="text-white font-bold uppercase tracking-widest text-sm mb-4">Popular Services</h3>
                    <ul class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <li><a href="/services/carpentry" class="hover:text-white transition">Carpentry</a></li>
                        <li><a href="/services/drywall-repair" class="hover:text-white transition">Drywall Repair</a></li>
                        <li><a href="/services/painting-staining" class="hover:text-white transition">Painting &amp; Staining</a></li>
                        <li><a href="/services/doors-windows" class="hover:text-white transition">Doors &amp; Windows</a></li>
                        <li><a href="/services/flooring-solutions" class="hover:text-white transition">Flooring Solutions</a></li>
                        <li><a href="/services/minor-plumbing" class="hover:text-white transition">Minor Plumbing</a></li>
                        <li><a href="/services/minor-electrical" class="hover:text-white transition">Minor Electrical</a></li>
                        <li><a href="/services/decks-fences" class="hover:text-white transition">Decks &amp; Fences</a></li>
                        <li><a href="/services/gutters" class="hover:text-white transition">Gutters</a></li>
                        <li><a href="/services/power-washing" class="hover:text-white transition">Power Washing</a></li>
                    </ul>
                    <a href="/services" class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-white transition">All services <i class="fas fa-arrow-right text-xs"></i></a>
                </nav>
                <nav aria-label="Service areas">
                    <h3 class="text-white font-bold uppercase tracking-widest text-sm mb-4">Service Areas</h3>
                    <ul class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <li><a href="/handyman/waterford" class="hover:text-white transition">Waterford</a></li>
                        <li><a href="/handyman/troy" class="hover:text-white transition">Troy</a></li>
                        <li><a href="/handyman/west-bloomfield" class="hover:text-white transition">West Bloomfield</a></li>
                        <li><a href="/handyman/rochester-hills" class="hover:text-white transition">Rochester Hills</a></li>
                        <li><a href="/handyman/royal-oak" class="hover:text-white transition">Royal Oak</a></li>
                        <li><a href="/handyman/birmingham" class="hover:text-white transition">Birmingham</a></li>
                        <li><a href="/handyman/clarkston" class="hover:text-white transition">Clarkston</a></li>
                        <li><a href="/handyman/farmington-hills" class="hover:text-white transition">Farmington Hills</a></li>
                        <li><a href="/handyman/novi" class="hover:text-white transition">Novi</a></li>
                        <li><a href="/handyman/southfield" class="hover:text-white transition">Southfield</a></li>
                        <li><a href="/handyman/franklin" class="hover:text-white transition">Franklin</a></li>
                        <li><a href="/handyman/orchard-lake" class="hover:text-white transition">Orchard Lake</a></li>
                    </ul>
                    <a href="/service-areas" class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-white transition">All service areas <i class="fas fa-arrow-right text-xs"></i></a>
                </nav>
            </div>
            <div class="mt-12 pt-8 border-t border-gray-800 text-center">
                <p class="text-xs leading-relaxed">&copy; 2026 AAA Handyman Services. All Rights Reserved. Operating under the minor project exemption of Michigan's Occupational Code (MCL 339.2403).<br>Notice: AAA Handyman Services specializes in minor home repairs, maintenance, and small-scale projects.<br>Locally Serving Oakland County, MI.</p>
                <div class="mt-4 flex flex-wrap justify-center gap-4 text-xs">
                    <a href="/privacy" class="hover:text-white transition">Privacy Policy</a>
                    <span class="text-gray-600">|</span>
                    <a href="/terms" class="hover:text-white transition">Terms of Service</a>
                </div>
            </div>
        </div>
    </footer>

    <!-- Back to top -->
    <button id="back-to-top" type="button" aria-label="Back to top" class="fixed bottom-6 left-6 z-50 hidden h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 hover:bg-red-700 transition"><i class="fas fa-arrow-up"></i></button>
    <script>
        (function () {
            var btn = document.getElementById('back-to-top');
            if (!btn) return;
            window.addEventListener('scroll', function () {
                var show = window.scrollY > 400;
                btn.classList.toggle('hidden', !show);
                btn.classList.toggle('flex', show);
            }, { passive: true });
            btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
        })();

        // Mobile Navigation Menu Toggle
        var mobileMenuBtn = document.getElementById('mobile-menu-btn');
        var mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', function () { mobileMenu.classList.toggle('hidden'); });
        }
    </script>

    <!-- Google tag (gtag.js) -->
    <script defer src="https://www.googletagmanager.com/gtag/js?id=G-VRMCPNEQC3"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-VRMCPNEQC3');
    </script>
</body>
</html>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const service of SERVICES) {
  const html = page(service);
  writeFileSync(join(OUT_DIR, `${service.slug}.html`), html, 'utf8');
  count += 1;
  console.log(`  wrote public/services/${service.slug}.html`);
}
console.log(`\nGenerated ${count} service landing page(s).`);
