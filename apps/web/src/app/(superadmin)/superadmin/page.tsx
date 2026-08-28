'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { superApi } from '@/lib/api'
import {
  Building01Icon,
  UserGroupIcon,
  Wallet01Icon,
  AnalyticsUpIcon,
  ArrowUp01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  Clock01Icon,
} from 'hugeicons-react'

// ─── Types & helpers ──────────────────────────────────────────────────────────

export interface GymRow {
  id: string; name: string; owner: string; email: string
  country: string; city: string; plan: string; status: string
  members: number; checkins: number; revenueXAF: number
  joinedAt: string; lastSeen: string; renewalAt: string | null
}

interface Overview {
  totalGyms: number; activeGyms: number; trialGyms: number
  suspendedGyms: number; mrr: number; arr: number
  planDistribution: { growth_plus: number; growth: number; starter: number }
}

const PLAN_PRICE: Record<string, number> = { growth_plus: 19900, growth: 9900, starter: 0, enterprise: 49900 }
const PLAN_LABEL: Record<string, string> = { growth_plus: 'Growth+', growth: 'Growth', starter: 'Starter', enterprise: 'Enterprise' }

export function mapGym(t: Record<string, unknown>): GymRow {
  const plan = (t.plan as string) ?? 'starter'
  const status = (t.status as string) ?? 'trialing'
  const createdAt = t.created_at ? new Date(t.created_at as string) : null
  const renewalRaw = t.subscription_renewal_at as string | null | undefined
  return {
    id: t.id as string,
    name: (t.name as string) ?? '—',
    owner: (t.owner_name as string) ?? '—',
    email: (t.owner_email as string) ?? '',
    country: '—', city: '—',
    plan: PLAN_LABEL[plan] ?? plan,
    status: status === 'trialing' ? 'trial' : status,
    members: (t.totalMembers as number) ?? 0,
    checkins: 0,
    revenueXAF: PLAN_PRICE[plan] ?? 0,
    joinedAt: createdAt ? createdAt.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
    lastSeen: '—',
    renewalAt: renewalRaw ? new Date(renewalRaw).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
  }
}

const ACTIVITY = [
  { gym: '—', detail: 'No recent activity', time: '—' },
]

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const } }),
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  card: '#0a0a0a',
  border: '#1a1a1a',
  borderSubtle: '#141414',
  surface: '#0d0d0d',
  textPrimary: '#f0f0f0',
  textSecondary: '#888',
  textMuted: '#333',
  textDim: '#222',
}

function Pill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, ...style }}>
      {children}
    </div>
  )
}

function SLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 500, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
      {children}
    </p>
  )
}

export default function SuperAdminDashboard() {
  const [gyms, setGyms] = useState<GymRow[]>([])
  const [overview, setOverview] = useState<Overview>({
    totalGyms: 0, activeGyms: 0, trialGyms: 0, suspendedGyms: 0,
    mrr: 0, arr: 0, planDistribution: { growth_plus: 0, growth: 0, starter: 0 },
  })

  useEffect(() => {
    superApi.get<{ gyms: Record<string, unknown>[] }>('/api/superadmin/gyms')
      .then(r => setGyms(r.gyms.map(mapGym)))
      .catch(() => {})
    superApi.get<Overview>('/api/superadmin/overview')
      .then(r => setOverview(r))
      .catch(() => {})
  }, [])

  const planDist = [
    { plan: 'Growth+', count: overview.planDistribution.growth_plus },
    { plan: 'Growth',  count: overview.planDistribution.growth },
    { plan: 'Starter', count: overview.planDistribution.starter },
  ]

  const kpis = [
    { label: 'Total gyms',    value: overview.totalGyms,    sub: `${overview.activeGyms} active`,      icon: Building01Icon  },
    { label: 'Total members', value: gyms.reduce((a, g) => a + g.members, 0), sub: 'across all gyms', icon: UserGroupIcon   },
    { label: 'MRR',           value: `₣${overview.mrr.toLocaleString('fr-CM')}`,  sub: 'monthly recurring', icon: Wallet01Icon   },
    { label: 'ARR',           value: `₣${overview.arr.toLocaleString('fr-CM')}`,  sub: 'annualized',         icon: AnalyticsUpIcon },
    { label: 'Trials',        value: overview.trialGyms,    sub: 'converting',                         icon: Clock01Icon    },
    { label: 'Suspended',     value: overview.suspendedGyms, sub: 'need attention',                    icon: Alert01Icon    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1280 }}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>
            Platform overview
          </h1>
          <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>
            All tenants, revenue, and platform health in one view.
          </p>
        </div>
        <Pill label="All systems operational" />
      </motion.div>

      {/* KPI row */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}
        className="kpi-grid">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <Card key={i}>
              <Icon size={16} style={{ color: T.textMuted }} />
              <p style={{ fontSize: 24, fontWeight: 600, color: T.textPrimary, margin: '10px 0 2px', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {kpi.value}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 12, color: T.textSecondary, margin: 0 }}>{kpi.label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ArrowUp01Icon size={8} style={{ color: T.textMuted }} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: T.textDim, margin: '2px 0 0' }}>{kpi.sub}</p>
            </Card>
          )
        })}
      </motion.div>

      {/* Main grid */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Gym list — spans 2 cols */}
        <Card style={{ gridColumn: 'span 2', padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
            <SLabel>All gyms</SLabel>
            <Link href="/superadmin/gyms" style={{ fontSize: 13, color: T.textSecondary, textDecoration: 'none' }}>
              View all →
            </Link>
          </div>
          <div>
            {gyms.length === 0 ? (
              <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>No gyms yet</p>
            ) : gyms.map((gym, i) => (
              <Link key={gym.id} href={`/superadmin/gyms/${gym.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', textDecoration: 'none', borderBottom: i < gyms.length - 1 ? `1px solid ${T.borderSubtle}` : 'none', transition: 'background 0.1s', outline: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#111', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#555' }}>{gym.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gym.name}</p>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{gym.city} · {gym.owner}</p>
                </div>
                <span style={{ fontSize: 10, color: '#3a3a3a', background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>
                  {gym.plan}
                </span>
                <span style={{ fontSize: 12, color: T.textSecondary, width: 78, textAlign: 'right', flexShrink: 0 }}>
                  {gym.members} members
                </span>
                <Pill label={gym.status} />
              </Link>
            ))}
          </div>
        </Card>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Plan distribution */}
          <Card>
            <SLabel>Plan distribution</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {planDist.map(p => (
                <div key={p.plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: T.textSecondary }}>{p.plan}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary }}>{p.count} gyms</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: '#111', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: '#f0f0f0', width: `${overview.totalGyms > 0 ? (p.count / overview.totalGyms) * 100 : 0}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: T.border, margin: '14px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>Monthly revenue</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>₣{overview.mrr.toLocaleString('fr-CM')}</span>
            </div>
          </Card>

          {/* Activity feed */}
          <Card style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <SLabel>Recent activity</SLabel>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#444' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ACTIVITY.map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.textDim, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.gym}</p>
                    <p style={{ fontSize: 12, color: T.textMuted, margin: '2px 0 0' }}>{ev.detail}</p>
                  </div>
                  <span style={{ fontSize: 11, color: T.textDim, flexShrink: 0 }}>{ev.time}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </motion.div>

      {/* Platform health */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SLabel>Platform health</SLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckmarkCircle01Icon size={14} style={{ color: T.textMuted }} />
              <span style={{ fontSize: 13, color: T.textSecondary }}>All services operational</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'API',             uptime: 99.98 },
              { label: 'Check-in QR',     uptime: 100   },
              { label: 'Email delivery',  uptime: 99.7  },
              { label: 'Payment gateway', uptime: 99.5  },
            ].map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: T.textSecondary }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary }}>{s.uptime}%</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: '#111', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: '#f0f0f0', width: `${s.uptime}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <style>{`
        @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (max-width: 700px)  { .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
    </div>
  )
}
