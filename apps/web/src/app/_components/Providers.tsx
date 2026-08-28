'use client'

// Must be imported before any Mantine imports — patches React.useEffectEvent
// which Next.js's canary React bundle does not export.
import '@/lib/react-polyfill'

import { type ReactNode } from 'react'
import { NextUIProvider } from '@nextui-org/react'

import { MantineProvider, createTheme } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'

// ─── Shared indigo theme — matches brand token in tailwind.config ─────────────

const mantineTheme = createTheme({
  primaryColor: 'indigo',
  colors: {
    indigo: [
      '#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc',
      '#818cf8', '#6366f1', '#4f46e5', '#4338ca',
      '#3730a3', '#312e81',
    ],
  },
  fontFamily: 'var(--font-exo2), Exo 2, system-ui, sans-serif',
  defaultRadius: 'md',
  radius: {
    xs: '0.375rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
  },
  shadows: {
    xs: '0 1px 4px rgba(0,0,0,0.05)',
    sm: '0 1px 8px rgba(0,0,0,0.07)',
    md: '0 4px 16px rgba(0,0,0,0.08)',
    lg: '0 8px 32px rgba(0,0,0,0.10)',
    xl: '0 16px 48px rgba(0,0,0,0.12)',
  },
  components: {
    Button: {
      defaultProps: { radius: 'md' },
    },
    Input: {
      defaultProps: { radius: 'md' },
    },
    Modal: {
      defaultProps: { radius: 'lg', centered: true },
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextUIProvider>
      <MantineProvider theme={mantineTheme} defaultColorScheme="light">
        <ModalsProvider>
          <Notifications
            position="top-right"
            zIndex={9999}
            containerWidth={360}
            notificationMaxHeight={200}
          />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </NextUIProvider>
  )
}
