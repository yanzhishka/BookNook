/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        stone: {
          50: '#fcfaf7',
          850: '#292524',
          950: '#0c0a09',
        },
      },
      animation: {
        aurora: 'aurora 25s linear infinite',
        float: 'float 8s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 5s ease-in-out infinite',
        grain: 'grain 8s steps(10) infinite',
      },
      keyframes: {
        aurora: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
          '33%': { transform: 'translate(5%, 10%) scale(1.1) rotate(2deg)' },
          '66%': { transform: 'translate(-5%, -5%) scale(0.9) rotate(-1deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-30px) rotate(1deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.3', filter: 'blur(30px)' },
          '50%': { opacity: '0.6', filter: 'blur(60px)' },
        },
        grain: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-5%, -5%)' },
          '20%': { transform: 'translate(-10%, 5%)' },
          '30%': { transform: 'translate(5%, -10%)' },
          '40%': { transform: 'translate(-5%, 15%)' },
          '50%': { transform: 'translate(-10%, 5%)' },
          '60%': { transform: 'translate(15%, 0)' },
          '70%': { transform: 'translate(0, 10%)' },
          '80%': { transform: 'translate(-15%, 0)' },
          '90%': { transform: 'translate(10%, 5%)' },
        },
      },
    },
  },
  plugins: [],
}
