/*
 * Behaviour for /careers: validation and submission of the application form.
 *
 * Lifted out of an inline <script> in public/careers.html for the same reasons
 * as the other page scripts -- see scripts/js/contact-page.js.
 */

(function () {
  const careersForm = document.getElementById('careers-form');
  const careersSubmit = document.getElementById('careers-submit');
  const careersStatus = document.getElementById('careers-message-status');

  /*
   * The old failure message told applicants to call or email without giving them
   * either the number or the address, so the way out dead-ended. Both are here
   * now, matching what the contact form already does.
   *
   * The success message names a channel and a timeframe for the same reason: an
   * applicant told only that they will be contacted "soon" has no idea whether
   * that means a day or a month.
   */
  const CAREERS_SENT_MESSAGE =
      "Thanks! We've got your application. Victor reviews these personally and will call or email within a few business days.";
  const CAREERS_FAILED_MESSAGE =
      "Your application didn't go through. Call (248) 385-3432 or email contact@aaahandyman.services and we'll take it down directly.";

  if (careersForm) {
      const setCareersStatus = (text, isError) => {
          if (!careersStatus) return;
          careersStatus.textContent = text;
          careersStatus.className = `text-sm font-semibold ${isError ? 'text-red-600' : 'text-green-700'}`;
          careersStatus.classList.remove('hidden');
      };

      careersForm.addEventListener('submit', function(e) {
          e.preventDefault();

          const submitApplication = function() {
              if (careersSubmit) {
                  careersSubmit.disabled = true;
                  careersSubmit.classList.add('opacity-70', 'cursor-not-allowed');
              }
              setCareersStatus('Sending your application…', false);
              fetch('/careers.html', {
                  method: 'POST',
                  body: new FormData(careersForm)
              })
              .then(response => {
                  if (response.ok) {
                      setCareersStatus(CAREERS_SENT_MESSAGE, false);
                      careersForm.reset();
                  } else {
                      setCareersStatus(CAREERS_FAILED_MESSAGE, true);
                  }
              })
              .catch(() => {
                  setCareersStatus(CAREERS_FAILED_MESSAGE, true);
              })
              .finally(() => {
                  if (careersSubmit) {
                      careersSubmit.disabled = false;
                      careersSubmit.classList.remove('opacity-70', 'cursor-not-allowed');
                  }
              });
          };

          submitApplication();
      });
  }
  const careersFelony = document.getElementById('careers-felony');
  const careersFelonyWrap = document.getElementById('careers-felony-details-wrap');
  if (careersFelony && careersFelonyWrap) {
      careersFelony.addEventListener('change', function () {
          careersFelonyWrap.classList.toggle('hidden', careersFelony.value !== 'Yes');
      });
  }
  const careersPhone = document.getElementById('careers-phone');
  if (careersPhone) {
      careersPhone.addEventListener('input', function (e) {
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
})();
