'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search01Icon, UserGroupIcon, Wallet01Icon,
  Settings01Icon, Building01Icon,
  Alert01Icon, CheckmarkCircle01Icon, ArrowUpRight01Icon,
  Cancel01Icon, Login01Icon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3, ease: 'easeOut' as const } }),
}

const T = {
  card: '#0a0a0a',
  border: '#1a1a1a',
  borderSubtle: '#141414',
  surface: '#0d0d0d',
  textPrimary: '#f0f0f0',
  textSecondary: '#555',
  textMuted: '#333',
}

type AuditEvent = {
  id: string
  event_type: string
  entity_id: string
  entity_name: string
  detail: string
  timestamp: string
}

function inferCategory(eventType: string): string {
  if (eventType === 'webhook') return 'system'
  return 'gym'
}

function inferSeverity(detail: string): 'info' | 'warn' | 'error' {
  if (detail === 'suspended' || detail === 'cancelled') return 'warn'
  if (detail === 'failed') return 'error'
  return 'info'
}

const CATEGORY_ICON: Record<string, React.ElementType> = {
  auth: Login01Icon, billing: Wallet01Icon, gym: Building01Icon,
  user: UserGroupIcon, system: Settings01Icon, plan: ArrowUpRight01Icon,
}

const SEVERITY_ICON: Record<string, React.ElementType> = {
  info: CheckmarkCircle01Icon, warn: Alert01Icon, error: Cancel01Icon,
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SLabel({ children }: { children: string }) {
  return <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{children}</p>
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: active ? '#1a1a1a' : 'none', border: `1px solid ${active ? T.border : 'transparent'}`, color: active ? T.textPrimary : T.textMuted, cursor: 'pointer', transition: 'all 0.1s' }}>
      {label}
    </button>
  )
}

function Dropdown({ value, options, onChange }: { value: string; options: { label: string; value: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = options.find(o => o.value === value)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 32, background: T.surface, border: '1px solid #242424', borderRadius: 8, fontSize: 13, color: T.textSecondary, cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' }}>
        {current?.label ?? value}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden', zIndex: 50, minWidth: '100%' }}>
            {options.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
                style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 13, color: o.value === value ? T.textPrimary : T.textSecondary, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', outline: 'none', whiteSpace: 'nowrap' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function AuditPage() {
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [events, setEvents]     = useState<AuditEvent[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    superApi.get<{ events: AuditEvent[] }>('/api/superadmin/audit-log?limit=100')
      .then(d => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const enriched = events.map(e => ({
    ...e,
    category: inferCategory(e.event_type),
    severity: inferSeverity(e.detail),
  }))

  const filtered = enriched.filter(e => {
    const matchCat    = category === 'all' || e.category === category
    const matchSev    = severity === 'all' || e.severity === severity
    const matchSearch = !search || e.entity_name.toLowerCase().includes(search.toLowerCase())
      || e.event_type.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSev && matchSearch
  })

  const SEV_FILTERS = [
    { label: 'All',   value: 'all'   },
    { label: 'Info',  value: 'info'  },
    { label: 'Warn',  value: 'warn'  },
    { label: 'Error', value: 'error' },
  ]

  const STATS = [
    { label: 'Total events', value: enriched.length },
    { label: 'Errors',       value: enriched.filter(e => e.severity === 'error').length },
    { label: 'Warnings',     value: enriched.filter(e => e.severity === 'warn').length },
    { label: 'Gym changes',  value: enriched.filter(e => e.category === 'gym').length },
    { label: 'Webhooks',     value: enriched.filter(e => e.category === 'system').length },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Audit log</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Immutable record of all platform-level actions and events.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px', height: 32, background: T.surface, border: `1px solid #242424`, borderRadius: 8 }}>
              <Search01Icon size={12} style={{ color: T.textSecondary, flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.textPrimary, width: 180 }} />
            </div>
            <Dropdown
              value={category}
              options={[
                { label: 'All categories', value: 'all' },
                { label: 'Gyms', value: 'gym' },
                { label: 'System', value: 'system' },
              ]}
              onChange={setCategory}
            />
          </div>
        </div>
      </motion.div>

      {/* Severity pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {SEV_FILTERS.map(f => (
          <FilterPill key={f.value} label={f.label} active={severity === f.value} onClick={() => setSeverity(f.value)} />
        ))}
      </div>

      {/* Stats */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {STATS.map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, margin: '0 0 3px', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Timeline */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, gap: 8 }}>
            <div style={{ width: 36 }} />
            <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Event</span></div>
            <div style={{ width: 100 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Category</span></div>
            <div style={{ width: 160 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Entity</span></div>
            <div style={{ width: 80 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Severity</span></div>
            <div style={{ width: 140 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time</span></div>
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 18, background: '#111', borderRadius: 4, marginBottom: 10 }} />
              ))}
            </div>
          ) : filtered.length > 0 ? filtered.map(ev => {
            const CatIcon = CATEGORY_ICON[ev.category] ?? Settings01Icon
            const SevIcon = SEVERITY_ICON[ev.severity]
            return (
              <div key={ev.id + ev.timestamp}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${T.borderSubtle}`, transition: 'background 0.1s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <div style={{ width: 36, display: 'flex', alignItems: 'center', paddingTop: 2 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#111', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CatIcon size={12} style={{ color: T.textSecondary }} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, margin: '0 0 2px' }}>{ev.event_type.replace('_', ' ')}</p>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{ev.detail}</p>
                </div>
                <div style={{ width: 100 }}>
                  <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{ev.category}</span>
                </div>
                <div style={{ width: 160 }}>
                  <span style={{ fontSize: 12, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{ev.entity_name}</span>
                </div>
                <div style={{ width: 80, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <SevIcon size={11} style={{ color: T.textMuted }} />
                  <span style={{ fontSize: 11, color: T.textSecondary }}>{ev.severity}</span>
                </div>
                <div style={{ width: 140 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>{fmt(ev.timestamp)}</span>
                </div>
              </div>
            )
          }) : (
            <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '32px 0' }}>No audit events found.</p>
          )}

          <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>{filtered.length} events shown · Audit logs retained for 90 days</span>
          </div>
        </div>
      </motion.div>

    </div>
  )
}
