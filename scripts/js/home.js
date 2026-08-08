/*
 * Behaviour for the home page, in the order the sections appear.
 *
 * These six blocks used to sit inline in public/index.html, spread through the
 * body between the sections they drive. An inline <script> is parser-blocking
 * wherever it sits, so each one stopped the HTML parse to compile and run --
 * including the 8kB `servicesData` literal below -- before the browser could
 * carry on building the page. None of them need to run that early: every one
 * only looks up elements and attaches listeners, and the handlers that pages
 * reach through `onclick` attributes are all published on `window`, so
 * nothing can call them before this file has run.
 *
 * Loaded with `defer` now, so it is fetched in parallel with the parse and
 * runs once the DOM is complete. It is also minified and cached for a year,
 * which the inline copies never were.
 */

/* ---- Pricing hub: tab switching ---- */
(function () {
  (function() {
      var buttons = document.querySelectorAll('.pricing-tab-btn');
      var panels = {
          'tab-btn-time': document.getElementById('time-packages'),
          'tab-btn-themed': document.getElementById('themed-packages'),
          'tab-btn-flat': document.getElementById('flat-rates')
      };

      window.aaaActivateTab = function(btnId) {
          buttons.forEach(function(btn) {
              var isTarget = btn.id === btnId;
              btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
              btn.tabIndex = isTarget ? 0 : -1;
              if (isTarget) {
                  btn.className = 'pricing-tab-btn px-5 py-3 rounded-xl font-bold text-sm sm:text-base transition bg-red-600 text-white shadow-md flex items-center gap-2';
              } else {
                  btn.className = 'pricing-tab-btn px-5 py-3 rounded-xl font-bold text-sm sm:text-base transition bg-transparent text-gray-700 hover:text-gray-900 hover:bg-gray-200/60 flex items-center gap-2';
              }
          });
          Object.keys(panels).forEach(function(id) {
              if (panels[id]) {
                  if (id === btnId) {
                      panels[id].classList.remove('hidden');
                      panels[id].hidden = false;
                  } else {
                      panels[id].classList.add('hidden');
                      panels[id].hidden = true;
                  }
              }
          });
      };

      buttons.forEach(function(btn) {
          btn.addEventListener('click', function() {
              window.aaaActivateTab(btn.id);
          });
          btn.addEventListener('keydown', function(event) {
              var current = Array.prototype.indexOf.call(buttons, btn);
              var next = current;
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % buttons.length;
              else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = buttons.length - 1;
              else return;
              event.preventDefault();
              window.aaaActivateTab(buttons[next].id);
              buttons[next].focus();
          });
      });

      // Activate tab based on URL anchor if present
      function checkHash() {
          var hash = window.location.hash;
          if (hash === '#themed-packages') {
              window.aaaActivateTab('tab-btn-themed');
          } else if (hash === '#flat-rates') {
              window.aaaActivateTab('tab-btn-flat');
          } else if (hash === '#time-packages' || hash === '#pricing-hub') {
              window.aaaActivateTab('tab-btn-time');
          }
      }
      window.addEventListener('hashchange', checkHash);
      checkHash();
      var selected = document.querySelector('.pricing-tab-btn[aria-selected="true"]');
      window.aaaActivateTab(selected ? selected.id : 'tab-btn-time');
  })();
})();

/* ---- Quote request form ---- */
(function () {
  (function () {
      var form = document.getElementById('quote-form');
      if (!form) return;

      var params = new URLSearchParams(window.location.search);
      var offer = params.get('offer');
      var offerCheckbox = document.getElementById('quote-first-service-certificate');
      if (offer === 'first-service' && offerCheckbox) {
          offerCheckbox.checked = true;
      }

      var photoInput = document.getElementById('q-photos');
      if (photoInput) {
          photoInput.addEventListener('change', function () {
              var label = form.querySelector('.quote-photo-label');
              var n = photoInput.files.length;
              if (label) label.textContent = n ? (n + ' photo' + (n > 1 ? 's' : '') + ' attached ✓') : 'Add Photos (Optional)';
          });
      }

      form.addEventListener('submit', function (e) {
          e.preventDefault();
          var btn = form.querySelector('button[type="submit"]');
          if (btn) { btn.disabled = true; btn.innerHTML = 'Sending…'; }

          var certificateBox = document.getElementById('quote-first-service-certificate');
          var claimedCertificate = Boolean(certificateBox && certificateBox.checked && !certificateBox.disabled);
          var emailField = form.querySelector('input[name="email"]');
          var nameField = form.querySelector('input[name="name"]');
          var email = emailField ? emailField.value : '';

          // File uploads: let the browser set the multipart Content-Type boundary.
          fetch('/', { method: 'POST', body: new FormData(form) })
              .then(function (res) {
                  if (!res.ok) throw new Error('Bad response');
                  // One certificate per customer. Email is optional on this
                  // form, and without one there is no identity to record the
                  // claim against, so it stays available in that case.
                  if (claimedCertificate && email && window.AAAGiftCertificate) {
                      window.AAAGiftCertificate.markRedeemed(email, {
                          name: nameField ? nameField.value : '',
                          source: 'quote_form'
                      });
                  }
                  form.classList.add('hidden');
                  var success = document.getElementById('quote-success');
                  if (success) success.classList.remove('hidden');
              })
              .catch(function () {
                  if (btn) { btn.disabled = false; btn.innerHTML = 'Get My Free Quote <i class="fas fa-arrow-right" aria-hidden="true"></i>'; }
                  alert('Sorry — there was a problem sending your request. Please call (248) 385-3432 or email contact@aaahandyman.services.');
              });
      });
  })();
})();

/* ---- Mobile drawer close + smooth in-page anchors ---- */
(function () {

  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
          const targetId = this.getAttribute('href');
          if (targetId === '#') return;

          const targetElement = document.getElementById(targetId.substring(1));
          if (targetElement) {
              e.preventDefault();
              if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                  mobileMenu.classList.add('hidden');
                  if (menuIcon) menuIcon.className = 'fas fa-bars';
              }
              const nav = document.querySelector('nav');
              const offset = nav ? nav.offsetHeight : 80;
              const elementPosition = targetElement.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - offset;

              window.scrollTo({
                  top: offsetPosition,
                  behavior: 'smooth'
              });
              setTimeout(() => {
                  history.pushState(null, null, targetId);
              }, 500);
          }
      });
  });
})();

/* ---- Recent reviews strip ---- */
(function () {

  (function () {
      const section = document.getElementById('reviews');
      const list = document.getElementById('home-reviews-list');
      if (!section || !list) return;

      const escapeHTML = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
      }[char]));

      const stars = (rating) => Array.from({ length: 5 }, (_, index) =>
          `<i class="${index < rating ? 'fas' : 'far'} fa-star" aria-hidden="true"></i>`
      ).join('');

      const badgeColors = {
          'Carpentry & Trim': 'bg-amber-100 text-amber-800',
          'Doors': 'bg-emerald-100 text-emerald-800',
          'Drywall': 'bg-neutral-100 text-neutral-800',
          'Painting': 'bg-pink-100 text-pink-800',
          'Electrical': 'bg-yellow-100 text-yellow-800',
          'Plumbing': 'bg-sky-100 text-sky-800',
          'Decks & Fences': 'bg-teal-100 text-teal-800',
          'Flooring': 'bg-violet-100 text-violet-800',
          'Maintenance': 'bg-orange-100 text-orange-800',
          'Other Service': 'bg-blue-100 text-blue-800'
      };

      const renderCard = (item) => {
          const badgeStyle = badgeColors[item.projectType] || 'bg-gray-100 text-gray-800';
          const name = escapeHTML(item.customerName || '');
          const initial = escapeHTML((item.customerName || '?').charAt(0));
          return `
              <article class="bg-white text-gray-900 rounded-3xl overflow-hidden shadow-xl flex flex-col">
                  <div class="relative bg-gray-50" style="aspect-ratio: 4 / 3; overflow: hidden;">
                      <img src="/.netlify/images?url=${encodeURIComponent(item.imageUrl)}&w=600&fm=avif&q=80" alt="${escapeHTML(item.imageAlt || (item.projectType + ' project by AAA Handyman Services LLC'))}" width="600" height="450" class="w-full h-full object-cover" loading="lazy" decoding="async">
                      <span class="absolute top-4 left-4 ${badgeStyle} text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md">${escapeHTML(item.projectType || 'Service')}</span>
                  </div>
                  <div class="p-6 flex flex-col flex-grow">
                      <div class="text-amber-500 text-lg flex gap-1 mb-3" role="img" aria-label="${escapeHTML(item.rating)} out of 5 stars">${stars(Number(item.rating) || 0)}</div>
                      <p class="text-gray-700 leading-relaxed italic flex-grow">"${escapeHTML(item.review || '')}"</p>
                      <div class="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm uppercase">${initial}</div>
                          <div>
                              <strong class="text-gray-900 block text-sm">${name}</strong>
                              <span class="text-xs text-gray-600 flex items-center gap-1"><i class="fas fa-map-marker-alt text-red-500" aria-hidden="true"></i> ${escapeHTML(item.location || '')}</span>
                          </div>
                      </div>
                  </div>
              </article>`;
      };

      const loadReviews = () => fetch('/api/reviews')
          .then(response => response.ok ? response.json() : Promise.reject())
          .then(items => {
              if (!Array.isArray(items) || items.length === 0) return;
              list.innerHTML = items.slice(0, 3).map(renderCard).join('');
              section.classList.remove('hidden');
              if (window.location.hash) {
                  let targetEl = null;
                  try {
                      targetEl = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
                  } catch (error) {
                      targetEl = null;
                  }
                  if (targetEl) {
                      setTimeout(() => {
                          const rect = targetEl.getBoundingClientRect();
                          const scrollTop = window.scrollY || document.documentElement.scrollTop;
                          const offsetPosition = rect.top + scrollTop - 80; // Offset sticky nav height
                          window.scrollTo({
                              top: offsetPosition,
                              behavior: 'auto'
                          });
                      }, 50);
                  }
              }
          })
          .catch(() => undefined);

      /*
       * This section is hidden until the data lands and sits well below
       * the fold, but the fetch used to fire during HTML parse: a function
       * invocation -- cold start included -- competing with the hero image
       * for bandwidth inside the LCP window, to populate something nobody
       * can see yet. Waiting for load and then for an idle moment hands
       * that time back to the largest paint and changes nothing visible.
       *
       * A deep link is the exception. When the URL already points at a
       * review the cards have to exist before the scroll can land on
       * them, so that path still runs immediately.
       */
      if (window.location.hash) {
          loadReviews();
      } else {
          const whenIdle = () => {
              if ('requestIdleCallback' in window) {
                  requestIdleCallback(loadReviews, { timeout: 3000 });
              } else {
                  setTimeout(loadReviews, 1200);
              }
          };
          if (document.readyState === 'complete') whenIdle();
          else window.addEventListener('load', whenIdle, { once: true });
      }
  })();
})();

/* ---- Maintenance membership dialog ---- */
(function () {
  (function () {
      const modal = document.getElementById('membership-modal');
      if (!modal || typeof modal.showModal !== 'function') return;
      const openers = document.querySelectorAll('[data-membership-open]');
      const closers = modal.querySelectorAll('[data-membership-close]');

      openers.forEach((btn) => btn.addEventListener('click', () => {
          modal.showModal();
          document.body.style.overflow = 'hidden';
      }));
      closers.forEach((btn) => btn.addEventListener('click', () => modal.close()));

      // Close when the backdrop (area outside the card) is clicked.
      modal.addEventListener('click', (event) => {
          if (event.target === modal) modal.close();
      });
      modal.addEventListener('close', () => {
          document.body.style.overflow = '';
      });
  })();
})();

/* ---- Service quick-view dialog ---- */
(function () {
  (function() {
      const servicesData = {
          'tv-mounting': {
              title: 'TV Wall Mounting',
              category: 'Installation & Mounting',
              price: '$170',
              icon: 'fa-tv',
              description: 'Professional TV wall mounting up to 65" securely anchored into wood or metal studs. Covers leveling, wire management options, and a stud and anchor safety check.',
              bullets: [
                  'Wall stud locator & safety anchor check',
                  'TV bracket installation & precision leveling',
                  'Cable routing & surface wire concealment',
                  'Soundbar & streaming box mounting options'
              ],
              link: '/services/installation',
              formService: 'TV Wall Mounting'
          },
          'drywall': {
              title: 'Drywall Repair & Patching',
              category: 'Interior Finishes',
              price: '$100',
              icon: 'fa-border-all',
              description: 'Seamless wall and ceiling repairs for doorknob dings, cracks, water stains, and drywall cutouts. Meticulously sanded and prepared paint-ready.',
              bullets: [
                  'Doorknob holes, crack & water damage patching',
                  'Mesh backing & joint compound application',
                  'Texture matching & paint-ready smooth sanding',
                  'Clean job site with contained dust management'
              ],
              link: '/services/drywall-repair',
              formService: 'Drywall Repair'
          },
          'doors': {
              title: 'Door Alignment & Repair',
              category: 'Doors & Windows',
              price: '$100',
              icon: 'fa-door-open',
              description: 'Expert adjustment for doors that stick, rub, or won\'t latch properly. Alignment, hinge shimming, strike plate adjustment, and draft weatherstripping.',
              bullets: [
                  'Entry & interior door alignment and planing',
                  'Strike plate, latch & deadbolt adjustments',
                  'Hinge tightening, shimming & pin replacement',
                  'Weatherstripping & sweep replacement to stop drafts'
              ],
              link: '/services/doors-windows',
              formService: 'Doors'
          },
          'plumbing': {
              title: 'Minor Plumbing & Fixture Swap',
              category: 'Plumbing Services',
              price: '$135',
              icon: 'fa-faucet-drip',
              description: 'Fast, clean replacement of kitchen & bathroom faucets, toilet rebuilds, supply line swaps, and garbage disposal installs.',
              bullets: [
                  'Kitchen & bathroom faucet replacement',
                  'Toilet flapper, fill valve & wax ring rebuilds',
                  'Showerhead & handheld wand installations',
                  'Garbage disposal & sink drain replacements'
              ],
              link: '/services/minor-plumbing',
              formService: 'Minor Plumbing'
          },
          'electrical': {
              title: 'Minor Electrical & Light Swaps',
              category: 'Electrical & Smart Home',
              price: '$135',
              icon: 'fa-lightbulb',
              description: 'Safe replacement of ceiling fans, light fixtures, wall switches, dimmers, outlets, and smart video doorbells.',
              bullets: [
                  'Interior & exterior light fixture replacements',
                  'Ceiling fan swap & balancing on existing box',
                  'Wall outlet, GFCI & dimmer switch upgrades',
                  'Smart doorbell & security sensor installation'
              ],
              link: '/services/minor-electrical',
              formService: 'Minor Electrical'
          },
          'carpentry': {
              title: 'Carpentry & Trim Work',
              category: 'Interior & Exterior',
              price: '$100',
              icon: 'fa-hammer',
              description: 'Precision finish carpentry including baseboards, crown molding, door casings, window trim, and exterior wood rot repairs.',
              bullets: [
                  'Baseboards, crown molding & interior trim',
                  'Door/window casings & decorative millwork',
                  'Exterior wood rot, fascia & trim repair',
                  'Custom shelving & closet system mounting'
              ],
              link: '/services/carpentry',
              formService: 'Carpentry & Trim'
          },
          'gutters': {
              title: 'Gutter Cleaning & Repairs',
              category: 'Exterior Maintenance',
              price: '$100',
              icon: 'fa-droplet',
              description: 'Full clearing of leaves and roof debris, downspout flushing, bracket re-securing, and gutter guard installation.',
              bullets: [
                  'Full gutter & downspout clearing',
                  'Water flow testing & blockage removal',
                  'Loose spike & bracket re-securing',
                  'Gutter guard & leaf screen installations'
              ],
              link: '/services/gutters',
              formService: 'Gutter Maintenance'
          },
          'locks': {
              title: 'Smart Locks & Hardware',
              category: 'Home Security',
              price: '$135',
              icon: 'fa-lock',
              description: 'Upgrade your entry security with keyless electronic smart locks, deadbolts, handlesets, and heavy-duty strike plates.',
              bullets: [
                  'Keyless smart lock & keypad installation',
                  'Deadbolt & handleset replacement',
                  'Reinforced security strike plate installation',
                  'Smooth latching & jamb clearance adjustment'
              ],
              link: '/services/doors-windows',
              formService: 'Home Security'
          }
      };

      const modal = document.getElementById('quick-view-modal');
      let quickViewOpener = null;

      window.openServiceQuickView = function(key) {
          const data = servicesData[key];
          if (!data || !modal) return;
          quickViewOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

          document.getElementById('quick-view-title').textContent = data.title;
          document.getElementById('quick-view-category').textContent = data.category;
          document.getElementById('quick-view-price').innerHTML = `Starting at <strong class="text-white text-base font-extrabold">${data.price}</strong> (Zone A) &middot; labor only, materials not included`;
          document.getElementById('quick-view-description').textContent = data.description;
          document.getElementById('quick-view-icon').className = `fas ${data.icon}`;
          document.getElementById('quick-view-page-link').href = data.link;
          document.getElementById('quick-view-book-btn').href = `/book?service=${encodeURIComponent(data.formService)}`;

          const bulletsUl = document.getElementById('quick-view-bullets');
          bulletsUl.innerHTML = '';
          data.bullets.forEach(b => {
              const li = document.createElement('li');
              li.className = 'flex items-start gap-2';
              li.innerHTML = `<i class="fas fa-check-circle text-red-600 mt-1 shrink-0" aria-hidden="true"></i><span>${b}</span>`;
              bulletsUl.appendChild(li);
          });

          if (typeof modal.showModal === 'function') {
              modal.showModal();
              document.body.style.overflow = 'hidden';
          } else {
              modal.setAttribute('open', 'true');
          }
      };

      window.closeServiceQuickView = function() {
          if (!modal) return;
          if (typeof modal.close === 'function') {
              modal.close();
          } else {
              modal.removeAttribute('open');
          }
          document.body.style.overflow = '';
      };

      if (modal) {
          modal.addEventListener('click', function(e) {
              if (e.target === modal) {
                  window.closeServiceQuickView();
              }
          });
          modal.addEventListener('close', function() {
              document.body.style.overflow = '';
              if (quickViewOpener && quickViewOpener.isConnected) quickViewOpener.focus();
              quickViewOpener = null;
          });
      }
  })();
})();
