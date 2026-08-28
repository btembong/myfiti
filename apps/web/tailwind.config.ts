import type { Config } from 'tailwindcss'
import { nextui } from '@nextui-org/react'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    // NextUI component styles
    './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}',
    // Tremor component styles
    './node_modules/@tremor/react/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-exo2)', 'Exo 2', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── Shared brand token (used by HeroUI + Tremor via Tailwind) ────
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // ── CSS var-driven semantic tokens ───────────────────────────────
        bg:      'var(--color-bg)',
        surface: 'var(--color-surface)',
        border:  'var(--color-border)',
        accent: {
          DEFAULT:    'var(--color-accent)',
          foreground: 'var(--color-accent-fg)',
        },
        // ── shadcn compat ────────────────────────────────────────────────
        background: 'var(--color-bg)',
        foreground: 'var(--color-text-heading)',
        primary: {
          DEFAULT:    'var(--color-accent)',
          foreground: 'var(--color-accent-fg)',
        },
        muted: {
          DEFAULT:    'var(--violet-100)',
          foreground: 'var(--color-text-muted)',
        },
        card: {
          DEFAULT:    'var(--color-surface)',
          foreground: 'var(--color-text-heading)',
        },
        input: 'var(--color-border)',
        ring:  'var(--color-accent)',
        destructive: {
          DEFAULT:    '#ef4444',
          foreground: '#ffffff',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-up':        'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    nextui({
      themes: {
        light: {
          colors: {
            primary: {
              50:      '#eef2ff',
              100:     '#e0e7ff',
              200:     '#c7d2fe',
              300:     '#a5b4fc',
              400:     '#818cf8',
              500:     '#6366f1',
              600:     '#4f46e5',
              700:     '#4338ca',
              800:     '#3730a3',
              900:     '#312e81',
              DEFAULT: '#6366f1',
              foreground: '#ffffff',
            },
          },
        },
      },
    }),
  ],
}

export default config
