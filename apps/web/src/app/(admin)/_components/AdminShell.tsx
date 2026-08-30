'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, getTenantSlug, setTenantSlug, decodeToken, isTokenExpired, clearToken } from '@/lib/auth'
import { api } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { Cancel01Icon } from 'hugeicons-react'
import { Spotlight, spotlight } from '@mantine/spotlight'
import { SidebarProvider, useSidebar } from './SidebarContext'
import { RightPanelProvider, useRightPanel } from './RightPanelContext'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

// ─── Spotlight action data ────────────────────────────────────────────────────

function useSpotlightActions() {
  const router = useRouter()
  return [
    { id: 'dashboard',     label: 'Dashboard',      description: 'Go to the main dashboard',         onClick: () => router.push('/dashboard') },
    { id: 'analytics',     label: 'Analytics',      description: 'View growth and revenue analytics', onClick: () => router.push('/analytics') },
    { id: 'members',       label: 'Members',         description: 'Manage your gym members',          onClick: () => router.push('/members') },
    { id: 'subscriptions', label: 'Subscriptions',   description: 'View and manage subscriptions',    onClick: () => router.push('/subscriptions') },
    { id: 'checkins',      label: 'Check-ins',       description: 'Monitor member check-ins',         onClick: () => router.push('/checkins') },
    { id: 'payments',      label: 'Payments',        description: 'View payment history',             onClick: () => router.push('/payments') },
    { id: 'communication', label: 'Communication',   description: 'Send messages to members',         onClick: () => router.push('/communication') },
    { id: 'settings',      label: 'Settings',        description: 'Configure your gym settings',      onClick: () => router.push('/settings') },
    { id: 'billing',       label: 'Billing & Plan',  description: 'Manage your Gymflow subscription', onClick: () => router.push('/settings/billing') },
    { id: 'staff',         label: 'Staff & Access',  description: 'Invite and manage staff members',   onClick: () => router.push('/settings/staff') },
    { id: 'integrations',  label: 'Integrations',    description: 'Connect third-party services',      onClick: () => router.push('/settings/integrations') },
    { id: 'help',          label: 'Help & Docs',     description: 'Guides, FAQs, and support',        onClick: () => router.push('/help') },
    { id: 'kiosk',         label: 'Kiosk Setup',     description: 'Get the kiosk URL and QR code',    onClick: () => router.push('/settings/kiosk') },
    { id: 'day-passes',    label: 'Day Pass Prices', description: 'Configure day pass pricing',        onClick: () => router.push('/settings/day-passes') },
  ]
}

// ─── Export for Topbar to call ────────────────────────────────────────────────

export { spotlight }

// ─── Inner shell ─────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode
  gymName?: string
  ownerName?: string
  ownerInitial?: string
  plan?: string
}

function Shell({ children, gymName, ownerName, ownerInitial, plan }: Props) {
  const { collapsed } = useSidebar()
  const { isOpen, content, title, close } = useRightPanel()
  const actions = useSpotlightActions()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f4f5f9' }}>
      <Sidebar gymName={gymName} ownerName={ownerName} ownerInitial={ownerInitial} plan={plan} />

      {/* ── Main column ── */}
      <motion.div
        animate={{ marginLeft: collapsed ? 64 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
      >
        <Topbar ownerName={ownerName} ownerInitial={ownerInitial} />

        {/* Content row — splits when right panel is open */}
        <div className="flex flex-1 overflow-hidden" style={{ paddingTop: 56 }}>
          <main className="flex-1 min-w-0 overflow-y-auto">
            {children}
          </main>

          {/* ── Right detail panel ── */}
          <AnimatePresence>
            {isOpen && (
              <motion.aside
                key="right-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 420, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                className="shrink-0 flex flex-col overflow-hidden"
                style={{ borderLeft: '1px solid #edeef4', background: '#ffffff' }}
              >
                <div className="w-[420px] h-full flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 shrink-0"
                    style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <p className="text-sm font-black" style={{ color: '#1e1b4b' }}>{title}</p>
                    <button onClick={close}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100">
                      <Cancel01Icon size={14} style={{ color: '#6b7280' }} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">{content}</div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Mantine Spotlight (⌘K) ── */}
      <Spotlight
        actions={actions}
        shortcut={['mod + K', '/']}
        nothingFound="No results — try searching for a page or action"
        highlightQuery
        searchProps={{
          placeholder: 'Search pages, members, actions…',
        }}
        styles={{
          root:    { zIndex: 9998 },
          content: { borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.14)', border: '1px solid #edeef4' },
          search:  { fontFamily: 'var(--font-exo2)', fontSize: 14, fontWeight: 500 },
          action:  { borderRadius: 10 },
          actionLabel: { fontWeight: 600 },
        }}
      />
    </div>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ownerName,    setOwnerName]    = useState('Owner')
  const [ownerInitial, setOwnerInitial] = useState('O')
  const [gymName,      setGymName]      = useState('My Gym')
  const [plan,         setPlan]         = useState('starter')

  useEffect(() => {
    const token = getToken()
    if (!token || isTokenExpired(token)) {
      clearToken()
      router.replace('/login')
      return
    }

    // Derive owner display name from JWT
    const payload = decodeToken(token)
    const name  = payload?.name  as string | undefined
    const email = payload?.email as string | undefined
    const displayName = name || (email ? email.split('@')[0] : 'Owner')
    setOwnerName(displayName)
    setOwnerInitial(displayName.charAt(0).toUpperCase())

    // Resolve tenant slug
    let slug = getTenantSlug()
    if (!slug) {
      const jwtSlug = payload?.tenant_slug as string | null | undefined
      if (jwtSlug) { setTenantSlug(jwtSlug); slug = jwtSlug }
    }
    if (!slug) { router.replace('/onboarding'); return }

    // Fetch gym name + plan from settings
    api.get<{ gym_name?: string; plan?: string }>('/api/settings')
      .then(d => {
        if (d.gym_name) setGymName(d.gym_name)
        if (d.plan) setPlan(d.plan)
      })
      .catch(() => {})
  }, [router])

  return (
    <SidebarProvider>
      <RightPanelProvider>
        <Shell gymName={gymName} ownerName={ownerName} ownerInitial={ownerInitial} plan={plan}>
          {children}
        </Shell>
      </RightPanelProvider>
    </SidebarProvider>
  )
}
