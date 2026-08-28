import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { Exo_2, Plus_Jakarta_Sans } from 'next/font/google'
import { Providers } from './_components/Providers'
import { PWAInstallBanner } from './_components/PWAInstallBanner'

// ── Mantine CSS (must come before Tailwind in build order) ──────────────────
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/spotlight/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/dates/styles.css'
import 'mantine-datatable/styles.css'

import './globals.css'

const exo2 = Exo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-exo2',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
})

export const metadata: Metadata = {
  title: 'myfiti — Fitness Management System',
  description: 'The fitness management platform for modern gyms. Built for Africa.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${exo2.variable} ${plusJakarta.variable}`}>
      <body className={exo2.className}>
        <Providers>
          {children}
          <PWAInstallBanner />
        </Providers>
      </body>
    </html>
  )
}
