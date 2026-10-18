import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
try {
  require.resolve('@tailwindcss/postcss');
} catch {
  throw new Error('Tailwind is not installed. Run `npm install` in C:\\QuantaCore, then restart Quanta.');
}

export default {
  plugins: { '@tailwindcss/postcss': {} },
};
