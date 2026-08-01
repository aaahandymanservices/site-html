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
          text: "7-Day priority response service for urgent repairs that affect immediate home safety, plumbing leaks, or door/window security ($135 first hour / $85 per hour after).",
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
      const status = document.getElementById('contact-form-status');

      /*
       * The form carries `novalidate`, so none of this is duplicating the
       * browser. Native validation puts one bubble on one field, dismisses it
       * on the next keystroke, and is never read by a screen reader that is not
       * focused on that field -- which on a form this long means a visitor can
       * be told "Message is required" while three fields further up are also
       * empty. Every rule below writes its message into a paragraph that the
       * field already points at with aria-describedby, so the whole set is
       * announced on focus and stays on screen until it is fixed.
       */
      const STATUS_TONES = {
          error: 'border-red-400 bg-red-950 text-red-100',
          success: 'border-emerald-400 bg-emerald-950 text-emerald-50'
      };
      const ALL_TONE_CLASSES = Object.values(STATUS_TONES).join(' ').split(' ');

      const setStatus = (message, tone) => {
          if (!status) return;
          status.classList.remove(...ALL_TONE_CLASSES);
          if (!message) {
              status.textContent = '';
              status.classList.add('hidden');
              return;
          }
          status.textContent = message;
          status.classList.add(...STATUS_TONES[tone].split(' '));
          status.classList.remove('hidden');
      };

      // A phone number is only usable if it can actually be dialled, so the
      // check is on the digit count rather than on the punctuation the input
      // handler above adds.
      const digitsOf = (value) => value.replace(/\D/g, '');

      const FIELDS = [
          {
              id: 'contact-name',
              label: 'Full name',
              validate: (value) => value.length >= 2
                  ? ''
                  : 'Please enter your full name.'
          },
          {
              id: 'contact-email',
              label: 'Email address',
              validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
                  ? ''
                  : 'Please enter an email address we can reply to, e.g. you@example.com.'
          },
          {
              id: 'contact-phone',
              label: 'Phone number',
              validate: (value) => {
                  const digits = digitsOf(value);
                  if (!digits) return 'Please enter a phone number we can reach you on.';
                  // 10 digits, or 11 with the US country code in front.
                  if (digits.length === 10 || (digits.length === 11 && digits[0] === '1')) return '';
                  return 'Please enter a 10-digit phone number, e.g. (248) 555-0123.';
              }
          },
          {
              id: 'contact-service',
              label: 'Service needed',
              validate: (value) => value ? '' : 'Please choose the service you need.'
          },
          {
              id: 'contact-message',
              label: 'Message',
              validate: (value) => value.length >= 10
                  ? ''
                  : 'Please tell us a little about the work — at least a sentence.'
          }
      ];

      const showFieldError = (field, message) => {
          const input = document.getElementById(field.id);
          const errorBox = document.getElementById(`${field.id}-error`);
          if (!input) return;
          if (message) {
              input.setAttribute('aria-invalid', 'true');
              if (errorBox) {
                  errorBox.textContent = message;
                  errorBox.classList.remove('hidden');
              }
          } else {
              input.removeAttribute('aria-invalid');
              if (errorBox) {
                  errorBox.textContent = '';
                  errorBox.classList.add('hidden');
              }
          }
      };

      const validateField = (field) => {
          const input = document.getElementById(field.id);
          if (!input) return '';
          const message = field.validate(input.value.trim());
          showFieldError(field, message);
          return message;
      };

      FIELDS.forEach(field => {
          const input = document.getElementById(field.id);
          if (!input) return;
          // Nothing is flagged before the visitor has had a go at it: `blur`
          // for a first pass, then `input`/`change` to clear the message the
          // moment it stops being true rather than on the next submit.
          input.addEventListener('blur', () => validateField(field));
          const liveEvent = input.tagName === 'SELECT' ? 'change' : 'input';
          input.addEventListener(liveEvent, () => {
              if (input.getAttribute('aria-invalid') === 'true') validateField(field);
          });
      });

      form.addEventListener('submit', function(e) {
          e.preventDefault();
          if (submitButton && submitButton.disabled) return;

          const invalid = FIELDS.filter(field => validateField(field));
          if (invalid.length) {
              setStatus(
                  invalid.length === 1
                      ? `${invalid[0].label} needs your attention before we can send this.`
                      : `${invalid.length} fields need your attention before we can send this.`,
                  'error'
              );
              const firstInvalid = document.getElementById(invalid[0].id);
              if (firstInvalid) {
                  firstInvalid.focus();
                  firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
              return;
          }

          setStatus('');
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

                      setStatus('Thank you! Your message is on its way and we will be in touch shortly.', 'success');
                      form.reset();
                      FIELDS.forEach(field => showFieldError(field, ''));
                      if (servicePackageInfo) {
                          servicePackageInfo.classList.add('hidden');
                          servicePackageInfo.innerHTML = '';
                      }
                  } else {
                      setStatus("Sorry — your message didn't go through. Please call us at (248) 385-3432 or email contact@aaahandyman.services and we'll help right away.", 'error');
                  }
              })
              .catch(() => {
                  setStatus("Sorry — your message didn't go through. Please call us at (248) 385-3432 or email contact@aaahandyman.services and we'll help right away.", 'error');
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
