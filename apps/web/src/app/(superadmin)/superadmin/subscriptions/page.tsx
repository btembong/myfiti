'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Search01Icon, Download01Icon, ArrowUpRight01Icon,
  Cancel01Icon, Refresh01Icon, More01Icon,
  CreditCardIcon, UserGroupIcon, Wallet01Icon,
  CheckmarkCircle01Icon, Alert01Icon, CrownIcon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'
import { type GymRow, mapGym } from '../page'

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

// Label shown in UI → raw key sent to API
const PLAN_KEY: Record<string, string> = {
  Starter: 'starter', Growth: 'growth', 'Growth+': 'growth_plus', Enterprise: 'enterprise',
}
const PLAN_LABELS = ['Starter', 'Growth', 'Growth+', 'Enterprise']
const PLAN_PRICE: Record<string, number> = { Starter: 0, Growth: 9900, 'Growth+': 19900, Enterprise: 49900 }
const BILLING_CYCLE = 'monthly'

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: active ? '#1a1a1a' : 'none', border: `1px solid ${active ? T.border : 'transparent'}`, color: active ? T.textPrimary : T.textMuted, cursor: 'pointer', transition: 'all 0.1s', outline: 'none' }}>
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

// ─── Change Plan Modal ────────────────────────────────────────────────────────

function ChangePlanModal({ gym, onConfirm, onClose, loading }: {
  gym: GymRow
  onConfirm: (plan: string) => void
  onClose: () => void
  loading: boolean
}) {
  const [selected, setSelected] = useState(gym.plan)

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 14, padding: 24, zIndex: 100 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, margin: '0 0 4px' }}>Change plan</p>
        <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 20px' }}>{gym.name} · currently on <strong style={{ color: T.textSecondary }}>{gym.plan}</strong></p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {PLAN_LABELS.map(label => {
            const price = PLAN_PRICE[label]
            const isActive = selected === label
            return (
              <button key={label} onClick={() => setSelected(label)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: 9, background: isActive ? '#111' : 'none', border: `1px solid ${isActive ? '#2a2a2a' : '#1a1a1a'}`, cursor: 'pointer', outline: 'none', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? T.textSecondary : T.textMuted }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? T.textPrimary : T.textSecondary }}>{label}</span>
                </div>
                <span style={{ fontSize: 12, color: T.textMuted, fontFamily: 'monospace' }}>
                  {price === 0 ? 'Free' : `₣${price.toLocaleString('fr-CM')}/mo`}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'none', border: '1px solid #1a1a1a', color: T.textSecondary, cursor: 'pointer', outline: 'none' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(selected)} disabled={loading || selected === gym.plan}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: selected === gym.plan ? '#1a1a1a' : '#f0f0f0', border: 'none', color: selected === gym.plan ? T.textMuted : '#0a0a0a', cursor: selected === gym.plan ? 'default' : 'pointer', outline: 'none', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Suspend Confirmation Modal ───────────────────────────────────────────────

function SuspendModal({ gym, onConfirm, onClose, loading }: {
  gym: GymRow
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 380, background: '#0a0a0a', border: '1px solid #2a1a1a', borderRadius: 14, padding: 24, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(127,29,29,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Alert01Icon size={15} style={{ color: '#7a3a3a' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Suspend gym?</p>
        </div>
        <p style={{ fontSize: 13, color: T.textSecondary, margin: '0 0 6px', lineHeight: 1.5 }}>
          <strong style={{ color: T.textPrimary }}>{gym.name}</strong> will lose access immediately.
        </p>
        <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 22px', lineHeight: 1.6 }}>
          Members will be unable to check in. The gym owner will see a suspension notice. You can reinstate it at any time.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'none', border: '1px solid #1a1a1a', color: T.textSecondary, cursor: 'pointer', outline: 'none' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#7f1d1d', border: 'none', color: '#fca5a5', cursor: 'pointer', outline: 'none', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Suspending…' : 'Suspend gym'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Record Cash Payment Modal ────────────────────────────────────────────────

const PLAN_PRICE_MONTHLY: Record<string, number> = {
  starter: 0, growth: 9900, growth_plus: 19900, enterprise: 49900,
}

function RecordCashModal({ gym, onConfirm, onClose, loading }: {
  gym: GymRow
  onConfirm: (amount: number, months: number, notes: string) => void
  onClose: () => void
  loading: boolean
}) {
  const suggested = PLAN_PRICE_MONTHLY[gym.plan?.toLowerCase().replace('+','_plus').replace(' ','_')] ?? 0
  const [amount, setAmount]   = useState(suggested)
  const [months, setMonths]   = useState(1)
  const [notes,  setNotes]    = useState('')

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 14, padding: 26, zIndex: 100 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet01Icon size={15} style={{ color: '#16a34a' }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Record cash payment</p>
            <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{gym.name} · {gym.plan} plan</p>
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 6 }}>Amount (XAF)</label>
          <input
            type="number" value={amount} min={0}
            onChange={e => setAmount(Number(e.target.value))}
            style={{ width: '100%', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: T.textPrimary, outline: 'none', boxSizing: 'border-box' }}
          />
          {suggested > 0 && (
            <p style={{ fontSize: 11, color: T.textMuted, margin: '5px 0 0' }}>
              Suggested: ₣{suggested.toLocaleString('fr-CM')}/month
              {months > 1 ? ` · ₣${(suggested * months).toLocaleString('fr-CM')} for ${months} months` : ''}
            </p>
          )}
        </div>

        {/* Months */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 6 }}>Period (months)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 3, 6, 12].map(m => (
              <button key={m} onClick={() => { setMonths(m); if (suggested > 0) setAmount(suggested * m) }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12, fontWeight: 500, background: months === m ? '#1a2a1a' : '#0d0d0d', border: `1px solid ${months === m ? '#16a34a' : '#1e1e1e'}`, color: months === m ? '#4ade80' : T.textSecondary, cursor: 'pointer', outline: 'none' }}>
                {m}mo
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 6 }}>Notes (optional)</label>
          <input
            type="text" value={notes} placeholder="Receipt number, bank branch, etc."
            onChange={e => setNotes(e.target.value)}
            style={{ width: '100%', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: T.textPrimary, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Summary */}
        <div style={{ background: '#0d1a0d', border: '1px solid #1a2a1a', borderRadius: 9, padding: '10px 14px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>Gym receives access until</span>
            <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>
              {(() => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) })()}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>Invoice will be emailed to</span>
            <span style={{ fontSize: 12, color: T.textSecondary }}>{gym.email}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'none', border: '1px solid #1a1a1a', color: T.textSecondary, cursor: 'pointer', outline: 'none' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(amount, months, notes)} disabled={loading || !amount || amount <= 0}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: !amount || amount <= 0 ? '#111' : '#16a34a', border: 'none', color: !amount || amount <= 0 ? T.textMuted : '#fff', cursor: !amount || amount <= 0 ? 'default' : 'pointer', outline: 'none', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Recording…' : 'Confirm & record'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowMenu({ gym, onChangePlan, onSuspend, onReinstate, onRecordCash }: {
  gym: GymRow
  onChangePlan: () => void
  onSuspend: () => void
  onReinstate: () => void
  onRecordCash: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary, outline: 'none' }}>
        <More01Icon size={14} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 180, background: '#0d0d0d', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', zIndex: 50 }}>
            <Link href={`/superadmin/gyms/${gym.id}`} onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', textDecoration: 'none', fontSize: 13, color: T.textSecondary, outline: 'none' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <ArrowUpRight01Icon size={13} /> View gym
            </Link>
            <button onClick={() => { onChangePlan(); setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.textSecondary, textAlign: 'left', outline: 'none' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <CrownIcon size={13} /> Change plan
            </button>
            <button onClick={() => { onRecordCash(); setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#4ade80', textAlign: 'left', outline: 'none' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <Wallet01Icon size={13} /> Record cash payment
            </button>
            <div style={{ height: 1, background: T.border }} />
            {gym.status !== 'suspended' ? (
              <button onClick={() => { onSuspend(); setOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#7a3a3a', textAlign: 'left', outline: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <Cancel01Icon size={13} /> Suspend
              </button>
            ) : (
              <button onClick={() => { onReinstate(); setOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.textSecondary, textAlign: 'left', outline: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <Refresh01Icon size={13} /> Reinstate
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function exportCSV(subs: ReturnType<typeof buildSubs>) {
  const headers = ['Gym', 'Owner', 'Email', 'Plan', 'Status', 'MRR', 'Members', 'Renewal', 'Joined']
  const lines = subs.map(s => [s.gym, s.owner, s.email, s.plan, s.status, s.mrr, s.members, s.renewal, s.joined]
    .map(v => `"${v}"`).join(','))
  const csv = [headers.join(','), ...lines].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'subscriptions.csv'; a.click()
}

function buildSubs(gyms: GymRow[]) {
  return gyms.map(g => {
    const mrr = PLAN_PRICE[g.plan] ?? 0

    // Use real renewal date from DB when available; fall back to estimate
    let renewal: string
    if (g.renewalAt) {
      renewal = g.renewalAt
    } else {
      const joined = new Date(g.joinedAt !== '—' ? g.joinedAt : Date.now())
      const est = new Date()
      est.setDate(joined.getDate())
      if (est <= new Date()) est.setMonth(est.getMonth() + 1)
      renewal = est.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    return {
      id: g.id,
      gym: g.name,
      owner: g.owner,
      email: g.email,
      plan: g.plan,
      status: g.status,
      mrr,
      members: g.members,
      joined: g.joinedAt,
      renewal,
      cycle: BILLING_CYCLE,
    }
  })
}

export default function SubscriptionsPage() {
  const [gyms, setGyms]           = useState<GymRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter]     = useState('all')
  const [actionLoading, setActionLoading]     = useState<string | null>(null)
  const [planModalGym, setPlanModalGym]       = useState<GymRow | null>(null)
  const [suspendModalGym, setSuspendModalGym] = useState<GymRow | null>(null)
  const [cashModalGym, setCashModalGym]       = useState<GymRow | null>(null)
  const [cashError, setCashError]             = useState<string | null>(null)
  const [cashSuccess, setCashSuccess]         = useState<string | null>(null)

  function fetchGyms() {
    return superApi.get<{ gyms: Record<string, unknown>[] }>('/api/superadmin/gyms')
      .then(r => setGyms(r.gyms.map(mapGym)))
  }

  useEffect(() => {
    fetchGyms().catch(() => {}).finally(() => setLoading(false))
  }, [])

  const subs = useMemo(() => buildSubs(gyms), [gyms])

  const filtered = useMemo(() => subs.filter(s => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    const matchPlan   = planFilter === 'all' || s.plan === planFilter
    const matchSearch = !search
      || s.gym.toLowerCase().includes(search.toLowerCase())
      || s.owner.toLowerCase().includes(search.toLowerCase())
      || s.email.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchPlan && matchSearch
  }), [subs, statusFilter, planFilter, search])

  const totalMRR   = subs.filter(s => s.status !== 'suspended').reduce((a, s) => a + s.mrr, 0)
  const activeSubs = subs.filter(s => s.status === 'active').length
  const trialSubs  = subs.filter(s => s.status === 'trial').length
  const suspended  = subs.filter(s => s.status === 'suspended').length
  const paidSubs   = subs.filter(s => s.mrr > 0 && s.status !== 'suspended').length

  async function doSuspend(gymId: string) {
    setActionLoading(gymId + 'suspend')
    try {
      await superApi.patch(`/api/superadmin/gyms/${gymId}`, { status: 'suspended' })
      await fetchGyms()
    } catch { /* noop */ } finally {
      setActionLoading(null)
      setSuspendModalGym(null)
    }
  }

  async function handleReinstate(gymId: string) {
    setActionLoading(gymId + 'reinstate')
    try {
      await superApi.patch(`/api/superadmin/gyms/${gymId}`, { status: 'active' })
      await fetchGyms()
    } catch { /* noop */ } finally { setActionLoading(null) }
  }

  async function handleRecordCash(gymId: string, amount: number, months: number, notes: string) {
    setCashError(null)
    setActionLoading(gymId + 'cash')
    try {
      const r = await superApi.post<{ ok: boolean; invoice_number: string; renewal_at: string }>(
        '/api/superadmin/billing/record-cash',
        { tenant_id: gymId, amount, period_months: months, notes: notes || undefined },
      )
      setCashSuccess(`Payment recorded. Invoice ${r.invoice_number} emailed. Active until ${new Date(r.renewal_at).toLocaleDateString()}.`)
      setCashModalGym(null)
      await fetchGyms()
    } catch (err) {
      setCashError(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleChangePlan(gymId: string, planLabel: string) {
    const planKey = PLAN_KEY[planLabel] ?? planLabel.toLowerCase().replace('+', '_plus').replace(' ', '_')
    setActionLoading(gymId + 'plan')
    try {
      await superApi.patch(`/api/superadmin/gyms/${gymId}`, { plan: planKey })
      await fetchGyms()
    } catch { /* noop */ } finally {
      setActionLoading(null)
      setPlanModalGym(null)
    }
  }

  const STATUS_FILTERS = [
    { label: 'All',       value: 'all'       },
    { label: 'Active',    value: 'active'    },
    { label: 'Trial',     value: 'trial'     },
    { label: 'Past due',  value: 'past_due'  },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Cancelled', value: 'cancelled' },
  ]

  const pastDue = subs.filter(s => s.status === 'past_due').length

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>

      {/* Cash payment modal */}
      {cashModalGym && (
        <RecordCashModal
          gym={cashModalGym}
          loading={actionLoading === cashModalGym.id + 'cash'}
          onConfirm={(amount, months, notes) => handleRecordCash(cashModalGym.id, amount, months, notes)}
          onClose={() => { setCashModalGym(null); setCashError(null) }}
        />
      )}

      {/* Feedback banners */}
      {cashSuccess && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#052e16', border: '1px solid #16a34a', borderRadius: 10, padding: '12px 20px', zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 520 }}>
          <CheckmarkCircle01Icon size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#4ade80' }}>{cashSuccess}</span>
          <button onClick={() => setCashSuccess(null)} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', marginLeft: 8, padding: 0, flexShrink: 0 }}>✕</button>
        </div>
      )}
      {cashError && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 20px', zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 520 }}>
          <Alert01Icon size={16} style={{ color: '#f87171', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#f87171' }}>{cashError}</span>
          <button onClick={() => setCashError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', marginLeft: 8, padding: 0, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Plan change modal */}
      {planModalGym && (
        <ChangePlanModal
          gym={planModalGym}
          loading={actionLoading === planModalGym.id + 'plan'}
          onConfirm={plan => handleChangePlan(planModalGym.id, plan)}
          onClose={() => setPlanModalGym(null)}
        />
      )}

      {/* Suspend confirmation modal */}
      {suspendModalGym && (
        <SuspendModal
          gym={suspendModalGym}
          loading={actionLoading === suspendModalGym.id + 'suspend'}
          onConfirm={() => doSuspend(suspendModalGym.id)}
          onClose={() => setSuspendModalGym(null)}
        />
      )}

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Subscriptions</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>All gym subscription plans, billing cycles, and renewal dates.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px', height: 32, background: T.surface, border: '1px solid #242424', borderRadius: 8 }}>
              <Search01Icon size={14} style={{ color: T.textSecondary, flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search gyms…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: T.textPrimary, width: 180 }} />
            </div>
            <Dropdown
              value={planFilter}
              options={[
                { label: 'All plans',  value: 'all'       },
                { label: 'Starter',    value: 'Starter'   },
                { label: 'Growth',     value: 'Growth'    },
                { label: 'Growth+',    value: 'Growth+'   },
                { label: 'Enterprise', value: 'Enterprise'},
              ]}
              onChange={setPlanFilter}
            />
            <button onClick={() => exportCSV(filtered)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 32, borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'none', border: `1px solid ${T.border}`, color: T.textSecondary, cursor: 'pointer', outline: 'none' }}>
              <Download01Icon size={14} /> Export CSV
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total MRR',   value: `₣${totalMRR.toLocaleString('fr-CM')}`, icon: Wallet01Icon,          accent: false },
          { label: 'Active subs', value: activeSubs,                               icon: CheckmarkCircle01Icon, accent: false },
          { label: 'Trials',      value: trialSubs,                                icon: CreditCardIcon,        accent: false },
          { label: 'Paying gyms', value: paidSubs,                                 icon: UserGroupIcon,         accent: false },
          { label: 'Past due',    value: pastDue,                                  icon: Alert01Icon,           accent: pastDue > 0 },
          { label: 'Suspended',   value: suspended,                                icon: Cancel01Icon,          accent: false },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} style={{ background: T.card, border: `1px solid ${kpi.accent ? '#7a3a3a' : T.border}`, borderRadius: 12, padding: 16 }}>
              <Icon size={16} style={{ color: kpi.accent ? '#7a3a3a' : T.textMuted }} />
              <p style={{ fontSize: 24, fontWeight: 700, color: kpi.accent ? '#c07070' : T.textPrimary, margin: '10px 0 2px', letterSpacing: '-0.02em', lineHeight: 1 }}>{kpi.value}</p>
              <p style={{ fontSize: 12, color: T.textSecondary, margin: 0 }}>{kpi.label}</p>
            </div>
          )
        })}
      </motion.div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {STATUS_FILTERS.map(f => (
          <FilterPill key={f.value} label={f.label} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)} />
        ))}
      </div>

      {/* Table */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>

          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, gap: 8 }}>
            <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gym</span></div>
            <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Plan</span></div>
            <div style={{ width: 80 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span></div>
            <div style={{ width: 110 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>MRR</span></div>
            <div style={{ width: 70 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Members</span></div>
            <div style={{ width: 80 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cycle</span></div>
            <div style={{ width: 130 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next renewal</span></div>
            <div style={{ width: 32 }} />
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: 18, background: '#111', borderRadius: 4, marginBottom: 10 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '32px 0' }}>No subscriptions match your filters.</p>
          ) : filtered.map(sub => {
            const gym = gyms.find(g => g.id === sub.id)
            return (
              <div key={sub.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderBottom: `1px solid ${T.borderSubtle}`, opacity: actionLoading?.startsWith(sub.id) ? 0.5 : 1, transition: 'background 0.1s, opacity 0.2s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>

                <Link href={`/superadmin/gyms/${sub.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9, outline: 'none' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#111', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#555' }}>{sub.gym.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.gym}</p>
                    <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{sub.owner} · {sub.email}</p>
                  </div>
                </Link>

                <div style={{ width: 90 }}>
                  <button
                    onClick={e => { e.preventDefault(); if (gym) setPlanModalGym(gym) }}
                    title="Change plan"
                    style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4, cursor: 'pointer', outline: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2a2a2a'; (e.currentTarget as HTMLElement).style.color = T.textPrimary }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.color = T.textSecondary }}>
                    {sub.plan}
                  </button>
                </div>
                <div style={{ width: 80 }}>
                  <StatusPill label={sub.status} />
                </div>
                <div style={{ width: 110 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: sub.mrr > 0 ? T.textPrimary : T.textMuted }}>
                    {sub.mrr > 0 ? `₣${sub.mrr.toLocaleString('fr-CM')}` : 'Free'}
                  </span>
                </div>
                <div style={{ width: 70 }}>
                  <span style={{ fontSize: 13, color: T.textSecondary }}>{sub.members}</span>
                </div>
                <div style={{ width: 80 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>{sub.cycle}</span>
                </div>
                <div style={{ width: 130 }}>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>{sub.renewal}</span>
                </div>
                <div style={{ width: 32 }}>
                  {gym && (
                    <RowMenu
                      gym={gym}
                      onChangePlan={() => setPlanModalGym(gym)}
                      onSuspend={() => setSuspendModalGym(gym)}
                      onReinstate={() => handleReinstate(sub.id)}
                      onRecordCash={() => { setCashError(null); setCashSuccess(null); setCashModalGym(gym) }}
                    />
                  )}
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>
              {filtered.length} subscription{filtered.length !== 1 ? 's' : ''} · MRR ₣{filtered.filter(s => s.status !== 'suspended').reduce((a, s) => a + s.mrr, 0).toLocaleString('fr-CM')}
            </span>
            <button onClick={() => exportCSV(filtered)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, outline: 'none' }}>
              <Download01Icon size={12} /> Export visible
            </button>
          </div>
        </div>
      </motion.div>

      {/* Plan breakdown */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show" style={{ marginTop: 14 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>Plan breakdown</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {PLAN_LABELS.map(plan => {
              const planSubs = subs.filter(s => s.plan === plan)
              const planMRR  = planSubs.filter(s => s.status !== 'suspended').reduce((a, s) => a + s.mrr, 0)
              return (
                <div key={plan} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{plan}</span>
                    <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>
                      {planSubs.length} gyms
                    </span>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, margin: '0 0 4px', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {planMRR > 0 ? `₣${planMRR.toLocaleString('fr-CM')}` : '—'}
                  </p>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>MRR from this plan</p>
                </div>
              )
            })}
          </div>
        </div>
      </motion.div>

    </div>
  )
}
