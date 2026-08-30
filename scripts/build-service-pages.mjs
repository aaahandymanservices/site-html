import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getUnifiedNav } from './unified-nav.mjs';
import { escapeHtml as esc, jsonLdScript } from './html-escape.mjs';
import { ASSET_VERSION, ICONS_CSS_VERSION } from './asset-version.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = JSON.parse(readFileSync(join(ROOT, 'public/data/services.json'), 'utf8'));
const OUT_DIR = join(ROOT, 'public/services');

const SITE = 'https://aaahandyman.services';
const PHONE_DISPLAY = '(248) 385-3432';
const PHONE_TEL = '+12483853432';

const CATEGORIES = DATA.categories;
const SERVICES = DATA.services;

const enc = (s) => encodeURIComponent(s);
const quoteHref = (service) => `/contact?service=${enc(service)}`;
const cleanHtml = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n/g, '\n');

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
      a: `Yes. AAA Handyman Services LLC is based in Waterford and provides ${service.name.toLowerCase().replace(/ services$/, '')} services for homeowners throughout Oakland County, Michigan, from Waterford and Clarkston to Troy, Royal Oak, Novi, and the surrounding communities.`
    },
    {
      q: `How much does ${service.name.toLowerCase().replace(/ services$/, '')} cost?`,
      a: `Pricing starts with a minimum service call: $100 in Zone A (within about 20 miles of our Waterford base) or $145 in Zone B (extended county, 20+ miles). That covers travel, diagnostics, and up to the first hour of labor. Continuous labor after the first hour is billed at a flat $70 per hour in quarter-hour increments, and materials are billed separately.`
    }
  ];
  if (service.faq) faqs.push({ q: service.faq.q, a: service.faq.a });
  faqs.push({
    q: `Do you offer emergency service for urgent issues?`,
    a: `Yes. After-hours emergency service is available 7 days a week for urgent repairs that affect home safety or security, such as leaks or door and window problems ($155 first hour / $100 per hour after). Call ${PHONE_DISPLAY} for priority response.`
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
    name: `${service.name} — AAA Handyman Services LLC`,
    '@id': `${url}#service`,
    url,
    category: catLabel,
    description: service.intro[0],
    provider: {
      '@type': 'HomeAndConstructionBusiness',
      name: 'AAA Handyman Services LLC',
      image: `${SITE}/logo-circular.png`,
      telephone: '+1-248-385-3432',
      email: 'contact@aaahandyman.services',
      priceRange: '$$',
      address: { '@type': 'PostalAddress', addressLocality: 'Waterford', addressRegion: 'MI', addressCountry: 'US' },
      sameAs: [
        'https://www.facebook.com/AAAHandymanServicesLLC',
        'https://maps.app.goo.gl/uqK9xsJj4UX5tW4W7',
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
    .map((obj) => jsonLdScript(obj))
    .join('\n');
}

function navLink(href, label, active) {
  const cls = active
    ? 'nav-link text-red-600 border-b-2 border-red-600 pb-1'
    : 'nav-link text-gray-700 hover:text-red-600 border-b-2 border-transparent pb-1 transition';
  return `<a href="${esc(href)}" class="${esc(cls)}">${esc(label)}</a>`;
}

function featureCard(f) {
  return `                <div class="card-layered flex items-start gap-3.5 bg-white border border-slate-200/90 p-4.5 rounded-2xl shadow-sm hover:shadow-md hover:border-red-600/40 transition-all transform hover:-translate-y-0.5 group">
                    <span class="w-9 h-9 flex-shrink-0 bg-red-100/80 rounded-xl flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors" aria-hidden="true"><i class="fas fa-check" aria-hidden="true"></i></span>
                    <span class="font-semibold text-gray-800 self-center">${esc(f)}</span>
                </div>`;
}

function relatedCard(s) {
  return `                <a href="/services/${esc(s.slug)}" class="card-layered generated-service-card group flex items-center gap-3.5 bg-white border border-slate-200/90 p-4.5 rounded-2xl shadow-sm hover:shadow-md hover:border-red-600/40 transition-all transform hover:-translate-y-1">
                    <span class="w-10 h-10 flex-shrink-0 bg-red-100/80 rounded-xl flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors" aria-hidden="true"><i class="fas ${esc(s.icon)}" aria-hidden="true"></i></span>
                    <span class="font-semibold text-gray-800 group-hover:text-red-800 transition-colors">${esc(s.name)}</span>
                </a>`;
}

function serviceAreasSection(service) {
  if (!CITIES_LIST.length) return '';
  const links = CITIES_LIST
    .map((c) => `<a href="/handyman/${esc(c.slug)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-xl transition border border-gray-200 text-sm font-semibold text-gray-800"><i class="fas fa-map-marker-alt text-red-500 text-xs" aria-hidden="true"></i> ${esc(c.name)}</a>`)
    .join('\n                    ');
  return `
            <!-- Service Area locations: internal links for discovery + local SEO -->
            <div class="max-w-5xl mx-auto mt-12 sm:mt-16 border-t border-gray-200 pt-10">
                <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-6">Our ${esc(service.name)} Service Area</h2>
                <p class="text-center text-gray-600 mb-6 max-w-2xl mx-auto">We provide expert ${esc(service.name.toLowerCase())} in the following Oakland County, Michigan communities:</p>
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
                <div class="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
                    <div class="flex items-center gap-3 mb-5">
                        <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600" aria-hidden="true"><i class="fas fa-ruler-horizontal" aria-hidden="true"></i></span>
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
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-red-600/30 transition">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-house-chimney" aria-hidden="true"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Roof Pitch &amp; Height</h4>
                            <p class="text-sm text-gray-600">Un-walkable, steep roofs or multi-story homes require extra safety harnesses and setup time, which can add a premium of 15% or more.</p>
                        </div>
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-red-600/30 transition">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-seedling" aria-hidden="true"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Severity of Clogs</h4>
                            <p class="text-sm text-gray-600">Gutters that are severely overflowing, packed with dirt, or hosting growing weeds must be scooped by hand instead of flushed &mdash; expect a 10% to 50% heavy-debris surcharge.</p>
                        </div>
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-red-600/30 transition">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-screwdriver-wrench" aria-hidden="true"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Gutter Guards</h4>
                            <p class="text-sm text-gray-600">Mesh or surface-tension guards that must be unscrewed and re-secured to clean underneath add labor time, and usually increase the cost.</p>
                        </div>
                    </div>
                    <p class="mt-5 text-sm text-gray-500 text-center max-w-3xl mx-auto"><i class="fas fa-circle-info text-red-600 mr-1" aria-hidden="true"></i> AAA Handyman keeps it simple: rather than charging by the foot, we quote a flat rate up front, then bill continuous labor at <strong>$70/hour</strong> in quarter-hour increments for anything beyond a standard clean. You will always know the price before we start. Prefer an instant quote? <a href="/ai-estimate" class="text-red-600 font-semibold underline underline-offset-2">Try our AI Repair Estimator</a>.</p>
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
                <div class="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
                    <div class="flex items-center gap-3 mb-5">
                        <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600" aria-hidden="true"><i class="fas fa-ruler-combined" aria-hidden="true"></i></span>
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
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-red-600/30 transition">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-soap" aria-hidden="true"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Surface Condition</h4>
                            <p class="text-sm text-gray-600">Heavy oil stains on driveways or thick green mold on north-facing siding need chemical pre-treatments, which add to material costs.</p>
                        </div>
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-red-600/30 transition">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-faucet-drip" aria-hidden="true"></i></span>
                            <h4 class="font-bold text-gray-900 mb-1">Water Access</h4>
                            <p class="text-sm text-gray-600">Rates assume a hookup to an outdoor spigot with strong pressure. If a technician must bring a water truck, the price scales up sharply.</p>
                        </div>
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-red-600/30 transition">
                            <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600 mb-3" aria-hidden="true"><i class="fas fa-couch" aria-hidden="true"></i></span>
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
  const displayName = service.name;
  const title = `${service.name} in Oakland County, MI | AAA Handyman Services LLC`;
  const desc = `${service.tagline} Professional ${service.name.toLowerCase().replace(/ services$/, '')} across Oakland County, MI. Call ${PHONE_DISPLAY}.`;
  const faqs = serviceFaq(service);
  const related = relatedServices(service);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Self-hosted brand fonts; @font-face lives in site-theme.css -->
    <link rel="preload" href="/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/roboto-latin.woff2" as="font" type="font/woff2" crossorigin>
    <style id="aaa-critical-palette">html{overflow-x:hidden}body{background:#f9fafb;color:#111827;margin:0;overflow-x:hidden}:where(.fa,.fas,.far,.fab,.fa-solid,.fa-regular,.fa-brands){display:inline-block;width:1em;line-height:1;font-style:normal;text-align:center}#site-header{position:sticky;top:0;z-index:100;background:#fff;border-bottom:3px solid #a61f2e;box-shadow:0 6px 22px rgba(27,42,74,.08)}#seasonal-banner{background:linear-gradient(100deg,#fff8ef,#fdeedd 48%,#fff6ec);border-bottom:1px solid rgba(27,42,74,.1)}#seasonal-banner[hidden]{display:none}.ambient-glow-hero,#booking-section.ambient-glow-hero{position:relative;overflow:hidden;min-height:18rem;background-color:#1b2a4a;background-image:linear-gradient(to right,#101b31 0%,#1b2a4a 50%,#020617 100%);color:#fff}.ambient-glow-hero h1,#booking-section.ambient-glow-hero h1{color:#fff}.skip-link{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.skip-link:focus,.skip-link:focus-visible{position:fixed!important;top:.75rem!important;left:50%!important;transform:translateX(-50%)!important;z-index:200!important;width:auto!important;height:auto!important;padding:.75rem 1.5rem!important;background:#a61f2e!important;color:#fff!important;font-weight:700!important;border-radius:.75rem!important;clip:auto!important;white-space:normal!important}</style>

    <title>${esc(title)}</title>

    <!-- Search Engine Optimization (SEO) Metadata -->
    <meta name="description" content="${esc(desc)}">
    <meta name="theme-color" content="#A61F2E">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
    <meta name="geo.region" content="US-MI">
    <meta name="geo.placename" content="Oakland County, Michigan">
    <link rel="canonical" href="${esc(url)}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${esc(url)}">
    <meta property="og:site_name" content="AAA Handyman Services LLC">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:image" content="${SITE}/logo-banner.jpg">
    <meta property="og:locale" content="en_US">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${esc(url)}">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${SITE}/logo-banner.jpg">

    <!-- Structured Data (JSON-LD) -->
${jsonLd(service)}

    <!--
      The analytics tag is injected on first interaction or after an idle
      timeout, whichever comes first, so a preconnect socket would idle out
      before it is ever used. Resolving the name up front is the part that
      still pays: the lookup is cached well past the deferral, so the request
      that eventually goes out skips a DNS round trip.
    -->
    <link rel="dns-prefetch" href="https://www.googletagmanager.com">

    <!-- Tailwind CSS (precompiled, see scripts/build-css.mjs) -->
    <link rel="stylesheet" href="/css/tailwind.css?v=${ASSET_VERSION}">
    <!-- Site theme (async via preload swap; palette block above paints first frame) -->
    <link rel="preload" href="/css/site-theme.css?v=${ASSET_VERSION}" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="/css/site-theme.css?v=${ASSET_VERSION}"></noscript>
    <!-- Font Awesome subset (generated, see scripts/build-icon-css.mjs) -->
    <link rel="preload" href="/css/icons.css?v=${ICONS_CSS_VERSION}" as="style" fetchpriority="low" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="/css/icons.css?v=${ICONS_CSS_VERSION}"></noscript>

    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="AAA Handyman">
    <meta name="application-name" content="AAA Handyman">
</head>
<body class="bg-gray-50 text-gray-900 flex flex-col min-h-screen overflow-x-hidden">
    <!-- Navbar -->
${getUnifiedNav('services')}

    <!-- Header / Hero -->
    <header class="ambient-glow-hero bg-gradient-to-r from-blue-950 via-blue-900 to-slate-950 text-white py-16 sm:py-20 relative overflow-hidden">
        <div class="absolute inset-0 opacity-5">
            <div class="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        </div>
        <div class="max-w-4xl mx-auto px-6 relative z-10 text-center">
            <!-- Breadcrumb -->
            <nav aria-label="Breadcrumb" class="text-sm text-blue-200 mb-4">
                <a href="/" class="hover:text-white">Home</a>
                <span class="mx-2">/</span>
                <a href="/services" class="hover:text-white">Services</a>
                <span class="mx-2">/</span>
                <span class="text-white font-semibold">${esc(displayName)}</span>
            </nav>
            <div class="w-16 h-16 mx-auto bg-red-600/10 border border-red-500/30 rounded-2xl flex items-center justify-center text-3xl text-red-300 mb-5 shadow-inner" aria-hidden="true"><i class="fas ${esc(service.icon)}" aria-hidden="true"></i></div>
            <div class="badge-craftsman text-xs sm:text-base mb-3 inline-flex">${esc(catLabel)} &middot; Oakland County, MI</div>
            <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-3">${esc(displayName)}</h1>
            <p class="text-sm sm:text-base font-semibold text-red-200 mb-4"><i class="fas fa-location-dot mr-1.5" aria-hidden="true"></i>Serving Oakland County</p>
            <p class="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
                ${esc(service.tagline)}
            </p>
            <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="/book?service=${enc(service.formService)}" class="btn-craftsman text-base px-6 py-3.5 rounded-xl shadow-lg">
                    <i class="fas fa-calendar-check" aria-hidden="true"></i> Book Online / Get a Free Quote
                </a>
                <a href="tel:${PHONE_TEL}" class="aaa-btn bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-base px-6 py-3.5 rounded-xl border border-red-500/40 hover:border-red-500 shadow-lg transition flex items-center justify-center gap-2">
                    <i class="fas fa-phone text-emerald-400" aria-hidden="true"></i> Call Now! ${PHONE_DISPLAY}
                </a>
            </div>
        </div>
    </header>

    <main id="main-content" class="flex-grow py-12 sm:py-16">
        <div class="max-w-7xl mx-auto px-6">
            <!-- Intro + pricing -->
            <div class="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start reveal-on-scroll">
                <div class="lg:col-span-2 prose prose-lg max-w-none text-gray-600">
                    <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">${esc(displayName)} in Waterford, Troy, West Bloomfield &amp; Oakland County, MI</h2>
${(service.slug === 'minor-electrical' || service.slug === 'minor-plumbing') ? `
                    <div class="my-4 p-4 bg-blue-50 border-2 border-blue-900 rounded-2xl flex items-start gap-3 text-blue-950">
                        <i class="fas fa-info-circle text-blue-800 text-xl mt-0.5 flex-shrink-0" aria-hidden="true"></i>
                        <p class="text-sm font-semibold leading-relaxed m-0">
                            <strong>Licensing &amp; Scope Note:</strong> Ideal for minor repairs, fixture replacements, and hardware upgrades. For major re-wiring or full replumbing, we can coordinate with licensed trades.
                        </p>
                    </div>` : ''}
${service.intro.map((p) => `                    <p>${esc(p)}</p>`).join('\n')}
                </div>
                <aside class="card-layered bg-white border border-slate-200/80 rounded-3xl p-6 shadow-lg">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="text-2xl text-red-600" aria-hidden="true"><i class="fas fa-tag" aria-hidden="true"></i></span>
                        <div>
                            <h3 class="text-lg font-bold text-gray-900">Simple, Upfront Pricing</h3>
                            <p class="text-sm text-gray-500">${esc(service.name)}</p>
                        </div>
                    </div>
                    <ul class="space-y-3 text-sm text-gray-700">
                        <li class="flex items-start gap-2"><i class="fas fa-location-dot text-red-600 mt-1" aria-hidden="true"></i><span><strong>$100 minimum</strong> in Zone A (within ~20 miles) &middot; <strong>$145</strong> in Zone B (extended county).</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-clock text-red-600 mt-1" aria-hidden="true"></i><span>Then a flat <strong>$70/hour</strong> in quarter-hour increments.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-box-open text-red-600 mt-1" aria-hidden="true"></i><span>Labor only &mdash; <strong>hardware and materials are not included</strong> and are billed separately, unless you supply them yourself.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-shield-halved text-red-600 mt-1" aria-hidden="true"></i><span>Every job backed by our <a href="/guarantee" class="text-red-600 font-semibold underline underline-offset-2">1-Year Workmanship Guarantee</a>.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-map text-red-600 mt-1" aria-hidden="true"></i><span>Available across <a href="/service-areas" class="text-red-600 font-semibold underline underline-offset-2">Oakland County</a>.</span></li>
                    </ul>
                    <a href="${quoteHref(service.formService)}" class="btn-craftsman mt-6 w-full text-center font-bold px-6 py-3 rounded-xl shadow-md">
                        <i class="fas fa-calendar-check" aria-hidden="true"></i> Request This Service
                    </a>
                    <a href="/ai-estimate" class="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs font-bold text-red-600 hover:text-red-700 transition">
                        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Instant AI Photo Estimate &rarr;
                    </a>
                    <a href="/rates" class="mt-2 block text-center text-xs text-gray-500 hover:text-red-600 underline underline-offset-2">See full rates &amp; packages</a>
                </aside>
            </div>
${costGuideSection(service)}
            <!-- What's included -->
            <div class="max-w-6xl mx-auto mt-14 sm:mt-20">
                ${service.slug === 'senior-care' ? `<!-- Checklist Callout Section -->
                <div class="bg-red-50 border-2 border-red-600 rounded-3xl p-6 sm:p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
                    <div class="max-w-2xl text-center md:text-left">
                        <h3 class="text-xl sm:text-2xl font-bold text-blue-900 flex items-center justify-center md:justify-start gap-2.5">
                            <i class="fas fa-clipboard-list text-red-600" aria-hidden="true"></i>
                            Complete Aging-in-Place Checklist
                        </h3>
                        <p class="text-gray-600 mt-2 text-sm sm:text-base leading-relaxed">
                            Planning aging-in-place updates? Explore our comprehensive guide covering exterior layout, room dimensions, countertops, bathroom wall-bracing, stairways, and electrical controls.
                        </p>
                    </div>
                    <div class="flex-shrink-0 w-full md:w-auto text-center">
                        <a href="/services/aging-in-place-guide" class="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-4 rounded-xl transition shadow-lg shadow-red-600/30">
                            View Checklist &amp; Guide <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </a>
                    </div>
                </div>` : ''}
                <div class="text-center mb-8">
                    <div class="uppercase text-blue-600 font-semibold tracking-widest text-sm">What's Included</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">${esc(displayName)} Services We Provide</h2>
                    <p class="mt-3 text-gray-600 max-w-2xl mx-auto">A few of the most requested tasks in this category. Do not see yours? Just ask, no job too small.</p>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
${service.features.map(featureCard).join('\n')}
                </div>
                <div class="mt-8 text-center">
                    <a href="/services" class="aaa-btn inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-base sm:text-lg px-8 py-4 rounded-xl font-semibold transition shadow-lg hover:shadow-green-600/30">
                        View All Services <i class="fas fa-arrow-right" aria-hidden="true"></i>
                    </a>
                </div>
            </div>

            <!-- Related services: internal links for discovery + SEO -->
            <div class="max-w-5xl mx-auto mt-12 sm:mt-16">
                <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-6">Related Services</h2>
                <p class="text-center text-gray-600 mb-6 max-w-2xl mx-auto">Homeowners who booked ${esc(service.name.toLowerCase().replace(/ services$/, ''))} also asked about:</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
${related.map(relatedCard).join('\n')}
                </div>
                <div class="mt-6 text-center">
                    <a href="/services" class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition font-semibold shadow-md hover:shadow-green-600/30"><i class="fas fa-list" aria-hidden="true"></i> Browse All Services</a>
                </div>
            </div>

${serviceAreasSection(service)}

            <!-- FAQ -->
            <div class="max-w-4xl mx-auto mt-14 sm:mt-20">
                <div class="text-center mb-8">
                    <div class="uppercase text-red-600 font-semibold tracking-widest text-sm">${esc(displayName)} FAQ</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">Common Questions</h2>
                </div>
                <div class="space-y-4">
${faqs.map((f) => `                    <article class="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm hover:border-red-600/30 transition">
                        <h3 class="text-lg sm:text-xl font-bold text-blue-900 mb-2">${esc(f.q)}</h3>
                        <p class="text-gray-600">${esc(f.a)}</p>
                    </article>`).join('\n')}
                </div>
            </div>

            <!-- CTA band -->
            <div class="max-w-5xl mx-auto mt-14 sm:mt-20 text-center bg-blue-900 text-white py-12 px-8 sm:py-16 sm:px-16 rounded-3xl">
                <p class="text-xl sm:text-2xl md:text-3xl font-medium">Ready for ${esc(displayName.toLowerCase())}?</p>
                <p class="mt-4 text-base sm:text-lg opacity-90">Call for availability and same-week scheduling, or request a free quote online. No job too small.</p>
                <div class="mt-8 flex flex-wrap justify-center gap-4">
                    <a href="tel:${PHONE_TEL}" class="aaa-btn inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-green-600/30">
                        <i class="fas fa-phone" aria-hidden="true"></i> ${PHONE_DISPLAY}
                    </a>
                    <a href="/book?service=${enc(service.formService)}" class="aaa-btn inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-red-600/30">
                        <i class="fas fa-calendar-check" aria-hidden="true"></i> Book Online Now
                    </a>
                    <a href="/ai-estimate" class="aaa-btn inline-flex items-center gap-2 bg-slate-950/90 hover:bg-slate-900 border border-red-500/50 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-red-600/20">
                        <i class="fas fa-wand-magic-sparkles text-red-400" aria-hidden="true"></i> Instant AI Estimate
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
                    <img src="/.netlify/images?url=/logo-circular.png&amp;w=160&amp;fm=avif&amp;q=80" srcset="/.netlify/images?url=/logo-circular.png&amp;w=80&amp;fm=avif&amp;q=80 1x, /.netlify/images?url=/logo-circular.png&amp;w=160&amp;fm=avif&amp;q=80 2x" width="80" height="80" loading="lazy" decoding="async" alt="AAA Handyman Services LLC Circular Logo" class="h-20 w-20 rounded-full object-cover shadow-lg border-2 border-red-600 mb-4">
                    <p class="text-sm max-w-xs">Reliable home repairs, maintenance, punch lists, and minor updates for homeowners across Oakland County, Michigan.</p>
                    <div class="mt-4 flex items-center gap-4">
                        <a href="https://www.facebook.com/AAAHandymanServicesLLC" target="_blank" rel="noopener noreferrer" aria-label="Follow AAA Handyman Services LLC on Facebook" class="text-2xl text-[#1877F2] hover:opacity-80 transition"><i class="fab fa-facebook" aria-hidden="true"></i></a>
                        <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Nextdoor" class="text-2xl text-[#00B24F] hover:opacity-80 transition"><i class="fa-solid fa-house-chimney" aria-hidden="true"></i></a>
                        <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Yelp" class="text-2xl text-[#FF1A1A] hover:opacity-80 transition"><i class="fa-brands fa-yelp" aria-hidden="true"></i></a>
                        <a href="https://maps.app.goo.gl/uqK9xsJj4UX5tW4W7" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Google" class="text-2xl text-[#4285F4] hover:opacity-80 transition"><svg width="1em" height="1em" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 42.41 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 4.59 4.34 11.12l7.35 5.7C13.42 13.62 18.27 9.75 24 9.75z"/></svg></a>
                    </div>
                </div>
                <nav aria-label="Footer Navigation">
                    <h3 class="text-white font-bold uppercase tracking-widest text-sm mb-4">Explore</h3>
                    <ul class="space-y-2 text-sm">
                        <li><a href="/commercial" class="hover:text-white transition">Commercial Services</a></li>
                        <li><a href="/emergency" class="hover:text-white transition">After-Hours Emergency</a></li>
                        <li><a href="/ai-estimate" class="hover:text-white transition">AI Repair Estimator</a></li>
                        <li><a href="/pricing-policy" class="hover:text-white transition">Pricing Policies</a></li>
                        <li><a href="/customer-care" class="hover:text-white transition">Customer Care</a></li>
                        <li><a href="/reviews" class="hover:text-white transition">Reviews</a></li>
                        <li><a href="/book" class="hover:text-white transition">Book Online</a></li>
                        <li><a href="/#faq" class="hover:text-white transition">FAQ</a></li>
                    </ul>
                </nav>
                <div>
                    <h3 class="text-white font-bold uppercase tracking-widest text-sm mb-4">Get in Touch</h3>
                    <ul class="space-y-3 text-sm">
                        <li><a href="tel:${PHONE_TEL}" class="inline-flex items-center gap-3 hover:text-white transition"><i class="fas fa-phone text-green-500 w-4 text-center" aria-hidden="true"></i>${PHONE_DISPLAY}</a></li>
                        <li><a href="mailto:contact@aaahandyman.services" class="inline-flex items-center gap-3 hover:text-white transition break-all"><i class="fas fa-envelope text-blue-500 w-4 text-center" aria-hidden="true"></i>contact@aaahandyman.services</a></li>
                        <li class="flex items-center justify-center md:justify-start gap-3"><i class="fas fa-map-marker-alt text-red-500 w-4 text-center" aria-hidden="true"></i>Waterford, MI &middot; Oakland County</li>
                    </ul>
                    <a href="/book?service=${enc(service.formService)}" class="aaa-btn mt-5 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-red-600/30"><i class="fas fa-calendar-check" aria-hidden="true"></i>Book Online Now</a>
                </div>
            </div>

            <div class="mt-12 pt-8 border-t border-gray-800 text-center">
                <p class="text-xs leading-relaxed">&copy; 2026 AAA Handyman Services LLC All Rights Reserved. We operate in compliance with Michigan&rsquo;s minor project exemption (MCL 339.2403).<br>Locally Serving Oakland County, MI.</p>
                <div class="mt-4 flex flex-wrap justify-center gap-4 text-xs">
                    <a href="/privacy" class="hover:text-white transition">Privacy Policy</a>
                    <span class="text-gray-600">|</span>
                    <a href="/terms" class="hover:text-white transition">Terms of Service</a>
                </div>
            </div>
        </div>
    </footer>

    <!-- Back to top -->
    <button id="back-to-top" type="button" aria-label="Back to top" class="fixed bottom-6 left-6 z-50 hidden h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 hover:bg-red-700 transition"><i class="fas fa-arrow-up" aria-hidden="true"></i></button>
    <!-- Service worker, analytics, and the promo bar dismiss all live in one
         deferred module rather than three inline blocks per page. -->
    <script src="/js/page-boot.js?v=${ASSET_VERSION}" defer></script>
    <script src="/js/site.js?v=${ASSET_VERSION}" defer></script>

    <!-- AI chat assistant widget -->
    <script src="/js/chat-loader.js?v=${ASSET_VERSION}" defer></script>
</body>
</html>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const service of SERVICES) {
  const html = cleanHtml(page(service));
  writeFileSync(join(OUT_DIR, `${esc(service.slug)}.html`), html, 'utf8');
  count += 1;
  console.log(`  wrote public/services/${esc(service.slug)}.html`);
}
console.log(`\nGenerated ${count} service landing page(s).`);
