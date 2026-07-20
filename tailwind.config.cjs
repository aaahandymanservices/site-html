module.exports = {
  darkMode: 'class',
  content: [
    './public/**/*.html',
    './public/**/*.js',
    './scripts/build-service-pages.mjs',
    './scripts/build-city-pages.mjs',
  ],
  theme: {
    extend: {
      colors: {
        red: {
          50: '#fdf2f2',
          100: '#fde8e8',
          200: '#fbd5d5',
          300: '#f8b4b4',
          400: '#f98080',
          500: '#e02424',
          600: '#8e1f26',
          700: '#751a1e',
          800: '#5c1417',
          900: '#461012',
        },
        blue: {
          50: '#f3f6f9',
          100: '#e7ecf2',
          200: '#c3cfde',
          300: '#9fb1ca',
          400: '#5776a2',
          500: '#0f3b79',
          600: '#0d2237',
          700: '#0a1b2c',
          800: '#081421',
          900: '#050e16',
          950: '#03070b',
        },
      },
    },
  },
  plugins: [],
};
