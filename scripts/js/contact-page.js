/*
 * Behaviour for /contact: phone formatting, the first-service offer pre-tick,
 * validation, and submission of the enquiry form.
 *
 * Previously an 11kB inline <script>, which is parser-blocking wherever it sits
 * and re-downloaded uncompressed on every visit. External and deferred, it is
 * minified, cached for a year, and out of the first-paint path.
 */

(function () {
  const contactPhone = document.getElementById('contact-phone');
  if (contactPhone) {
      contactPhone.addEventListener('input', function (e) {
          let val = e.target.value.replace(/\D/g, '');
          if (val.length > 10) val = val.substring(0, 10);
          const match = val.match(/^(\d{1,3})(\d{0,3})(\d{0,4})$/);
          if (match) {
              let formatted = "";
              if (match[1]) formatted += "(" + match[1];
              if (match[1].length === 3) formatted += ") ";
              if (match[2]) formatted += match[2];
              if (match[2].length === 3) formatted += "-";
              if (match[3]) formatted += match[3];
              e.target.value = formatted;
          }
      });
  }
  const PACKAGE_DESCRIPTIONS = {
      "Maintenance Membership": {
          text: "Scheduled seasonal visits, priority booking, and member pricing all year long for $49/mo.",
          link: "/rates#time-packages"
      },
      "4-Hour Handyman Package": {
          text: "4 Hours of reserved labor to work straight through a punch list of smaller repairs, adjustments, or upgrades. Save $30!",
          link: "/rates#packages"
      },
      "6-Hour Handyman Package": {
          text: "6 Productive hours for a longer punch list with room for repairs, maintenance, and light improvement projects. Save $60!",
          link: "/rates#packages"
      },
      "8-Hour Handyman Package": {
          text: "A full 8-hour workday for larger punch lists and projects that benefit from uninterrupted, back-to-back progress. Save $105!",
          link: "/rates#packages"
      },
      "Home Safety Audit": {
          text: "A focused $100 audit examining fall prevention, safety detectors, lighting, entry points, and lock security.",
          link: "/rates#audits"
      },
      "Energy Tune-Up Audit": {
          text: "A focused $100 audit to locate draft points, heat/cool leaks, and seal standard minor leaks on the spot.",
          link: "/rates#audits"
      },
      "Storm-Prep Check": {
          text: "A focused $100 audit checking drainage, gutter alignment, exterior caulk seals, and sump pump functionality.",
          link: "/rates#audits"
      },
      "Whole-Home Assessment": {
          text: "Get all three specialized audits (Safety, Energy, Storm-Prep) in a single visit with a unified punch list. Save $100!",
          link: "/rates#audits"
      },
      "Home Safety Menu": {
          text: "Standardized package safety menus: Good ($170 - Standard checks), Better ($290 - Upgraded safety additions), Best ($390 - Deluxe coverage). Menu prices are labor only — hardware and materials are billed separately or supplied by you.",
          link: "/rates#menus"
      },
      "Energy Efficiency Menu": {
          text: "Standardized package energy menus: Good ($145 - Draft checks & standard sweeps), Better ($315 - Enhanced seals & hatch insulation), Best ($415 - Maximum thermal sealing). Menu prices are labor only — hardware and materials are billed separately or supplied by you.",
          link: "/rates#menus"
      },
      "Storm & Water Defense Menu": {
          text: "Standardized package storm/water menus: Good ($145 - Basic checks & spot caulking), Better ($250 - Gutter tune-up & pump checks), Best ($340 - Full perimeter sealing & defense). Menu prices are labor only — hardware and materials are billed separately or supplied by you.",
          link: "/rates#menus"
      },
      "Fall Home Prep Package": {
          text: "A comprehensive seasonal package detailing gutter clean-out, water spigot winterization, draft sealing, and leaf checks.",
          link: "/rates"
      },
      "Spring Home Refresh Package": {
          text: "A seasonal tune-up package including deck checks, screen washing, exterior caulk refreshes, and gutter flow checks.",
          link: "/rates"
      },
      "Priority / After-Hours Service": {
          text: "7-Day priority response service for urgent repairs that affect immediate home safety, plumbing leaks, or door/window security ($175 first hour / $100 per hour after).",
          link: "/rates"
      }
  };

  const contactService = document.getElementById('contact-service');
  const servicePackageInfo = document.getElementById('service-package-info');

  const updatePackageDetails = () => {
      if (!contactService || !servicePackageInfo) return;
      const val = contactService.value;
      // Support exact keys and strip parentheticals if present
      const cleanVal = val.split(" (")[0];
      const desc = PACKAGE_DESCRIPTIONS[cleanVal] || PACKAGE_DESCRIPTIONS[val];
      if (desc) {
          servicePackageInfo.innerHTML = '';

          const p = document.createElement('p');
          p.className = 'leading-relaxed';

          const infoIcon = document.createElement('i');
          infoIcon.className = 'fas fa-circle-info text-red-500 mr-2';
          infoIcon.setAttribute('aria-hidden', 'true');

          const strong = document.createElement('strong');
          strong.textContent = `${val}:`;

          const detailsLink = document.createElement('a');
          detailsLink.href = desc.link;
          detailsLink.target = '_blank';
          detailsLink.className = 'text-red-300 hover:text-red-200 underline font-semibold whitespace-nowrap ml-1';
          detailsLink.textContent = 'Learn details ';

          const linkIcon = document.createElement('i');
          linkIcon.className = 'fas fa-arrow-up-right-from-square text-xs';
          linkIcon.setAttribute('aria-hidden', 'true');
          detailsLink.appendChild(linkIcon);

          p.appendChild(infoIcon);
          p.appendChild(strong);
          p.appendChild(document.createTextNode(` ${desc.text} `));
          p.appendChild(detailsLink);

          servicePackageInfo.appendChild(p);
          servicePackageInfo.classList.remove('hidden');
      } else {
          servicePackageInfo.classList.add('hidden');
          servicePackageInfo.innerHTML = '';
      }
  };

  if (contactService) {
      contactService.addEventListener('change', updatePackageDetails);
  }

  const setContactService = (value) => {
      if (!contactService) return;
      const match = Array.from(contactService.options).find(opt => opt.value === value);
      if (match) {
          contactService.value = value;
          updatePackageDetails();
      }
  };

  (function prefillServiceFromQuery() {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('service');
      if (requested) setContactService(requested);
      const requestedCity = params.get('city');
      const contactCity = document.getElementById('contact-city');
      if (requestedCity && contactCity && !contactCity.value) {
          contactCity.value = requestedCity;
      }
      const offer = params.get('offer');
      const offerCheckbox = document.getElementById('first-service-certificate');
      if (offer === 'first-service' && offerCheckbox) {
          offerCheckbox.checked = true;
      }
  })();

  document.addEventListener('click', event => {
      const link = event.target.closest('a[data-service]');
      if (link) setContactService(link.getAttribute('data-service'));
  });
  const form = document.getElementById('contact-form');
  if (form) {
      const submitButton = form.querySelector('button[type="submit"]');
      form.addEventListener('submit', function(e) {
          e.preventDefault();
          if (submitButton && submitButton.disabled) return;
          if (submitButton) {
              submitButton.disabled = true;
              submitButton.classList.add('opacity-70', 'cursor-not-allowed');
          }

          const formData = new FormData(form);
          const isSubscribed = document.getElementById('seasonal-opt-in')?.checked;
          const email = formData.get('email');
          const name = formData.get('name');
          const certificateBox = document.getElementById('first-service-certificate');
          const claimedCertificate = Boolean(certificateBox && certificateBox.checked && !certificateBox.disabled);

          const sendMessage = function() {
              fetch('/contact.html', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams(formData).toString()
              })
              .then(response => {
                  if (response.ok) {
                      // The certificate is one per customer, so spend it the
                      // moment the claim lands. This records it against their
                      // email address server-side and stops the offer being
                      // rendered for them on any page from here on.
                      if (claimedCertificate && email && window.AAAGiftCertificate) {
                          window.AAAGiftCertificate.markRedeemed(email, { name: name, source: 'contact_form' });
                      }

                      if (isSubscribed && email) {
                          fetch('/api/seasonal-subscription', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: email, name: name, source: 'quote_form' })
                          }).catch(err => console.error('Subscription error:', err));
                      }

                      alert('Thank you! Your message has been sent. We will contact you soon.');
                      form.reset();
                  } else {
                      alert("Sorry — your message didn't go through. Please call us at (248) 385-3432 or email contact@aaahandyman.services and we'll help right away.");
                  }
              })
              .catch(error => {
                  alert("Sorry — your message didn't go through. Please call us at (248) 385-3432 or email contact@aaahandyman.services and we'll help right away.");
              })
              .finally(() => {
                  if (submitButton) {
                      submitButton.disabled = false;
                      submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
                  }
              });
          };

          sendMessage();
      });
  }
})();
