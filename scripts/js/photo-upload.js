/*
 * One rule for every photo uploader on the site: JPG, PNG, WebP or GIF, 10 MB
 * max each.
 *
 * Six forms take photos -- the home quote form, /contact, /ai-estimate, /book,
 * /customer-care and the review submitter -- and before this file each one
 * carried its own copy of the accept list, its own size ceiling (5, 7 or 10 MB
 * depending on the page), and its own near-identical canvas downscaling loop.
 * They drifted: /book turned away GIFs, /contact advertised HEIC, the home form
 * accepted image/* and validated nothing at all. Anything that is the same on
 * all six lives here now, so the next change lands in one place.
 *
 * This is a plain script, not a module -- same as every other file in this
 * directory -- so it publishes one explicit window property and the page
 * scripts read it from there. It must load before them; see the SCRIPT_VERSIONS
 * list in scripts/update-static-pages.mjs and the <script> tags on each page.
 *
 * Two numbers matter and they are not the same number:
 *
 *   MAX_BYTES (10 MB) is what the visitor is allowed to pick. It is the
 *   promise the label makes.
 *
 *   The upload budget is what may actually go on the wire, and it is set by
 *   whatever receives the form -- roughly 6 MB for a buffered Netlify function,
 *   8 MB for a Netlify Forms post, both counting the text fields and multipart
 *   overhead too. Each caller passes its own budget to prepare().
 *
 * prepare() is the bridge between them: a 10 MB photo off a phone is resized
 * and re-encoded until it fits the caller's budget, so the 10 MB promise holds
 * even where only 4 MB can be transmitted.
 */
(function () {
  'use strict';

  var MAX_BYTES = 10 * 1024 * 1024;

  // Order matters only for readability; the browser treats it as a set.
  var TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  // The `accept` attribute for every photo <input type=file> on the site.
  //
  // Listing concrete types rather than image/* is also what makes iPhone
  // uploads work: iOS transcodes HEIC to JPEG on the way out when the accept
  // list does not name HEIC, and hands over the original when it does. Naming
  // the four types is therefore friendlier to iPhone visitors than the
  // image/heic entry /contact used to carry.
  var ACCEPT = TYPES.join(',');

  // Files dragged from a file manager sometimes arrive with an empty `type`
  // (no OS mapping, or a copy that lost it), so the extension is a fallback
  // rather than a second gate -- either one passing is enough.
  var EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;

  // The exact wording under every dropzone. Kept as one string so the six
  // pages cannot describe the same rule six ways.
  var RULE = 'JPG, PNG, WebP or GIF · 10 MB max each';

  // Canvas re-encoding starts here and steps down until the file fits.
  var START_DIMENSION = 2000;
  var START_QUALITY = 0.85;
  var MIN_QUALITY = 0.5;
  var MAX_ATTEMPTS = 5;

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function isAccepted(file) {
    if (!file) return false;
    return TYPES.indexOf(file.type) !== -1 || EXTENSIONS.test(file.name || '');
  }

  /*
   * Returns the message to show the visitor, or '' when the file is fine.
   * Naming the file matters when several were picked at once -- "one of your
   * photos is too large" leaves them guessing which.
   */
  function rejectionFor(file) {
    if (!file) return '';
    var name = file.name ? '"' + file.name + '"' : 'That file';
    if (!isAccepted(file)) {
      return name + ' isn\'t a supported format. Please choose a JPG, PNG, WebP or GIF image.';
    }
    if (file.size === 0) {
      return name + ' looks empty. Please pick a different photo.';
    }
    if (file.size > MAX_BYTES) {
      // Rounded up on purpose. A file one byte over the limit is 10.000001 MB,
      // and to the nearest tenth that prints as "is 10.0 MB, which is over the
      // 10 MB limit" -- a sentence that argues with itself. Ceiling never
      // reads as equal to the limit it just exceeded.
      var overBy = Math.ceil((file.size / (1024 * 1024)) * 10) / 10;
      return name + ' is ' + overBy.toFixed(1) + ' MB, which is over the 10 MB limit.';
    }
    return '';
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('That image could not be read. Please try a different photo.'));
      };
      img.src = url;
    });
  }

  function toJpeg(canvas, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
  }

  /*
   * Shrink `file` until it fits `budgetBytes`, returning the original
   * untouched when it already does.
   *
   * A GIF is never redrawn. A canvas round-trip keeps frame one and silently
   * discards the animation, which is a worse outcome than an honest error, so
   * an oversized GIF is refused with a message that says what to do instead.
   * Under the budget it passes through as-is, animation intact.
   *
   * Throws on failure so callers can surface `error.message` directly.
   */
  function prepare(file, budgetBytes) {
    var budget = budgetBytes || MAX_BYTES;

    if (!(file instanceof File) || file.size === 0) return Promise.resolve(file);
    if (file.size <= budget) return Promise.resolve(file);

    if (file.type === 'image/gif' || /\.gif$/i.test(file.name || '')) {
      var gifError = new Error(
        'Animated GIFs can’t be resized in your browser, and this one is ' +
        formatBytes(file.size) + '. Please save it as a JPG or PNG first, or pick a smaller GIF.'
      );
      // Callers that replace decode failures with their own wording still want
      // this one through: it names a fix the visitor can act on, where the
      // others are indistinguishable ways the browser gave up.
      gifError.code = 'gif-too-large';
      return Promise.reject(gifError);
    }

    var tooBig = new Error(
      'That photo is too large to send. Please choose a smaller one, or save it as a JPG first.'
    );

    return loadImage(file).then(function (img) {
      var dimension = START_DIMENSION;
      var quality = START_QUALITY;

      // Each pass shrinks harder. A handful of rounds brings any camera photo
      // under the budget without visibly softening a normal one.
      var attempt = function (n) {
        if (n >= MAX_ATTEMPTS) throw tooBig;

        var scale = Math.min(1, dimension / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        var ctx = canvas.getContext('2d');
        if (!ctx) throw tooBig;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        return toJpeg(canvas, quality).then(function (blob) {
          if (!blob) throw tooBig;
          if (blob.size <= budget) {
            var name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
            return new File([blob], name, { type: 'image/jpeg' });
          }
          dimension = Math.round(dimension * 0.75);
          quality = Math.max(MIN_QUALITY, quality - 0.1);
          return attempt(n + 1);
        });
      };

      return attempt(0);
    });
  }

  window.AAAPhotoUpload = {
    TYPES: TYPES.slice(),
    ACCEPT: ACCEPT,
    EXTENSIONS: EXTENSIONS,
    MAX_BYTES: MAX_BYTES,
    RULE: RULE,
    formatBytes: formatBytes,
    isAccepted: isAccepted,
    rejectionFor: rejectionFor,
    prepare: prepare,
  };
})();
