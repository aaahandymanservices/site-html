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
          100: '#f8e9eb',
          200: '#efc8cd',
          300: '#df929c',
          400: '#c95160',
          500: '#b83242',
          600: '#a61f2e',
          700: '#7f1723',
          800: '#68151e',
          900: '#521219',
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
      },
    },
  },
  plugins: [],
};
