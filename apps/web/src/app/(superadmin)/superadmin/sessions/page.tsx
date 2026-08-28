'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Cancel01Icon, ShieldKeyIcon, Alert01Icon, SmartPhone01Icon,
  Globe02Icon, CheckmarkCircle01Icon, Search01Icon,
  Logout01Icon, UserGroupIcon, RefreshIcon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

const T = {
  card: '#0a0a0a', border: '#1a1a1a', borderSubtle: '#141414',
  surface: '#0d0d0d', textPrimary: '#f0f0f0', textSecondary: '#555', textMuted: '#333',
}

type Session = {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  role: string
  tenant_id: string | null
  tenant_name: string | null
  tenant_slug: string | null
  ip_address: string | null
  device: string | null
  browser: string | null
  created_at: string
  last_active_at: string
  expires_at: string | null
  terminated: boolean
  current: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function DeviceIcon({ device }: { device: string | null }) {
  const isMobile = device === 'iPhone' || device === 'Android'
  const Icon = isMobile ? SmartPhone01Icon : Globe02Icon
  return <Icon size={12} style={{ color: T.textSecondary }} />
}

export default function SessionsPage() {
  const [sessions, setSessions]     = useState<Session[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [terminating, setTerminating] = useState<string | null>(null)

  function fetchSessions() {
    setLoading(true)
    superApi.get<{ sessions: Session[] }>('/api/superadmin/sessions')
      .then(d => setSessions(d.sessions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSessions() }, [])

  const filtered = sessions.filter(s =>
    !search
      || (s.user_name ?? '').toLowerCase().includes(search.toLowerCase())
      || (s.tenant_name ?? '').toLowerCase().includes(search.toLowerCase())
      || (s.ip_address ?? '').includes(search)
      || s.role.includes(search.toLowerCase()),
  )

  async function terminate(id: string) {
    setTerminating(id)
    try {
      await superApi.delete(`/api/superadmin/sessions/${id}`)
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch { /* noop */ } finally { setTerminating(null) }
  }

  async function terminateAll() {
    setTerminating('all')
    try {
      await superApi.delete('/api/superadmin/sessions')
      setSessions(prev => prev.filter(s => s.current))
    } catch { /* noop */ } finally { setTerminating(null) }
  }

  const flagged  = sessions.filter(s => s.browser?.toLowerCase().includes('curl') || (s.role === 'owner' && !s.tenant_id))
  const active   = sessions.filter(s => {
    const diff = Date.now() - new Date(s.last_active_at).getTime()
    return diff < 30 * 60 * 1000
  })
  const superadminSessions = sessions.filter(s => s.role === 'superadmin')

  const STATS = [
    { label: 'Active sessions',     value: sessions.length,           Icon: UserGroupIcon },
    { label: 'Recently active',     value: active.length,             Icon: CheckmarkCircle01Icon },
    { label: 'Superadmin sessions', value: superadminSessions.length, Icon: ShieldKeyIcon },
    { label: 'Flagged',             value: flagged.length,            Icon: Alert01Icon },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Session management</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Monitor active sessions across all users. Force-terminate suspicious sessions.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchSessions} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 500, color: T.textSecondary, cursor: 'pointer' }}>
              <RefreshIcon size={13} /> Refresh
            </button>
            <button onClick={terminateAll} disabled={terminating === 'all'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#7a4a4a', cursor: 'pointer' }}>
              <Logout01Icon size={13} />
              {terminating === 'all' ? 'Terminating…' : 'Terminate all others'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {STATS.map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
            <s.Icon size={14} style={{ color: T.textSecondary }} />
            <p style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, margin: '10px 0 4px', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Flagged alert */}
      {flagged.length > 0 && (
        <motion.div variants={fade} custom={2} initial="hidden" animate="show" style={{ marginBottom: 14 }}>
          {flagged.map(s => (
            <div key={s.id} style={{ background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Alert01Icon size={15} style={{ color: '#7a3a3a' }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#c47a7a', margin: '0 0 2px' }}>Suspicious session detected</p>
                    <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{s.user_email ?? s.user_name} · {s.ip_address} · {s.browser} · {timeAgo(s.last_active_at)}</p>
                  </div>
                </div>
                <button onClick={() => terminate(s.id)}
                  style={{ padding: '5px 12px', background: '#2a0a0a', border: '1px solid #7f1d1d', borderRadius: 7, fontSize: 11, fontWeight: 600, color: '#7a3a3a', cursor: 'pointer' }}>
                  Terminate now
                </button>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Session table */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Active sessions</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px', height: 30, background: T.surface, border: `1px solid #242424`, borderRadius: 8 }}>
              <Search01Icon size={12} style={{ color: T.textSecondary, flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user, gym, IP…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.textPrimary, width: 180 }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${T.borderSubtle}`, gap: 8 }}>
            <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>User</span></div>
            <div style={{ width: 85 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Role</span></div>
            <div style={{ width: 160 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Device / Browser</span></div>
            <div style={{ width: 130 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>IP</span></div>
            <div style={{ width: 110 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Last active</span></div>
            <div style={{ width: 32 }} />
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: 18, background: '#111', borderRadius: 4, marginBottom: 10 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '32px 0' }}>
              {sessions.length === 0 ? 'No active sessions. Sessions are recorded on login.' : 'No sessions match your search.'}
            </p>
          ) : filtered.map(s => {
            const isFlagged = s.browser?.toLowerCase().includes('curl') || (s.role === 'owner' && !s.tenant_id)
            return (
              <div key={s.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${T.borderSubtle}`, background: isFlagged ? '#1c0a0a' : 'transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (!isFlagged) (e.currentTarget as HTMLElement).style.background = '#0d0d0d' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isFlagged ? '#1c0a0a' : 'transparent' }}>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1a1a', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.textSecondary }}>
                      {(s.user_name ?? s.user_email ?? '?').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: isFlagged ? '#c47a7a' : T.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.user_name ?? s.user_email ?? 'Unknown'}
                      </p>
                      {s.current && <span style={{ fontSize: 9, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '1px 5px', borderRadius: 3 }}>You</span>}
                      {isFlagged && <Alert01Icon size={11} style={{ color: '#7a3a3a' }} />}
                    </div>
                    <p style={{ fontSize: 11, color: T.textMuted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.tenant_name ?? (s.role === 'superadmin' ? 'Platform' : '—')}</p>
                  </div>
                </div>

                <div style={{ width: 85 }}>
                  <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{s.role}</span>
                </div>

                <div style={{ width: 160, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DeviceIcon device={s.device} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, margin: 0 }}>{s.device ?? '—'}</p>
                    <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>{s.browser ?? '—'}</p>
                  </div>
                </div>

                <div style={{ width: 130 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: isFlagged ? '#c47a7a' : T.textSecondary, margin: '0 0 1px', fontFamily: 'monospace' }}>{s.ip_address ?? '—'}</p>
                </div>

                <div style={{ width: 110, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>{timeAgo(s.last_active_at)}</span>
                </div>

                <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                  {!s.current && (
                    <button onClick={() => terminate(s.id)} disabled={terminating === s.id} title="Terminate session"
                      style={{ width: 24, height: 24, borderRadius: 6, background: 'none', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textMuted, opacity: terminating === s.id ? 0.4 : 1 }}>
                      <Cancel01Icon size={11} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>{filtered.length} session{filtered.length !== 1 ? 's' : ''} · Sessions recorded on login</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
