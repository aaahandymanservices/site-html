export function getUnifiedNav(activePage = 'none') {
  const isServices = activePage === 'services';
  const isServiceAreas = activePage === 'service-areas';
  const isRates = activePage === 'rates';
  const isGuarantee = activePage === 'guarantee';
  const isReviews = activePage === 'reviews';
  const isCareers = activePage === 'careers';
  const isContact = activePage === 'contact';

  // `whitespace-nowrap` and `shrink-0` are load-bearing, not decoration: without
  // them a multi-word label ("Service Areas") wraps onto a second line as soon
  // as the row runs short of space, which grows the bar and shoves the links
  // into the logo. Links keep their intrinsic width; the brand truncates instead.
  const linkCls = (active) => active
    ? 'nav-link shrink-0 whitespace-nowrap py-1 text-red-600 font-bold border-b-2 border-red-600 transition'
    : 'nav-link shrink-0 whitespace-nowrap py-1 text-gray-700 hover:text-red-600 border-b-2 border-transparent transition';

  const mobileLinkCls = (active) => active
    ? 'block text-red-600 font-bold py-2.5 px-3 bg-red-50 rounded-xl transition'
    : 'block text-gray-800 font-medium py-2.5 px-3 hover:bg-gray-50 hover:text-red-600 rounded-xl transition';

  return `<a href="#main-content" class="skip-link">Skip to main content</a>

<nav id="site-nav" aria-label="Primary" class="bg-white shadow-md sticky top-0 z-50 border-b-[3px] border-red-600">
    <div class="max-w-7xl mx-auto px-4 py-2 sm:px-6 sm:py-3 flex flex-nowrap items-center justify-between gap-x-3 sm:gap-x-4">
        <a href="/" class="flex min-w-0 shrink items-center gap-2.5 sm:gap-3 group" aria-label="AAA Handyman Services home">
            <img src="/.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80" srcset="/.netlify/images?url=/icon.jpg&amp;w=48&amp;fm=avif&amp;q=80 1x, /.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80 2x" width="48" height="48" decoding="async" fetchpriority="high" alt="AAA Handyman Services Logo" class="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0 border-2 border-red-600 transition group-hover:scale-105">
            <div class="min-w-0">
                <!-- The name steps back down at the lg breakpoint, where the full
                     link row first appears alongside it, and returns to full size
                     at xl once there is room for both. -->
                <p class="text-base min-[390px]:text-lg sm:text-2xl md:text-3xl lg:text-xl xl:text-3xl font-bold tracking-tight text-red-600 leading-tight truncate">AAA Handyman Services</p>
                <p class="text-[10px] sm:text-xs text-gray-500 font-medium truncate">Oakland County, Michigan</p>
            </div>
        </a>

        <!-- Desktop Navigation: shrink-0 keeps the link row at its intrinsic
             width, so a short row can never be squeezed into wrapping. Type and
             gaps tighten at lg, where the row first has to share a 1024px bar
             with the logo, and step back up on wider screens. -->
        <div class="hidden shrink-0 lg:flex lg:flex-nowrap items-center gap-x-4 xl:gap-x-5 2xl:gap-x-6 text-[15px] xl:text-base 2xl:text-lg font-medium">
            <a href="/services" class="${linkCls(isServices)}">Services</a>
            <a href="/service-areas" class="${linkCls(isServiceAreas)}">Service Areas</a>
            <a href="/rates" class="${linkCls(isRates)}">Rates</a>
            <a href="/guarantee" class="${linkCls(isGuarantee)}">Guarantee</a>
            <a href="/reviews" class="${linkCls(isReviews)}">Reviews</a>
            <a href="/careers" class="${linkCls(isCareers)}">Careers</a>
            <a href="/contact" class="${linkCls(isContact)}">Contact</a>

            <!-- Social Media Icons -->
            <div class="flex shrink-0 items-center gap-x-2.5 xl:gap-x-3 pl-2 border-l border-gray-200">
                <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" aria-label="Follow AAA Handyman Services on Facebook" class="text-[#1877F2] hover:opacity-80 text-xl transition p-1"><i class="fab fa-facebook" aria-hidden="true"></i></a>
                <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Yelp" class="text-[#FF1A1A] hover:opacity-80 text-lg transition p-1"><i class="fa-brands fa-yelp" aria-hidden="true"></i></a>
                <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Nextdoor" class="text-[#00B24F] hover:opacity-80 text-lg transition p-1"><i class="fa-solid fa-house-chimney" aria-hidden="true"></i></a>
            </div>
        </div>

        <!-- Mobile Hamburger Button -->
        <div class="flex shrink-0 items-center lg:hidden">
            <button id="mobile-menu-btn" class="text-gray-700 hover:text-red-600 focus:outline-none p-2 rounded-lg transition border border-gray-200 hover:border-gray-300" aria-label="Toggle Navigation Menu" aria-expanded="false" aria-controls="mobile-menu">
                <i class="fas fa-bars text-2xl" id="menu-icon" aria-hidden="true"></i>
            </button>
        </div>
    </div>

    <!-- Mobile Navigation Drawer / Menu. The height cap keeps the drawer inside
         the space below the bar; site-theme.css upgrades it to dynamic viewport
         units where they are supported, for mobile toolbars that come and go. -->
    <div id="mobile-menu" class="hidden lg:hidden bg-white border-t border-gray-200 px-4 py-4 space-y-3 shadow-2xl max-h-[calc(100vh-4.5rem)] sm:max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain">
        <div class="space-y-1">
            <a href="/services" class="${mobileLinkCls(isServices)}">Services</a>
            <a href="/service-areas" class="${mobileLinkCls(isServiceAreas)}">Service Areas</a>
            <a href="/rates" class="${mobileLinkCls(isRates)}">Rates</a>
            <a href="/guarantee" class="${mobileLinkCls(isGuarantee)}">Guarantee</a>
            <a href="/reviews" class="${mobileLinkCls(isReviews)}">Reviews</a>
            <a href="/careers" class="${mobileLinkCls(isCareers)}">Careers</a>
            <a href="/contact" class="${mobileLinkCls(isContact)}">Contact</a>
        </div>

        <div class="pt-3 border-t border-gray-100 flex items-center justify-center space-x-6 text-2xl">
            <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" aria-label="Facebook Page" class="text-[#1877F2] hover:opacity-80 transition"><i class="fab fa-facebook" aria-hidden="true"></i></a>
            <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Yelp Page" class="text-[#FF1A1A] hover:opacity-80 transition"><i class="fa-brands fa-yelp" aria-hidden="true"></i></a>
            <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Nextdoor Page" class="text-[#00B24F] hover:opacity-80 transition"><i class="fa-solid fa-house-chimney" aria-hidden="true"></i></a>
        </div>
    </div>
</nav>`;
}
