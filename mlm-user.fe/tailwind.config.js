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
        // Green scale (based on brand green)
        'mlm-green': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#49A321', // Primary
          600: '#3d8a1c',
          700: '#1B5E20', // Dark
          800: '#166534',
          900: '#14532d',
        },
        // Warm neutral (complements green)
        'mlm-warm': {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
        // Teal accent (harmonizes with green)
        'mlm-teal': {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
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

