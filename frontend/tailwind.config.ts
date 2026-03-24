/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          100: '#E8F5EF',
          400: '#48A07A',
          500: '#2E7D5E',
          600: '#25674D',
        },
        accent: {
          100: '#FEF3DC',
          500: '#E8A838',
        },
        danger: {
          100: '#FDEDEC',
          500: '#C0392B',
        },
        success: {
          500: '#27AE60',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '12px',
        modal: '16px',
      },
    },
  },
  plugins: [],
}
