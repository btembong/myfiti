'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search01Icon, Download01Icon,
  CheckmarkCircle01Icon, Clock01Icon, Cancel01Icon, RefreshIcon, MailSend01Icon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'
import { getSuperToken } from '@/lib/auth'

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

type Invoice = {
  id: string
  invoice_number: string
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  amount_xaf: number
  status: string
  period_start: string
  period_end: string
  due_date: string
  paid_at: string | null
  plan: string
  plan_label: string
  created_at: string
  pdf_url: string | null
}

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
      {children}
    </p>
  )
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
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 32, background: T.surface, border: '1px solid #242424', borderRadius: 8, fontSize: 12, color: T.textSecondary, cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' }}>
        {current?.label ?? value}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden', zIndex: 50, minWidth: '100%' }}>
            {options.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
                style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 12, color: o.value === value ? T.textPrimary : T.textSecondary, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', outline: 'none', whiteSpace: 'nowrap' }}
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

const STATUS_ICON: Record<string, React.ElementType> = {
  paid: CheckmarkCircle01Icon,
  overdue: Cancel01Icon,
  pending: Clock01Icon,
  draft: Clock01Icon,
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtXAF(n: number) {
  return `₣${n.toLocaleString('fr-CM')}`
}

function exportCSV(rows: Invoice[]) {
  const header = ['Invoice #', 'Gym', 'Plan', 'Amount (XAF)', 'Status', 'Period', 'Due Date', 'Paid At']
  const lines = rows.map(r => [
    r.invoice_number,
    r.tenant_name,
    r.plan,
    r.amount_xaf,
    r.status,
    `${fmt(r.period_start)} – ${fmt(r.period_end)}`,
    fmt(r.due_date),
    r.paid_at ? fmt(r.paid_at) : '',
  ].map(v => `"${v}"`).join(','))
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'invoices.csv'; a.click()
  URL.revokeObjectURL(url)
}

async function downloadPDF(invoice: Invoice) {
  const token = getSuperToken()
  const res = await fetch(`/api/superadmin/invoices/${invoice.id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoice.invoice_number}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const PLAN_OPTIONS = [
  { label: 'All plans', value: 'all' },
  { label: 'Starter', value: 'Starter' },
  { label: 'Growth', value: 'Growth' },
  { label: 'Growth+', value: 'Growth+' },
  { label: 'Enterprise', value: 'Enterprise' },
]

const PERIOD_OPTIONS = [
  { label: 'All time', value: 'all' },
  { label: 'This month', value: 'this_month' },
  { label: 'Last month', value: 'last_month' },
  { label: 'Last 3 months', value: 'last_3m' },
  { label: 'Last 6 months', value: 'last_6m' },
  { label: 'This year', value: 'this_year' },
]

function withinPeriod(iso: string, period: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  if (period === 'all') return true
  if (period === 'this_month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  if (period === 'last_month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()
  }
  if (period === 'last_3m') return d >= new Date(now.getFullYear(), now.getMonth() - 3, 1)
  if (period === 'last_6m') return d >= new Date(now.getFullYear(), now.getMonth() - 6, 1)
  if (period === 'this_year') return d.getFullYear() === now.getFullYear()
  return true
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')

  function fetchInvoices() {
    return superApi.get<{ invoices: Invoice[] }>('/api/superadmin/invoices?limit=200')
      .then(d => setInvoices(d.invoices ?? []))
  }

  useEffect(() => {
    fetchInvoices().catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function generateInvoices() {
    setGenerating(true)
    try {
      const r = await superApi.post<{ created: number; skipped: number }>('/api/superadmin/invoices/generate')
      await fetchInvoices()
      alert(`Generated ${r.created} invoice${r.created !== 1 ? 's' : ''}, ${r.skipped} already existed.`)
    } catch { /* noop */ } finally { setGenerating(false) }
  }

  async function markPaid(id: string) {
    try {
      await superApi.patch(`/api/superadmin/invoices/${id}`, { status: 'paid' })
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'paid', paid_at: new Date().toISOString() } : inv))
    } catch { /* noop */ }
  }

  async function resendInvoice(id: string) {
    try {
      await superApi.post(`/api/superadmin/invoices/${id}/resend`)
    } catch { /* noop */ }
  }

  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter
    const matchPlan   = planFilter === 'all'   || (inv.plan_label ?? inv.plan) === planFilter
    const matchPeriod = withinPeriod(inv.created_at, periodFilter)
    const matchSearch = !search
      || inv.tenant_name.toLowerCase().includes(search.toLowerCase())
      || inv.invoice_number.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchPlan && matchPeriod && matchSearch
  })

  const totalRevenue  = invoices.reduce((s, i) => i.status === 'paid' ? s + i.amount_xaf : s, 0)
  const outstanding   = invoices.filter(i => i.status === 'pending' || i.status === 'overdue')
  const outstandingAmt = outstanding.reduce((s, i) => s + i.amount_xaf, 0)
  const overdueCount  = invoices.filter(i => i.status === 'overdue').length
  const paidCount     = invoices.filter(i => i.status === 'paid').length
  const collectionRate = invoices.length > 0 ? Math.round((paidCount / invoices.length) * 100) : 0

  const STATUS_FILTERS = ['all', 'paid', 'pending', 'overdue', 'draft']

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Invoices</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Platform-level billing records for all gym subscriptions.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={generateInvoices} disabled={generating}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 500, color: T.textSecondary, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}>
              <RefreshIcon size={13} />
              {generating ? 'Generating…' : 'Generate this month'}
            </button>
            <button onClick={() => exportCSV(filtered)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 500, color: T.textSecondary, cursor: 'pointer' }}>
              <Download01Icon size={13} />
              Export CSV
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total collected',   value: fmtXAF(totalRevenue) },
          { label: 'Outstanding',       value: fmtXAF(outstandingAmt) },
          { label: 'Paid invoices',     value: paidCount },
          { label: 'Overdue',           value: overdueCount },
          { label: 'Collection rate',   value: `${collectionRate}%` },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, margin: '0 0 3px', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show"
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px', height: 32, background: T.surface, border: `1px solid #242424`, borderRadius: 8 }}>
          <Search01Icon size={12} style={{ color: T.textSecondary, flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search gym or invoice #"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.textPrimary, width: 180 }} />
        </div>
        <Dropdown value={planFilter} options={PLAN_OPTIONS} onChange={setPlanFilter} />
        <Dropdown value={periodFilter} options={PERIOD_OPTIONS} onChange={setPeriodFilter} />
      </motion.div>

      {/* Status filter pills */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show"
        style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {STATUS_FILTERS.map(s => (
          <FilterPill key={s} label={s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
        ))}
      </motion.div>

      {/* Invoice table */}
      <motion.div variants={fade} custom={4} initial="hidden" animate="show">
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>

          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, gap: 8 }}>
            <div style={{ width: 28 }} />
            <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invoice</span></div>
            <div style={{ width: 110 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Plan</span></div>
            <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span></div>
            <div style={{ width: 110 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Amount</span></div>
            <div style={{ width: 130 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Period</span></div>
            <div style={{ width: 110 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Due date</span></div>
            <div style={{ width: 68 }} />
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 18, background: '#111', borderRadius: 4, marginBottom: 10 }} />
              ))}
            </div>
          ) : filtered.length > 0 ? filtered.map(inv => {
            const SIcon = STATUS_ICON[inv.status] ?? Clock01Icon
            return (
              <div key={inv.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${T.borderSubtle}`, transition: 'background 0.1s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>

                <div style={{ width: 28 }}>
                  <SIcon size={13} style={{ color: T.textSecondary }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, margin: 0 }}>{inv.tenant_name}</p>
                  </div>
                  <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'monospace' }}>{inv.invoice_number}</span>
                </div>

                <div style={{ width: 110 }}>
                  <span style={{ fontSize: 11, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{inv.plan_label ?? inv.plan}</span>
                </div>

                <div style={{ width: 90 }}>
                  <StatusPill label={inv.status} />
                </div>

                <div style={{ width: 110 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, fontFamily: 'monospace' }}>{fmtXAF(inv.amount_xaf)}</span>
                </div>

                <div style={{ width: 130 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>
                    {fmt(inv.period_start)} –<br />{fmt(inv.period_end)}
                  </span>
                </div>

                <div style={{ width: 110 }}>
                  <span style={{ fontSize: 11, color: inv.status === 'overdue' ? '#7a3a3a' : T.textMuted }}>{fmt(inv.due_date)}</span>
                </div>

                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', width: 96 }}>
                  {(inv.status === 'pending' || inv.status === 'overdue') && (
                    <button onClick={() => markPaid(inv.id)} title="Mark as paid"
                      style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textSecondary }}>
                      <CheckmarkCircle01Icon size={12} />
                    </button>
                  )}
                  <button onClick={() => resendInvoice(inv.id)} title="Resend invoice email"
                    style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textSecondary }}>
                    <MailSend01Icon size={12} />
                  </button>
                  <button onClick={() => downloadPDF(inv)} title="Download PDF"
                    style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textSecondary }}>
                    <Download01Icon size={12} />
                  </button>
                </div>
              </div>
            )
          }) : (
            <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '32px 0' }}>No invoices found.</p>
          )}

          <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>{filtered.length} invoices</span>
            {filtered.length > 0 && (
              <span style={{ fontSize: 11, color: T.textMuted }}>
                Total: <span style={{ color: T.textSecondary, fontWeight: 600 }}>{fmtXAF(filtered.reduce((s, i) => s + i.amount_xaf, 0))}</span>
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Plan breakdown */}
      <motion.div variants={fade} custom={5} initial="hidden" animate="show" style={{ marginTop: 14 }}>
        <div style={{ marginBottom: 10 }}><SLabel>Revenue by plan</SLabel></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {['Starter', 'Growth', 'Growth+', 'Enterprise'].map(plan => {
            const planInvoices = invoices.filter(i => (i.plan_label ?? i.plan) === plan && i.status === 'paid')
            const revenue = planInvoices.reduce((s, i) => s + i.amount_xaf, 0)
            const gymCount = new Set(planInvoices.map(i => i.tenant_id)).size
            return (
              <div key={plan} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, color: T.textSecondary, margin: '0 0 8px', fontWeight: 500 }}>{plan}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, margin: '0 0 3px', letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'monospace' }}>{fmtXAF(revenue)}</p>
                <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{gymCount} gym{gymCount !== 1 ? 's' : ''} · collected</p>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Outstanding invoices callout */}
      {overdueCount > 0 && (
        <motion.div variants={fade} custom={6} initial="hidden" animate="show" style={{ marginTop: 14 }}>
          <div style={{ background: '#100808', border: '1px solid #2a1010', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#7a3a3a', margin: '0 0 3px' }}>{overdueCount} overdue invoice{overdueCount !== 1 ? 's' : ''}</p>
              <p style={{ fontSize: 12, color: '#553030', margin: 0 }}>{fmtXAF(invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount_xaf, 0))} outstanding — consider following up with these gyms.</p>
            </div>
            <button
              onClick={() => setStatusFilter('overdue')}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'none', border: '1px solid #3a1a1a', color: '#7a3a3a', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              View overdue
            </button>
          </div>
        </motion.div>
      )}

    </div>
  )
}
