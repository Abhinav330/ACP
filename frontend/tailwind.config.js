/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{css}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#16588e',
      },
    },
  },
  plugins: [],
}
