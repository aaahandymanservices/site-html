/*
 * Behaviour for the /book request form: the first-service offer pre-tick, phone
 * formatting, validation, and submission.
 *
 * Previously a 29kB inline <script> that blocked the parse of the page it sits
 * on. External and deferred, it is minified, cached for a year, and no longer
 * in front of the first paint.
 */

(function () {
  // Check for offer=first-service URL parameter
  (function() {
      var params = new URLSearchParams(window.location.search);
      var offer = params.get('offer');
      var bookingOfferCheckbox = document.getElementById('booking-first-service-certificate');
      if (offer === 'first-service' && bookingOfferCheckbox) {
          bookingOfferCheckbox.checked = true;
      }
  })();

  // Automatic phone number formatter
  const bookingPhone = document.getElementById('booking-phone');
  if (bookingPhone) {
      bookingPhone.addEventListener('input', function (e) {
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

  // Setup the guided booking widget and date constraints.
  const bookingForm = document.getElementById('booking-form');
  const submitBtn = document.getElementById('submit-btn');
  const bookingError = document.getElementById('booking-error');
  const bookingDateInput = document.getElementById('booking-date');
  const timeSlotsContainer = document.getElementById('time-slots-container');
  const hiddenTimeInput = document.getElementById('booking-time');
  const requiredBookingFields = bookingForm ? Array.from(bookingForm.querySelectorAll('[required]:not(#booking-time)')) : [];

  function setBookingError(message = '') {
      if (!bookingError) return;
      bookingError.textContent = message;
      bookingError.classList.toggle('hidden', !message);
  }

  function updateBookingCompletion() {
      if (!bookingForm || !submitBtn) return;
      const fieldsComplete = requiredBookingFields.every(field => field.value.trim() && field.checkValidity());
      submitBtn.disabled = !(fieldsComplete && hiddenTimeInput.value);
  }

  if (bookingDateInput) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      bookingDateInput.min = `${yyyy}-${mm}-${dd}`;

      bookingDateInput.addEventListener('change', function() {
          const dateVal = this.value;
          setBookingError();
          hiddenTimeInput.value = '';
          if (!dateVal) {
              renderTimeSlots('weekday');
              updateBookingCompletion();
              return;
          }

          const parts = dateVal.split('-');
          const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
          const dayOfWeek = selectedDate.getDay();

          if (dayOfWeek === 0) {
              setBookingError('AAA Handyman Services is closed on Sundays. Please choose a Monday–Saturday date.');
              this.value = '';
              renderTimeSlots('weekday');
              updateBookingCompletion();
              return;
          }

          renderTimeSlots(dayOfWeek === 6 ? 'saturday' : 'weekday');
          updateBookingCompletion();
      });
  }

  function setupTimeSlotListeners() {
      const timeSlotBtns = document.querySelectorAll('.time-slot-btn');
      timeSlotBtns.forEach(btn => {
          btn.addEventListener('click', function() {
              timeSlotBtns.forEach(b => {
                  b.classList.remove('selected');
                  b.classList.remove('bg-red-600');
                  b.classList.add('bg-gray-800');
                  b.setAttribute('aria-pressed', 'false');
              });

              this.classList.add('selected');
              this.classList.remove('bg-gray-800');
              this.classList.add('bg-red-600');
              this.setAttribute('aria-pressed', 'true');
              hiddenTimeInput.value = this.getAttribute('data-value');
              setBookingError();
              updateBookingCompletion();
          });
      });
  }

  function renderTimeSlots(type) {
      if (!timeSlotsContainer) return;

      if (type === "saturday") {
          timeSlotsContainer.innerHTML = `
              <button type="button" data-value="10:00 AM - 12:00 PM" aria-pressed="false" class="time-slot-btn px-3 py-3.5 bg-gray-800 border-[2px] border-gray-700 rounded-xl font-semibold text-sm hover:border-gray-500 focus:outline-none text-center">
                  10:00 AM
                  <span class="block text-[10px] text-gray-400 font-normal">to 12:00 PM</span>
              </button>
              <button type="button" data-value="12:30 PM - 2:30 PM" aria-pressed="false" class="time-slot-btn px-3 py-3.5 bg-gray-800 border-[2px] border-gray-700 rounded-xl font-semibold text-sm hover:border-gray-500 focus:outline-none text-center">
                  12:30 PM
                  <span class="block text-[10px] text-gray-400 font-normal">to 2:30 PM</span>
              </button>
              <button type="button" data-value="3:00 PM - 5:00 PM" aria-pressed="false" class="time-slot-btn px-3 py-3.5 bg-gray-800 border-[2px] border-gray-700 rounded-xl font-semibold text-sm hover:border-gray-500 focus:outline-none text-center">
                  3:00 PM
                  <span class="block text-[10px] text-gray-400 font-normal">to 5:00 PM</span>
              </button>
          `;
      } else {
          timeSlotsContainer.innerHTML = `
              <button type="button" data-value="9:00 AM - 11:00 AM" aria-pressed="false" class="time-slot-btn px-3 py-3.5 bg-gray-800 border-[2px] border-gray-700 rounded-xl font-semibold text-sm hover:border-gray-500 focus:outline-none text-center">
                  9:00 AM
                  <span class="block text-[10px] text-gray-400 font-normal">to 11:00 AM</span>
              </button>
              <button type="button" data-value="12:00 PM - 2:00 PM" aria-pressed="false" class="time-slot-btn px-3 py-3.5 bg-gray-800 border-[2px] border-gray-700 rounded-xl font-semibold text-sm hover:border-gray-500 focus:outline-none text-center">
                  12:00 PM
                  <span class="block text-[10px] text-gray-400 font-normal">to 2:00 PM</span>
              </button>
              <button type="button" data-value="3:00 PM - 5:00 PM" aria-pressed="false" class="time-slot-btn px-3 py-3.5 bg-gray-800 border-[2px] border-gray-700 rounded-xl font-semibold text-sm hover:border-gray-500 focus:outline-none text-center">
                  3:00 PM
                  <span class="block text-[10px] text-gray-400 font-normal">to 5:00 PM</span>
              </button>
          `;
      }
      setupTimeSlotListeners();
  }

  renderTimeSlots('weekday');
  requiredBookingFields.forEach(field => {
      field.addEventListener('input', updateBookingCompletion);
      field.addEventListener('change', updateBookingCompletion);
  });
  updateBookingCompletion();

  // Set service parameter from query string if available.
  //
  // Nothing derived from the URL is ever written as markup. Query values are
  // normalised through these helpers first: `sanitizeText` strips control
  // characters (including the NUL/newline tricks used to smuggle markup past
  // a naive filter) and caps the length to the same limit the API enforces,
  // and `safeInternalPath` rejects anything that is not a plain root-relative
  // path so a `javascript:`, `data:`, or cross-origin URL can never reach an
  // href. See the API's own `clean()` for the server-side counterpart.
  const MAX_NOTES_LENGTH = 700;

  const sanitizeText = (value, maxLength) =>
      String(value ?? '')
          .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, maxLength);

  const safeInternalPath = (value, fallback) => {
      const path = String(value ?? '');
      // A single leading slash not followed by another slash or a backslash:
      // "/services#x" passes, "//evil.example" and "/\evil.example" do not.
      return /^\/(?![/\\])[A-Za-z0-9\-._~/?#%&=+,:@!$'()*[\]]*$/.test(path) ? path : fallback;
  };

  const PACKAGE_DESCRIPTIONS = {
      "Maintenance Membership": {
          text: "Scheduled seasonal visits, priority booking, and member pricing all year long for $49/mo.",
          link: "/rates#time-packages"
      },
      "Seasonal Prep Package": {
          text: "Gutter cleaning, weatherstripping, window sash checks, and deck maintenance inspection. Protect your home before seasonal weather shifts!",
          link: "/services#services"
      },
      "Move-In / Move-Out Bundle": {
          text: "TV wall mounting, wall patching, paint touch-ups, and deadbolt/lock upgrades. Perfect for settling in or preparing to sell!",
          link: "/services#services"
      },
      "Senior Safety & Accessibility Package": {
          text: "Bathroom grab bar mounting, lever door handle conversions, non-slip stair treads, and handrail stability checks. Labor only — hardware and materials are billed separately or supplied by you.",
          link: "/services#services"
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
      }
  };

  const bookingService = document.getElementById('booking-service');
  const servicePackageInfo = document.getElementById('service-package-info');

  const updatePackageDetails = () => {
      if (!bookingService || !servicePackageInfo) return;
      const val = bookingService.value;
      // Own-property lookup only. A bare `PACKAGE_DESCRIPTIONS[val]` also
      // resolves inherited keys ("constructor", "__proto__", "toString"),
      // which would hand the block below an object it never described.
      const desc = Object.prototype.hasOwnProperty.call(PACKAGE_DESCRIPTIONS, val)
          ? PACKAGE_DESCRIPTIONS[val]
          : null;
      if (desc) {
          servicePackageInfo.innerHTML = '';

          const p = document.createElement('p');
          p.className = 'leading-relaxed';

          const infoIcon = document.createElement('i');
          infoIcon.className = 'fas fa-circle-info text-red-500 mr-2';
          infoIcon.setAttribute('aria-hidden', 'true');
          p.appendChild(infoIcon);

          const strong = document.createElement('strong');
          strong.textContent = `${val}:`;
          p.appendChild(strong);

          p.appendChild(document.createTextNode(` ${desc.text} `));

          const link = document.createElement('a');
          link.href = safeInternalPath(desc.link, '/services');
          link.target = '_blank';
          // Without noopener the new tab keeps a handle on this one and can
          // navigate the booking form away to a look-alike page.
          link.rel = 'noopener noreferrer';
          link.className = 'text-red-300 hover:text-red-200 underline font-semibold whitespace-nowrap ml-1';
          link.textContent = 'Learn details ';

          const linkIcon = document.createElement('i');
          linkIcon.className = 'fas fa-arrow-up-right-from-square text-xs';
          linkIcon.setAttribute('aria-hidden', 'true');
          link.appendChild(linkIcon);

          p.appendChild(link);
          servicePackageInfo.appendChild(p);
          servicePackageInfo.classList.remove('hidden');
      } else {
          servicePackageInfo.classList.add('hidden');
          servicePackageInfo.innerHTML = '';
      }
  };

  if (bookingService) {
      bookingService.addEventListener('change', updatePackageDetails);
  }

  (function prefillServiceFromQuery() {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('service');
      const requestedPkg = params.get('package');
      const requestedNotes = params.get('notes');

      const messageField = document.getElementById('booking-message');
      // `?notes=` lands in a field the customer then submits, so it is
      // reflected back to the owner's inbox and stored with the booking.
      // Sanitising it here keeps a crafted link from seeding the record with
      // control characters or padding past the API's own 700-char limit.
      const safeNotes = sanitizeText(requestedNotes, MAX_NOTES_LENGTH);
      if (safeNotes && messageField && !messageField.value.trim()) {
          messageField.value = safeNotes;
      }

      if (requestedPkg && bookingService) {
          const pkgMap = {
              'seasonal-prep': 'Seasonal Prep Package',
              'move-in-out': 'Move-In / Move-Out Bundle',
              'senior-safety': 'Senior Safety & Accessibility Package'
          };
          const mappedPkg = pkgMap[requestedPkg];
          if (mappedPkg) {
              bookingService.value = mappedPkg;
              updatePackageDetails();
              return;
          }
      }

      if (requested && bookingService) {
          const match = Array.from(bookingService.options).find(opt => opt.value === requested);
          if (match) {
              bookingService.value = requested;
              updatePackageDetails();
          }
      }
  })();

  const bookingPhoto = document.getElementById('booking-photo');
  const bookingPhotoDropzone = document.getElementById('booking-photo-dropzone');
  const bookingPhotoEmpty = document.getElementById('booking-photo-empty');
  const bookingPhotoPreviewWrap = document.getElementById('booking-photo-preview-wrap');
  const bookingPhotoPreview = document.getElementById('booking-photo-preview');
  const bookingPhotoName = document.getElementById('booking-photo-name');
  const bookingPhotoRemove = document.getElementById('booking-photo-remove');
  const bookingPhotoError = document.getElementById('booking-photo-error');
  const MAX_SOURCE_PHOTO_BYTES = 10 * 1024 * 1024;
  const MAX_UPLOAD_PHOTO_BYTES = 5 * 1024 * 1024;
  const MAX_PHOTO_DIMENSION = 2000;
  const BOOKING_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  let bookingPhotoPreviewUrl = '';

  const showBookingPhotoError = (message = '') => {
      if (!bookingPhotoError) return;
      bookingPhotoError.textContent = message;
      bookingPhotoError.classList.toggle('hidden', !message);
  };

  const clearBookingPhoto = () => {
      if (bookingPhoto) bookingPhoto.value = '';
      if (bookingPhotoPreviewUrl) URL.revokeObjectURL(bookingPhotoPreviewUrl);
      bookingPhotoPreviewUrl = '';
      bookingPhotoPreview?.removeAttribute('src');
      bookingPhotoPreviewWrap?.classList.add('hidden');
      bookingPhotoPreviewWrap?.classList.remove('flex');
      bookingPhotoEmpty?.classList.remove('hidden');
      showBookingPhotoError();
  };

  const updateBookingPhotoPreview = () => {
      const file = bookingPhoto?.files?.[0];
      if (!file) {
          clearBookingPhoto();
          return;
      }
      if (!BOOKING_PHOTO_TYPES.has(file.type)) {
          clearBookingPhoto();
          showBookingPhotoError('Choose a JPG, PNG, or WebP image.');
          return;
      }
      if (file.size > MAX_SOURCE_PHOTO_BYTES) {
          clearBookingPhoto();
          showBookingPhotoError('Choose a photo that is 10 MB or smaller.');
          return;
      }
      if (bookingPhotoPreviewUrl) URL.revokeObjectURL(bookingPhotoPreviewUrl);
      bookingPhotoPreviewUrl = URL.createObjectURL(file);
      bookingPhotoPreview.src = bookingPhotoPreviewUrl;
      bookingPhotoName.textContent = file.name || 'Repair photo';
      bookingPhotoEmpty?.classList.add('hidden');
      bookingPhotoPreviewWrap?.classList.remove('hidden');
      bookingPhotoPreviewWrap?.classList.add('flex');
      showBookingPhotoError();
  };

  const prepareBookingPhoto = (file) => new Promise((resolve, reject) => {
      if (!(file instanceof File) || file.size <= MAX_UPLOAD_PHOTO_BYTES) {
          resolve(file);
          return;
      }
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
          URL.revokeObjectURL(url);
          const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          if (!context) {
              reject(new Error('That photo could not be prepared for upload.'));
              return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
              if (!blob) {
                  reject(new Error('That photo could not be prepared for upload.'));
                  return;
              }
              const name = `${(file.name || 'repair-photo').replace(/\.[^.]+$/, '')}.jpg`;
              resolve(new File([blob], name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.82);
      };
      image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('That photo could not be read. Please choose a different image.'));
      };
      image.src = url;
  });

  bookingPhoto?.addEventListener('change', updateBookingPhotoPreview);
  bookingPhotoRemove?.addEventListener('click', (event) => {
      event.preventDefault();
      clearBookingPhoto();
  });

  if (bookingPhotoDropzone && bookingPhoto) {
      ['dragenter', 'dragover'].forEach((eventName) => {
          bookingPhotoDropzone.addEventListener(eventName, (event) => {
              event.preventDefault();
              bookingPhotoDropzone.classList.add('border-red-500', 'bg-gray-900/70');
          });
      });
      ['dragleave', 'drop'].forEach((eventName) => {
          bookingPhotoDropzone.addEventListener(eventName, (event) => {
              event.preventDefault();
              bookingPhotoDropzone.classList.remove('border-red-500', 'bg-gray-900/70');
          });
      });
      bookingPhotoDropzone.addEventListener('drop', (event) => {
          const file = event.dataTransfer?.files?.[0];
          if (!file) return;
          const transfer = new DataTransfer();
          transfer.items.add(file);
          bookingPhoto.files = transfer.files;
          updateBookingPhotoPreview();
      });
  }

  // Form submission via API
  if (bookingForm) {
      bookingForm.addEventListener('submit', async function(e) {
          e.preventDefault();

          // Validation
          const name = document.getElementById('booking-name').value.trim();
          const email = document.getElementById('booking-email').value.trim();
          const phone = document.getElementById('booking-phone').value.trim();
          const service = document.getElementById('booking-service').value;
          const bookingDate = document.getElementById('booking-date').value;
          const bookingTime = hiddenTimeInput.value;
          const message = document.getElementById('booking-message').value.trim();
          const optIn = document.getElementById('seasonal-opt-in').checked;
          const certificateBox = document.getElementById('booking-first-service-certificate');
          const claimedCertificate = Boolean(certificateBox && certificateBox.checked && !certificateBox.disabled);

          setBookingError();
          if (!bookingForm.checkValidity()) {
              bookingForm.reportValidity();
              setBookingError('Please complete each required field before confirming your booking request.');
              updateBookingCompletion();
              return;
          }

          if (!bookingTime) {
              setBookingError('Please select an arrival window.');
              return;
          }

          submitBtn.disabled = true;
          submitBtn.innerHTML = 'PROCESSING BOOKING... <i class="fas fa-spinner animate-spin" aria-hidden="true"></i>';

          try {
              const sourcePhoto = bookingPhoto?.files?.[0] || null;
              const uploadPhoto = sourcePhoto ? await prepareBookingPhoto(sourcePhoto) : null;
              if (uploadPhoto && uploadPhoto.size > MAX_UPLOAD_PHOTO_BYTES) {
                  throw new Error('The photo is still too large after processing. Please choose a smaller image.');
              }

              const requestData = new FormData();
              requestData.append('customerName', name);
              requestData.append('email', email);
              requestData.append('phone', phone);
              requestData.append('service', service);
              requestData.append('bookingDate', bookingDate);
              requestData.append('bookingTime', bookingTime);
              requestData.append('message', message);
              requestData.append('seasonal-opt-in', optIn ? 'on' : 'off');
              requestData.append('firstServiceGiftCertificate', claimedCertificate ? 'on' : 'off');
              if (uploadPhoto) requestData.append('photo', uploadPhoto, uploadPhoto.name);

              const response = await fetch('/api/booking', {
                  method: 'POST',
                  body: requestData
              });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(data.error || 'Failed to submit booking.');

              // The API decides whether the certificate was actually applied
              // -- it is one per customer and the booking may be a repeat. Any
              // "redeemed" verdict is mirrored into local storage so the offer
              // stops rendering for this visitor site-wide.
              const giftCertificate = data.giftCertificate || {};
              if (giftCertificate.firstServiceGiftRedeemed && window.AAAGiftCertificate) {
                  window.AAAGiftCertificate.markRedeemed(email, {
                      name: name,
                      source: 'booking_form',
                      redeemedAt: giftCertificate.redeemedAt,
                      serverConfirmed: true
                  });
              }

              // Nice confirmation details update
              document.getElementById('summary-service').innerText = service;
              
              // Format date nicely (e.g. 2026-07-22 to July 22, 2026)
              try {
                  const parts = bookingDate.split('-');
                  const d = new Date(parts[0], parts[1] - 1, parts[2]);
                  const formattedDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                  document.getElementById('summary-date').innerText = `${formattedDate} (${bookingTime})`;
              } catch (err) {
                  document.getElementById('summary-date').innerText = `${bookingDate} (${bookingTime})`;
              }

              // Forward booking to Netlify Forms for email alert and dashboard integration
              const netlifyFormData = new URLSearchParams();
              netlifyFormData.append('form-name', 'bookings');
              netlifyFormData.append('name', name);
              netlifyFormData.append('email', email);
              netlifyFormData.append('phone', phone);
              netlifyFormData.append('service', service);
              netlifyFormData.append('bookingDate', bookingDate);
              netlifyFormData.append('bookingTime', bookingTime);
              netlifyFormData.append('message', message);
              netlifyFormData.append('seasonal-opt-in', optIn ? 'on' : 'off');
              // Tell the owner which bookings actually carry the $50 discount,
              // and flag a repeat claim so it can be explained rather than honoured twice.
              if (giftCertificate.applied) {
                  netlifyFormData.append('first-service-gift-certificate', 'Applied — $50 first-service gift certificate');
              } else if (claimedCertificate) {
                  netlifyFormData.append('first-service-gift-certificate', 'Not applied — already redeemed on an earlier service');
              }
              if (data.booking?.photoUrl) {
                  // Resolve against this origin and forward it only when it
                  // stayed here, so a tampered API response cannot plant an
                  // off-site or javascript: link in the owner's notification.
                  const resolved = new URL(data.booking.photoUrl, window.location.origin);
                  if (resolved.origin === window.location.origin && (resolved.protocol === 'https:' || resolved.protocol === 'http:')) {
                      netlifyFormData.append('photoUrl', resolved.href);
                  }
              }

              fetch('/book.html', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: netlifyFormData.toString()
              }).catch(err => console.error('Netlify Form submission failed:', err));

              // Toggle States
              bookingForm.classList.add('hidden');
              document.getElementById('success-state').classList.remove('hidden');
          } catch (error) {
              setBookingError(`${error.message} Please double-check your details or call us directly.`);
              submitBtn.disabled = false;
              submitBtn.innerHTML = 'Request My Booking <i class="fas fa-calendar-check" aria-hidden="true"></i>';
          }
      });
  }
})();
