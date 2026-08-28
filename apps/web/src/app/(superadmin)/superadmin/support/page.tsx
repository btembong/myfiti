'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search01Icon, CheckmarkCircle01Icon,
  Mail01Icon, MailSend01Icon, Clock01Icon, Add01Icon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'

const T = {
  card: '#0a0a0a',
  border: '#1a1a1a',
  borderSubtle: '#141414',
  surface: '#0d0d0d',
  textPrimary: '#f0f0f0',
  textSecondary: '#555',
  textMuted: '#333',
}

type TicketMessage = { id: string; from: 'gym' | 'support'; text: string; time: string }

type Ticket = {
  id: string
  subject: string
  status: 'open' | 'pending' | 'resolved'
  priority: 'high' | 'medium' | 'low'
  createdAt: string
  updatedAt: string
  gymId: string
  gymName: string
  gymSlug: string
  gymPlan: string
  gymStatus: string
  ownerName: string
  ownerEmail: string
  messages: TicketMessage[]
}

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SupportPage() {
  const [tickets, setTickets]         = useState<Ticket[]>([])
  const [loading, setLoading]         = useState(true)
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all')
  const [reply, setReply]             = useState('')
  const [sending, setSending]         = useState(false)
  const [resolving, setResolving]     = useState(false)
  const messagesEndRef                = useRef<HTMLDivElement>(null)

  function fetchTickets() {
    superApi.get<{ tickets: Ticket[] }>('/api/superadmin/support/tickets')
      .then(r => {
        setTickets(r.tickets)
        if (!selectedId && r.tickets.length > 0) setSelectedId(r.tickets[0].id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTickets() }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedId, tickets])

  const filtered = tickets.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchSearch = !search ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.gymName.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const selected = tickets.find(t => t.id === selectedId) ?? filtered[0] ?? null

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return
    setSending(true)
    try {
      await superApi.post(`/api/superadmin/support/tickets/${selected.id}/reply`, { body: reply.trim() })
      setReply('')
      // Optimistic update
      setTickets(prev => prev.map(t =>
        t.id === selected.id
          ? {
              ...t,
              status: 'pending' as const,
              messages: [...t.messages, { id: crypto.randomUUID(), from: 'support', text: reply.trim(), time: new Date().toISOString() }],
            }
          : t,
      ))
    } catch {
      // silent — keep reply text so user can retry
    } finally {
      setSending(false)
    }
  }

  async function resolveTicket() {
    if (!selected || resolving) return
    setResolving(true)
    try {
      await superApi.patch(`/api/superadmin/support/tickets/${selected.id}`, { status: 'resolved' })
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: 'resolved' } : t))
    } catch {
    } finally {
      setResolving(false)
    }
  }

  async function reopenTicket() {
    if (!selected) return
    try {
      await superApi.patch(`/api/superadmin/support/tickets/${selected.id}`, { status: 'open' })
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: 'open' } : t))
    } catch {}
  }

  const openCount     = tickets.filter(t => t.status === 'open').length
  const pendingCount  = tickets.filter(t => t.status === 'pending').length
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* Left — ticket list */}
      <div style={{ width: 290, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', background: T.card, flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: '0 0 10px' }}>Support</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 10px', height: 30, background: T.surface, border: `1px solid #242424`, borderRadius: 7 }}>
            <Search01Icon size={11} style={{ color: T.textSecondary, flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…"
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 11, color: T.textPrimary, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {([['all', tickets.length], ['open', openCount], ['pending', pendingCount], ['resolved', resolvedCount]] as const).map(([s, count]) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ background: statusFilter === s ? '#1a1a1a' : T.surface, border: `1px solid ${statusFilter === s ? T.border : 'transparent'}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: statusFilter === s ? T.textPrimary : T.textSecondary }}>{count} {s}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>No tickets.</p>
          ) : filtered.map(ticket => (
            <div key={ticket.id} onClick={() => setSelectedId(ticket.id)}
              style={{
                padding: '11px 14px', borderBottom: `1px solid ${T.borderSubtle}`,
                cursor: 'pointer',
                background: selectedId === ticket.id ? '#0d0d0d' : 'transparent',
                borderLeft: `2px solid ${selectedId === ticket.id ? '#555' : 'transparent'}`,
                transition: 'background 0.1s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.gymName}</span>
                <span style={{ fontSize: 9, color: '#888', background: '#111', border: `1px solid ${T.border}`, padding: '1px 6px', borderRadius: 3, flexShrink: 0, marginLeft: 6 }}>{ticket.priority}</span>
              </div>
              <p style={{ fontSize: 11, color: T.textMuted, margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusPill label={ticket.status} />
                <span style={{ fontSize: 10, color: T.textMuted }}>{fmtTime(ticket.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center — thread */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050505', minWidth: 0 }}>
          {/* Thread header */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, background: T.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, margin: '0 0 6px' }}>{selected.subject}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusPill label={selected.status} />
                  <span style={{ fontSize: 10, color: '#888', background: '#111', border: `1px solid ${T.border}`, padding: '1px 6px', borderRadius: 3 }}>{selected.priority} priority</span>
                  <span style={{ fontSize: 11, color: T.textMuted }}>#{selected.id.slice(0, 8)} · {fmtDate(selected.createdAt)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selected.status !== 'resolved' ? (
                  <button onClick={resolveTicket} disabled={resolving}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, background: 'none', border: `1px solid #4a7a5a`, color: '#4a7a5a', cursor: resolving ? 'default' : 'pointer', opacity: resolving ? 0.6 : 1 }}>
                    <CheckmarkCircle01Icon size={13} /> {resolving ? 'Resolving…' : 'Mark resolved'}
                  </button>
                ) : (
                  <button onClick={reopenTicket}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, background: 'none', border: `1px solid ${T.border}`, color: T.textSecondary, cursor: 'pointer' }}>
                    <Clock01Icon size={13} /> Reopen
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {selected.messages.map((msg) => {
              const isSupport = msg.from === 'support'
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isSupport ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{
                      background: isSupport ? '#1a1a1a' : '#111',
                      border: `1px solid ${T.border}`,
                      borderRadius: isSupport ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                      padding: '10px 14px',
                    }}>
                      <p style={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                    </div>
                    <p style={{ fontSize: 10, color: T.textMuted, margin: '4px 0 0', textAlign: isSupport ? 'right' : 'left' }}>
                      {isSupport ? 'Support team' : selected.ownerName} · {fmtTime(msg.time)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, background: T.card }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                style={{ flex: 1, background: T.surface, border: `1px solid #242424`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: T.textPrimary, outline: 'none', resize: 'none', minHeight: 60, fontFamily: 'inherit', lineHeight: 1.5, transition: 'border-color 0.15s' }}
                placeholder="Type your reply… (Ctrl+↵ to send)"
                value={reply} onChange={e => setReply(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#404040')}
                onBlur={e => (e.target.style.borderColor = '#242424')}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                rows={2}
                disabled={selected.status === 'resolved'}
              />
              <button onClick={sendReply} disabled={sending || !reply.trim() || selected.status === 'resolved'}
                style={{ width: 42, height: 42, borderRadius: '50%', background: sending || !reply.trim() || selected.status === 'resolved' ? '#1a1a1a' : '#f0f0f0', border: 'none', cursor: sending || !reply.trim() || selected.status === 'resolved' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                <MailSend01Icon size={16} color={sending || !reply.trim() || selected.status === 'resolved' ? '#333' : '#0a0a0a'} />
              </button>
            </div>
            {selected.status === 'resolved' && (
              <p style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>This ticket is resolved. Reopen it to send a reply.</p>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
          <p style={{ fontSize: 13, color: T.textMuted }}>{loading ? 'Loading tickets…' : 'No tickets yet.'}</p>
        </div>
      )}

      {/* Right — gym context */}
      <div style={{ width: 250, borderLeft: `1px solid ${T.border}`, background: T.card, padding: 14, overflowY: 'auto', flexShrink: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>Gym context</p>
        {selected?.gymId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a1a', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#555' }}>{selected.gymName.slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: 0 }}>{selected.gymName}</p>
                  <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{selected.gymSlug}</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: 'Plan',   value: selected.gymPlan },
                  { label: 'Status', value: selected.gymStatus },
                  { label: 'Opened', value: fmtDate(selected.createdAt) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: T.textSecondary }}>{row.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.textPrimary }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Contact</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Mail01Icon size={11} style={{ color: T.textMuted }} />
                <span style={{ fontSize: 11, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.ownerEmail}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: T.textSecondary }}>{selected.ownerName}</span>
                <span style={{ fontSize: 9, color: T.textMuted, background: '#111', border: `1px solid ${T.border}`, padding: '1px 6px', borderRadius: 3 }}>Owner</span>
              </div>
            </div>

            {/* Other open tickets from same gym */}
            {tickets.filter(t => t.gymId === selected.gymId && t.id !== selected.id && t.status !== 'resolved').length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Other open tickets</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tickets.filter(t => t.gymId === selected.gymId && t.id !== selected.id && t.status !== 'resolved').map(t => (
                    <div key={t.id} onClick={() => setSelectedId(t.id)}
                      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: '7px 10px', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#111')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = T.surface)}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</p>
                      <StatusPill label={t.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New ticket shortcut */}
            <button
              onClick={() => window.open(`/superadmin/gyms/${selected.gymId}`, '_blank')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 500, background: 'none', border: `1px solid ${T.border}`, color: T.textSecondary, cursor: 'pointer', width: '100%' }}>
              <Add01Icon size={11} /> View gym details
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 11, color: T.textMuted }}>Select a ticket to see gym info.</p>
        )}
      </div>

    </div>
  )
}
