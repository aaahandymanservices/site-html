import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = JSON.parse(readFileSync(join(ROOT, 'public/data/service-areas.json'), 'utf8'));
const OUT_DIR = join(ROOT, 'public/handyman');

const SITE = 'https://aaahandyman.services';
const PHONE_DISPLAY = '(248) 385-3432';
const PHONE_TEL = '+12483853432';

const ZONE_INFO = {
  A: { label: 'Zone A (Within 20 Miles)', rate: '$100', color: 'green', miles: 'within about 20 miles of our Waterford base' },
  B: { label: 'Zone B (Extended County / 20+ Miles)', rate: '$145', color: 'red', miles: 'in the extended county, about 20+ miles from Waterford' }
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
const quoteHref = (city) => `/contact?service=General+Estimate+%2F+Quote&city=${enc(city)}`;
const cleanHtml = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n/g, '\n');

function cityFaq(city) {
  const zone = ZONE_INFO[city.zone];
  return [
    {
      q: `Do you offer handyman services in ${city.name}, MI?`,
      a: `Yes. AAA Handyman Services is based in Waterford and regularly serves ${city.name} and the surrounding Oakland County area. We handle minor home repairs, maintenance, and small projects, from carpentry and drywall to painting, flooring, doors, gutters, and minor plumbing or electrical work.`
    },
    {
      q: `How much does a handyman cost in ${city.name}?`,
      a: `${city.name} falls in our ${zone.label}, so it carries a ${zone.rate} minimum service call that covers travel, diagnostics, and up to the first hour of labor. Continuous labor after the first hour is billed at a flat $70 per hour in quarter-hour increments. Materials are billed separately.`
    },
    {
      q: `Do you offer emergency handyman service near ${city.name}?`,
      a: `Yes. After-hours emergency service is available 7 days a week for urgent repairs such as leaks or door and window problems that affect home safety or security. Call ${PHONE_DISPLAY} for priority response.`
    }
  ];
}

function jsonLd(city) {
  const zone = ZONE_INFO[city.zone];
  const url = `${SITE}/handyman/${city.slug}`;
  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name: `AAA Handyman Services — ${city.name}, MI`,
    image: `${SITE}/logo-circular.png`,
    '@id': `${url}#business`,
    url,
    telephone: '+1-248-385-3432',
    email: 'contact@aaahandyman.services',
    priceRange: '$$',
    description: `Local handyman and home repair services for ${city.name}, Michigan and the surrounding Oakland County area. ${zone.label}: ${zone.rate} minimum service call.`,
    address: { '@type': 'PostalAddress', addressLocality: 'Waterford', addressRegion: 'MI', addressCountry: 'US' },
    sameAs: [
      'https://www.facebook.com/AAAHandymanServices',
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
  return [localBusiness, breadcrumb, faq]
    .map((obj) => `    <script type="application/ld+json">\n${JSON.stringify(obj, null, 2).split('\n').map((l) => '    ' + l).join('\n')}\n    </script>`)
    .join('\n');
}

function navLink(href, label, active) {
  const cls = active
    ? 'nav-link text-red-600 border-b-2 border-red-600 pb-1'
    : 'nav-link text-gray-700 hover:text-red-600 border-b-2 border-transparent pb-1 transition';
  return `<a href="${href}" class="${cls}">${label}</a>`;
}

function serviceChip(s) {
  return `                <a href="/services#${s.anchor}" class="generated-service-card group flex items-center gap-3 bg-white border-[2px] border-red-600 ring-1 ring-red-600 p-4 rounded-2xl shadow-sm hover:text-red-600">
                    <span class="w-10 h-10 flex-shrink-0 bg-red-100 rounded-xl flex items-center justify-center text-red-600" aria-hidden="true"><i class="fas ${s.icon}"></i></span>
                    <span class="font-semibold text-gray-800 group-hover:text-red-600">${s.label}</span>
                </a>`;
}

function nearbyLinks(city) {
  const nearby = (city.nearby || []).map((slug) => bySlug[slug]).filter(Boolean);
  if (!nearby.length) return '';
  const chips = nearby
    .map((n) => `<a href="/handyman/${n.slug}" class="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-xl transition border border-gray-200 font-semibold text-gray-800"><i class="fas fa-map-marker-alt text-red-500"></i> ${n.name}</a>`)
    .join('\n                    ');
  return `
            <!-- Nearby areas: internal links for discovery + local SEO -->
            <div class="max-w-5xl mx-auto mt-12 sm:mt-16">
                <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 text-center mb-6">Handyman Service Near ${city.name}</h2>
                <p class="text-center text-gray-600 mb-6 max-w-2xl mx-auto">We also serve nearby Oakland County communities. Explore a neighboring area:</p>
                <div class="flex flex-wrap justify-center gap-3">
                    ${chips}
                    <a href="/service-areas" class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition font-semibold shadow-md hover:shadow-green-600/30"><i class="fas fa-map"></i> All Service Areas</a>
                </div>
            </div>`;
}

function page(city) {
  const zone = ZONE_INFO[city.zone];
  const url = `${SITE}/handyman/${city.slug}`;
  const title = `Handyman in ${city.name}, MI | AAA Handyman Services`;
  const desc = `Reliable local handyman services in ${city.name}, MI. Carpentry, drywall, painting, doors, gutters, plumbing & electrical. ${zone.rate} minimum. Call ${PHONE_DISPLAY}.`;
  const faqs = cityFaq(city);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <script>
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Resource hints -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>

    <title>${title}</title>

    <!-- Search Engine Optimization (SEO) Metadata -->
    <meta name="description" content="${desc}">
    <meta name="theme-color" content="#A61F2E">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
    <meta name="geo.region" content="US-MI">
    <meta name="geo.placename" content="${city.name}, Michigan">
    <link rel="canonical" href="${url}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:site_name" content="AAA Handyman Services">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${SITE}/logo-banner.jpg">
    <meta property="og:locale" content="en_US">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${SITE}/logo-banner.jpg">

    <!-- Structured Data (JSON-LD) -->
${jsonLd(city)}

    <!-- Tailwind CSS (precompiled, see scripts/build-css.mjs) -->
    <link rel="stylesheet" href="/css/tailwind.css?v=20260720">
    <link rel="stylesheet" href="/css/site-theme.css?v=20260722">

    <!-- Brand font: Roboto -->
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" as="style">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap"></noscript>

    <!-- FontAwesome icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"></noscript>

    <style>
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
                ${navLink('/services', 'Services', false)}
                ${navLink('/service-areas', 'Service Areas', true)}
                ${navLink('/rates', 'Rates', false)}
                ${navLink('/guarantee', 'Guarantee', false)}
                ${navLink('/reviews', 'Reviews', false)}
                ${navLink('/careers', 'Careers', false)}
                ${navLink('/contact', 'Contact', false)}
                <div class="flex flex-col items-center space-y-1">
                    <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" aria-label="Follow AAA Handyman Services on Facebook" class="nav-link text-[#1877F2] hover:opacity-80 text-xl transition leading-none"><i class="fab fa-facebook"></i></a>
                    <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Yelp" class="nav-link text-[#FF1A1A] hover:opacity-80 text-sm transition leading-none"><i class="fa-brands fa-yelp"></i></a>
                    <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Nextdoor" class="nav-link text-[#00B24F] hover:opacity-80 text-sm transition leading-none"><i class="fa-solid fa-house-chimney"></i></a>
                </div>
            </div>
            <div class="flex items-center space-x-2 sm:space-x-3">
                <button id="mobile-menu-btn" class="md:hidden text-gray-700 hover:text-red-600 focus:outline-none p-1 sm:p-2" aria-label="Toggle Navigation Menu">
                    <i class="fas fa-bars text-xl sm:text-2xl" id="menu-icon"></i>
                </button>
            </div>
        </div>
        <div id="mobile-menu" class="hidden md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-inner">
            <a href="/services" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Services</a>
            <a href="/service-areas" class="block text-red-600 font-bold py-2 border-b border-gray-100">Service Areas</a>
            <a href="/rates" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Rates</a>
            <a href="/guarantee" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Guarantee</a>
            <a href="/reviews" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Reviews</a>
            <a href="/careers" class="block text-gray-700 hover:text-red-600 py-2 border-b border-gray-100 transition">Careers</a>
            <a href="/contact" class="block text-gray-700 hover:text-red-600 py-2 transition">Contact</a>
            <button onclick="window.__aaaOpenChat &amp;&amp; (window.__aaaOpenChat(), document.getElementById('mobile-menu').classList.add('hidden'))" class="block text-left w-full text-red-600 font-bold py-2 transition"><i class="fas fa-comments mr-2"></i>AI Chat Assistant</button>            <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-[#1877F2] hover:opacity-80 py-2 transition"><i class="fab fa-facebook"></i> Facebook Page</a>
            <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-[#FF1A1A] hover:opacity-80 py-2 transition"><i class="fa-brands fa-yelp"></i> Yelp Page</a>
            <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-[#00B24F] hover:opacity-80 py-2 transition"><i class="fa-solid fa-house-chimney"></i> Nextdoor Page</a>
        </div>
    </nav>

    <!-- Floating Call Action -->
    <noscript>
        <a href="tel:${PHONE_TEL}" class="fixed bottom-5 right-5 z-50 flex bg-green-600 hover:bg-green-700 text-white w-14 h-14 md:w-auto md:h-auto p-0 md:px-6 md:py-3 rounded-full font-bold items-center justify-center gap-2 md:gap-3 transition pulse-btn-green shadow-2xl focus:outline-none focus:ring-4 focus:ring-green-300" title="Call AAA Handyman Services Now" aria-label="Call AAA Handyman Services Now">
            <i class="fas fa-phone" aria-hidden="true"></i>
            <span class="hidden md:inline">Call Now! <span class="hidden lg:inline">${PHONE_DISPLAY}</span></span>
        </a>
    </noscript>

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
                <a href="/service-areas" class="hover:text-white">Service Areas</a>
                <span class="mx-2">/</span>
                <span class="text-white font-semibold">${city.name}</span>
            </nav>
            <div class="uppercase tracking-widest text-red-500 font-semibold text-sm sm:text-base mb-2">${city.region} &middot; Oakland County, MI</div>
            <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-3">Handyman in ${city.name}, Michigan</h1>
            <p class="text-sm sm:text-base font-semibold text-red-400 mb-4"><i class="fas fa-location-dot mr-1.5"></i>Serving ${city.name} &amp; surrounding Oakland County communities</p>
            <p class="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
                Trusted, locally owned home repair and maintenance for ${city.name} homeowners. No job too small &mdash; backed by our 1-Year Workmanship Guarantee and honest, upfront pricing.
            </p>
            <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="/book?service=General+Estimate+%2F+Quote&amp;city=${enc(city.name)}" class="bg-red-600 hover:bg-red-700 text-white font-bold text-base px-6 py-3.5 rounded-xl shadow-lg hover:shadow-red-600/30 transition flex items-center justify-center gap-2">
                    <i class="fas fa-calendar-check"></i> Book Online / Get a Free Quote
                </a>
                <a href="tel:${PHONE_TEL}" class="bg-green-600 hover:bg-green-700 text-white font-bold text-base px-6 py-3.5 rounded-xl shadow-lg hover:shadow-green-600/30 transition flex items-center justify-center gap-2">
                    <i class="fas fa-phone"></i> Call Now! ${PHONE_DISPLAY}
                </a>
            </div>
        </div>
    </header>

    <main class="flex-grow py-12 sm:py-16">
        <div class="max-w-7xl mx-auto px-6">
            <!-- Intro + pricing -->
            <div class="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
                <div class="lg:col-span-2 prose prose-lg max-w-none text-gray-600">
                    <h2 class="text-2xl sm:text-3xl font-bold text-blue-900 mb-4">Your Local Handyman for ${city.name}</h2>
                    <p>${city.blurb}</p>
                    <p>Whether it is a single nagging repair or a full seasonal to-do list, we bring the same craftsmanship, clean job sites, and clear communication to every ${city.name} home. From drywall and doors to painting, flooring, gutters, and minor plumbing or electrical work, we help you protect your home's comfort and value.</p>
                </div>
                <aside class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 rounded-3xl p-6 shadow-lg">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="text-2xl text-${zone.color}-600" aria-hidden="true"><i class="fas fa-location-dot"></i></span>
                        <div>
                            <h3 class="text-lg font-bold text-gray-900">${city.name} Coverage</h3>
                            <p class="text-sm text-gray-500">${zone.label}</p>
                        </div>
                    </div>
                    <ul class="space-y-3 text-sm text-gray-700">
                        <li class="flex items-start gap-2"><i class="fas fa-tag text-red-600 mt-1"></i><span><strong>${zone.rate} minimum service call</strong> &mdash; covers travel, diagnostics, and the first hour of labor.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-clock text-red-600 mt-1"></i><span>Then a flat <strong>$70/hour</strong> in quarter-hour increments.</span></li>                        <li class="flex items-start gap-2"><i class="fas fa-map-pin text-red-600 mt-1"></i><span>ZIP codes served: ${city.zips.join(', ')}.</span></li>
                        <li class="flex items-start gap-2"><i class="fas fa-shield-halved text-red-600 mt-1"></i><span>Every job backed by our <a href="/guarantee" class="text-red-600 font-semibold underline underline-offset-2">1-Year Workmanship Guarantee</a>.</span></li>
                    </ul>
                    <a href="${quoteHref(city.name)}" class="mt-6 w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-red-600/30">
                        <i class="fas fa-calendar-check"></i> Request Service in ${city.name}
                    </a>
                    <a href="/rates" class="mt-3 block text-center text-sm text-gray-500 hover:text-red-600 underline underline-offset-2">See full rates &amp; packages</a>
                </aside>
            </div>

            <!-- Popular services -->
            <div class="max-w-6xl mx-auto mt-14 sm:mt-20">
                <div class="text-center mb-8">
                    <div class="uppercase text-blue-600 font-semibold tracking-widest text-sm">What We Do in ${city.name}</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">Popular Handyman Services</h2>
                    <p class="mt-3 text-gray-600 max-w-2xl mx-auto">A few of the most requested repairs and projects. Tap any service for details, or see the full list.</p>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
${POPULAR_SERVICES.map(serviceChip).join('\n')}
                </div>
                <div class="mt-8 text-center">
                    <a href="/services" class="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-base sm:text-lg px-8 py-4 rounded-xl font-semibold transition shadow-lg hover:shadow-green-600/30">
                        View All Services <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>
${nearbyLinks(city)}

            <!-- FAQ -->
            <div class="max-w-4xl mx-auto mt-14 sm:mt-20">
                <div class="text-center mb-8">
                    <div class="uppercase text-red-600 font-semibold tracking-widest text-sm">${city.name} Handyman FAQ</div>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-blue-900">Questions from ${city.name} Homeowners</h2>
                </div>
                <div class="space-y-4">
${faqs.map((f) => `                    <article class="bg-white border-[2px] border-red-600 ring-1 ring-red-600 p-6 rounded-3xl shadow-sm">
                        <h3 class="text-lg sm:text-xl font-bold text-blue-900 mb-2">${f.q}</h3>
                        <p class="text-gray-600">${f.a}</p>
                    </article>`).join('\n')}
                </div>
            </div>

            <!-- CTA band -->
            <div class="max-w-5xl mx-auto mt-14 sm:mt-20 text-center bg-blue-900 text-white py-12 px-8 sm:py-16 sm:px-16 rounded-3xl">
                <p class="text-xl sm:text-2xl md:text-3xl font-medium">Need a handyman in ${city.name}?</p>
                <p class="mt-4 text-base sm:text-lg opacity-90">Call for availability and same-week scheduling, or request a free quote online. No job too small.</p>
                <div class="mt-8 flex flex-wrap justify-center gap-4">
                    <a href="tel:${PHONE_TEL}" class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-green-600/30">
                        <i class="fas fa-phone"></i> ${PHONE_DISPLAY}
                    </a>
                    <a href="/book?service=General+Estimate+%2F+Quote&city=${enc(city.name)}" class="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-red-600/30">
                        <i class="fas fa-calendar-check"></i> Book Online Now
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
                        <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" aria-label="Follow AAA Handyman Services on Facebook" class="text-2xl text-[#1877F2] hover:opacity-80 transition"><i class="fab fa-facebook"></i></a>
                        <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Nextdoor" class="text-2xl text-[#00B24F] hover:opacity-80 transition"><i class="fa-solid fa-house-chimney"></i></a>
                        <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Yelp" class="text-2xl text-[#FF1A1A] hover:opacity-80 transition"><i class="fa-brands fa-yelp"></i></a>
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
                        <li><a href="/book" class="hover:text-white transition">Book Online</a></li>
                        <li><a href="/service-areas" class="hover:text-white transition">Service Areas</a></li>
                        <li><a href="/#faq" class="hover:text-white transition">FAQ</a></li>
                    </ul>
                </nav>
                <div>
                    <h3 class="text-white font-bold uppercase tracking-widest text-sm mb-4">Get in Touch</h3>
                    <ul class="space-y-3 text-sm">
                        <li><a href="tel:${PHONE_TEL}" class="inline-flex items-center gap-3 hover:text-white transition"><i class="fas fa-phone text-green-500 w-4 text-center"></i>${PHONE_DISPLAY}</a></li>
                        <li><a href="mailto:contact@aaahandyman.services" class="inline-flex items-center gap-3 hover:text-white transition break-all"><i class="fas fa-envelope text-blue-500 w-4 text-center"></i>contact@aaahandyman.services</a></li>
                        <li class="flex items-center justify-center md:justify-start gap-3"><i class="fas fa-map-marker-alt text-red-500 w-4 text-center"></i>Serving ${city.name} &middot; Oakland County, MI</li>
                    </ul>
                    <a href="/book?service=General+Estimate+%2F+Quote&city=${enc(city.name)}" class="mt-5 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-red-600/30"><i class="fas fa-calendar-check"></i>Book Online Now</a>
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
    <script src="/js/site.js?v=20260720" defer></script>

    <!-- Google tag (gtag.js) -->
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-VRMCPNEQC3');

      function loadGtag(){
        if(window.__gtagLoaded) return;
        window.__gtagLoaded = true;
        var s = document.createElement('script');
        s.src = 'https://www.googletagmanager.com/gtag/js?id=G-VRMCPNEQC3';
        s.async = true;
        document.head.appendChild(s);
      }
      if ('requestIdleCallback' in window) {
        requestIdleCallback(function() { setTimeout(loadGtag, 2500); });
      } else {
        setTimeout(loadGtag, 3500);
      }
      ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function(e) {
        window.addEventListener(e, loadGtag, { once: true, passive: true });
      });
    </script>

    <!-- AI chat assistant widget -->
    <script src="/js/chat-widget.js?v=20260720" defer></script>
</body>
</html>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const city of DATA.cities) {
  const html = cleanHtml(page(city));
  writeFileSync(join(OUT_DIR, `${city.slug}.html`), html, 'utf8');
  count += 1;
  console.log(`  wrote public/handyman/${city.slug}.html`);
}
console.log(`\nGenerated ${count} city landing page(s).`);
