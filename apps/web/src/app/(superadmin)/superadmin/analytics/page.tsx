'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AnalyticsUpIcon, ArrowUp01Icon, ArrowDown01Icon,
  UserGroupIcon, Wallet01Icon,
  CheckmarkCircle01Icon,
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

type MrrPoint  = { month: string; mrr: number }
type ChurnPoint = { month: string; churned: number; retained: number }
type CohortRow  = { cohort: string; size: number; m1: number | null; m2: number | null; m3: number | null; m6: number | null; m12: number | null; plan: string }
type Analytics  = {
  mrr_history: MrrPoint[]
  churn_by_month: ChurnPoint[]
  cohorts: CohortRow[]
  total_members: number
}

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

function healthScore(gym: GymRow): number {
  let score = 0
  if (gym.status === 'active') score += 30
  else if (gym.status === 'trial') score += 15
  if (gym.plan === 'Growth+') score += 25
  else if (gym.plan === 'Growth') score += 15
  const loginRecency = gym.lastSeen.includes('min') || gym.lastSeen.includes('h ago') ? 25
    : gym.lastSeen === 'Yesterday' ? 20 : gym.lastSeen.includes('2d') ? 10 : 5
  score += loginRecency + Math.min(20, Math.floor(gym.members / 6))
  return Math.min(100, score)
}

function CohortCell({ value }: { value: number | null }) {
  if (value === null) return <div style={{ width: 52, height: 28, borderRadius: 6, background: '#0d0d0d' }} />
  const alpha = Math.max(0.1, value / 100)
  return (
    <div style={{ width: 52, height: 28, borderRadius: 6, background: `rgba(240,240,240,${alpha * 0.15})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: value >= 80 ? '#f0f0f0' : value >= 40 ? '#888' : '#555' }}>{value}%</span>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, ...style }}>{children}</div>
}

function SLabel({ children }: { children: string }) {
  return <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{children}</p>
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('12m')
  const [gyms, setGyms] = useState<GymRow[]>([])
  const [overview, setOverview] = useState({ mrr: 0, activeGyms: 0, totalGyms: 0, trialGyms: 0 })
  const [analytics, setAnalytics] = useState<Analytics>({ mrr_history: [], churn_by_month: [], cohorts: [], total_members: 0 })

  useEffect(() => {
    Promise.all([
      superApi.get<{ gyms: Record<string, unknown>[] }>('/api/superadmin/gyms'),
      superApi.get<typeof overview>('/api/superadmin/overview'),
      superApi.get<Analytics>('/api/superadmin/analytics'),
    ]).then(([gr, ov, an]) => {
      setGyms(gr.gyms.map(mapGym))
      setOverview(ov)
      setAnalytics({
        mrr_history: an.mrr_history ?? [],
        churn_by_month: an.churn_by_month ?? [],
        cohorts: an.cohorts ?? [],
        total_members: an.total_members ?? 0,
      })
    }).catch(() => {})
  }, [])

  const periodMonths = period === '3m' ? 3 : period === '6m' ? 6 : 12
  const mrrHistory = analytics.mrr_history.slice(-periodMonths)
  const maxMrr = mrrHistory.length > 0 ? Math.max(...mrrHistory.map(d => d.mrr), 1) : 1

  const MRR = overview.mrr
  const prevMRR = mrrHistory.length >= 2 ? mrrHistory[mrrHistory.length - 2].mrr : 0
  const mrrGrowth = prevMRR > 0 ? (((MRR - prevMRR) / prevMRR) * 100).toFixed(1) : '0'
  const mrrGrowthPositive = MRR >= prevMRR

  const churnHistory = analytics.churn_by_month.slice(-periodMonths)
  const totalChurned = churnHistory.reduce((a, m) => a + m.churned, 0)
  const totalRetained = churnHistory.reduce((a, m) => a + m.retained, 0)
  const churnRate = (totalChurned + totalRetained) > 0
    ? ((totalChurned / (totalChurned + totalRetained)) * 100).toFixed(1)
    : '0'

  const totalMembers = analytics.total_members || gyms.reduce((a, g) => a + g.members, 0)
  const payingCount = gyms.filter(g => g.revenueXAF > 0).length
  const avgRevenuePerGym = payingCount > 0 ? Math.round(MRR / payingCount) : 0
  const conversionRate = overview.totalGyms > 0
    ? ((overview.activeGyms / overview.totalGyms) * 100).toFixed(0) : '0'

  const PERIODS = ['3m', '6m', '12m']

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Platform analytics</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Revenue growth, churn, cohort retention, and gym health intelligence.</p>
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
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'MRR',              value: `₣${MRR.toLocaleString('fr-CM')}`,       delta: `${mrrGrowthPositive ? '+' : ''}${mrrGrowth}%`, up: mrrGrowthPositive, icon: Wallet01Icon           },
          { label: 'ARR',              value: `₣${(MRR*12).toLocaleString('fr-CM')}`,  delta: null,                                             up: true,              icon: AnalyticsUpIcon        },
          { label: 'Churn rate',       value: `${churnRate}%`,                          delta: 'MoM avg',                                        up: false,             icon: ArrowDown01Icon        },
          { label: 'Total members',    value: totalMembers,                              delta: null,                                             up: true,              icon: UserGroupIcon          },
          { label: 'Trial→Paid',       value: `${conversionRate}%`,                     delta: 'conversion',                                     up: true,              icon: CheckmarkCircle01Icon  },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <Card key={i}>
              <Icon size={14} style={{ color: T.textMuted }} />
              <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, margin: '10px 0 2px', letterSpacing: '-0.02em', lineHeight: 1 }}>{kpi.value}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{kpi.label}</p>
                {kpi.delta && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {kpi.up ? <ArrowUp01Icon size={8} style={{ color: T.textMuted }} /> : <ArrowDown01Icon size={8} style={{ color: T.textMuted }} />}
                    <span style={{ fontSize: 10, color: T.textMuted }}>{kpi.delta}</span>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </motion.div>

      {/* Charts row */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>

        {/* MRR growth */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <SLabel>MRR growth</SLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {mrrGrowthPositive ? <ArrowUp01Icon size={10} style={{ color: T.textSecondary }} /> : <ArrowDown01Icon size={10} style={{ color: T.textSecondary }} />}
              <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>{mrrGrowth}% this month</span>
            </div>
          </div>
          {mrrHistory.length === 0 ? (
            <div style={{ height: 108, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>No revenue data yet</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 108 }}>
              {mrrHistory.map((d, i) => (
                <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', borderRadius: '3px 3px 0 0',
                    height: `${Math.round((d.mrr / maxMrr) * 100)}px`,
                    background: i === mrrHistory.length - 1 ? '#f0f0f0' : '#2a2a2a',
                    minHeight: 4,
                  }} />
                  <span style={{ fontSize: 9, color: T.textMuted }}>{d.month}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ height: 1, background: T.border, margin: '14px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>{period} growth</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
              ₣{(mrrHistory.length >= 2 ? mrrHistory[mrrHistory.length - 1].mrr - mrrHistory[0].mrr : 0).toLocaleString('fr-CM')} added
            </span>
          </div>
        </Card>

        {/* Churn & retention */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <SLabel>Churn vs retention</SLabel>
            <span style={{ fontSize: 10, color: T.textSecondary, background: '#141414', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{churnRate}% avg churn</span>
          </div>
          {churnHistory.length === 0 ? (
            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>No churn data yet</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {churnHistory.map(m => {
                const total = m.churned + m.retained
                const churnPct = total > 0 ? Math.round((m.churned / total) * 100) : 0
                const retainPct = 100 - churnPct
                return (
                  <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: T.textMuted, width: 28 }}>{m.month}</span>
                    <div style={{ flex: 1, display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                      <div style={{ flex: retainPct, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {retainPct > 30 && <span style={{ fontSize: 9, fontWeight: 700, color: '#555' }}>{retainPct}%</span>}
                      </div>
                      {churnPct > 0 && (
                        <div style={{ flex: churnPct, background: '#2a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#7a3a3a' }}>{churnPct}%</span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: m.churned > 0 ? '#7a3a3a' : T.textMuted, width: 40, textAlign: 'right' }}>
                      {m.churned > 0 ? `-${m.churned}` : '0 lost'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ height: 1, background: T.border, margin: '14px 0' }} />
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1a1a1a', border: `1px solid ${T.border}` }} />
              <span style={{ fontSize: 11, color: T.textSecondary }}>Retained</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#2a1a1a', border: `1px solid #7f1d1d` }} />
              <span style={{ fontSize: 11, color: T.textSecondary }}>Churned</span>
            </div>
          </div>
        </Card>

      </motion.div>

      {/* Cohort retention */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show" style={{ marginBottom: 14 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
            <SLabel>Cohort retention analysis</SLabel>
            <span style={{ fontSize: 11, color: T.textMuted }}>% of gyms still active after N months</span>
          </div>
          {analytics.cohorts.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>No cohort data yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 560, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cohort</span></div>
                  <div style={{ width: 40 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Size</span></div>
                  {['M1', 'M2', 'M3', 'M6', 'M12'].map(m => (
                    <div key={m} style={{ width: 52, textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m}</span></div>
                  ))}
                  <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Plan</span></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {analytics.cohorts.map(c => (
                    <div key={c.cohort} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 90 }}><span style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary }}>{c.cohort}</span></div>
                      <div style={{ width: 40 }}><span style={{ fontSize: 12, color: T.textSecondary }}>{c.size}</span></div>
                      <CohortCell value={c.m1} />
                      <CohortCell value={c.m2} />
                      <CohortCell value={c.m3} />
                      <CohortCell value={c.m6} />
                      <CohortCell value={c.m12} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{c.plan}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Gym health scores */}
      <motion.div variants={fade} custom={4} initial="hidden" animate="show" style={{ marginBottom: 14 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
            <SLabel>Gym health scores</SLabel>
            <span style={{ fontSize: 11, color: T.textMuted }}>Plan + status + login recency + member count</span>
          </div>
          {[...gyms].sort((a, b) => healthScore(b) - healthScore(a)).map(gym => {
            const score = healthScore(gym)
            return (
              <div key={gym.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: `1px solid ${T.borderSubtle}`, transition: 'background 0.1s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <div style={{ width: 180 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, margin: 0 }}>{gym.name}</p>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{gym.owner}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{score} / 100</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{score >= 80 ? 'Healthy' : score >= 55 ? 'At risk' : 'Critical'}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#111', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: '#f0f0f0', width: `${score}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>
                <div style={{ width: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{gym.plan}</span>
                  <StatusPill label={gym.status} />
                  <span style={{ fontSize: 11, color: T.textMuted }}>{gym.lastSeen}</span>
                </div>
              </div>
            )
          })}
        </Card>
      </motion.div>

      {/* Revenue summary */}
      <motion.div variants={fade} custom={5} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Avg revenue / paying gym',      value: `₣${avgRevenuePerGym.toLocaleString('fr-CM')}/mo`,                                                                                 sub: `${payingCount} paying gyms` },
          { label: 'Revenue at risk (suspended)',    value: `₣${gyms.filter(g=>g.status==='suspended').reduce((a,g)=>a+g.revenueXAF,0).toLocaleString('fr-CM')}/mo`,                          sub: `${gyms.filter(g=>g.status==='suspended').length} gym(s) suspended` },
          { label: 'Potential if trials convert',   value: `₣${(MRR + overview.trialGyms * 9900).toLocaleString('fr-CM')}/mo`,                                                                sub: `${overview.trialGyms} trial(s) converting` },
        ].map(s => (
          <Card key={s.label}>
            <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, margin: '0 0 6px', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, margin: '0 0 4px' }}>{s.label}</p>
            <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{s.sub}</p>
          </Card>
        ))}
      </motion.div>

    </div>
  )
}
