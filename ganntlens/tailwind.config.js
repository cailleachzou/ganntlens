/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        phase1: '#dbeafe',
        phase2: '#fef3c7',
        phase3: '#d1fae5',
        today: '#ef4444',
        milestone: '#f97316',
        milestoneDone: '#10b981'
      }
    }
  },
  plugins: []
}
