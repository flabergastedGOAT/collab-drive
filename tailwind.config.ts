import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      transitionProperty: { width: 'width' },
    },
  },
  plugins: [],
} satisfies Config;
