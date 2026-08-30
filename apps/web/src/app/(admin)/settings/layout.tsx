'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Settings01Icon,
  Building01Icon,
  CreditCardIcon,
  Notification01Icon,
  UserGroupIcon,
  Plug01Icon,
  Alert01Icon,
  ArrowRight01Icon,
  Medal01Icon,
  Tv01Icon,
  SaleTag01Icon,
} from 'hugeicons-react'

const NAV = [
  { label: 'General',        href: '/settings',                  icon: Settings01Icon },
  { label: 'Gym Profile',    href: '/settings/profile',          icon: Building01Icon },
  { label: 'Brand',          href: '/settings/brand',            icon: Medal01Icon },
  { label: 'Billing & Plan', href: '/settings/billing',          icon: CreditCardIcon },
  { label: 'Notifications',  href: '/settings/notifications',    icon: Notification01Icon },
  { label: 'Staff & Access', href: '/settings/staff',            icon: UserGroupIcon },
  { label: 'Integrations',   href: '/settings/integrations',     icon: Plug01Icon },
  { label: 'Kiosk',          href: '/settings/kiosk',            icon: Tv01Icon },
  { label: 'Day Pass Prices',href: '/settings/day-passes',       icon: SaleTag01Icon },
]

const DANGER = { label: 'Danger zone', href: '/settings/danger', icon: Alert01Icon }

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const path = usePathname()

  return (
    <div className="flex h-full min-h-full">

      {/* ── Secondary sub-nav ── */}
      <aside className="w-56 shrink-0 flex flex-col py-6 px-3 overflow-y-auto"
        style={{ borderRight: '1px solid #edeef4', background: '#fafbfc' }}>

        <p className="text-[9px] font-black uppercase tracking-[0.18em] px-3 mb-3"
          style={{ color: '#c0c5d0' }}>
          Settings
        </p>

        <div className="space-y-0.5 flex-1">
          {NAV.map(item => {
            const active = path === item.href
            const Icon = item.icon
            return (
              <div key={item.href} className="relative">
                <Link href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative"
                  style={{
                    background: active ? '#eef2ff' : 'transparent',
                    color: active ? '#4f46e5' : '#6b7280',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f4f5f9' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  {active && (
                    <motion.span layoutId="settings-pill"
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                      style={{ background: '#6366f1' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
                  )}
                  <Icon size={17} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ArrowRight01Icon size={12} style={{ color: '#a5b4fc' }} />}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Danger zone at bottom */}
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #edeef4' }}>
          <Link href={DANGER.href}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ color: '#ef4444' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fff1f2')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <DANGER.icon size={17} />
            {DANGER.label}
          </Link>
        </div>
      </aside>

      {/* ── Settings content area ── */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
