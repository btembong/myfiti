'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CheckmarkCircle01Icon, Cancel01Icon, Edit01Icon,
  FlashIcon, StarIcon, CrownIcon,
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

type Feature = { key: string; label: string; starter: boolean | string; growth: boolean | string; growthPlus: boolean | string }

const FEATURES: Feature[] = [
  { key: 'members',       label: 'Member management',        starter: true,      growth: true,       growthPlus: true },
  { key: 'checkin',       label: 'QR check-in',              starter: true,      growth: true,       growthPlus: true },
  { key: 'payments',      label: 'Payment tracking',         starter: true,      growth: true,       growthPlus: true },
  { key: 'subscriptions', label: 'Subscription billing',     starter: false,     growth: true,       growthPlus: true },
  { key: 'classes',       label: 'Class scheduling',         starter: false,     growth: true,       growthPlus: true },
  { key: 'trainers',      label: 'Trainer management',       starter: false,     growth: true,       growthPlus: true },
  { key: 'analytics',     label: 'Advanced analytics',       starter: false,     growth: true,       growthPlus: true },
  { key: 'messaging',     label: 'Member messaging',         starter: false,     growth: false,      growthPlus: true },
  { key: 'brand',         label: 'Custom branding',          starter: false,     growth: false,      growthPlus: true },
  { key: 'api',           label: 'API access',               starter: false,     growth: false,      growthPlus: true },
  { key: 'integrations',  label: 'Third-party integrations', starter: false,     growth: false,      growthPlus: true },
  { key: 'staff',         label: 'Staff accounts',           starter: '1',       growth: '3',        growthPlus: 'Unlimited' },
  { key: 'storage',       label: 'File storage',             starter: '500 MB',  growth: '5 GB',     growthPlus: '50 GB' },
  { key: 'support',       label: 'Support level',            starter: 'Email',   growth: 'Priority', growthPlus: 'Dedicated' },
]

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value
      ? <CheckmarkCircle01Icon size={14} style={{ color: T.textSecondary }} />
      : <Cancel01Icon size={14} style={{ color: T.textMuted }} />
  }
  return <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary }}>{value}</span>
}

function SLabel({ children }: { children: string }) {
  return <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{children}</p>
}

function Toggle({ on }: { on: boolean }) {
  const [checked, setChecked] = useState(on)
  return (
    <button onClick={() => setChecked(c => !c)}
      style={{ width: 36, height: 20, borderRadius: 10, background: checked ? '#f0f0f0' : '#1a1a1a', border: `1px solid ${T.border}`, position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: checked ? '#0a0a0a' : '#333', transition: 'left 0.2s' }} />
    </button>
  )
}

export default function PlansPage() {
  const [prices, setPrices] = useState({ starter: 0, growth: 9900, growthPlus: 19900 })
  const [editing, setEditing] = useState<string | null>(null)
  const [planGyms, setPlanGyms] = useState({ starter: 0, growth: 0, growthPlus: 0 })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      superApi.get<{ planDistribution: { starter: number; growth: number; growth_plus: number } }>('/api/superadmin/overview'),
      superApi.get<{ config: { starter: number; growth: number; growthPlus: number } }>('/api/superadmin/plans/config'),
    ]).then(([ov, cfg]) => {
      setPlanGyms({ starter: ov.planDistribution.starter, growth: ov.planDistribution.growth, growthPlus: ov.planDistribution.growth_plus })
      if (cfg.config) setPrices(cfg.config)
    }).catch(() => {})
  }, [])

  async function publish() {
    setSaving(true)
    try {
      await superApi.patch('/api/superadmin/plans/config', prices)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* noop */ } finally { setSaving(false) }
  }

  const PLANS = [
    { key: 'starter',    label: 'Starter',  icon: FlashIcon,  price: prices.starter,    gyms: planGyms.starter,    mrr: 0 },
    { key: 'growth',     label: 'Growth',   icon: StarIcon,   price: prices.growth,     gyms: planGyms.growth,     mrr: planGyms.growth * prices.growth },
    { key: 'growthPlus', label: 'Growth+',  icon: CrownIcon,  price: prices.growthPlus, gyms: planGyms.growthPlus, mrr: planGyms.growthPlus * prices.growthPlus },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Plans & Pricing</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Manage subscription tiers, feature access, and pricing.</p>
          </div>
          <button onClick={publish} disabled={saving}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: saved ? '#1a2a1a' : '#f0f0f0', color: saved ? '#4a7a5a' : '#0a0a0a', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Publish changes'}
          </button>
        </div>
      </motion.div>

      {/* Plan cards */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {PLANS.map(plan => {
          const Icon = plan.icon
          const isEditing = editing === plan.key
          return (
            <div key={plan.key} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={16} style={{ color: T.textSecondary }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{plan.label}</span>
                </div>
                <button onClick={() => setEditing(isEditing ? null : plan.key)}
                  style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary }}>
                  <Edit01Icon size={13} />
                </button>
              </div>

              {isEditing ? (
                <input
                  type="number" autoFocus
                  value={prices[plan.key as keyof typeof prices]}
                  onChange={e => setPrices(p => ({ ...p, [plan.key]: Number(e.target.value) }))}
                  onBlur={() => setEditing(null)}
                  style={{ width: '100%', background: '#111', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 22, fontWeight: 700, color: T.textPrimary, outline: 'none', boxSizing: 'border-box' }}
                />
              ) : (
                <p style={{ fontSize: 26, fontWeight: 700, color: T.textPrimary, margin: '0 0 2px', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {plan.price > 0 ? `₣${plan.price.toLocaleString('fr-CM')}` : 'Free'}
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary }}>/mo</span>
                </p>
              )}

              <div style={{ height: 1, background: T.border, margin: '14px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>Active gyms</span>
                  <span style={{ fontSize: 11, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 8px', borderRadius: 4 }}>{plan.gyms} gyms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>Monthly revenue</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: plan.mrr > 0 ? T.textPrimary : T.textMuted }}>
                    {plan.mrr > 0 ? `₣${plan.mrr.toLocaleString('fr-CM')}` : '—'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Feature matrix */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show" style={{ marginBottom: 14 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
            <SLabel>Feature matrix</SLabel>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ flex: 1 }} />
            {PLANS.map(p => {
              const Icon = p.icon
              return (
                <div key={p.key} style={{ width: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Icon size={11} style={{ color: T.textMuted }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>{p.label}</span>
                </div>
              )
            })}
          </div>
          {FEATURES.map((f) => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', padding: '9px 18px', borderBottom: `1px solid ${T.borderSubtle}`, transition: 'background 0.1s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, flex: 1 }}>{f.label}</span>
              <div style={{ width: 110, display: 'flex', justifyContent: 'center' }}><FeatureCell value={f.starter} /></div>
              <div style={{ width: 110, display: 'flex', justifyContent: 'center' }}><FeatureCell value={f.growth} /></div>
              <div style={{ width: 110, display: 'flex', justifyContent: 'center' }}><FeatureCell value={f.growthPlus} /></div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Trial settings */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ marginBottom: 16 }}><SLabel>Trial & onboarding settings</SLabel></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'Trial period enabled',        desc: 'New gyms start on a 14-day free trial.', on: true  },
              { label: 'Trial → Growth auto-prompt',  desc: 'Show upgrade prompt at day 10 of trial.', on: true  },
              { label: 'Require card on trial start',  desc: 'Capture card info during onboarding.',   on: false },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#0d0d0d', border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, margin: '0 0 4px' }}>{s.label}</p>
                  <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{s.desc}</p>
                </div>
                <Toggle on={s.on} />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

    </div>
  )
}
