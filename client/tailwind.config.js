/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tce: {
          navy: '#0A192F',
          dark: '#0D213F',
          blue: '#1E3A8A',
          lightBlue: '#3B82F6',
          crimson: '#8B0000',
          red: '#DC2626',
          gold: '#D97706',
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          border: '#E2E8F0'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
