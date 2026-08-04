/*
 * Behaviour for /customer-care: phone formatting, validation, the photo size
 * guard, and submission of the issue intake form.
 *
 * Built to mirror contact-page.js, because the two forms have the same job and
 * a visitor who has used one should recognise the other. The one real
 * difference is the file input: this form posts as multipart/form-data, so the
 * request cannot be url-encoded the way the enquiry form's is.
 */

(function () {
  const carePhone = document.getElementById('care-phone');
  if (carePhone) {
      carePhone.addEventListener('input', function (e) {
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

  // A guarantee page CTA can arrive here with the category already decided, so
  // honour ?category= when it names one of the options we actually offer.
  (function prefillCategory() {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('category');
      const select = document.getElementById('care-category');
      if (!requested || !select) return;
      const match = Array.from(select.options).find(
          option => option.value.toLowerCase() === requested.toLowerCase()
      );
      if (match) select.value = match.value;
  })();

  const form = document.getElementById('care-form');
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const status = document.getElementById('care-form-status');

  /*
   * The form carries `novalidate`, so none of this duplicates the browser.
   * Native validation puts one bubble on one field, dismisses it on the next
   * keystroke, and is never read by a screen reader that is not focused on that
   * field. Every rule below writes its message into a paragraph the field
   * already points at with aria-describedby, so the whole set is announced on
   * focus and stays on screen until it is fixed.
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

  // A phone number is only usable if it can actually be dialled, so the check
  // is on the digit count rather than on the punctuation added above.
  const digitsOf = (value) => value.replace(/\D/g, '');

  const FIELDS = [
      {
          id: 'care-name',
          label: 'Your name',
          validate: (value) => value.length >= 2
              ? ''
              : 'Please enter your full name.'
      },
      {
          id: 'care-phone',
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
          id: 'care-email',
          label: 'Your email address',
          validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
              ? ''
              : 'Please enter an email address we can reply to, e.g. you@example.com.'
      },
      {
          id: 'care-category',
          label: 'The issue category',
          validate: (value) => value ? '' : 'Please choose the category that fits best.'
      },
      {
          id: 'care-description',
          label: 'Your description of the concern',
          validate: (value) => value.length >= 10
              ? ''
              : 'Please tell us what happened — at least a sentence.'
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
      // Nothing is flagged before the visitor has had a go at it: `blur` for a
      // first pass, then `input`/`change` to clear the message the moment it
      // stops being true rather than on the next submit.
      input.addEventListener('blur', () => validateField(field));
      const liveEvent = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(liveEvent, () => {
          if (input.getAttribute('aria-invalid') === 'true') validateField(field);
      });
  });

  /*
   * Netlify Forms rejects the whole request over 8MB, and a photo straight off
   * a modern phone can clear that on its own. Catching it here means the
   * visitor is told which file is the problem while they still have the form in
   * front of them, instead of losing a filled-in report to an opaque failure.
   * The ceiling is set below the platform limit to leave room for the text
   * fields and the multipart boundaries.
   */
  const MAX_PHOTO_BYTES = 7 * 1024 * 1024;
  const photoInput = document.getElementById('care-photo');
  const photoError = document.getElementById('care-photo-error');

  const showPhotoError = (message) => {
      if (!photoInput) return '';
      if (message) {
          photoInput.setAttribute('aria-invalid', 'true');
          if (photoError) {
              photoError.textContent = message;
              photoError.classList.remove('hidden');
          }
      } else {
          photoInput.removeAttribute('aria-invalid');
          if (photoError) {
              photoError.textContent = '';
              photoError.classList.add('hidden');
          }
      }
      return message;
  };

  const validatePhoto = () => {
      const file = photoInput && photoInput.files && photoInput.files[0];
      if (!file) return showPhotoError('');
      if (file.size > MAX_PHOTO_BYTES) {
          const megabytes = (file.size / (1024 * 1024)).toFixed(1);
          return showPhotoError(
              `That image is ${megabytes} MB, which is over the 7 MB limit. Please attach a smaller one, or email it to contact@aaahandyman.services.`
          );
      }
      return showPhotoError('');
  };

  if (photoInput) photoInput.addEventListener('change', validatePhoto);

  form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitButton && submitButton.disabled) return;

      const invalid = FIELDS.filter(field => validateField(field));
      const photoProblem = validatePhoto();

      if (invalid.length || photoProblem) {
          if (photoProblem && !invalid.length) {
              setStatus(photoProblem, 'error');
              if (photoInput) {
                  photoInput.focus();
                  photoInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
              return;
          }
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

      /*
       * No Content-Type header, and the body stays a FormData rather than being
       * url-encoded: the browser has to set multipart/form-data itself so it
       * can put the boundary in, and a hand-set header would strip it and take
       * the photo with it.
       */
      fetch('/customer-care.html', {
          method: 'POST',
          body: new FormData(form)
      })
      .then(response => {
          if (response.ok) {
              setStatus(
                  'Thank you — your report is in. We will acknowledge it within 24 business hours, and sooner if we can.',
                  'success'
              );
              form.reset();
              FIELDS.forEach(field => showFieldError(field, ''));
              showPhotoError('');
          } else {
              setStatus(
                  "Sorry — your report didn't go through. Please call us at (248) 385-3432 or email contact@aaahandyman.services and we'll pick it up right away.",
                  'error'
              );
          }
      })
      .catch(() => {
          setStatus(
              "Sorry — your report didn't go through. Please call us at (248) 385-3432 or email contact@aaahandyman.services and we'll pick it up right away.",
              'error'
          );
      })
      .finally(() => {
          if (submitButton) {
              submitButton.disabled = false;
              submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
          }
      });
  });
})();
