import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getUnifiedNav } from './unified-nav.mjs';
import { escapeHtml as esc, jsonLdScript } from './html-escape.mjs';
import { ASSET_VERSION, ICONS_CSS_VERSION } from './asset-version.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = JSON.parse(readFileSync(join(ROOT, 'public/data/service-areas.json'), 'utf8'));
const OUT_DIR = join(ROOT, 'public/handyman');

const SITE = 'https://aaahandyman.services';
const PHONE_DISPLAY = '(248) 385-3432';
const PHONE_TEL = '+12483853432';

/*
 * `badge` carries the finished utility strings rather than a colour name that
 * gets interpolated into a class. Tailwind scans this file for literal class
 * names, so a `text-${zone.color}-600` built at render time only ever reaches
 * the stylesheet by accident -- because some other file happened to spell the
 * same class out. The zone tags match /service-areas: Zone A deep forest green,
 * Zone B metallic gold, so a customer sees the same colour for their tier on
 * both pages. Gold is light enough that its badge takes near-black text where
 * the green one takes white; white on #d4af37 is not readable.
 */
const ZONE_INFO = {
  A: {
    label: 'Zone A (Within 20 Miles)',
    tag: 'Zone A',
    rate: '$100',
    badge: 'bg-[#1e5631] text-white',
    miles: 'within about 20 miles of our Waterford base'
  },
  B: {
    label: 'Zone B (Extended County / 20+ Miles)',
    tag: 'Zone B',
    rate: '$145',
    badge: 'bg-[#d4af37] text-[#1a1a1a]',
    miles: 'in the extended county, about 20+ miles from Waterford'
  }
};

// Popular services shown on every city page, linked to the deep anchors on /services.
const POPULAR_SERVICES = [
  { anchor: 'carpentry', icon: 'fa-hammer', label: 'Carpentry & Trim' },
  { anchor: 'doors-windows', icon: 'fa-door-open', label: 'Doors & Windows' },
  { anchor: 'drywall-repair', icon: 'fa-border-all', label: 'Drywall Repair' },
  { anchor: 'painting-staining', icon: 'fa-paint-roller', label: 'Painting & Staining' },
  { anchor: 'flooring-solutions', icon: 'fa-ruler-combined', label: 'Flooring Solutions' },
  { anchor: 'minor-plumbing', icon: 'fa-faucet-drip', label: 'Minor Plumbing' },
  { anchor: 'minor-electrical', icon: 'fa-lightbulb', label: 'Minor Electrical' },
  { anchor: 'installation', icon: 'fa-screwdriver-wrench', label: 'Installation & Mounting' },
  { anchor: 'decks-fences', icon: 'fa-tree', label: 'Decks & Fences' },
  { anchor: 'gutters', icon: 'fa-house-flood-water', label: 'Gutters' },
  { anchor: 'home-repair-upkeep', icon: 'fa-house-chimney', label: 'Home Repair & Upkeep' },
  { anchor: 'senior-care', icon: 'fa-wheelchair', label: 'Senior & Aging-in-Place' }
];

const bySlug = Object.fromEntries(DATA.cities.map((c) => [c.slug, c]));
const enc = (s) => encodeURIComponent(s);
const quoteHref = (city) => `/contact?service=General+Estimate+%2F+Quote&amp;city=${enc(city)}`;
const cleanHtml = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n/g, '\n');

function cityFaq(city) {
  const zone = ZONE_INFO[city.zone];
  return [
    {
      q: `Do you offer handyman services in ${city.name}, MI?`,
      a: `Yes. AAA Handyman Services LLC is based in Waterford and regularly serves ${city.name} and the surrounding Oakland County area. We handle home repairs, maintenance, punch lists, and minor updates, from carpentry and drywall to painting, flooring, doors, gutters, and minor plumbing or electrical work.`
    },
    {
      q: `How much does a handyman cost in ${city.name}?`,
      a: `${city.name} falls in our ${zone.label}, so it carries a ${zone.rate} minimum service call that covers travel, diagnostics, and up to the first hour of labor. Continuous labor after the first hour is billed at a flat $70 per hour in quarter-hour increments. Materials are billed separately.`
    },
    {
      q: `Do you offer emergency handyman service near ${city.name}?`,
      a: `Yes. After-hours emergency service is available 7 days a week for urgent repairs such as leaks or door and window problems that affect home safety or security ($155 first hour / $100 per hour after). Call ${PHONE_DISPLAY} for priority response.`
    }
  ];
}

function jsonLd(city) {
  const zone = ZONE_INFO[city.zone];
  const url = `${SITE}/handyman/${city.slug}`;
  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name: `AAA Handyman Services LLC — ${city.name}, MI`,
    image: `${SITE}/logo-circular.png`,
    '@id': `${url}#business`,
    url,
    telephone: '+1-248-385-3432',
    email: 'contact@aaahandyman.services',
    priceRange: '$$',
    description: `Local handyman and home repair services for ${city.name}, Michigan and the surrounding Oakland County area. ${zone.label}: ${zone.rate} minimum service call.`,
    address: { '@type': 'PostalAddress', addressLocality: 'Waterford', addressRegion: 'MI', addressCountry: 'US' },
    sameAs: [
      'https://www.facebook.com/AAAHandymanServicesLLC',
      'https://maps.app.goo.gl/uqK9xsJj4UX5tW4W7',
      'https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960',
      'https://www.yelp.com/biz/aaa-handyman-services-waterford-township'
    ],
    areaServed: [
      { '@type': 'City', name: `${city.name}, MI` },
      { '@type': 'AdministrativeArea', name: 'Oakland County, MI' }
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `Handyman Services in ${city.name}, MI`,
      itemListElement: POPULAR_SERVICES.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.label, areaServed: `${city.name}, MI` }
      }))
    }
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Service Areas', item: `${SITE}/service-areas` },
      { '@type': 'ListItem', position: 3, name: `${city.name}, MI`, item: url }
    ]
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: cityFaq(city).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };
  return jsonLdScript([localBusiness, breadcrumb, faq]);
}

function navLink(href, label, active) {
  const cls = active
    ? 'nav-link text-red-600 border-b-2 border-red-600 pb-1'
    : 'nav-link text-gray-700 hover:text-red-600 border-b-2 border-transparent pb-1 transition';
  return `<a href="${esc(href)}" class="${esc(cls)}">${esc(label)}</a>`;
}

function serviceChip(s) {
  return `                <a href="/services#${esc(s.anchor)}" class="card-layered generated-service-card group flex items-center gap-3.5 bg-white border border-slate-200/90 p-4.5 rounded-2xl shadow-sm hover:shadow-md hover:border-red-600/40 transition-all transform hover:-translate-y-1">
                    <span class="w-10 h-10 flex-shrink-0 bg-red-100/80 rounded-xl flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors" aria-hidden="true"><i class="fas ${esc(s.icon)}" aria-hidden="true"></i></span>
                    <span class="font-semibold text-gray-800 group-hover:text-red-800 transition-colors">${esc(s.label)}</span>
                </a>`;
}

function nearbyLinks(city) {
  const nearby = (city.nearby || []).map((slug) => bySlug[slug]).filter(Boolean);
  if (!nearby.length) return '';
  const chips = nearby
    .map((n) => `<a href="/handyman/${esc(n.slug)}" class="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-xl transition border border-gray-200 font-semibold text-gray-800"><i class="fas fa-map-marker-alt text-red-500" aria-hidden="true"></i> ${esc(n.name)}</a>`)
    .join('\n                    ');
  return `
            <!-- Nearby areas: internal links for discovery + local SEO -->
            <div class="max-w-5xl mx-auto mt-12 sm:mt-16">
                <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-6">Handyman Service Near ${esc(city.name)}</h2>
                <p class="text-center text-gray-600 mb-6 max-w-2xl mx-auto">We also serve nearby Oakland County communities. Explore a neighboring area:</p>
                <div class="flex flex-wrap justify-center gap-3">
                    ${chips}
                    <a href="/service-areas" class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition font-semibold shadow-md hover:shadow-green-600/30"><i class="fas fa-map" aria-hidden="true"></i> All Service Areas</a>
                </div>
            </div>`;
}

function page(city) {
  const zone = ZONE_INFO[city.zone];
  // Raw text, escaped at each sink below. Escaping here instead would double up
  // wherever these are interpolated into markup.
  const url = `${SITE}/handyman/${city.slug}`;
  const title = `Handyman in ${city.name}, MI | AAA Handyman Services LLC`;
  const desc = `Reliable local handyman services in ${city.name}, MI. Carpentry, drywall, painting, doors, gutters, plumbing & electrical. ${zone.rate} minimum. Call ${PHONE_DISPLAY}.`;
  const faqs = cityFaq(city);

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
    <meta name="geo.placename" content="${esc(city.name)}, Michigan">
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
${jsonLd(city)}

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
${getUnifiedNav('service-areas')}

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
                <a href="/service-areas" class="hover:text-white">Service Areas</a>
                <span class="mx-2">/</span>
                <span class="text-white font-semibold">${esc(city.name)}</span>
            </nav>
            <div class="badge-craftsman text-xs sm:text-base mb-3 inline-flex">${esc(city.region)} &middot; Oakland County, MI</div>
            <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-3">Handyman in ${esc(city.name)}, Michigan</h1>
            <p class="text-sm sm:text-base font-semibold text-red-200 mb-4"><i class="fas fa-location-dot mr-1.5" aria-hidden="true"></i>Serving ${esc(city.name)} &amp; surrounding Oakland County communities</p>
            <p class="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
                Trusted, locally owned home repair and maintenance for ${esc(city.name)} homeowners. No job too small &mdash; backed by our 1-Year Workmanship Guarantee and honest, upfront pricing.
            </p>
            <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="/book?service=General+Estimate+%2F+Quote&amp;city=${enc(city.name)}" class="btn-craftsman text-base px-6 py-3.5 rounded-xl shadow-lg">
                    <i class="fas fa-calendar-check" aria-hidden="true"></i> Book Online / Get a Free Quote
                </a>
                <a href="tel:${PHONE_TEL}" class="aaa-btn bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-base px-6 py-3.5 rounded-xl border border-red-500/40 hover:border-red-500 shadow-lg transition flex items-center justify-center gap-2">
                    <i class="fas fa-phone text-emerald-400" aria-hidden="true"></i> Call Now! ${PHONE_DISPLAY}
                </a>
            </div>
        </div>
    </header>

    <main id="main-content" class="flex-grow">
        <div class="max-w-7xl mx-auto px-6 pt-10 sm:pt-14">
            <!-- Intro + pricing -->
            <div class="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start reveal-on-scroll">
                <div class="lg:col-span-2 prose prose-lg max-w-none text-gray-600">
                    <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">Your Local Handyman for ${esc(city.name)}</h2>
                    <p>${esc(city.blurb)}</p>
                    <p>Whether it is a single nagging repair or a full seasonal to-do list, we bring the same craftsmanship, clean job sites, and clear communication to every ${esc(city.name)} home. From drywall and doors to painting, flooring, gutters, and minor plumbing or electrical work, we help you protect your home's comfort and value.</p>
                </div>
                <aside class="card-layered bg-white border border-slate-200/80 rounded-3xl p-6 shadow-lg">
                    <div class="mb-4">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <h3 class="text-lg font-bold text-gray-900">${esc(city.name)} Coverage</h3>
                            <span class="inline-flex items-center gap-1.5 rounded-full ${esc(zone.badge)} px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest">
                                <i class="fas fa-location-dot" aria-hidden="true"></i> ${esc(zone.tag)}
                            </span>
                        </div>
                        <p class="text-sm text-gray-500 mt-1">${esc(zone.label)}</p>
                    </div>
                    <ul class="space-y-3 text-sm text-gray-700">
                        <li class="flex items-start gap-2"><i class="fas fa-tag text-red-600 mt-1" aria-hidden="true"></i><span><strong>${esc(zone.rate)} minimum service call</strong> &mdash; covers travel, diagnostics, and the first hour of labor.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-clock text-red-600 mt-1" aria-hidden="true"></i><span>Then a flat <strong>$70/hour</strong> in quarter-hour increments.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-box-open text-red-600 mt-1" aria-hidden="true"></i><span>Labor only &mdash; <strong>hardware and materials are not included</strong> and are billed separately, unless you supply them yourself.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-map-pin text-red-600 mt-1" aria-hidden="true"></i><span>ZIP codes served: ${esc(city.zips.join(', '))}.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-shield-halved text-red-600 mt-1" aria-hidden="true"></i><span>Every job backed by our <a href="/guarantee" class="text-red-600 font-semibold underline underline-offset-2">1-Year Workmanship Guarantee</a>.</span></li>
                    </ul>
                    <a href="${quoteHref(city.name)}" class="btn-craftsman mt-6 w-full text-center font-bold px-6 py-3 rounded-xl shadow-md">
                        <i class="fas fa-calendar-check" aria-hidden="true"></i> Request Service in ${esc(city.name)}
                    </a>
                    <a href="/ai-estimate" class="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs font-bold text-red-600 hover:text-red-700 transition">
                        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Instant AI Photo Estimate &rarr;
                    </a>
                    <a href="/rates" class="mt-2 block text-center text-xs text-gray-500 hover:text-red-600 underline underline-offset-2">See full rates &amp; packages</a>
                </aside>
            </div>

            <!-- Popular services -->
            <div class="max-w-6xl mx-auto mt-14 sm:mt-20">
                <div class="text-center mb-8">
                    <div class="uppercase text-blue-600 font-semibold tracking-widest text-sm">What We Do in ${esc(city.name)}</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">Popular Handyman Services</h2>
                    <p class="mt-3 text-gray-600 max-w-2xl mx-auto">A few of the most requested repairs and projects. Tap any service for details, or see the full list.</p>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
${POPULAR_SERVICES.map(serviceChip).join('\n')}
                </div>
                <div class="mt-8 text-center">
                    <a href="/services" class="aaa-btn inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-base sm:text-lg px-8 py-4 rounded-xl font-semibold transition shadow-lg hover:shadow-green-600/30">
                        View All Services <i class="fas fa-arrow-right" aria-hidden="true"></i>
                    </a>
                </div>
            </div>
${nearbyLinks(city)}

            <!-- FAQ -->
            <div class="max-w-4xl mx-auto mt-14 sm:mt-20">
                <div class="text-center mb-8">
                    <div class="uppercase text-red-600 font-semibold tracking-widest text-sm">${esc(city.name)} Handyman FAQ</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">Questions from ${esc(city.name)} Homeowners</h2>
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
                <p class="text-xl sm:text-2xl md:text-3xl font-medium">Need a handyman in ${esc(city.name)}?</p>
                <p class="mt-4 text-base sm:text-lg opacity-90">Call for availability and same-week scheduling, or request a free quote online. No job too small.</p>
                <div class="mt-8 flex flex-wrap justify-center gap-4">
                    <a href="tel:${PHONE_TEL}" class="aaa-btn inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-green-600/30">
                        <i class="fas fa-phone" aria-hidden="true"></i> ${PHONE_DISPLAY}
                    </a>
                    <a href="/book?service=General+Estimate+%2F+Quote&amp;city=${enc(city.name)}" class="aaa-btn inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-red-600/30">
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
                <nav aria-label="Footer">
                    <h3 class="text-white font-bold uppercase tracking-widest text-sm mb-4">Explore</h3>
                    <ul class="space-y-2 text-sm">
                        <li><a href="/services" class="hover:text-white transition">Services</a></li>
                        <li><a href="/rates" class="hover:text-white transition">Rates &amp; Packages</a></li>
                        <li><a href="/ai-estimate" class="hover:text-white transition">AI Repair Estimator</a></li>
                        <li><a href="/pricing-policy" class="hover:text-white transition">Pricing Policies</a></li>
                        <li><a href="/guarantee" class="hover:text-white transition">Our Guarantee</a></li>
                        <li><a href="/customer-care" class="hover:text-white transition">Customer Care</a></li>
                        <li><a href="/reviews" class="hover:text-white transition">Reviews</a></li>
                        <li><a href="/careers" class="hover:text-white transition">Careers</a></li>
                        <li><a href="/book" class="hover:text-white transition">Book Online</a></li>
                        <li><a href="/service-areas" class="hover:text-white transition">Service Areas</a></li>
                        <li><a href="/#faq" class="hover:text-white transition">FAQ</a></li>
                    </ul>
                </nav>
                <div>
                    <h3 class="text-white font-bold uppercase tracking-widest text-sm mb-4">Get in Touch</h3>
                    <ul class="space-y-3 text-sm">
                        <li><a href="tel:${PHONE_TEL}" class="inline-flex items-center gap-3 hover:text-white transition"><i class="fas fa-phone text-green-500 w-4 text-center" aria-hidden="true"></i>${PHONE_DISPLAY}</a></li>
                        <li><a href="mailto:contact@aaahandyman.services" class="inline-flex items-center gap-3 hover:text-white transition break-all"><i class="fas fa-envelope text-blue-500 w-4 text-center" aria-hidden="true"></i>contact@aaahandyman.services</a></li>
                        <li class="flex items-center justify-center md:justify-start gap-3"><i class="fas fa-map-marker-alt text-red-500 w-4 text-center" aria-hidden="true"></i>Serving ${esc(city.name)} &middot; Oakland County, MI</li>
                    </ul>
                    <a href="/book?service=General+Estimate+%2F+Quote&amp;city=${enc(city.name)}" class="aaa-btn mt-5 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-red-600/30"><i class="fas fa-calendar-check" aria-hidden="true"></i>Book Online Now</a>
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
                    <a href="/services" class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-white transition">All services <i class="fas fa-arrow-right text-xs" aria-hidden="true"></i></a>
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
                    <a href="/service-areas" class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-white transition">All service areas <i class="fas fa-arrow-right text-xs" aria-hidden="true"></i></a>
                </nav>
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
for (const city of DATA.cities) {
  const html = cleanHtml(page(city));
  writeFileSync(join(OUT_DIR, `${esc(city.slug)}.html`), html, 'utf8');
  count += 1;
  console.log(`  wrote public/handyman/${esc(city.slug)}.html`);
}
console.log(`\nGenerated ${count} city landing page(s).`);
