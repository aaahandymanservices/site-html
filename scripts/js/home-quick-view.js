/*
 * Service quick-view dialog for the home page, split out of home.js.
 *
 * The catalog of eight services it drives is a multi-kilobyte data literal that
 * only matters the moment a visitor taps one of the quick-view buttons — well
 * below the fold and long after first paint. Keeping it inside home.js made
 * every visitor parse all of it up front; loading it here, on first interaction
 * with a quick-view button (or during idle time as a fallback), takes that
 * parse off the home page's critical path without changing any behaviour.
 *
 * home.js installs a small loader that publishes a stub window.openServiceQuickView
 * which injects this file on demand; the inline onclick attributes on the page
 * keep working unchanged before and after the load.
 */

/* Shared focus trap for the home page's <dialog> modals (same implementation
 * as the one in home.js -- the two dialog blocks it served were split across
 * both files, so each carries its own copy rather than ordering a load). */
function aaaTrapDialogFocus(modal) {
    if (!modal) return;
    modal.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab' || !modal.open) return;
      const focusables = Array.from(
        modal.querySelectorAll('a[href], button:not([disabled]), input:not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
}

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
      aaaTrapDialogFocus(modal);
  })();
})();
