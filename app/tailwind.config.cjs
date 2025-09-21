/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx}',
    './content/**/*.{md,mdx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        'cyberpunk': {
          'bg-dark': '#0A0A0F',
          'surface': '#1A1B2E',
          'neon-blue': '#00F6FF',
          'neon-pink': '#FF00D4',
          'accent-purple': '#7A00FF',
          'accent-lime': '#B6FF00',
          'neutral-light': '#C5C6FF',
          'neutral-mid': '#8A8DAA',
          'warning': '#FF5E00',
        }
      },
      boxShadow: {
        'neon-blue': '0 0 5px #00F6FF, 0 0 10px #00F6FF, 0 0 15px #00F6FF',
        'neon-pink': '0 0 5px #FF00D4, 0 0 10px #FF00D4, 0 0 15px #FF00D4',
        'neon-purple': '0 0 5px #7A00FF, 0 0 10px #7A00FF, 0 0 15px #7A00FF',
        'neon-lime': '0 0 5px #B6FF00, 0 0 10px #B6FF00, 0 0 15px #B6FF00',
      },
      animation: {
        'pulse-neon': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          'from': {
            textShadow: '0 0 5px #00F6FF, 0 0 10px #00F6FF, 0 0 15px #00F6FF, 0 0 20px #00F6FF',
          },
          'to': {
            textShadow: '0 0 2px #00F6FF, 0 0 5px #00F6FF, 0 0 8px #00F6FF, 0 0 12px #00F6FF',
          }
        }
      }
    },
  },
  plugins: [],
};
