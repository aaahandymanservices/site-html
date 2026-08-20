/*
 * Seasonal offer bar, rendered directly under the top nav on every page.
 *
 * The copy turns over four times a year while the pages themselves are static,
 * so the season is resolved twice. Once here, at build time -- that is what a
 * visitor without JavaScript and what a crawler that doesn't run it will read.
 * Then again in the browser by js/site.js, so a deploy that predates the
 * equinox never leaves the site advertising the wrong season. Both readings
 * come from this one table: it travels to the browser as JSON inside the
 * banner rather than being copied into the script, where the two would drift.
 */

import { escapeHtml, jsonForScript } from './html-escape.mjs';

export const SEASONAL_OFFERS = {
  spring: {
    icon: '☀️',
    label: 'Spring Deck & Gutter Prep',
    lead: 'Book your spring deck & gutter prep and',
    save: 'save $50',
    note: 'Oakland County homeowners · limited spring openings',
  },
  summer: {
    icon: '🌤️',
    label: 'Summer Exterior Refresh',
    lead: 'Book your summer exterior refresh and',
    save: 'save $50',
    note: 'Oakland County homeowners · limited summer openings',
  },
  fall: {
    icon: '🍂',
    label: 'Fall Maintenance Special',
    lead: 'Book your seasonal tune-up today and',
    save: 'save $50',
    note: 'Oakland County homeowners · limited fall openings',
  },
  winter: {
    icon: '❄️',
    label: 'Winter Weatherproofing Special',
    lead: 'Book your winter weatherproofing and',
    save: 'save $50',
    note: 'Oakland County homeowners · limited winter openings',
  },
};

/** Meteorological seasons, which is how a Michigan homeowner thinks about the
 *  work: winter runs December through February, not from the solstice. */
export function currentSeason(date = new Date()) {
  const month = date.getMonth();
  if (month <= 1 || month === 11) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'fall';
}

export function getSeasonalBanner() {
  const season = currentSeason();
  const offer = SEASONAL_OFFERS[season];

  // Nothing in the table contains `<` today, but JSON sitting inside a document
  // has to survive the HTML parser whatever the copy is edited to later, and a
  // stray `</script>` in it would end the block early.
  const seasons = jsonForScript(SEASONAL_OFFERS, 0);

  // Dismissal is read back before the first paint rather than in the deferred
  // site.js, so a visitor who closed the bar never sees it flash in and
  // collapse again on every page they open. It re-derives the season key
  // instead of importing one -- the few bytes of duplication buy the whole
  // no-flash behaviour, and site.js re-checks the same key straight after.
  const dismissGuard = "(function(){try{var b=document.getElementById('seasonal-banner');"
    + 'if(!b)return;var d=new Date(),m=d.getMonth(),y=d.getFullYear();'
    + "var s=(m<=1||m===11)?'winter':m<=4?'spring':m<=7?'summer':'fall';"
    + "var k=s+'-'+(m===11?y+1:y);b.dataset.seasonKey=k;"
    + "if(localStorage.getItem('aaa-seasonal-banner')===k)b.hidden=true;}catch(e){}})();";

  return `<aside id="seasonal-banner" class="seasonal-banner" data-season="${season}" aria-label="Seasonal offer">
    <div class="seasonal-banner__inner">
        <p class="seasonal-badge">
            <span class="seasonal-badge__icon" data-banner-icon aria-hidden="true">${offer.icon}</span>
            <span data-banner-label>${escapeHtml(offer.label)}</span>
        </p>
        <p class="seasonal-banner__copy">
            <span class="seasonal-banner__lead"><span data-banner-lead>${escapeHtml(offer.lead)}</span> <strong class="seasonal-banner__save" data-banner-save>${escapeHtml(offer.save)}</strong></span>
            <span class="seasonal-banner__note" data-banner-note>${escapeHtml(offer.note)}</span>
        </p>
        <a class="seasonal-banner__cta" href="/#quote" data-banner-cta>Claim Seasonal Offer<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8h11M9 3.5 13.5 8 9 12.5"></path></svg></a>
    </div>
    <button type="button" class="seasonal-banner__close" data-banner-close aria-label="Dismiss seasonal offer">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"></path></svg>
    </button>
    <script type="application/json" data-banner-seasons>${seasons}</script>
    <script>${dismissGuard}</script>
</aside>`;
}

/*
 * New customer promotion banner, rendered at the very top of the page (above
 * the sticky header) on every page except the legal pages (Terms and Privacy).
 *
 * The offer is a $50 gift certificate toward a new customer's next service. The
 * CTA scrolls to the booking form on the current page when it is present, or
 * navigates to /book#booking-form otherwise. The banner ships its own inline
 * <style> so it paints with the first frame regardless of when site-theme.css
 * lands, and a tiny inline script wires the smooth-scroll behaviour so the CTA
 * works without waiting for the deferred behaviour scripts.
 */
export function getNewCustomerBanner({ ctaHref = '/book#booking-form' } = {}) {
  const href = escapeHtml(ctaHref);
  // The banner disappears the moment a visitor clicks the CTA, and the
  // dismissal is persisted so the bar never chases them across pages. The key
  // is plain ('dismissed') rather than season-scoped because the offer has no
  // rotation, and a returning visitor who already claimed it should not be
  // re-pitched on every page they open.
  const STORAGE_KEY = 'aaa-new-customer-banner';
  const dismissGuard = "(function(){try{if(localStorage.getItem('" + STORAGE_KEY + "')==='dismissed'){var b=document.getElementById('new-customer-banner');if(b)b.hidden=true;}}catch(e){}})();";
  return `<aside id="new-customer-banner" class="new-customer-banner" aria-label="New customer special offer">
    <style>.new-customer-banner{background:#080c14;color:#fff;border-bottom:3px solid #dc2626;transition:height .35s ease,opacity .25s ease,margin .35s ease,padding .35s ease;overflow:hidden}.new-customer-banner__inner{max-width:80rem;margin-inline:auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.5rem 1.25rem;padding:.7rem 1.25rem}.new-customer-banner__copy{display:flex;align-items:center;gap:.6rem;margin:0;text-align:center;font-size:.95rem;font-weight:600;line-height:1.35;color:#e2e8f0}.new-customer-banner__icon{font-size:1.15rem;line-height:1}.new-customer-banner__lead{color:#fca5a5;font-weight:800;letter-spacing:.01em}.new-customer-banner__amount{color:#fff;font-weight:800}.new-customer-banner__cta{display:inline-flex;align-items:center;gap:.45rem;min-height:2.75rem;padding:.5rem 1.15rem;border-radius:.7rem;background:linear-gradient(135deg,#ef4444,#dc2626 60%,#991b1b);border:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:800;font-size:.875rem;white-space:nowrap;text-decoration:none;box-shadow:0 6px 16px rgba(220,38,38,0.45);transition:transform .2s ease,box-shadow .2s ease}.new-customer-banner__cta:hover{filter:brightness(1.08);box-shadow:0 10px 22px rgba(220,38,38,0.6);transform:translateY(-1px)}.new-customer-banner__cta svg{flex:0 0 auto}#new-customer-banner[hidden]{display:none}#new-customer-banner.is-dismissing{opacity:0;margin-top:0;margin-bottom:0;padding-top:0;padding-bottom:0;height:0}@media(max-width:640px){.new-customer-banner__copy{font-size:.85rem}.new-customer-banner__cta{font-size:.8rem}}@media(prefers-reduced-motion:reduce){#new-customer-banner.is-dismissing{transition:none}}</style>
    <script>${dismissGuard}</script>
    <div class="new-customer-banner__inner">
        <p class="new-customer-banner__copy">
            <span class="new-customer-banner__icon" aria-hidden="true">🎁</span>
            <span><strong class="new-customer-banner__lead">New Customer Special:</strong> Receive a <strong class="new-customer-banner__amount">$50 gift certificate</strong> toward your next service!</span>
        </p>
        <a class="new-customer-banner__cta" href="${href}" data-ncb-cta>Claim My $50 Gift<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8h11M9 3.5 13.5 8 9 12.5"></path></svg></a>
    </div>
    <script>(function(){var b=document.getElementById('new-customer-banner');if(!b)return;var c=b.querySelector('[data-ncb-cta]');if(!c)return;var KEY='${STORAGE_KEY}';var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;function dismiss(){try{localStorage.setItem(KEY,'dismissed')}catch(e){}if(reduce){b.hidden=true;return}b.style.height=b.offsetHeight+'px';b.classList.add('is-dismissing');var done=function(){window.clearTimeout(t);b.removeEventListener('transitionend',onEnd);b.hidden=true;b.classList.remove('is-dismissing');b.style.height=''};var onEnd=function(e){if(e.target===b&&e.propertyName==='height')done()};b.addEventListener('transitionend',onEnd);var t=window.setTimeout(done,650);requestAnimationFrame(function(){b.style.height='0px'})}c.addEventListener('click',function(e){dismiss();var h=c.getAttribute('href')||'';if(h.indexOf('#')!==0)return;var t=document.querySelector(h);if(!t)return;e.preventDefault();t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});if(window.history&&window.history.replaceState)window.history.replaceState(null,'',h);var f=t.querySelector('input:not([type=hidden]),select,textarea');if(f)window.setTimeout(function(){f.focus({preventScroll:true})},reduce?0:520)})})()</script>
</aside>`;
}

export function getUnifiedNav(activePage = 'none', { promoBanner = true, promoCtaHref = '/book#booking-form' } = {}) {
  const isServices = activePage === 'services';
  const isServiceAreas = activePage === 'service-areas';
  const isRates = activePage === 'rates';
  const isGuarantee = activePage === 'guarantee';
  const isReviews = activePage === 'reviews';
  const isCareers = activePage === 'careers';
  const isContact = activePage === 'contact';

  const ariaCurrent = (active) => active ? ' aria-current="page"' : '';

  const linkCls = (active) => active
    ? 'nav-link py-1 text-red-500 font-bold border-b-2 border-red-500 transition'
    : 'nav-link py-1 text-slate-300 hover:text-white border-b-2 border-transparent transition';

  const mobileLinkCls = (active) => active
    ? 'block text-red-400 font-bold py-2.5 px-3.5 bg-red-950/60 border border-red-500/30 rounded-xl transition'
    : 'block text-slate-200 font-medium py-2.5 px-3.5 hover:bg-slate-800/80 hover:text-white rounded-xl transition';

  const promoBannerHtml = promoBanner ? `\n${getNewCustomerBanner({ ctaHref: promoCtaHref })}\n` : '';

  return `<a href="#main-content" class="skip-link sr-only focus:not-sr-only">Skip to main content</a>
${promoBannerHtml}
<header id="site-header" class="site-header sticky top-0 z-[100] bg-[#0B0F19]/95 backdrop-blur-md shadow-2xl border-b-[3px] border-red-600 border-t border-white/10">
    <div class="header-container site-nav__bar max-w-7xl mx-auto flex items-center justify-between">
        <a href="/" class="brand site-nav__brand group flex items-center gap-3 min-w-0">
            <img src="/.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80" srcset="/.netlify/images?url=/icon.jpg&amp;w=48&amp;fm=avif&amp;q=80 1x, /.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80 2x" width="48" height="48" decoding="async" fetchpriority="high" alt="" class="h-9 w-9 sm:h-11 sm:w-11 rounded-full object-cover flex-shrink-0 border-2 border-red-600 shadow-sm transition group-hover:scale-105">
            <div class="brand-text min-w-0">
                <p class="brand-title text-base min-[390px]:text-lg sm:text-xl lg:text-xl xl:text-2xl font-bold tracking-tight text-white leading-tight truncate">AAA Handyman Services <span class="text-red-500">LLC</span></p>
                <p class="brand-tagline text-[10px] sm:text-xs text-slate-400 font-medium">Oakland County, Michigan</p>
            </div>
            <span class="sr-only">home</span>
        </a>

        <!-- Desktop Navigation Container -->
        <div class="site-nav__desktop hidden lg:flex items-center">
            <ul class="nav-links site-nav__links flex items-center gap-5 list-none m-0 p-0 text-sm xl:text-base font-medium">
                <li><a href="/services" class="${linkCls(isServices)}"${ariaCurrent(isServices)}>Services</a></li>
                <li><a href="/service-areas" class="${linkCls(isServiceAreas)}"${ariaCurrent(isServiceAreas)}>Service Areas</a></li>
                <li><a href="/rates" class="${linkCls(isRates)}"${ariaCurrent(isRates)}>Rates</a></li>
                <li><a href="/guarantee" class="${linkCls(isGuarantee)}"${ariaCurrent(isGuarantee)}>Guarantee</a></li>
                <li><a href="/careers" class="${linkCls(isCareers)}"${ariaCurrent(isCareers)}>Careers</a></li>
                <li><a href="/contact" class="${linkCls(isContact)}"${ariaCurrent(isContact)}>Contact</a></li>
            </ul>

            <!-- Social Media Icons -->
            <div class="social-icons site-nav__social flex items-center gap-3 pl-4 border-l border-slate-800 ml-3">
                <a href="https://www.facebook.com/AAAHandymanServicesLLC" target="_blank" rel="noopener noreferrer" aria-label="Follow AAA Handyman Services LLC on Facebook" class="text-[#1877F2] hover:opacity-80 text-xl transition p-1"><i class="fab fa-facebook" aria-hidden="true"></i></a>
                <a href="https://maps.app.goo.gl/uqK9xsJj4UX5tW4W7" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Google" class="text-[#4285F4] hover:opacity-80 text-xl transition p-1"><svg width="1em" height="1em" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 42.41 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 4.59 4.34 11.12l7.35 5.7C13.42 13.62 18.27 9.75 24 9.75z"/></svg></a>
                <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Yelp" class="text-[#FF1A1A] hover:opacity-80 text-lg transition p-1"><i class="fa-brands fa-yelp" aria-hidden="true"></i></a>
                <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Nextdoor" class="text-[#00B24F] hover:opacity-80 text-lg transition p-1"><i class="fa-solid fa-house-chimney" aria-hidden="true"></i></a>
            </div>
        </div>

        <!-- Mobile Hamburger Button -->
        <button id="mobile-menu-btn" class="flex lg:hidden hamburger-menu site-nav__toggle items-center justify-center text-slate-200 hover:text-white focus:outline-none p-2 rounded-xl transition border border-slate-700/80 hover:border-slate-500 bg-slate-800/80" aria-label="Menu" aria-expanded="false" aria-controls="mobile-menu">
            <i class="fas fa-bars text-2xl" id="menu-icon" aria-hidden="true"></i>
        </button>
    </div>

    <!-- Mobile Navigation Drawer / Menu -->
    <div id="mobile-menu" class="hidden bg-[#0F172A]/98 backdrop-blur-lg border-t border-slate-800 px-4 py-4 space-y-3 shadow-2xl" hidden aria-hidden="true">
        <div class="space-y-1">
            <a href="/services" class="${mobileLinkCls(isServices)}"${ariaCurrent(isServices)}>Services</a>
            <a href="/service-areas" class="${mobileLinkCls(isServiceAreas)}"${ariaCurrent(isServiceAreas)}>Service Areas</a>
            <a href="/rates" class="${mobileLinkCls(isRates)}"${ariaCurrent(isRates)}>Rates</a>
            <a href="/guarantee" class="${mobileLinkCls(isGuarantee)}"${ariaCurrent(isGuarantee)}>Guarantee</a>
            <a href="/reviews" class="${mobileLinkCls(isReviews)}"${ariaCurrent(isReviews)}>Reviews</a>
            <a href="/careers" class="${mobileLinkCls(isCareers)}"${ariaCurrent(isCareers)}>Careers</a>
            <a href="/contact" class="${mobileLinkCls(isContact)}"${ariaCurrent(isContact)}>Contact</a>
        </div>

        <div class="pt-3 border-t border-slate-800 flex flex-col gap-3">
            <a href="tel:+12483853432" class="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition text-center">
                <i class="fas fa-phone" aria-hidden="true"></i> Call (248) 385-3432
            </a>
            <div class="flex items-center justify-center gap-6 text-2xl pt-1">
                <a href="https://www.facebook.com/AAAHandymanServicesLLC" target="_blank" rel="noopener noreferrer" aria-label="Follow AAA Handyman Services LLC on Facebook" class="text-[#1877F2] hover:opacity-80 transition"><i class="fab fa-facebook" aria-hidden="true"></i></a>
                <a href="https://maps.app.goo.gl/uqK9xsJj4UX5tW4W7" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Google" class="text-[#4285F4] hover:opacity-80 transition"><svg width="1em" height="1em" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 42.41 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 4.59 4.34 11.12l7.35 5.7C13.42 13.62 18.27 9.75 24 9.75z"/></svg></a>
                <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Yelp" class="text-[#FF1A1A] hover:opacity-80 transition"><i class="fa-brands fa-yelp" aria-hidden="true"></i></a>
                <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services LLC on Nextdoor" class="text-[#00B24F] hover:opacity-80 transition"><i class="fa-solid fa-house-chimney" aria-hidden="true"></i></a>
            </div>
        </div>
    </div>
</header>`;
}
