/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      boxShadow: {
        brutal: '5px 5px 0 #000',
        'brutal-lg': '8px 8px 0 #000',
        'brutal-sm': '3px 3px 0 #000',
      },
    },
  },
  plugins: [],
};
