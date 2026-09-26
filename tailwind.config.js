/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
      colors: {
        paper: {
          50: '#FAF9F6',
          100: '#F5F4F0',
          200: '#EAE8E1',
          300: '#DBD8CE',
          400: '#B8B4A5',
          800: '#2C2B29',
          900: '#1C1B1A',
        },
      }
    },
  },
  plugins: [],
}
