'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search01Icon, RefreshIcon, CheckmarkCircle01Icon,
  Cancel01Icon, Clock01Icon,
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

type WebhookEvent = {
  id: string
  tenant_id: string | null
  tenant_name: string | null
  tenant_slug: string | null
  event_type: string
  status: string
  payload: unknown
  response_code: number | null
  attempts: number | null
  created_at: string
  processed_at: string | null
}

const STATUS_ICON: Record<string, React.ElementType> = {
  delivered: CheckmarkCircle01Icon, completed: CheckmarkCircle01Icon,
  failed: Cancel01Icon,
  retrying: RefreshIcon,
  pending: Clock01Icon,
}

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function WebhooksPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  function fetchEvents() {
    setLoading(true)
    superApi.get<{ webhooks: WebhookEvent[] }>('/api/superadmin/webhooks?limit=100')
      .then(d => setEvents(d.webhooks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchEvents() }, [])

  const filtered = events.filter(e => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    const matchEvent  = eventFilter === 'all'  || e.event_type === eventFilter
    const matchSearch = !search || e.event_type.includes(search) || e.id.includes(search)
      || (e.tenant_name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchEvent && matchSearch
  })

  function retry(id: string) {
    superApi.post(`/api/superadmin/webhooks/${id}/retry`)
      .then(() => {
        setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'pending' } : e))
      })
      .catch(() => {})
  }

  const delivered    = events.filter(e => e.status === 'delivered' || e.status === 'completed').length
  const failed       = events.filter(e => e.status === 'failed').length
  const retrying     = events.filter(e => e.status === 'retrying' || e.status === 'pending').length
  const deliveryRate = events.length > 0 ? Math.round((delivered / events.length) * 100) : 0

  const uniqueEvents = Array.from(new Set(events.map(e => e.event_type)))

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Webhook delivery log</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Real-time webhook event delivery status, retry management, and payload inspection.</p>
          </div>
          <button onClick={fetchEvents}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 500, color: T.textSecondary, cursor: 'pointer' }}>
            <RefreshIcon size={13} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total events',  value: events.length },
          { label: 'Delivered',     value: delivered },
          { label: 'Failed',        value: failed },
          { label: 'Pending',       value: retrying },
          { label: 'Delivery rate', value: `${deliveryRate}%` },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, margin: '0 0 3px', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show"
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px', height: 32, background: T.surface, border: `1px solid #242424`, borderRadius: 8 }}>
          <Search01Icon size={12} style={{ color: T.textSecondary, flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search event, ID…"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.textPrimary, width: 160 }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: T.surface, border: `1px solid #242424`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: T.textSecondary, outline: 'none', cursor: 'pointer' }}>
          <option value="all">All statuses</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
        <select value={eventFilter} onChange={e => setEventFilter(e.target.value)}
          style={{ background: T.surface, border: `1px solid #242424`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: T.textSecondary, outline: 'none', cursor: 'pointer', maxWidth: 220 }}>
          <option value="all">All events</option>
          {uniqueEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        {failed > 0 && (
          <button onClick={() => events.filter(e => e.status === 'failed').forEach(e => retry(e.id))}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#1a1200', border: '1px solid #3a2800', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#7a6a3a', cursor: 'pointer' }}>
            <RefreshIcon size={12} />
            Retry all failed ({failed})
          </button>
        )}
      </motion.div>

      {/* Event log */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, gap: 8 }}>
            <div style={{ width: 28 }} />
            <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Event</span></div>
            <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span></div>
            <div style={{ width: 70 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Code</span></div>
            <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Attempts</span></div>
            <div style={{ width: 140 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time</span></div>
            <div style={{ width: 32 }} />
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 18, background: '#111', borderRadius: 4, marginBottom: 10 }} />
              ))}
            </div>
          ) : filtered.length > 0 ? filtered.map(ev => {
            const SIcon = STATUS_ICON[ev.status] ?? Clock01Icon
            const isExpanded = expanded === ev.id
            return (
              <div key={ev.id}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${T.borderSubtle}`, cursor: 'pointer', transition: 'background 0.1s' }}
                  onClick={() => setExpanded(isExpanded ? null : ev.id)}
                  onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = '#0d0d0d' }}
                  onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>

                  <div style={{ width: 28 }}>
                    <SIcon size={13} style={{ color: T.textSecondary }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: T.textSecondary, flexShrink: 0 }} />
                      <p style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, margin: 0, fontFamily: 'monospace' }}>{ev.event_type}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'monospace' }}>{ev.id.slice(0, 12)}</span>
                      <span style={{ fontSize: 10, color: T.textMuted }}>·</span>
                      <span style={{ fontSize: 11, color: T.textSecondary }}>{ev.tenant_name ?? '—'}</span>
                    </div>
                  </div>

                  <div style={{ width: 90 }}>
                    <StatusPill label={ev.status} />
                  </div>

                  <div style={{ width: 70 }}>
                    {ev.response_code ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: ev.response_code < 300 ? '#4a7a5a' : '#7a3a3a', fontFamily: 'monospace' }}>{ev.response_code}</span>
                    ) : <span style={{ fontSize: 11, color: T.textMuted }}>—</span>}
                  </div>

                  <div style={{ width: 90 }}>
                    <span style={{ fontSize: 11, color: T.textSecondary }}>{ev.attempts ?? 0}</span>
                  </div>

                  <div style={{ width: 140 }}>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{fmt(ev.created_at)}</span>
                  </div>

                  <div style={{ width: 32 }} onClick={e => e.stopPropagation()}>
                    {ev.status === 'failed' && (
                      <button onClick={() => retry(ev.id)} title="Retry"
                        style={{ width: 24, height: 24, borderRadius: 6, background: 'none', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textSecondary }}>
                        <RefreshIcon size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: 28, marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 10, color: T.textMuted, margin: '0 0 3px' }}>Tenant</p>
                        <p style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, margin: 0 }}>{ev.tenant_name ?? '—'} ({ev.tenant_slug ?? '—'})</p>
                      </div>
                      {ev.processed_at && (
                        <div>
                          <p style={{ fontSize: 10, color: T.textMuted, margin: '0 0 3px' }}>Processed</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, margin: 0 }}>{fmt(ev.processed_at)}</p>
                        </div>
                      )}
                    </div>
                    {ev.payload != null && (
                      <div>
                        <p style={{ fontSize: 10, color: T.textMuted, margin: '0 0 5px' }}>Payload</p>
                        <div style={{ background: T.card, borderRadius: 7, padding: '8px 12px', border: `1px solid ${T.border}` }}>
                          <pre style={{ fontSize: 11, color: T.textSecondary, fontFamily: 'monospace', wordBreak: 'break-all', whiteSpace: 'pre-wrap', margin: 0 }}>
                            {typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          }) : (
            <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '32px 0' }}>No webhook events found.</p>
          )}

          <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>{filtered.length} events · Click row to inspect payload</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
