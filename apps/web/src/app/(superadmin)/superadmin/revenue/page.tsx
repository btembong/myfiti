'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet01Icon, AnalyticsUpIcon, ArrowUp01Icon, Alert01Icon, CheckmarkCircle01Icon } from 'hugeicons-react'
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

const PLAN_LABEL: Record<string, string> = { growth_plus: 'Growth+', growth: 'Growth', starter: 'Starter', enterprise: 'Enterprise' }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, ...style }}>{children}</div>
}

function SLabel({ children }: { children: string }) {
  return <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{children}</p>
}

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

interface Transaction { id: string; tenant_name: string; amount_xaf: number; status: string; paid_at: string | null; plan: string }
interface RevenueData {
  mrr: number; arr: number
  byPlan: { plan: string; price: number; count: number; revenue: number }[]
  monthly: { month: string; revenue: number }[]
  transactions: Transaction[]
}

export default function RevenuePage() {
  const [period, setPeriod] = useState('30d')
  const [rev, setRev] = useState<RevenueData>({ mrr: 0, arr: 0, byPlan: [], monthly: [], transactions: [] })

  useEffect(() => {
    superApi.get<RevenueData>('/api/superadmin/revenue')
      .then(r => setRev(r))
      .catch(() => {})
  }, [])

  const totalPayingGyms = rev.byPlan.filter(p => p.price > 0).reduce((a, p) => a + p.count, 0)
  const maxPlanRev = Math.max(...rev.byPlan.map(p => p.revenue), 1)
  const monthly = rev.monthly.length > 0 ? rev.monthly : [{ month: '—', revenue: 0 }]
  const maxMonthRev = Math.max(...monthly.map(d => d.revenue), 1)
  const failedCount = rev.transactions.filter(t => t.status === 'overdue' || t.status === 'failed').length
  const PERIODS = ['7d', '30d', '90d', '1y']

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Revenue</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Platform-level billing and subscription revenue.</p>
          </div>
          <div style={{ display: 'flex', gap: 2, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 3 }}>
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: period === p ? '#1a1a1a' : 'none', border: period === p ? `1px solid ${T.border}` : '1px solid transparent', color: period === p ? T.textPrimary : T.textMuted, cursor: 'pointer', transition: 'all 0.1s' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'MRR',    value: `₣${rev.mrr.toLocaleString('fr-CM')}`,  icon: Wallet01Icon },
          { label: 'ARR',    value: `₣${rev.arr.toLocaleString('fr-CM')}`,  icon: AnalyticsUpIcon },
          { label: 'Paying gyms', value: totalPayingGyms,                    icon: CheckmarkCircle01Icon },
          { label: 'Failed payments', value: failedCount, icon: Alert01Icon },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <Card key={i}>
              <Icon size={14} style={{ color: T.textMuted }} />
              <p style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, margin: '10px 0 2px', letterSpacing: '-0.02em', lineHeight: 1 }}>{kpi.value}</p>
              <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{kpi.label}</p>
            </Card>
          )
        })}
      </motion.div>

      {/* Charts row */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>

        {/* Monthly revenue chart */}
        <Card>
          <div style={{ marginBottom: 20 }}><SLabel>Monthly revenue trend</SLabel></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
            {monthly.map(d => (
              <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: '100%', borderRadius: '3px 3px 0 0',
                  height: `${Math.round((d.revenue / maxMonthRev) * 100)}px`,
                  background: '#f0f0f0',
                  minHeight: 4, transition: 'height 0.3s',
                }} />
                <span style={{ fontSize: 10, color: T.textMuted }}>{d.month}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: T.border, margin: '14px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>MoM growth</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowUp01Icon size={11} style={{ color: T.textSecondary }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>17% this month</span>
            </div>
          </div>
        </Card>

        {/* Revenue by plan */}
        <Card>
          <div style={{ marginBottom: 20 }}><SLabel>Revenue by plan</SLabel></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rev.byPlan.length > 0 ? rev.byPlan.map(r => {
              const label = r.plan === 'growth_plus' ? 'Growth+' : r.plan === 'growth' ? 'Growth' : r.plan === 'starter' ? 'Starter' : r.plan
              return (
                <div key={r.plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: '#f0f0f0' }} />
                      <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
                      <span style={{ fontSize: 11, color: T.textMuted }}>({r.count} gyms)</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: r.revenue > 0 ? T.textPrimary : T.textMuted }}>
                      {r.revenue > 0 ? `₣${r.revenue.toLocaleString('fr-CM')}/mo` : 'Free'}
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: '#111', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: '#f0f0f0', width: `${maxPlanRev > 0 ? (r.revenue / maxPlanRev) * 100 : 0}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            }) : (
              <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '20px 0' }}>No plan data yet.</p>
            )}
          </div>
        </Card>

      </motion.div>

      {/* Transaction history */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
            <SLabel>Recent transactions</SLabel>
          </div>
          {/* Column headers */}
          <div style={{ display: 'flex', padding: '8px 18px', borderBottom: `1px solid ${T.borderSubtle}` }}>
            <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gym</span></div>
            <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Plan</span></div>
            <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span></div>
            <div style={{ width: 110 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date</span></div>
            <div style={{ width: 100, textAlign: 'right' }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Amount</span></div>
          </div>
          {rev.transactions.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '20px 0' }}>No transactions yet.</p>
          ) : rev.transactions.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderBottom: `1px solid ${T.borderSubtle}`, transition: 'background 0.1s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: T.textPrimary }}>{t.tenant_name}</span>
              <div style={{ width: 90 }}>
                <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{PLAN_LABEL[t.plan] ?? t.plan}</span>
              </div>
              <div style={{ width: 90 }}>
                <StatusPill label={t.status} />
              </div>
              <span style={{ width: 110, fontSize: 11, color: T.textSecondary }}>
                {t.paid_at ? new Date(t.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </span>
              <span style={{ width: 100, textAlign: 'right', fontSize: 12, fontWeight: 600, color: t.amount_xaf > 0 ? T.textPrimary : T.textMuted }}>
                {t.amount_xaf > 0 ? `₣${t.amount_xaf.toLocaleString('fr-CM')}` : '—'}
              </span>
            </div>
          ))}
        </Card>
      </motion.div>

    </div>
  )
}
