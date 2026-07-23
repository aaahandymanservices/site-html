export function getUnifiedNav(activePage = 'none') {
  const isServices = activePage === 'services';
  const isServiceAreas = activePage === 'service-areas';
  const isRates = activePage === 'rates';
  const isGuarantee = activePage === 'guarantee';
  const isReviews = activePage === 'reviews';
  const isCareers = activePage === 'careers';
  const isContact = activePage === 'contact';

  const linkCls = (active) => active
    ? 'nav-link py-2 text-red-600 font-bold border-b-2 border-red-600 transition'
    : 'nav-link py-2 text-gray-700 hover:text-red-600 border-b-2 border-transparent transition';

  return `<header class="sticky top-0 z-50 bg-white shadow-md border-b-[3px] border-red-600">
    <nav class="max-w-7xl mx-auto px-4 py-2 sm:px-6 sm:py-2.5 flex justify-between items-center" aria-label="Main Navigation">
        <a href="/" class="flex min-w-0 items-center space-x-2.5 sm:space-x-3 group" aria-label="AAA Handyman Services home">
            <img src="/.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80" srcset="/.netlify/images?url=/icon.jpg&amp;w=48&amp;fm=avif&amp;q=80 1x, /.netlify/images?url=/icon.jpg&amp;w=96&amp;fm=avif&amp;q=80 2x" width="48" height="48" alt="AAA Handyman Services Logo" class="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0 border-2 border-red-600 transition group-hover:scale-105">
            <div class="min-w-0">
                <p class="text-base min-[390px]:text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-red-600 leading-tight truncate">AAA Handyman Services</p>
                <p class="text-[10px] sm:text-xs text-gray-500 font-medium">Oakland County, Michigan</p>
            </div>
        </a>

        <!-- Desktop Navigation -->
        <div class="hidden lg:flex items-center space-x-5 xl:space-x-7 text-base font-semibold text-gray-700">
            <!-- Services Megamenu Dropdown -->
            <div class="relative group nav-dropdown">
                <a href="/services" class="${linkCls(isServices)} flex items-center gap-1.5 focus:outline-none" aria-haspopup="true" aria-expanded="false">
                    <span>Services</span>
                    <i class="fas fa-chevron-down text-xs text-gray-400 group-hover:text-red-600 transition-transform group-hover:rotate-180"></i>
                </a>
                <div class="nav-dropdown-menu absolute left-1/2 -translate-x-1/2 top-full pt-2 w-[840px] max-w-[90vw] hidden group-hover:block group-focus-within:block z-50">
                    <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 ring-1 ring-black/5">
                        <div class="grid grid-cols-4 gap-6 text-left">
                            <!-- Category 1: Structural & Carpentry -->
                            <div>
                                <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 pb-2 border-b border-gray-100 mb-3">
                                    <i class="fas fa-hammer text-sm"></i>
                                    <span>Structural &amp; Carpentry</span>
                                </div>
                                <ul class="space-y-2 text-sm">
                                    <li><a href="/services/carpentry" class="block text-gray-700 hover:text-red-600 transition font-medium">Carpentry &amp; Trim</a></li>
                                    <li><a href="/services/doors-windows" class="block text-gray-700 hover:text-red-600 transition font-medium">Doors &amp; Windows</a></li>
                                    <li><a href="/services/drywall-repair" class="block text-gray-700 hover:text-red-600 transition font-medium">Drywall Repair</a></li>
                                    <li><a href="/services/painting-staining" class="block text-gray-700 hover:text-red-600 transition font-medium">Painting &amp; Staining</a></li>
                                    <li><a href="/services/flooring-solutions" class="block text-gray-700 hover:text-red-600 transition font-medium">Flooring Solutions</a></li>
                                    <li><a href="/services/aging-in-place-guide" class="block text-gray-700 hover:text-red-600 transition font-medium text-xs text-blue-800">Aging-in-Place Guide</a></li>
                                </ul>
                            </div>
                            <!-- Category 2: Plumbing & Electrical -->
                            <div>
                                <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 pb-2 border-b border-gray-100 mb-3">
                                    <i class="fas fa-faucet-drip text-sm"></i>
                                    <span>Plumbing &amp; Electrical</span>
                                </div>
                                <ul class="space-y-2 text-sm">
                                    <li><a href="/services/minor-plumbing" class="block text-gray-700 hover:text-red-600 transition font-medium">Minor Plumbing</a></li>
                                    <li><a href="/services/tub-shower-recaulk" class="block text-gray-700 hover:text-red-600 transition font-medium">Tub &amp; Shower Re-Caulk</a></li>
                                    <li><a href="/services/minor-electrical" class="block text-gray-700 hover:text-red-600 transition font-medium">Minor Electrical</a></li>
                                    <li><a href="/services/energy-efficiency" class="block text-gray-700 hover:text-red-600 transition font-medium">Energy Tune-Up</a></li>
                                    <li><a href="/services/home-security" class="block text-gray-700 hover:text-red-600 transition font-medium">Security &amp; Smart Home</a></li>
                                </ul>
                            </div>
                            <!-- Category 3: Assembly & Mounting -->
                            <div>
                                <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 pb-2 border-b border-gray-100 mb-3">
                                    <i class="fas fa-screwdriver-wrench text-sm"></i>
                                    <span>Assembly &amp; Mounting</span>
                                </div>
                                <ul class="space-y-2 text-sm">
                                    <li><a href="/services/installation" class="block text-gray-700 hover:text-red-600 transition font-medium">Installation &amp; Mounting</a></li>
                                    <li><a href="/services/furniture-assembly" class="block text-gray-700 hover:text-red-600 transition font-medium">Furniture Assembly</a></li>
                                    <li><a href="/services/garage-storage" class="block text-gray-700 hover:text-red-600 transition font-medium">Garage &amp; Storage</a></li>
                                    <li><a href="/services/senior-care" class="block text-gray-700 hover:text-red-600 transition font-medium">Senior Care &amp; Safety</a></li>
                                    <li><a href="/services/commercial" class="block text-gray-700 hover:text-red-600 transition font-medium">Commercial Services</a></li>
                                </ul>
                            </div>
                            <!-- Category 4: Exterior & Maintenance -->
                            <div>
                                <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 pb-2 border-b border-gray-100 mb-3">
                                    <i class="fas fa-house-chimney text-sm"></i>
                                    <span>Exterior &amp; Maintenance</span>
                                </div>
                                <ul class="space-y-2 text-sm">
                                    <li><a href="/services/decks-fences" class="block text-gray-700 hover:text-red-600 transition font-medium">Decks &amp; Fences</a></li>
                                    <li><a href="/services/gutters" class="block text-gray-700 hover:text-red-600 transition font-medium">Gutters</a></li>
                                    <li><a href="/services/power-washing" class="block text-gray-700 hover:text-red-600 transition font-medium">Power Washing</a></li>
                                    <li><a href="/services/dryer-vent" class="block text-gray-700 hover:text-red-600 transition font-medium">Dryer Vent Cleaning</a></li>
                                    <li><a href="/services/home-repair-upkeep" class="block text-gray-700 hover:text-red-600 transition font-medium">Home Repair &amp; Upkeep</a></li>
                                    <li><a href="/services/preventative-maintenance" class="block text-gray-700 hover:text-red-600 transition font-medium">Preventative Care</a></li>
                                    <li><a href="/services/maintenance-cleaning" class="block text-gray-700 hover:text-red-600 transition font-medium">Seasonal Care</a></li>
                                    <li><a href="/services/projects-for-pets" class="block text-gray-700 hover:text-red-600 transition font-medium">Projects for Pets</a></li>
                                </ul>
                            </div>
                        </div>
                        <div class="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-2xl">
                            <span class="text-gray-500 font-medium"><i class="fas fa-shield-halved text-red-600 mr-1"></i> All work backed by our 1-Year Workmanship Guarantee</span>
                            <a href="/services" class="font-bold text-red-600 hover:text-red-700 flex items-center gap-1 transition">
                                <span>View All Services Catalog</span>
                                <i class="fas fa-arrow-right text-[10px]"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <a href="/service-areas" class="${linkCls(isServiceAreas)}">Service Areas</a>

            <!-- Rates & Pricing (with sub-nav dropdown) -->
            <div class="relative group nav-dropdown">
                <a href="/rates" class="${linkCls(isRates)} flex items-center gap-1.5 focus:outline-none" aria-haspopup="true" aria-expanded="false">
                    <span>Rates</span>
                    <i class="fas fa-chevron-down text-xs text-gray-400 group-hover:text-red-600 transition-transform group-hover:rotate-180"></i>
                </a>
                <div class="nav-dropdown-menu absolute left-0 top-full pt-2 w-64 hidden group-hover:block group-focus-within:block z-50">
                    <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 ring-1 ring-black/5 space-y-1">
                        <a href="/rates#rates" class="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition"><i class="fas fa-tags text-red-600 text-xs w-4"></i> Overview &amp; Rates</a>
                        <a href="/rates#flat-rate" class="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition"><i class="fas fa-list-check text-red-600 text-xs w-4"></i> Flat-Rate Menu</a>
                        <a href="/rates#estimate" class="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition"><i class="fas fa-calculator text-red-600 text-xs w-4"></i> Instant Quote Calculator</a>
                        <a href="/rates#audits" class="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition"><i class="fas fa-clipboard-check text-red-600 text-xs w-4"></i> Specialized Audits</a>
                        <a href="/rates#menus" class="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition"><i class="fas fa-layer-group text-red-600 text-xs w-4"></i> Safety &amp; Energy Menus</a>
                        <a href="/rates#packages" class="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition"><i class="fas fa-calendar-day text-red-600 text-xs w-4"></i> Time Packages</a>
                        <a href="/rates#add-ons" class="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition"><i class="fas fa-bolt text-red-600 text-xs w-4"></i> Add-Ons &amp; Materials</a>
                    </div>
                </div>
            </div>

            <a href="/guarantee" class="${linkCls(isGuarantee)}">Guarantee</a>
            <a href="/reviews" class="${linkCls(isReviews)}">Reviews</a>
            <a href="/careers" class="${linkCls(isCareers)}">Careers</a>
            <a href="/contact" class="${linkCls(isContact)}">Contact</a>

            <!-- Social Media Icons -->
            <div class="flex items-center space-x-3 pl-2 border-l border-gray-200">
                <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" aria-label="Follow AAA Handyman Services on Facebook" class="text-[#1877F2] hover:opacity-80 text-xl transition p-1"><i class="fab fa-facebook"></i></a>
                <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Yelp" class="text-[#FF1A1A] hover:opacity-80 text-lg transition p-1"><i class="fa-brands fa-yelp"></i></a>
                <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Find AAA Handyman Services on Nextdoor" class="text-[#00B24F] hover:opacity-80 text-lg transition p-1"><i class="fa-solid fa-house-chimney"></i></a>
            </div>
        </div>

        <!-- Mobile Hamburger Button -->
        <div class="flex items-center lg:hidden space-x-2">
            <button id="mobile-menu-btn" class="text-gray-700 hover:text-red-600 focus:outline-none p-2 rounded-lg transition border border-gray-200 hover:border-gray-300" aria-label="Toggle Navigation Menu">
                <i class="fas fa-bars text-2xl" id="menu-icon"></i>
            </button>
        </div>
    </nav>

    <!-- Mobile Navigation Drawer / Menu -->
    <div id="mobile-menu" class="hidden lg:hidden bg-white border-t border-gray-100 max-h-[calc(100vh-65px)] overflow-y-auto shadow-2xl">
        <div class="px-4 py-4 space-y-4">
            <div class="border-b border-gray-100 pb-3">
                <button type="button" id="mobile-services-toggle" class="w-full flex items-center justify-between py-2 text-gray-800 font-bold text-base text-left focus:outline-none">
                    <span class="flex items-center gap-2"><i class="fas fa-screwdriver-wrench text-red-600 text-sm"></i> Services</span>
                    <i class="fas fa-chevron-down text-xs text-gray-400 transition-transform" id="mobile-services-arrow"></i>
                </button>
                <div id="mobile-services-menu" class="hidden pl-2 pt-2 space-y-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">Structural &amp; Carpentry</p>
                        <div class="grid grid-cols-2 gap-1.5 text-xs text-gray-700">
                            <a href="/services/carpentry" class="py-1 hover:text-red-600">Carpentry &amp; Trim</a>
                            <a href="/services/doors-windows" class="py-1 hover:text-red-600">Doors &amp; Windows</a>
                            <a href="/services/drywall-repair" class="py-1 hover:text-red-600">Drywall Repair</a>
                            <a href="/services/painting-staining" class="py-1 hover:text-red-600">Painting &amp; Staining</a>
                            <a href="/services/flooring-solutions" class="py-1 hover:text-red-600">Flooring Solutions</a>
                            <a href="/services/aging-in-place-guide" class="py-1 hover:text-red-600">Aging-in-Place Guide</a>
                        </div>
                    </div>
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">Plumbing &amp; Electrical</p>
                        <div class="grid grid-cols-2 gap-1.5 text-xs text-gray-700">
                            <a href="/services/minor-plumbing" class="py-1 hover:text-red-600">Minor Plumbing</a>
                            <a href="/services/tub-shower-recaulk" class="py-1 hover:text-red-600">Tub &amp; Shower Caulk</a>
                            <a href="/services/minor-electrical" class="py-1 hover:text-red-600">Minor Electrical</a>
                            <a href="/services/energy-efficiency" class="py-1 hover:text-red-600">Energy Tune-Up</a>
                            <a href="/services/home-security" class="py-1 hover:text-red-600">Security &amp; Smart Home</a>
                        </div>
                    </div>
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">Assembly &amp; Mounting</p>
                        <div class="grid grid-cols-2 gap-1.5 text-xs text-gray-700">
                            <a href="/services/installation" class="py-1 hover:text-red-600">Installation &amp; Mounting</a>
                            <a href="/services/furniture-assembly" class="py-1 hover:text-red-600">Furniture Assembly</a>
                            <a href="/services/garage-storage" class="py-1 hover:text-red-600">Garage &amp; Storage</a>
                            <a href="/services/senior-care" class="py-1 hover:text-red-600">Senior Care &amp; Safety</a>
                            <a href="/services/commercial" class="py-1 hover:text-red-600">Commercial Services</a>
                        </div>
                    </div>
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">Exterior &amp; Maintenance</p>
                        <div class="grid grid-cols-2 gap-1.5 text-xs text-gray-700">
                            <a href="/services/decks-fences" class="py-1 hover:text-red-600">Decks &amp; Fences</a>
                            <a href="/services/gutters" class="py-1 hover:text-red-600">Gutters</a>
                            <a href="/services/power-washing" class="py-1 hover:text-red-600">Power Washing</a>
                            <a href="/services/dryer-vent" class="py-1 hover:text-red-600">Dryer Vent Cleaning</a>
                            <a href="/services/home-repair-upkeep" class="py-1 hover:text-red-600">Home Repair &amp; Upkeep</a>
                            <a href="/services/preventative-maintenance" class="py-1 hover:text-red-600">Preventative Care</a>
                            <a href="/services/maintenance-cleaning" class="py-1 hover:text-red-600">Seasonal Care</a>
                            <a href="/services/projects-for-pets" class="py-1 hover:text-red-600">Projects for Pets</a>
                        </div>
                    </div>
                    <a href="/services" class="block text-center text-xs font-bold text-red-600 bg-red-50 py-2 rounded-lg">View All Services →</a>
                </div>
            </div>

            <div class="border-b border-gray-100 pb-3">
                <button type="button" id="mobile-rates-toggle" class="w-full flex items-center justify-between py-2 text-gray-800 font-bold text-base text-left focus:outline-none">
                    <span class="flex items-center gap-2"><i class="fas fa-tags text-red-600 text-sm"></i> Rates &amp; Packages</span>
                    <i class="fas fa-chevron-down text-xs text-gray-400 transition-transform" id="mobile-rates-arrow"></i>
                </button>
                <div id="mobile-rates-menu" class="hidden pl-2 pt-2 space-y-1.5 text-xs font-medium text-gray-700">
                    <a href="/rates#rates" class="block py-1 hover:text-red-600">Overview &amp; Rates</a>
                    <a href="/rates#flat-rate" class="block py-1 hover:text-red-600">Flat-Rate Menu</a>
                    <a href="/rates#estimate" class="block py-1 hover:text-red-600">Instant Quote Calculator</a>
                    <a href="/rates#audits" class="block py-1 hover:text-red-600">Specialized Audits</a>
                    <a href="/rates#menus" class="block py-1 hover:text-red-600">Safety &amp; Energy Menus</a>
                    <a href="/rates#packages" class="block py-1 hover:text-red-600">Time Packages</a>
                    <a href="/rates#add-ons" class="block py-1 hover:text-red-600">Add-Ons &amp; Materials</a>
                </div>
            </div>

            <a href="/service-areas" class="block text-gray-800 font-bold py-2 border-b border-gray-100 hover:text-red-600 transition">Service Areas</a>
            <a href="/guarantee" class="block text-gray-800 font-bold py-2 border-b border-gray-100 hover:text-red-600 transition">Guarantee</a>
            <a href="/reviews" class="block text-gray-800 font-bold py-2 border-b border-gray-100 hover:text-red-600 transition">Reviews</a>
            <a href="/careers" class="block text-gray-800 font-bold py-2 border-b border-gray-100 hover:text-red-600 transition">Careers</a>
            <a href="/contact" class="block text-gray-800 font-bold py-2 border-b border-gray-100 hover:text-red-600 transition">Contact</a>

            <div class="pt-2 space-y-2">
                <a href="/book" class="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition shadow-md text-base">
                    <i class="fas fa-calendar-check"></i> Book Online — Free Quote
                </a>
                <a href="tel:+12483853432" class="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition shadow-md text-base">
                    <i class="fas fa-phone"></i> Call Now! (248) 385-3432
                </a>
                <button type="button" onclick="window.__aaaOpenChat &amp;&amp; (window.__aaaOpenChat(), document.getElementById('mobile-menu').classList.add('hidden'))" class="w-full flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white font-bold py-3 rounded-xl transition shadow-md text-base">
                    <i class="fas fa-comments"></i> AI Chat Assistant
                </button>
            </div>

            <div class="pt-3 border-t border-gray-100 flex items-center justify-center space-x-6 text-2xl">
                <a href="https://www.facebook.com/AAAHandymanServices" target="_blank" rel="noopener" aria-label="Facebook Page" class="text-[#1877F2] hover:opacity-80 transition"><i class="fab fa-facebook"></i></a>
                <a href="https://www.yelp.com/biz/aaa-handyman-services-waterford-township" target="_blank" rel="noopener noreferrer" aria-label="Yelp Page" class="text-[#FF1A1A] hover:opacity-80 transition"><i class="fa-brands fa-yelp"></i></a>
                <a href="https://nextdoor.com/page/aaa-handyman-services-waterford-township-mi?utm_campaign=1784179755732&share_action_id=49fd140e-0f23-4ef9-a33d-ffef9c6b6960" target="_blank" rel="noopener noreferrer" aria-label="Nextdoor Page" class="text-[#00B24F] hover:opacity-80 transition"><i class="fa-solid fa-house-chimney"></i></a>
            </div>
        </div>
    </div>
</header>`;
}
