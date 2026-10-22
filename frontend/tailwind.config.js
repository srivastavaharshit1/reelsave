/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#19211f',
        muted: '#68736f',
        canvas: '#f7f8f6',
        accent: '#e36f4e',
        forest: '#244b3e',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 20px 60px -36px rgba(25, 33, 31, .24)' },
    },
  },
  plugins: [],
}
