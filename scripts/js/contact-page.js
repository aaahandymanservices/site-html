/*
 * Behaviour for /contact: phone formatting, the first-service offer pre-tick,
 * validation, the photo upload widget, and submission of the enquiry form.
 *
 * The form posts as multipart/form-data to /api/contact-quote so it can carry
 * up to five repair photos alongside the text fields. No Content-Type header
 * is set on the fetch: the browser has to put the multipart boundary in
 * itself, and a hand-set header would strip it and take the photos with it.
 * The submission still works without a photo -- the photos are optional, and a
 * quote with no photo is worth more than no quote at all.
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
          text: "4 Hours of reserved labor to work straight through a punch list of smaller repairs, adjustments, or upgrades. Save $31!",
          link: "/rates#packages"
      },
      "6-Hour Handyman Package": {
          text: "6 Productive hours for a longer punch list with room for repairs, maintenance, and light improvement projects. Save $45!",
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
          text: "Get all three specialized audits (Safety, Energy, Storm-Prep) in a single visit with a unified punch list. Save $84!",
          link: "/rates#audits"
      },
      "Home Safety Menu": {
          text: "Standardized package safety menus: Good ($185 - Standard checks), Better ($342 - Upgraded safety additions), Best ($500 - Deluxe coverage). Menu prices are labor only — hardware and materials are billed separately or supplied by you.",
          link: "/rates#menus"
      },
      "Energy Efficiency Menu": {
          text: "Standardized package energy menus: Good ($153 - Draft checks & standard sweeps), Better ($374 - Enhanced seals & hatch insulation), Best ($531 - Maximum thermal sealing). Menu prices are labor only — hardware and materials are billed separately or supplied by you.",
          link: "/rates#menus"
      },
      "Storm & Water Defense Menu": {
          text: "Standardized package storm/water menus: Good ($153 - Basic checks & spot caulking), Better ($279 - Gutter tune-up & pump checks), Best ($405 - Full perimeter sealing & defense). Menu prices are labor only — hardware and materials are billed separately or supplied by you.",
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
          text: "7-Day priority response service for urgent repairs that affect immediate home safety, plumbing leaks, or door/window security ($155 first hour / $100 per hour after).",
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
          detailsLink.textContent = "See what's included ";

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
      const offerCheckbox = document.getElementById('loyalty-credit') || document.getElementById('first-service-certificate');
      if (offer === 'first-service' && offerCheckbox) {
          offerCheckbox.checked = true;
      }
  })();

  document.addEventListener('click', event => {
      const link = event.target.closest('a[data-service]');
      if (link) setContactService(link.getAttribute('data-service'));
  });

  /*
   * Photo upload widget.
   *
   * The dropzone is a <div role=button> wrapping a hidden <input type=file
   * multiple>, so a click anywhere on it has to open the file picker in JS --
   * a <label> would do it for free, but the markup is a div so this block
   * wires the click itself. It also adds drag-and-drop, preview thumbnails
   * with file name and size, a remove button on each thumbnail, client-side
   * type/size/count validation, and a progress bar that animates while the
   * request is in flight (the upload itself is one multipart POST, so the bar
   * is an indeterminate proxy; XHR's progress event is what makes it move).
   *
   * Limits mirror the server-side function: up to 5 photos, and the shared
   * site rule of JPG / PNG / WebP / GIF at 10 MB each (see photo-upload.js).
   * The five photos travel in one buffered function request capped at 6 MB, so
   * anything over the per-photo share of that budget is downscaled in the
   * browser on submit -- five 10 MB pictures off a phone would not otherwise
   * fit on the wire at all.
   */
  const photoRule = window.AAAPhotoUpload;
  const MAX_PHOTOS = 5;
  // The wire budget per photo, not what the visitor may pick. Five of these
  // plus the text fields and multipart overhead stay inside the 6 MB cap.
  const UPLOAD_SAFE_BYTES = 1 * 1024 * 1024;
  const formatBytes = photoRule.formatBytes;
  const photoInput = document.getElementById('contact-photo-input');
  const photoDropzone = document.getElementById('contact-photo-dropzone');
  const photoEmpty = document.getElementById('contact-photo-empty');
  const photoPreviews = document.getElementById('contact-photo-previews');
  const photoError = document.getElementById('contact-photo-error');
  const photoProgress = document.getElementById('contact-photo-progress');
  const photoProgressBar = document.getElementById('contact-photo-progress-bar');
  const photoProgressText = document.getElementById('contact-photo-progress-text');

  // The selected files, in the order they were added. Array, not a FileList,
  // so we can splice on remove without fighting the read-only DOM collection.
  let selectedPhotos = [];

  const showPhotoError = (message) => {
      if (!photoError) return;
      if (message) {
          photoError.textContent = message;
          photoError.classList.remove('hidden');
          if (photoInput) photoInput.setAttribute('aria-invalid', 'true');
      } else {
          photoError.textContent = '';
          photoError.classList.add('hidden');
          if (photoInput) photoInput.removeAttribute('aria-invalid');
      }
  };

  const renderPreviews = () => {
      if (!photoPreviews) return;
      photoPreviews.innerHTML = '';
      if (selectedPhotos.length === 0) {
          photoPreviews.classList.add('hidden');
          if (photoEmpty) photoEmpty.classList.remove('hidden');
          return;
      }
      if (photoEmpty) photoEmpty.classList.add('hidden');
      photoPreviews.classList.remove('hidden');

      selectedPhotos.forEach((file, index) => {
          const li = document.createElement('li');
          li.className = 'relative group rounded-2xl overflow-hidden border border-blue-600 bg-blue-950';

          const img = document.createElement('img');
          img.alt = `Repair photo ${index + 1}: ${file.name}`;
          img.className = 'aspect-square w-full object-cover';
          img.file = file;
          // Object URL for the thumbnail. Revoked on remove and on page unload
          // by the browser; the cost of a handful of lingering URLs is nothing.
          try {
              img.src = URL.createObjectURL(file);
          } catch {
              img.src = '';
          }
          li.appendChild(img);

          // File name + size, pinned to the bottom of the thumbnail.
          const meta = document.createElement('div');
          meta.className = 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-blue-950/95 to-transparent px-2 py-1.5 pt-3 text-left';
          const name = document.createElement('p');
          name.className = 'truncate text-[11px] font-semibold text-white';
          name.textContent = file.name;
          const size = document.createElement('p');
          size.className = 'text-[10px] text-blue-200';
          size.textContent = formatBytes(file.size);
          meta.appendChild(name);
          meta.appendChild(size);
          li.appendChild(meta);

          // Remove / trash button. `type=button` so it never submits the form.
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 text-white hover:bg-red-600 flex items-center justify-center text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400';
          remove.setAttribute('aria-label', `Remove photo ${index + 1}`);
          remove.dataset.photoIndex = String(index);
          remove.innerHTML = '<i class="fas fa-trash-can" aria-hidden="true"></i>';
          li.appendChild(remove);

          photoPreviews.appendChild(li);
      });
  };

  const addPhotos = (fileList) => {
      const candidates = Array.from(fileList || []);
      if (candidates.length === 0) return;

      const errors = [];
      const accepted = [];

      for (const file of candidates) {
          const rejection = photoRule.rejectionFor(file);
          if (rejection) {
              errors.push(rejection);
              continue;
          }
          accepted.push(file);
      }

      // Enforce the total count cap, keeping the earliest selections.
      const room = MAX_PHOTOS - selectedPhotos.length;
      if (room <= 0) {
          showPhotoError(`You can attach up to ${MAX_PHOTOS} photos. Remove one to add another.`);
          renderPreviews();
          return;
      }
      if (accepted.length > room) {
          accepted.splice(room);
          errors.push(`Only ${room} more photo${room === 1 ? '' : 's'} can be attached (max ${MAX_PHOTOS}). The rest were skipped.`);
      }

      selectedPhotos = selectedPhotos.concat(accepted);

      if (errors.length) {
          showPhotoError(errors.join(' '));
      } else {
          showPhotoError('');
      }
      renderPreviews();
  };

  if (photoInput) {
      photoInput.addEventListener('change', (e) => {
          addPhotos(e.target.files);
          // Reset the input so the same file can be re-selected after remove.
          e.target.value = '';
      });
  }

  if (photoPreviews) {
      photoPreviews.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-photo-index]');
          if (!btn) return;
          const index = Number.parseInt(btn.dataset.photoIndex, 10);
          if (Number.isInteger(index) && index >= 0 && index < selectedPhotos.length) {
              selectedPhotos.splice(index, 1);
              showPhotoError('');
              renderPreviews();
          }
      });
  }

  if (photoDropzone) {
      // Click anywhere on the dropzone opens the file picker. The dropzone is
      // a <div>, not a <label>, so the click has to be wired in JS. The hidden
      // input itself sits inside the dropzone; clicking it would re-trigger,
      // so clicks that originate on the input are left for the input to run
      // its own file picker.
      photoDropzone.addEventListener('click', (e) => {
          if (e.target === photoInput) return;
          if (photoInput) photoInput.click();
      });

      // Keyboard support: the dropzone is a role=button with tabindex=0. Enter
      // and Space open the file picker, mirroring a native button.
      photoDropzone.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (photoInput) photoInput.click();
          }
      });

      // Drag-and-drop. `dragover`/`dragenter` must preventDefault to make the
      // dropzone a valid drop target; `dragleave` only re-toggles when the
      // pointer leaves the dropzone entirely (counter hits zero).
      let dragCounter = 0;
      photoDropzone.addEventListener('dragenter', (e) => {
          e.preventDefault();
          dragCounter += 1;
          photoDropzone.classList.add('border-red-400', 'bg-blue-900/40');
      });
      photoDropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      });
      photoDropzone.addEventListener('dragleave', (e) => {
          e.preventDefault();
          dragCounter -= 1;
          if (dragCounter <= 0) {
              dragCounter = 0;
              photoDropzone.classList.remove('border-red-400', 'bg-blue-900/40');
          }
      });
      photoDropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dragCounter = 0;
          photoDropzone.classList.remove('border-red-400', 'bg-blue-900/40');
          if (e.dataTransfer && e.dataTransfer.files) {
              addPhotos(e.dataTransfer.files);
          }
      });

      // Prevent the browser from opening a dropped file outside the dropzone.
      ['dragover', 'drop'].forEach((evt) => {
          window.addEventListener(evt, (e) => {
              if (e.target === photoDropzone || (photoDropzone && photoDropzone.contains(e.target))) return;
              e.preventDefault();
          });
      });
  }

  const resetPhotoWidget = () => {
      selectedPhotos = [];
      showPhotoError('');
      renderPreviews();
      if (photoProgress) photoProgress.classList.add('hidden');
      if (photoProgressBar) photoProgressBar.style.width = '0%';
      if (photoProgressText) photoProgressText.textContent = '';
  };

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
              label: 'Your name',
              validate: (value) => value.length >= 2
                  ? ''
                  : 'Please enter your full name.'
          },
          {
              id: 'contact-email',
              label: 'Your email address',
              validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
                  ? ''
                  : 'Please enter an email address we can reply to, e.g. you@example.com.'
          },
          {
              id: 'contact-phone',
              label: 'Your phone number',
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
              label: 'The service you need',
              validate: (value) => value ? '' : 'Please choose the service you need.'
          },
          {
              id: 'contact-message',
              label: 'Your project details',
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

      form.addEventListener('submit', async function(e) {
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

          // Resize before anything is built. A visitor may pick five 10 MB
          // pictures, which is legal by the rule on the label but five times
          // what one function request can carry, so each is re-encoded down to
          // its share of the budget first. Files already under it pass through
          // untouched, and an animated GIF is never redrawn -- if one is too
          // big the helper says so by name and the form stays put.
          let uploadPhotos = selectedPhotos;
          if (selectedPhotos.length) {
              if (photoProgress && photoProgressText) {
                  photoProgress.classList.remove('hidden');
                  if (photoProgressBar) photoProgressBar.style.width = '0%';
                  photoProgressText.textContent = 'Preparing your photos…';
              }
              try {
                  uploadPhotos = [];
                  for (const file of selectedPhotos) {
                      uploadPhotos.push(await photoRule.prepare(file, UPLOAD_SAFE_BYTES));
                  }
              } catch (error) {
                  if (photoProgress) photoProgress.classList.add('hidden');
                  showPhotoError(error instanceof Error ? error.message : 'One of your photos could not be prepared. Please try a different image.');
                  if (submitButton) {
                      submitButton.disabled = false;
                      submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
                  }
                  return;
              }
          }

          // Build the multipart body. The hidden <input name=photo1 multiple> in
          // the markup is only there to make the dropzone a click target; the
          // actual files live in our selectedPhotos array so we can manage
          // order and removal. Strip whatever the input contributed and append
          // one entry per selected photo as photo1..photoN, which is what the
          // function reads.
          const formData = new FormData(form);
          formData.delete('photo1');
          uploadPhotos.forEach((file, index) => {
              formData.append(`photo${index + 1}`, file, file.name);
          });

          const email = formData.get('email');
          const name = formData.get('name');
          const certificateBox = document.getElementById('loyalty-credit') || document.getElementById('first-service-certificate');
          const claimedCertificate = Boolean(certificateBox && certificateBox.checked && !certificateBox.disabled);

          // Indeterminate-but-moving progress bar. The upload is one multipart
          // POST, so XHR's upload.progress event is what actually moves the bar;
          // fetch has no upload progress at all, so XHR is the only way to show
          // the visitor something is happening while a 9 MB photo leaves their
          // phone. When there are no photos, the bar stays hidden.
          const hasPhotos = selectedPhotos.length > 0;
          if (hasPhotos && photoProgress && photoProgressBar) {
              photoProgress.classList.remove('hidden');
              photoProgressBar.style.width = '0%';
              if (photoProgressText) photoProgressText.textContent = 'Sending your photos…';
          }

          const sendMessage = function() {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', '/api/contact-quote');
              // No Content-Type header: the browser sets multipart/form-data with
              // its own boundary, and a hand-set header strips the boundary and
              // takes the photos with it.
              if (hasPhotos && photoProgressBar) {
                  xhr.upload.onprogress = (event) => {
                      if (!event.lengthComputable) return;
                      const percent = Math.max(0, Math.min(100, (event.loaded / event.total) * 100));
                      photoProgressBar.style.width = percent + '%';
                      if (photoProgressText && percent < 100) {
                          photoProgressText.textContent = `Sending your photos… ${Math.round(percent)}%`;
                      }
                  };
                  xhr.upload.onload = () => {
                      if (photoProgressBar) photoProgressBar.style.width = '100%';
                      if (photoProgressText) photoProgressText.textContent = 'Finalizing your request…';
                  };
              }

              xhr.onload = () => {
                  let responseOk = xhr.status >= 200 && xhr.status < 300;
                  let serverError = '';
                  if (!responseOk) {
                      try {
                          const data = JSON.parse(xhr.responseText || '{}');
                          serverError = data.error || '';
                      } catch {
                          serverError = '';
                      }
                  }

                  if (responseOk) {
                      // The certificate is one per customer, so spend it the
                      // moment the claim lands. This records it against their
                      // email address server-side and stops the offer being
                      // rendered for them on any page from here on.
                      if (claimedCertificate && email && window.AAAGiftCertificate) {
                          window.AAAGiftCertificate.markRedeemed(email, { name: name, source: 'contact_form' });
                      }

                      // The function handles the seasonal opt-in itself when the
                      // box is checked, so there is no second fetch to
                      // /api/seasonal-subscription here -- it would double-subscribe
                      // the visitor.

                      setStatus('Thank you! Your message is on its way and we will be in touch shortly.', 'success');
                      form.reset();
                      FIELDS.forEach(field => showFieldError(field, ''));
                      resetPhotoWidget();
                      if (servicePackageInfo) {
                          servicePackageInfo.classList.add('hidden');
                          servicePackageInfo.innerHTML = '';
                      }
                  } else {
                      setStatus(
                          serverError || "Sorry — your message didn't go through. Please call us at (248) 385-3432 or email contact@aaahandyman.services and we'll help right away.",
                          'error'
                      );
                      // Reset the progress bar on failure so it doesn't look like
                      // the upload is still going.
                      if (photoProgress) photoProgress.classList.add('hidden');
                      if (photoProgressBar) photoProgressBar.style.width = '0%';
                      if (photoProgressText) photoProgressText.textContent = '';
                  }
              };

              xhr.onerror = () => {
                  setStatus("Sorry — your message didn't go through. Please call us at (248) 385-3432 or email contact@aaahandyman.services and we'll help right away.", 'error');
                  if (photoProgress) photoProgress.classList.add('hidden');
                  if (photoProgressBar) photoProgressBar.style.width = '0%';
                  if (photoProgressText) photoProgressText.textContent = '';
              };

              xhr.onloadend = () => {
                  if (submitButton) {
                      submitButton.disabled = false;
                      submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
                  }
              };

              xhr.send(formData);
          };

          sendMessage();
      });
  }
})();
