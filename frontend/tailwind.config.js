/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent-primary)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--error)',
        contrast: 'var(--chart-contrast)',
        'on-accent': 'var(--text-on-accent)',
      },
      backgroundColor: {
        primary: 'var(--bg-primary)',
        surface: 'var(--bg-primary)',
        'surface-2': 'var(--bg-secondary)',
        'surface-3': 'var(--bg-tertiary)',
        hover: 'var(--bg-hover)',
        overlay: 'var(--overlay)',
        accent: 'var(--accent-primary)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--error)',
        input: 'var(--input-bg)',
        'input-muted': 'var(--input-muted-bg)',
      },
      borderColor: {
        primary: 'var(--border-primary)',
        secondary: 'var(--border-secondary)',
        accent: 'var(--accent-primary)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--error)',
      },
      ringColor: {
        focus: 'var(--focus-ring)',
        accent: 'var(--accent-primary)',
      },
      accentColor: {
        primary: 'var(--accent-primary)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--error)',
      },
      divideColor: {
        primary: 'var(--border-primary)',
        secondary: 'var(--border-secondary)',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
