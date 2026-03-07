import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#07080A',
          surface: '#0D0F12',
          'surface-2': '#13161B',
          'surface-3': '#191D24',
        },
        border: {
          DEFAULT: '#1C2028',
          hover: '#2A303C',
          active: '#3B82F6',
        },
        text: {
          primary: '#E8ECF1',
          secondary: '#8B95A5',
          muted: '#5A6478',
          inverse: '#07080A',
        },
        accent: {
          blue: '#3B82F6',
          'blue-hover': '#2563EB',
          'blue-dim': 'rgba(59,130,246,0.125)',
          indigo: '#818CF8',
          purple: '#C084FC',
        },
        success: { DEFAULT: '#34D399', dim: 'rgba(52,211,153,0.125)' },
        warning: { DEFAULT: '#FBBF24', dim: 'rgba(251,191,36,0.125)' },
        danger: { DEFAULT: '#FB7185', dim: 'rgba(251,113,133,0.125)' },
        info: '#38BDF8',
      },
      fontFamily: {
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.3)',
        md: '0 4px 12px rgba(0,0,0,0.4)',
        lg: '0 12px 40px rgba(0,0,0,0.5)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.3s ease-out',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-out-right': 'slideOutRight 0.15s ease-in',
      },
    },
  },
  plugins: [],
} satisfies Config;
