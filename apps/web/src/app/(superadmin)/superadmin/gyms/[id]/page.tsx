'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft01Icon, Building01Icon, UserGroupIcon, Wallet01Icon,
  QrCode01Icon, ArrowUpRight01Icon, Alert01Icon, CheckmarkCircle01Icon,
  Calendar01Icon, Mail01Icon, SmartPhone01Icon, CrownIcon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'
import { setToken, setTenantSlug } from '@/lib/auth'
import { type GymRow, mapGym } from '../../page'

// Label → raw key for plan PATCH
const PLAN_KEY: Record<string, string> = {
  Starter: 'starter', Growth: 'growth', 'Growth+': 'growth_plus', Enterprise: 'enterprise',
}
const PLAN_LABELS = ['Starter', 'Growth', 'Growth+', 'Enterprise']
const PLAN_PRICE: Record<string, number> = { Starter: 0, Growth: 9900, 'Growth+': 19900, Enterprise: 49900 }

// ─── Override Plan Modal ──────────────────────────────────────────────────────

function OverridePlanModal({ gym, onConfirm, onClose, loading }: {
  gym: GymRow; onConfirm: (p: string) => void; onClose: () => void; loading: boolean
}) {
  const [selected, setSelected] = useState(gym.plan)
  const T = { card: '#0a0a0a', border: '#1a1a1a', borderSubtle: '#141414', textPrimary: '#f0f0f0', textSecondary: '#555', textMuted: '#333' }
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 14, padding: 24, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <CrownIcon size={14} style={{ color: T.textSecondary }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Override plan</p>
        </div>
        <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 18px' }}>{gym.name} · currently on <strong style={{ color: T.textSecondary }}>{gym.plan}</strong></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
          {PLAN_LABELS.map(label => {
            const isActive = selected === label
            return (
              <button key={label} onClick={() => setSelected(label)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 13px', borderRadius: 8, background: isActive ? '#111' : 'none', border: `1px solid ${isActive ? '#2a2a2a' : '#1a1a1a'}`, cursor: 'pointer', outline: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#888' : '#333' }} />
                  <span style={{ fontSize: 13, color: isActive ? T.textPrimary : T.textSecondary }}>{label}</span>
                </div>
                <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>
                  {PLAN_PRICE[label] === 0 ? 'Free' : `₣${PLAN_PRICE[label].toLocaleString('fr-CM')}/mo`}
                </span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, background: 'none', border: '1px solid #1a1a1a', color: T.textSecondary, cursor: 'pointer', outline: 'none' }}>Cancel</button>
          <button onClick={() => onConfirm(selected)} disabled={loading || selected === gym.plan}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: selected === gym.plan ? '#1a1a1a' : '#f0f0f0', border: 'none', color: selected === gym.plan ? T.textMuted : '#0a0a0a', cursor: selected === gym.plan ? 'default' : 'pointer', outline: 'none', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({ gym, onConfirm, onClose, loading }: {
  gym: GymRow; onConfirm: () => void; onClose: () => void; loading: boolean
}) {
  const T = { textPrimary: '#f0f0f0', textSecondary: '#555', textMuted: '#333' }
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 380, background: '#0a0a0a', border: '1px solid #2a1a1a', borderRadius: 14, padding: 24, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(127,29,29,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Alert01Icon size={14} style={{ color: '#7a3a3a' }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Delete gym?</p>
        </div>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 8px', lineHeight: 1.5 }}>
          <strong style={{ color: T.textPrimary }}>{gym.name}</strong> will be archived and all access revoked.
        </p>
        <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 22px', lineHeight: 1.6 }}>Data is preserved but the gym is permanently cancelled. This cannot be undone from the UI.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, background: 'none', border: '1px solid #1a1a1a', color: '#555', cursor: 'pointer', outline: 'none' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: '#7f1d1d', border: 'none', color: '#fca5a5', cursor: 'pointer', outline: 'none', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Deleting…' : 'Delete gym'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Send Message Modal ───────────────────────────────────────────────────────

function SendMessageModal({ gym, onClose }: { gym: GymRow; onClose: () => void }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const T2 = { card: '#0a0a0a', border: '#1a1a1a', textPrimary: '#f0f0f0', textSecondary: '#555', textMuted: '#333' }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return
    setLoading(true); setError(null)
    try {
      await superApi.post(`/api/superadmin/gyms/${gym.id}/message`, { subject, body })
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally { setLoading(false) }
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 460, background: T2.card, border: `1px solid ${T2.border}`, borderRadius: 14, padding: 24, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Mail01Icon size={14} style={{ color: T2.textSecondary }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: T2.textPrimary, margin: 0 }}>Send message</p>
        </div>
        <p style={{ fontSize: 12, color: T2.textMuted, margin: '0 0 18px' }}>To: <span style={{ color: T2.textSecondary }}>{gym.owner}</span> · {gym.email}</p>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckmarkCircle01Icon size={32} style={{ color: '#4a7a5a', margin: '0 auto 10px', display: 'block' }} />
            <p style={{ fontSize: 13, color: T2.textSecondary, margin: 0 }}>Message sent successfully.</p>
            <button onClick={onClose} style={{ marginTop: 16, padding: '7px 18px', borderRadius: 8, fontSize: 12, background: '#f0f0f0', border: 'none', color: '#0a0a0a', cursor: 'pointer', outline: 'none' }}>Close</button>
          </div>
        ) : (
          <>
            <input
              value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${T2.border}`, background: '#111', color: T2.textPrimary, fontSize: 13, outline: 'none', marginBottom: 10 }}
            />
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${T2.border}`, background: '#111', color: T2.textPrimary, fontSize: 13, outline: 'none', resize: 'vertical', marginBottom: 14, fontFamily: 'inherit' }}
            />
            {error && <p style={{ fontSize: 11, color: '#f87171', margin: '0 0 10px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, background: 'none', border: `1px solid ${T2.border}`, color: T2.textSecondary, cursor: 'pointer', outline: 'none' }}>Cancel</button>
              <button onClick={handleSend} disabled={loading || !subject.trim() || !body.trim()}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: !subject.trim() || !body.trim() ? '#1a1a1a' : '#f0f0f0', border: 'none', color: !subject.trim() || !body.trim() ? T2.textMuted : '#0a0a0a', cursor: loading ? 'default' : 'pointer', outline: 'none', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

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

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

const GYM_ACTIVITY = [
  { action: 'Member check-in',       who: 'Amina Nkosi',      time: '5 min ago'  },
  { action: 'Payment received',      who: '₣15,000',          time: '2h ago'     },
  { action: 'New member registered', who: 'Kofi Mensah',      time: '3h ago'     },
  { action: 'Subscription renewed',  who: 'Fatou Diallo',     time: 'Yesterday'  },
  { action: 'Admin login',           who: 'Owner',            time: 'Yesterday'  },
  { action: 'Plan upgraded',         who: 'Growth → Growth+', time: '3d ago'     },
]

const EMPTY: GymRow = {
  id: '', name: '—', owner: '—', email: '', country: '—', city: '—',
  plan: '—', status: '—', members: 0, checkins: 0, revenueXAF: 0, joinedAt: '—', lastSeen: '—', renewalAt: null,
}

function SLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
      {children}
    </p>
  )
}

export default function GymDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [gym, setGym] = useState<GymRow>(EMPTY)
  const [overridePlanModal, setOverridePlanModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [sendMessageModal, setSendMessageModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  async function fetchGym() {
    if (!id) return
    const r = await superApi.get<Record<string, unknown>>(`/api/superadmin/gyms/${id}`)
    setGym(mapGym(r))
  }

  useEffect(() => {
    fetchGym().catch(() => {})
  }, [id])

  async function patchGym(body: Record<string, unknown>) {
    setActionError(null)
    setActionLoading(true)
    try {
      await superApi.patch(`/api/superadmin/gyms/${id}`, body)
      await fetchGym()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      setActionError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSuspend() { await patchGym({ status: 'suspended' }) }
  async function handleReinstate() { await patchGym({ status: 'active' }) }

  async function handleOverridePlan(planLabel: string) {
    const planKey = PLAN_KEY[planLabel]
    if (!planKey) return
    await patchGym({ plan: planKey })
    setOverridePlanModal(false)
  }

  async function handleDelete() {
    setActionError(null)
    setActionLoading(true)
    try {
      await superApi.patch(`/api/superadmin/gyms/${id}`, { status: 'cancelled' })
      setDeleteModal(false)
      router.push('/superadmin/gyms')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      setActionError(msg)
      setActionLoading(false)
    }
  }

  async function handleImpersonate() {
    setActionError(null)
    setActionLoading(true)
    try {
      const res = await superApi.post<{ token: string; tenant: { slug: string } }>(
        `/api/superadmin/impersonate/${id}`,
      )
      // Set token then open dashboard in a new tab — superadmin session is preserved
      setToken(res.token)
      setTenantSlug(res.tenant.slug)
      window.open('/dashboard', '_blank')
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Impersonate failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResetPassword() {
    setActionError(null)
    setActionSuccess(null)
    setActionLoading(true)
    try {
      await superApi.post(`/api/superadmin/gyms/${id}/reset-password`)
      setActionSuccess('Password reset email sent.')
      setTimeout(() => setActionSuccess(null), 4000)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setActionLoading(false)
    }
  }

  const monthlyRevenue = gym.revenueXAF * 12

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      {/* Back */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show" style={{ marginBottom: 16 }}>
        <Link href="/superadmin/gyms"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary, textDecoration: 'none' }}>
          <ArrowLeft01Icon size={13} /> Back to gyms
        </Link>
      </motion.div>

      {/* Header card */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show" style={{ marginBottom: 14 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#111', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#555' }}>{gym.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>{gym.name}</h1>
                  <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>
                    {gym.plan}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <StatusPill label={gym.status} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    { icon: Building01Icon,  text: `${gym.city}, ${gym.country}` },
                    { icon: Calendar01Icon,  text: `Joined ${gym.joinedAt}` },
                    { icon: Mail01Icon,      text: gym.email },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon size={11} style={{ color: T.textMuted }} />
                      <span style={{ fontSize: 12, color: T.textSecondary }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {actionError && (
                <p style={{ fontSize: 11, color: '#f87171', margin: 0, textAlign: 'right' }}>{actionError}</p>
              )}
              {actionSuccess && (
                <p style={{ fontSize: 11, color: '#4ade80', margin: 0, textAlign: 'right' }}>{actionSuccess}</p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSendMessageModal(true)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'none', border: `1px solid ${T.border}`, color: T.textSecondary, cursor: 'pointer' }}>
                Send message
              </button>
              <button onClick={handleImpersonate} disabled={actionLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: '#f0f0f0', border: 'none', color: '#0a0a0a', cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}>
                <ArrowUpRight01Icon size={13} /> {actionLoading ? 'Loading…' : 'Impersonate'}
              </button>
              {gym.status !== 'suspended' ? (
                <button onClick={handleSuspend} disabled={actionLoading} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'none', border: `1px solid #7a3a3a`, color: '#7a3a3a', cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}>
                  {actionLoading ? 'Saving…' : 'Suspend'}
                </button>
              ) : (
                <button onClick={handleReinstate} disabled={actionLoading} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'none', border: `1px solid #4a7a5a`, color: '#4a7a5a', cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}>
                  {actionLoading ? 'Saving…' : 'Reinstate'}
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Members',    value: gym.members,  icon: UserGroupIcon, sub: 'total' },
          { label: 'Check-ins',  value: gym.checkins, icon: QrCode01Icon,  sub: 'all time' },
          { label: 'Revenue/mo', value: gym.revenueXAF > 0 ? `₣${gym.revenueXAF.toLocaleString('fr-CM')}` : '—', icon: Wallet01Icon, sub: 'recurring' },
          { label: 'Revenue/yr', value: monthlyRevenue > 0 ? `₣${monthlyRevenue.toLocaleString('fr-CM')}` : '—', icon: Wallet01Icon, sub: 'annualized' },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
              <Icon size={14} style={{ color: T.textMuted }} />
              <p style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, margin: '10px 0 2px', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {kpi.value}
              </p>
              <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{kpi.label}</p>
              <p style={{ fontSize: 10, color: T.textMuted, margin: '2px 0 0' }}>{kpi.sub}</p>
            </div>
          )
        })}
      </motion.div>

      {/* Detail grid */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Owner info */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ marginBottom: 16 }}><SLabel>Owner & account</SLabel></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1a1a1a', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>
                {gym.owner.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0 }}>{gym.owner}</p>
              <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>Owner · Admin</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Email',       value: gym.email,    icon: Mail01Icon      },
              { label: 'City',        value: gym.city,     icon: Building01Icon  },
              { label: 'Joined',      value: gym.joinedAt, icon: Calendar01Icon  },
              { label: 'Last active', value: gym.lastSeen, icon: SmartPhone01Icon },
            ].map(row => {
              const Icon = row.icon
              return (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={11} style={{ color: T.textMuted }} />
                    <span style={{ fontSize: 12, color: T.textSecondary }}>{row.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary }}>{row.value || '—'}</span>
                </div>
              )
            })}
          </div>
          <div style={{ height: 1, background: T.border, margin: '16px 0' }} />
          <div>
            <div style={{ marginBottom: 10 }}><SLabel>Plan history</SLabel></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { from: 'Starter', to: gym.plan === 'Growth+' ? 'Growth' : gym.plan, date: gym.joinedAt },
                ...(gym.plan !== 'Starter' ? [{ from: gym.plan === 'Growth+' ? 'Growth' : 'Starter', to: gym.plan, date: '3 months later' }] : []),
              ].map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckmarkCircle01Icon size={11} style={{ color: T.textMuted }} />
                  <span style={{ fontSize: 12, color: T.textSecondary, flex: 1 }}>
                    {ev.from} → <span style={{ color: T.textPrimary, fontWeight: 500 }}>{ev.to}</span>
                  </span>
                  <span style={{ fontSize: 11, color: T.textMuted }}>{ev.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity log */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SLabel>Activity log</SLabel>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a7a5a' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {GYM_ACTIVITY.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.textMuted, marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, margin: 0 }}>{ev.action}</p>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: '2px 0 0' }}>{ev.who}</p>
                </div>
                <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>{ev.time}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: T.border, margin: '16px 0' }} />

          <div>
            <div style={{ marginBottom: 10 }}><SLabel>Admin actions</SLabel></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={handleResetPassword} disabled={actionLoading} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 500, background: 'none', border: `1px solid ${T.border}`, color: T.textSecondary, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading ? 'Sending…' : 'Reset password'}
              </button>
              <button onClick={() => setOverridePlanModal(true)} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 500, background: 'none', border: `1px solid ${T.border}`, color: T.textSecondary, cursor: 'pointer' }}>
                Override plan
              </button>
              <button onClick={() => setDeleteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 500, background: 'none', border: `1px solid #7f1d1d`, color: '#7a3a3a', cursor: 'pointer' }}>
                <Alert01Icon size={11} /> Delete gym
              </button>
            </div>
          </div>
        </div>

      </motion.div>

      {sendMessageModal && (
        <SendMessageModal gym={gym} onClose={() => setSendMessageModal(false)} />
      )}
      {overridePlanModal && (
        <OverridePlanModal
          gym={gym}
          onConfirm={handleOverridePlan}
          onClose={() => setOverridePlanModal(false)}
          loading={actionLoading}
        />
      )}
      {deleteModal && (
        <DeleteModal
          gym={gym}
          onConfirm={handleDelete}
          onClose={() => setDeleteModal(false)}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
