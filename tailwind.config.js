// Tailwind is compiled at build time instead of loading the Play CDN script in the
// browser. A remote script runs with this app's full privileges, including any
// credentials held in browser storage.
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
