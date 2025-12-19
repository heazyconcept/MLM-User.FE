/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'selector',
  theme: {
    extend: {
      fontFamily: {
        'geist': ['Geist', 'sans-serif'],
        'outfit': ['Outfit', 'sans-serif'],
        'poppins': ['Poppins', 'sans-serif'],
      },
      colors: {
        'mlm-primary': '#49A321', // Brand Primary Green
        'mlm-secondary': '#64748b', // Grey for secondary text
        'brand': {
          'green-light': '#DCEDC8',
          'green-primary': '#49A321',
          'green-dark': '#1B5E20',
          'gold': '#F9A825',
        },
        'mlm-success': '#22c55e',
        'mlm-error': '#ef4444',
        'mlm-warning': '#f59e0b',
        'mlm-background': '#f8fafc',
        'mlm-text': '#000000', // Black for main text
        'mlm-blue': {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        'mlm-red': {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
    },
  },
}

