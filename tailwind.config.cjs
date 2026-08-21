module.exports = {
  /*
   * The site has one theme and it is the light one. Nothing renders a `dark`
   * class on `html`, so this setting emits no dark variants at all -- which is
   * the point of keeping it. The alternative, Tailwind's `media` default, would
   * hand any stray `dark:` utility straight to the visitor's OS preference and
   * quietly reintroduce a second theme nobody designed or reviewed.
   */
  darkMode: 'class',
  content: [
    './public/**/*.html',
    './public/**/*.js',
    // The browser scripts' own sources. public/js/*.js above is only the
    // minified copy that build-js.mjs emits, and build-css.mjs runs before it,
    // so scanning the output alone means a first build on a clean checkout
    // classifies last deploy's class names. Several of these files build markup
    // from class-name strings -- the review cards and the owner's admin
    // controls in reviews-page.js, the quick-view dialog in home.js -- and a
    // class Tailwind never sees is a class that is not in the stylesheet.
    './scripts/js/**/*.js',
    // The nav markup lives in a shared module rather than in the generated
    // pages, and the CSS build runs before those pages exist, so it has to be
    // scanned directly or its utilities never reach the stylesheet.
    './scripts/unified-nav.mjs',
    './scripts/build-service-pages.mjs',
    './scripts/build-city-pages.mjs',
  ],
  theme: {
    extend: {
      /*
       * `transition` is Tailwind's catch-all utility and this site uses it on
       * roughly 150 elements per page. Its default property list includes
       * `box-shadow`, which the compositor cannot animate: a hovered card
       * crossfading `shadow-md` into `shadow-xl` re-rasterises the blurred
       * shadow on the main thread every frame, and hovering across a service
       * grid multiplies that by the number of cards. The list below is the
       * upstream default minus `box-shadow`, so `hover:shadow-*` still applies,
       * just instantly. Anything that genuinely needs an animated shadow can
       * still opt in with `transition-shadow`.
       */
      transitionProperty: {
        DEFAULT:
          'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, transform, filter, backdrop-filter',
      },
      colors: {
        /*
         * The brand is navy #1B2A4A and crimson #A61F2E. Both scales below are
         * built around those two: `blue-900` is the navy and `red-600` is the
         * crimson, with the rest of each ramp mixed toward white and black so
         * a tint or shade of the brand colour is always a utility class away.
         *
         * An `amber` ramp and a `craftsman` gold set used to live here, with
         * `amber-500` remapped to #F5A623. Nothing in the brand called for a
         * third accent, and in practice the gold displaced crimson on CTAs,
         * badges, and card hovers across every page. Both are gone; anything
         * that reached for gold now reaches for `red-*`. Removing the `amber`
         * override also means the name is simply undefined rather than
         * silently resolving to an off-brand gold if it ever reappears.
         */
        red: {
          50: '#fdf2f2',
          100: '#f8e9eb',
          200: '#efc8cd',
          300: '#df929c',
          400: '#c95160',
          500: '#b83242',
          600: '#a61f2e',
          700: '#7f1723',
          800: '#68151e',
          900: '#521219',
          /* The markup uses `red-950` (deep crimson panels behind light text).
             Without an entry here it deep-merged to Tailwind's stock #450a0a,
             which is browner than this ramp and read as a mismatch next to
             `red-900`. */
          950: '#3a0d12',
        },
        blue: {
          50: '#f4f6fa',
          100: '#e8edf5',
          200: '#cbd6e6',
          300: '#a5b7d1',
          400: '#7892b7',
          500: '#55749f',
          600: '#3d5985',
          700: '#30476d',
          800: '#26395a',
          900: '#1b2a4a',
          950: '#101b31',
        },
        green: {
          600: '#166534',
          700: '#14532d',
        },
        emerald: {
          600: '#047857',
          700: '#065f46',
        },
      },
    },
  },
  plugins: [],
};
