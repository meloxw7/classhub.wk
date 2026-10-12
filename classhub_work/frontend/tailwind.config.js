/** @type {import('tailwindcss').Config} */ module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef7ff', 100: '#d9edff', 500: '#1683ff', 600: '#0b6fe4', 700: '#0759bd' },
        ink: '#102033',
      },
    },
  },
  plugins: [],
};
