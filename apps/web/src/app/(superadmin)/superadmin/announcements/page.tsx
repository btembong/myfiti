'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  MailSend01Icon, CheckmarkCircle01Icon,
  UserGroupIcon, Building01Icon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
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

type Announcement = {
  id: string
  title: string
  message: string
  type: string
  audience: string
  sent_to: number
  created_at: string
}

function TabPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s', background: active ? '#1a1a1a' : 'none', border: `1px solid ${active ? T.border : 'transparent'}`, color: active ? T.textPrimary : T.textMuted }}>
      {label}
    </button>
  )
}

function SLabel({ children }: { children: string }) {
  return <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>{children}</p>
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('info')
  const [audience, setAudience] = useState('all')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [tab, setTab] = useState('compose')

  useEffect(() => {
    superApi.get<{ announcements: Announcement[] }>('/api/superadmin/announcements')
      .then(d => setAnnouncements(d.announcements ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const charCount = body.length
  const audienceLabel = audience === 'all' ? 'All gyms' : audience === 'growth_plus' ? 'Growth+ only' : audience === 'growth' ? 'Growth only' : 'Starter only'

  async function sendAnnouncement() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const res = await superApi.post<{ announcement: Announcement }>('/api/superadmin/announcements', {
        title, message: body, type, audience,
      })
      setAnnouncements(prev => [res.announcement, ...prev])
      setTitle(''); setBody(''); setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch { /* noop */ } finally { setSending(false) }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Announcements</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Broadcast messages to gym owners and admins across the platform.</p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <TabPill label="Compose" active={tab === 'compose'} onClick={() => setTab('compose')} />
            <TabPill label={`History (${announcements.length})`} active={tab === 'history'} onClick={() => setTab('history')} />
          </div>
        </div>
      </motion.div>

      {tab === 'compose' && (
        <motion.div variants={fade} custom={1} initial="hidden" animate="show">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* Compose form */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
              <SLabel>New announcement</SLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>

                <div>
                  <SLabel>Title</SLabel>
                  <input
                    value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Scheduled maintenance — Jul 10"
                    style={{ width: '100%', background: T.surface, border: `1px solid #242424`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: T.textPrimary, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <SLabel>Message body</SLabel>
                  <textarea
                    value={body} onChange={e => setBody(e.target.value)}
                    placeholder="Write your message to gym owners and admins…"
                    rows={6}
                    style={{ width: '100%', background: T.surface, border: `1px solid #242424`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: T.textPrimary, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <p style={{ fontSize: 10, color: T.textMuted, textAlign: 'right', margin: '3px 0 0' }}>{charCount} / 1000 chars</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <SLabel>Type</SLabel>
                    <select value={type} onChange={e => setType(e.target.value)}
                      style={{ width: '100%', background: T.surface, border: `1px solid #242424`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: T.textSecondary, outline: 'none', cursor: 'pointer' }}>
                      <option value="info">Info</option>
                      <option value="feature">New feature</option>
                      <option value="warning">Warning</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <SLabel>Audience</SLabel>
                    <select value={audience} onChange={e => setAudience(e.target.value)}
                      style={{ width: '100%', background: T.surface, border: `1px solid #242424`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: T.textSecondary, outline: 'none', cursor: 'pointer' }}>
                      <option value="all">All gyms</option>
                      <option value="growth_plus">Growth+ only</option>
                      <option value="growth">Growth only</option>
                      <option value="starter">Starter only</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button onClick={sendAnnouncement} disabled={!title.trim() || !body.trim() || sending}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: sent ? '#1a2a1a' : T.textPrimary, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: sent ? '#4a7a5a' : '#000', cursor: (!title.trim() || !body.trim() || sending) ? 'not-allowed' : 'pointer', opacity: (!title.trim() || !body.trim()) ? 0.4 : 1 }}>
                    {sent ? <CheckmarkCircle01Icon size={14} /> : <MailSend01Icon size={14} />}
                    {sending ? 'Sending…' : sent ? 'Sent!' : 'Send now'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Preview */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
                <SLabel>Preview</SLabel>
                <div style={{ background: T.surface, borderRadius: 10, padding: 14, border: `1px solid ${T.border}`, marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.textMuted }} />
                    <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{type}</span>
                    <span style={{ fontSize: 10, color: T.textMuted }}>Platform notification</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: '0 0 6px' }}>
                    {title || 'Announcement title…'}
                  </p>
                  <p style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6, margin: 0 }}>
                    {body || 'Your message body will appear here.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div style={{ background: T.surface, borderRadius: 7, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Building01Icon size={11} style={{ color: T.textSecondary }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary }}>{audienceLabel}</span>
                  </div>
                  <div style={{ background: T.surface, borderRadius: 7, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <UserGroupIcon size={11} style={{ color: T.textSecondary }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary }}>Email to owners</span>
                  </div>
                </div>
              </div>

              {/* Delivery channels */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
                <SLabel>Delivery channels</SLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                  {[
                    { channel: 'Email digest',        desc: 'Sent to gym owner email addresses.',  on: true  },
                    { channel: 'In-app banner',        desc: 'Shown in the admin dashboard topbar.', on: false },
                    { channel: 'Push notification',    desc: 'Mobile push to the Gymflow app.',     on: false },
                  ].map(ch => (
                    <div key={ch.channel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, margin: 0 }}>{ch.channel}</p>
                        <p style={{ fontSize: 11, color: T.textMuted, margin: '2px 0 0' }}>{ch.desc}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ch.on ? '#4a7a5a' : T.textMuted }} />
                        <span style={{ fontSize: 11, color: T.textMuted }}>{ch.on ? 'Active' : 'Off'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {tab === 'history' && (
        <motion.div variants={fade} custom={1} initial="hidden" animate="show">
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, gap: 8 }}>
              <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Announcement</span></div>
              <div style={{ width: 100 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Type</span></div>
              <div style={{ width: 140 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Audience</span></div>
              <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recipients</span></div>
              <div style={{ width: 110 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sent</span></div>
            </div>

            {loading ? (
              <div style={{ padding: 24 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ height: 40, background: '#111', borderRadius: 6, marginBottom: 8 }} />
                ))}
              </div>
            ) : announcements.length === 0 ? (
              <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '32px 0' }}>No announcements sent yet.</p>
            ) : announcements.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.borderSubtle}` }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</p>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message.slice(0, 80)}{a.message.length > 80 ? '…' : ''}</p>
                </div>
                <div style={{ width: 100 }}>
                  <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{a.type}</span>
                </div>
                <div style={{ width: 140, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building01Icon size={10} style={{ color: T.textMuted }} />
                  <span style={{ fontSize: 11, color: T.textSecondary }}>{a.audience}</span>
                </div>
                <div style={{ width: 90 }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>{a.sent_to} gym{a.sent_to !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ width: 110 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>{fmtDate(a.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
