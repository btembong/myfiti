'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DashboardSquare01Icon,
  Building01Icon,
  UserGroupIcon,
  Wallet01Icon,
  CreditCardIcon,
  HelpCircleIcon,
  Plug01Icon,
  Notebook01Icon,
  Settings01Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  Logout01Icon,
  Search01Icon,
  MailSend01Icon,
  Notification01Icon,
  ShieldKeyIcon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  InformationCircleIcon,
  Activity01Icon,
  Target01Icon,
  LinkSquare01Icon,
  UserMultiple02Icon,
  ViewIcon,
  ViewOffIcon,
  Invoice01Icon,
  RepeatIcon,
} from 'hugeicons-react'
import { getSuperToken, setSuperToken, clearSuperToken } from '@/lib/auth'
import { superApi } from '@/lib/api'

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    group: 'Overview',
    items: [{ label: 'Dashboard',        href: '/superadmin',                    icon: DashboardSquare01Icon }],
  },
  {
    group: 'Tenants',
    items: [
      { label: 'Gyms',                   href: '/superadmin/gyms',               icon: Building01Icon },
      { label: 'Users',                  href: '/superadmin/users',              icon: UserGroupIcon },
    ],
  },
  {
    group: 'Business',
    items: [
      { label: 'Revenue',                href: '/superadmin/revenue',            icon: Wallet01Icon },
      { label: 'Analytics',              href: '/superadmin/analytics',          icon: Activity01Icon },
      { label: 'Payouts',                href: '/superadmin/payouts',            icon: CreditCardIcon },
      { label: 'Subscriptions',          href: '/superadmin/subscriptions',      icon: RepeatIcon },
      { label: 'Invoices',               href: '/superadmin/invoices',           icon: Invoice01Icon },
      { label: 'Plans & Pricing',        href: '/superadmin/plans',              icon: Target01Icon },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Support',                href: '/superadmin/support',            icon: HelpCircleIcon },
      { label: 'Feature Flags',          href: '/superadmin/flags',              icon: Plug01Icon },
      { label: 'Announcements',          href: '/superadmin/announcements',      icon: MailSend01Icon },
      { label: 'Webhooks',               href: '/superadmin/webhooks',           icon: LinkSquare01Icon },
      { label: 'Audit Log',              href: '/superadmin/audit',              icon: Notebook01Icon },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Sessions',               href: '/superadmin/sessions',           icon: UserMultiple02Icon },
      { label: 'Settings',               href: '/superadmin/settings',           icon: Settings01Icon },
    ],
  },
]

const NOTIFS = [
  { id: '1', type: 'warn' as const,  title: 'GymCore Dakar payment failed', desc: 'Growth plan renewal — 3 retries remaining', time: '12 min ago', read: false },
  { id: '2', type: 'ok'   as const,  title: 'PeakPulse Nairobi upgraded',   desc: 'Starter → Growth+ — ₣19,900/mo',            time: '2h ago',    read: false },
  { id: '3', type: 'info' as const,  title: 'New gym registered',            desc: 'FitLife Lagos — trial started',              time: '5h ago',    read: true  },
]

const NOTIF_ICON = {
  warn: Alert01Icon,
  info: InformationCircleIcon,
  ok:   CheckmarkCircle01Icon,
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  pageBg:          '#000',
  sidebarBg:       '#0a0a0a',
  border:          '#1a1a1a',
  borderSubtle:    '#141414',
  surface:         '#0d0d0d',
  inputBg:         '#0d0d0d',
  inputBorder:     '#242424',
  textPrimary:     '#f0f0f0',
  textSecondary:   '#555',
  textMuted:       '#333',
  navActive:       '#141414',
  navInactive:     'transparent',
  navTextActive:   '#e8e8e8',
  navTextInactive: '#444',
  navGroupLabel:   '#252525',
}

// ─── Login form ───────────────────────────────────────────────────────────────

function SuperAdminLogin({ onAuth }: { onAuth: () => void }) {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('Email and password are required.'); return }
    setLoading(true); setError('')
    try {
      const r = await superApi.post<{ token: string }>('/api/superadmin/login', { email, password })
      setSuperToken(r.token)
      onAuth()
    } catch {
      setError('Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: 500,
    color: T.textPrimary, outline: 'none', transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 380, background: '#0a0a0a', border: `1px solid ${T.border}`, borderRadius: 16, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldKeyIcon size={18} color="#000" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, margin: 0 }}>myfiti Platform</p>
            <p style={{ fontSize: 13, color: T.textSecondary, margin: 0 }}>Super Admin access</p>
          </div>
        </div>

        {error && (
          <div style={{ borderLeft: '2px solid #7f1d1d', paddingLeft: 12, fontSize: 13, color: '#f87171', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
              Email
            </label>
            <input type="email" value={email} placeholder="admin@myfiti.app"
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#404040')}
              onBlur={e => (e.target.style.borderColor = T.inputBorder)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} placeholder="••••••••"
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                style={{ ...inputStyle, paddingRight: 42 }}
                onFocus={e => (e.target.style.borderColor = '#404040')}
                onBlur={e => (e.target.style.borderColor = T.inputBorder)}
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: T.textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPw ? <ViewOffIcon size={16} /> : <ViewIcon size={16} />}
              </button>
            </div>
          </div>

          <button onClick={handleLogin} disabled={loading}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, background: '#f0f0f0', color: '#0a0a0a', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: 4 }}>
            {loading ? 'Signing in…' : <><ShieldKeyIcon size={15} /> Sign in to Platform</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed]     = useState(false)
  const [notifications, setNotifications] = useState(NOTIFS)
  const [notifOpen, setNotifOpen]     = useState(false)
  const [userOpen, setUserOpen]       = useState(false)
  const [isAuthed, setIsAuthed]       = useState(false)
  const path = usePathname()
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => { setIsAuthed(!!getSuperToken()) }, [])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); setCollapsed(c => !c) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!isAuthed) return <SuperAdminLogin onAuth={() => setIsAuthed(true)} />

  const CRUMBS: Record<string, string[]> = {
    '/superadmin':                    ['Dashboard'],
    '/superadmin/gyms':               ['Tenants', 'Gyms'],
    '/superadmin/users':              ['Tenants', 'Users'],
    '/superadmin/revenue':            ['Business', 'Revenue'],
    '/superadmin/plans':              ['Business', 'Plans'],
    '/superadmin/support':            ['Operations', 'Support'],
    '/superadmin/flags':              ['Operations', 'Feature Flags'],
    '/superadmin/announcements':      ['Operations', 'Announcements'],
    '/superadmin/webhooks':           ['Operations', 'Webhooks'],
    '/superadmin/audit':              ['Operations', 'Audit Log'],
    '/superadmin/analytics':          ['Business', 'Analytics'],
    '/superadmin/payouts':            ['Business', 'Payouts'],
    '/superadmin/subscriptions':      ['Business', 'Subscriptions'],
    '/superadmin/invoices':           ['Business', 'Invoices'],
    '/superadmin/sessions':           ['System', 'Sessions'],
    '/superadmin/settings':           ['System', 'Settings'],
  }

  const crumbs = CRUMBS[path]
    ?? (path.startsWith('/superadmin/gyms/') ? ['Tenants', 'Gyms', 'Detail'] : ['Platform'])

  const SIDEBAR_W = collapsed ? 56 : 240

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.pageBg }}>

      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: SIDEBAR_W }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed', inset: '0 auto 0 0', zIndex: 50,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
          background: T.sidebarBg, borderRight: `1px solid ${T.border}`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', height: 56, flexShrink: 0, padding: '0 8px', gap: 6, borderBottom: `1px solid ${T.border}` }}>

          {collapsed ? (
            <button onClick={() => setCollapsed(false)}
              style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', margin: '0 auto' }}>
              <ShieldKeyIcon size={16} color="#000" />
            </button>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '5px 6px', borderRadius: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldKeyIcon size={14} color="#000" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>myfiti</p>
                  <p style={{ fontSize: 11, color: T.textSecondary, margin: 0, lineHeight: 1.2 }}>Super Admin</p>
                </div>
              </div>

              <button onClick={() => setCollapsed(c => !c)}
                style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, outline: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <SidebarLeft01Icon size={14} />
              </button>
            </>
          )}

          {collapsed && (
            <button onClick={() => setCollapsed(c => !c)}
              style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, outline: 'none' }}>
              <SidebarRight01Icon size={14} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 6px' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.group} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <p style={{ fontSize: 13, fontWeight: 500, color: T.navGroupLabel, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '10px 8px 4px', margin: 0 }}>
                  {gi > 0 ? group.group : ''}
                </p>
              )}
              {collapsed && gi > 0 && (
                <div style={{ height: 1, background: T.borderSubtle, margin: '6px 4px' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {group.items.map(item => {
                  const active = path === item.href || (item.href !== '/superadmin' && path.startsWith(item.href))
                  const Icon = item.icon
                  return (
                    <Link key={item.href} href={item.href}
                      title={collapsed ? item.label : undefined}
                      style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        gap: collapsed ? 0 : 9,
                        padding: collapsed ? '9px 0' : '8px 10px',
                        borderRadius: 8, textDecoration: 'none',
                        fontWeight: active ? 500 : 400, fontSize: 15,
                        background: active ? T.navActive : T.navInactive,
                        color: active ? T.navTextActive : T.navTextInactive,
                        transition: 'background 0.1s, color 0.1s',
                        position: 'relative',
                        outline: 'none',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                      onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = '#0f0f0f'; el.style.color = '#666' } }}
                      onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = T.navInactive; el.style.color = T.navTextInactive } }}
                    >
                      {active && (
                        <motion.span layoutId="super-nav-pill"
                          style={{ position: 'absolute', left: 0, top: 5, bottom: 5, width: 2, borderRadius: '0 2px 2px 0', background: '#f0f0f0' }}
                          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                        />
                      )}
                      <Icon size={20} style={{ flexShrink: 0 }} />
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span key="label"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.1 }}
                            style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1 }}>
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '6px 6px 8px', borderTop: `1px solid ${T.border}`, flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setUserOpen(o => !o)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 9, padding: collapsed ? '8px 0' : '8px 10px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.1s', outline: 'none' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0f0f0f')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1a1a', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#555' }}>SA</span>
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div key="user" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary, margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Super Admin</p>
                    <p style={{ fontSize: 12, color: T.textSecondary, margin: 0, lineHeight: 1.3 }}>Platform owner</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            {userOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setUserOpen(false)} />
                <div style={{ position: 'absolute', bottom: '100%', left: collapsed ? 8 : 6, right: 6, marginBottom: 6, background: '#0d0d0d', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', zIndex: 50, minWidth: 160 }}>
                  <Link href="/dashboard" onClick={() => setUserOpen(false)}
                    style={{ display: 'block', padding: '10px 14px', fontSize: 14, color: '#555', textDecoration: 'none', outline: 'none' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                    ← Admin portal
                  </Link>
                  <div style={{ height: 1, background: T.border }} />
                  <button onClick={() => { clearSuperToken(); setIsAuthed(false); setUserOpen(false) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 14, color: '#888', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', outline: 'none' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                    <Logout01Icon size={16} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Main column ── */}
      <motion.div
        animate={{ marginLeft: SIDEBAR_W }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
      >
        {/* Topbar */}
        <motion.header
          animate={{ left: SIDEBAR_W }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'fixed', top: 0, right: 0, zIndex: 40, height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 22px', gap: 16,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 14, color: T.textMuted }}>Platform</span>
            {crumbs.map((c, i) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: T.textMuted }}>/</span>
                <span style={{ fontSize: 15, fontWeight: i === crumbs.length - 1 ? 500 : 400, color: i === crumbs.length - 1 ? T.textPrimary : '#3a3a3a' }}>
                  {c}
                </span>
              </div>
            ))}
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 34, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8, cursor: 'text', flex: '0 1 240px' }}>
              <Search01Icon size={16} style={{ color: T.textSecondary, flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: T.textSecondary, flex: 1 }}>Search platform…</span>
              <kbd style={{ fontSize: 12, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#141414', color: T.textSecondary, border: `1px solid ${T.border}`, fontFamily: 'inherit' }}>⌘K</kbd>
            </div>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setNotifOpen(o => !o)}
                style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', position: 'relative', color: T.textSecondary, outline: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0f0f0f')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <Notification01Icon size={18} />
                {unread > 0 && (
                  <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: '#555', border: '1px solid #000' }} />
                )}
              </button>

              {notifOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setNotifOpen(false)} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 310, background: '#0a0a0a', border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', zIndex: 50 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>Notifications</span>
                      {unread > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: '#555', background: '#141414', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{unread} new</span>}
                    </div>
                    {notifications.map(n => {
                      const NIcon = NOTIF_ICON[n.type]
                      return (
                        <button key={n.id}
                          onClick={() => setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))}
                          style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `1px solid ${T.borderSubtle}`, opacity: n.read ? 0.45 : 1, textAlign: 'left', outline: 'none' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                          <div style={{ width: 30, height: 30, borderRadius: 7, background: '#111', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <NIcon size={14} style={{ color: '#444' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                            <p style={{ fontSize: 13, color: '#3a3a3a', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.desc}</p>
                            <p style={{ fontSize: 12, color: T.textMuted, margin: '3px 0 0' }}>{n.time}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Avatar */}
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1a1a1a', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#555' }}>SA</span>
            </div>
          </div>
        </motion.header>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', paddingTop: 56 }}>
          <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: T.pageBg }}>
            {children}
          </main>
        </div>
      </motion.div>
    </div>
  )
}
