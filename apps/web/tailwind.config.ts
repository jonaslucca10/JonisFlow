import type { Config } from 'tailwindcss';

// Cores extraídas da logo (análise pixel do logo.png):
//  - fundo/navy dominante: #0b1328
//  - accent teal: #3a7d8d
// Shades derivados para profundidade/hover sem desviar do logo.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#0b1328',
          dark: '#070b1c',
          accent: '#3a7d8d',
          'accent-light': '#5a9fb0',
          'accent-dark': '#2c6070',
          'accent-soft': '#e8f2f4',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,19,40,.04), 0 8px 24px -12px rgba(11,19,40,.12)',
        'card-hover': '0 2px 4px rgba(11,19,40,.06), 0 16px 40px -16px rgba(11,19,40,.20)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .6s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
