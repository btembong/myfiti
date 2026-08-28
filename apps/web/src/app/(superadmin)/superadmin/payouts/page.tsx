'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet01Icon, CheckmarkCircle01Icon,
  Download01Icon, Alert01Icon, Building01Icon,
  ArrowRight01Icon, RefreshIcon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'
import { type GymRow, mapGym } from '../page'

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

const PLATFORM_FEE_PCT = 0.15

type PayoutHistoryRow = { period: string; gross: number; fees: number; net: number; gyms: number; status: string }

function SLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{children}</p>
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, ...style }}>{children}</div>
}

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

function Dropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 32, background: T.surface, border: '1px solid #242424', borderRadius: 8, fontSize: 13, color: T.textSecondary, cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' }}>
        {value}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden', zIndex: 50, minWidth: '100%' }}>
            {options.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false) }}
                style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 13, color: o === value ? T.textPrimary : T.textSecondary, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', outline: 'none', whiteSpace: 'nowrap' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                {o}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function exportPayoutsCSV(rows: PayoutHistoryRow[]) {
  const headers = ['Period', 'Gross', 'Platform Fees', 'Net Paid', 'Gyms', 'Status']
  const lines = rows.map(r => [r.period, r.gross, r.fees, r.net, r.gyms, r.status].join(','))
  const csv = [headers.join(','), ...lines].join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'payout-history.csv'; a.click()
}

export default function PayoutsPage() {
  const [gyms, setGyms]           = useState<GymRow[]>([])
  const [history, setHistory]     = useState<PayoutHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [month, setMonth]         = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    Promise.all([
      superApi.get<{ gyms: Record<string, unknown>[] }>('/api/superadmin/gyms'),
      superApi.get<{ history: PayoutHistoryRow[] }>('/api/superadmin/payouts/history'),
    ]).then(([gr, hr]) => {
      const mapped = gr.gyms.map(mapGym)
      setGyms(mapped)
      const rows = hr.history ?? []
      setHistory(rows)
      if (rows.length > 0 && !month) setMonth(rows[0].period)
    }).catch(() => {}).finally(() => setHistoryLoading(false))
  }, [])

  const payouts = useMemo(() => gyms.filter(g => g.revenueXAF > 0).map(g => ({
    id: g.id, gym: g.name, country: g.country, plan: g.plan,
    grossRevenue: g.revenueXAF,
    platformFee:  Math.round(g.revenueXAF * PLATFORM_FEE_PCT),
    netPayout:    Math.round(g.revenueXAF * (1 - PLATFORM_FEE_PCT)),
    status: g.status === 'suspended' ? 'held' : 'scheduled',
    method: 'Mobile Money',
    stripeId: `po_${g.id.slice(0, 8)}`,
  })), [gyms])

  const TOTAL_GROSS = payouts.reduce((a, p) => a + p.grossRevenue, 0)
  const TOTAL_FEES  = payouts.reduce((a, p) => a + p.platformFee, 0)
  const TOTAL_NET   = payouts.reduce((a, p) => a + p.netPayout, 0)
  const TOTAL_HELD  = payouts.filter(p => p.status === 'held').reduce((a, p) => a + p.netPayout, 0)

  const MONTHS = history.map(h => h.period)

  async function processAll() {
    setProcessing(true)
    try {
      await superApi.post('/api/superadmin/payouts/process', { month })
    } catch { /* handled gracefully */ } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Payouts & reconciliation</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Platform fee splits, per-gym net payouts, and disbursement status.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {MONTHS.length > 0 && <Dropdown value={month || MONTHS[0]} options={MONTHS} onChange={setMonth} />}
            <button onClick={() => exportPayoutsCSV(history)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 32, borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'none', border: `1px solid ${T.border}`, color: T.textSecondary, cursor: 'pointer', outline: 'none' }}>
              <Download01Icon size={14} /> Export CSV
            </button>
          </div>
        </div>
      </motion.div>

      {/* Summary KPIs */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Gross collected',     value: `₣${TOTAL_GROSS.toLocaleString('fr-CM')}`, sub: 'Total billed',       icon: Wallet01Icon },
          { label: 'Platform fees (15%)', value: `₣${TOTAL_FEES.toLocaleString('fr-CM')}`,  sub: 'Platform revenue',   icon: ArrowRight01Icon },
          { label: 'Net to gyms',         value: `₣${TOTAL_NET.toLocaleString('fr-CM')}`,   sub: 'After platform cut', icon: CheckmarkCircle01Icon },
          { label: 'Held (suspended)',    value: `₣${TOTAL_HELD.toLocaleString('fr-CM')}`,  sub: 'Pending resolution', icon: Alert01Icon },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
              <Icon size={16} style={{ color: T.textMuted }} />
              <p style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, margin: '10px 0 2px', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: T.textSecondary, margin: 0 }}>{s.label}</p>
              <p style={{ fontSize: 11, color: T.textMuted, margin: '2px 0 0' }}>{s.sub}</p>
            </div>
          )
        })}
      </motion.div>

      {/* Revenue split bar */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show" style={{ marginBottom: 14 }}>
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <SLabel>Revenue split — {month}</SLabel>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#2a2a2a', border: `1px solid ${T.border}` }} />
                <span style={{ fontSize: 12, color: T.textSecondary }}>Platform 15%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f0f0f0' }} />
                <span style={{ fontSize: 12, color: T.textSecondary }}>Gyms 85%</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
            <div style={{ flex: 15, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary }}>₣{TOTAL_FEES.toLocaleString('fr-CM')}</span>
            </div>
            <div style={{ flex: 85, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0a0a0a' }}>₣{TOTAL_NET.toLocaleString('fr-CM')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: T.textSecondary }}>Platform net revenue this month</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>₣{TOTAL_FEES.toLocaleString('fr-CM')}</span>
          </div>
        </Card>
      </motion.div>

      {/* Per-gym breakdown */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show" style={{ marginBottom: 14 }}>
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
            <SLabel>Per-gym payout breakdown</SLabel>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 18px', borderBottom: `1px solid ${T.borderSubtle}`, gap: 8 }}>
            {[['Gym', undefined], ['Gross', 100], ['Platform fee', 110], ['Net payout', 100], ['Method', 110], ['Status', 100], [null, 32]].map(([label, w], i) => (
              <div key={i} style={w ? { width: w as number } : { flex: 1 }}>
                {label && <span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label as string}</span>}
              </div>
            ))}
          </div>
          {payouts.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>No paying gyms this period.</p>
          ) : payouts.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderBottom: `1px solid ${T.borderSubtle}`, transition: 'background 0.1s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary, margin: '0 0 2px' }}>{p.gym}</p>
                <p style={{ fontSize: 10, color: T.textMuted, margin: 0, fontFamily: 'monospace' }}>{p.stripeId}</p>
              </div>
              <div style={{ width: 100 }}><span style={{ fontSize: 13, color: T.textSecondary }}>₣{p.grossRevenue.toLocaleString('fr-CM')}</span></div>
              <div style={{ width: 110 }}><span style={{ fontSize: 13, color: T.textSecondary }}>₣{p.platformFee.toLocaleString('fr-CM')}</span></div>
              <div style={{ width: 100 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>₣{p.netPayout.toLocaleString('fr-CM')}</span>
              </div>
              <div style={{ width: 110 }}><span style={{ fontSize: 12, color: T.textSecondary }}>{p.method}</span></div>
              <div style={{ width: 100 }}>
                <StatusPill label={p.status} />
              </div>
              <div style={{ width: 32 }}>
                {p.status === 'held' && (
                  <button title="Release payout"
                    onClick={() => superApi.post(`/api/superadmin/payouts/${p.id}/release`, {}).catch(() => {})}
                    style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer', color: T.textSecondary, outline: 'none' }}>
                    <CheckmarkCircle01Icon size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>{payouts.length} payouts</span>
            <button onClick={processAll} disabled={processing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500, background: '#f0f0f0', border: 'none', color: '#0a0a0a', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.6 : 1, outline: 'none' }}>
              <RefreshIcon size={14} /> {processing ? 'Processing…' : 'Process all scheduled'}
            </button>
          </div>
        </Card>
      </motion.div>

      {/* Payout history */}
      <motion.div variants={fade} custom={4} initial="hidden" animate="show">
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
            <SLabel>Payout history</SLabel>
            <button onClick={() => exportPayoutsCSV(history)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.textSecondary, outline: 'none' }}>
              <Download01Icon size={13} /> Export all
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 18px', borderBottom: `1px solid ${T.borderSubtle}`, gap: 8 }}>
            {[['Period', 100], ['Gross', 110], ['Platform fees', 110], ['Net paid out', 110], ['Gyms', 70], ['Status', undefined], [null, 80]].map(([label, w], i) => (
              <div key={i} style={w ? { width: w as number } : { flex: 1 }}>
                {label && <span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label as string}</span>}
              </div>
            ))}
          </div>
          {historyLoading ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 32, background: '#111', borderRadius: 6, marginBottom: 8 }} />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>No payout history yet.</p>
          ) : history.map(h => (
            <div key={h.period} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderBottom: `1px solid ${T.borderSubtle}`, transition: 'background 0.1s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <div style={{ width: 100 }}><span style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{h.period}</span></div>
              <div style={{ width: 110 }}><span style={{ fontSize: 13, color: T.textSecondary }}>₣{h.gross.toLocaleString('fr-CM')}</span></div>
              <div style={{ width: 110 }}><span style={{ fontSize: 13, color: T.textSecondary }}>₣{h.fees.toLocaleString('fr-CM')}</span></div>
              <div style={{ width: 110 }}><span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>₣{h.net.toLocaleString('fr-CM')}</span></div>
              <div style={{ width: 70, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building01Icon size={12} style={{ color: T.textMuted }} />
                <span style={{ fontSize: 13, color: T.textSecondary }}>{h.gyms}</span>
              </div>
              <div style={{ flex: 1 }}>
                <StatusPill label={h.status} />
              </div>
              <div style={{ width: 80 }}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${T.border}`, borderRadius: 5, padding: '4px 10px', fontSize: 12, color: T.textSecondary, cursor: 'pointer', outline: 'none' }}>
                  <Download01Icon size={11} /> PDF
                </button>
              </div>
            </div>
          ))}
        </Card>
      </motion.div>

    </div>
  )
}
