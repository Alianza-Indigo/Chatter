import type { Config } from 'tailwindcss';

/**
 * Paleta Whalabi: índigo + lavanda + gris oscuro + blanco.
 * Los colores de marca se pueden sobreescribir por tenant vía CSS variables
 * (--whalabi-primary / --whalabi-accent) aplicadas en runtime.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colores de marca por tenant. Se definen como triplete RGB en una CSS
        // variable para que funcionen los modificadores de opacidad (bg-brand/10).
        brand: {
          DEFAULT: 'rgb(var(--whalabi-primary-rgb, 79 70 229) / <alpha-value>)',
          accent: 'rgb(var(--whalabi-accent-rgb, 167 139 250) / <alpha-value>)',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        lavender: {
          300: '#c4b5fd',
          400: '#a78bfa',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
