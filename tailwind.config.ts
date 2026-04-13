import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        moss: '#0f766e',
        sand: '#f8fafc',
      },
      boxShadow: {
        glow: '0 20px 80px rgba(15, 118, 110, 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;