import tailwindcssAnimate from 'tailwindcss-animate'
import { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: {
          DEFAULT: 'var(--border)',
          subtle: 'var(--border-subtle)',
          soft: 'var(--border-soft)',
          muted: 'var(--border-muted)',
          strong: 'var(--border-strong)',
          emphasis: 'var(--border-emphasis)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: {
          DEFAULT: 'var(--background)',
          panel: 'var(--background-panel)',
        },
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          faint: 'var(--primary-faint)',
          soft: 'var(--primary-soft)',
          muted: 'var(--primary-muted)',
          emphasis: 'var(--primary-emphasis)',
          border: 'var(--primary-border)',
          'border-strong': 'var(--primary-border-strong)',
          hover: 'var(--primary-hover)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
          hover: 'var(--secondary-hover)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
          soft: 'var(--destructive-soft)',
          border: 'var(--destructive-border)',
          hover: 'var(--destructive-hover)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
          soft: 'var(--muted-soft)',
          strong: 'var(--muted-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
          hover: 'var(--card-hover)',
        },
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        overlay: 'var(--overlay)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        streak: 'var(--streak)',
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          'foreground-muted': 'var(--sidebar-foreground-muted)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
