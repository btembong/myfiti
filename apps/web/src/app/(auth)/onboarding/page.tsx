'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dumbbell01Icon,
  Settings01Icon,
  PieChart01Icon,
  Wallet01Icon,
  RocketIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Globe02Icon,
  Clock01Icon,
  FlashIcon,
  GroupLayersIcon,
  Activity01Icon,
  ImageUploadIcon,
} from 'hugeicons-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingData {
  gymName: string; slug: string; country: string; timezone: string; currency: string
  town: string; quarter: string; street: string; address: string; phone: string; website: string
  primaryColor: string; tagline: string; logoDataUrl: string
  selectedPlan: 'starter' | 'growth' | 'growth_plus' | 'enterprise' | ''
  billingCycle: 'monthly' | 'annual'
  tranzakAppId: string; tranzakAppSecret: string; tranzakSkip: boolean
}

// ─── Plans ────────────────────────────────────────────────────────────────────

const MYFITI_PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    monthlyPrice: 15000,
    annualPrice: 150000,
    members: 'Up to 100 members',
    desc: 'Perfect for new gyms just getting started.',
    highlight: false,
    features: ['Member management', 'Subscription engine', 'QR check-in kiosk', 'Payment recording', '1 admin account', 'Email notifications'],
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    monthlyPrice: 35000,
    annualPrice: 350000,
    members: 'Up to 500 members',
    desc: 'For growing gyms that need more power.',
    highlight: true,
    features: ['Everything in Starter', 'Class scheduling & booking', 'Trainer portal', 'Member mobile view', 'SMS notifications', '5 staff accounts', 'Full analytics dashboard', 'Referral system'],
  },
  {
    id: 'growth_plus' as const,
    name: 'Growth+',
    monthlyPrice: 75000,
    annualPrice: 750000,
    members: 'Unlimited members',
    desc: 'The full enterprise platform for established gyms.',
    highlight: false,
    features: ['Everything in Growth', 'REST API & webhooks', 'Unlimited staff', 'Kiosk terminal', 'Custom subdomain', 'Audit log & RBAC', 'Priority support (24h SLA)', 'Data export & backups'],
  },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: 'CM', name: 'Cameroon',      currency: 'XAF', tz: 'Africa/Douala'       },
  { code: 'NG', name: 'Nigeria',       currency: 'NGN', tz: 'Africa/Lagos'         },
  { code: 'GH', name: 'Ghana',         currency: 'GHS', tz: 'Africa/Accra'         },
  { code: 'KE', name: 'Kenya',         currency: 'KES', tz: 'Africa/Nairobi'       },
  { code: 'SN', name: 'Senegal',       currency: 'XOF', tz: 'Africa/Dakar'         },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', tz: 'Africa/Abidjan'       },
  { code: 'ZA', name: 'South Africa',  currency: 'ZAR', tz: 'Africa/Johannesburg'  },
  { code: 'TZ', name: 'Tanzania',      currency: 'TZS', tz: 'Africa/Dar_es_Salaam' },
  { code: 'UG', name: 'Uganda',        currency: 'UGX', tz: 'Africa/Kampala'       },
  { code: 'RW', name: 'Rwanda',        currency: 'RWF', tz: 'Africa/Kigali'        },
  { code: 'ET', name: 'Ethiopia',      currency: 'ETB', tz: 'Africa/Addis_Ababa'   },
  { code: 'MA', name: 'Morocco',       currency: 'MAD', tz: 'Africa/Casablanca'    },
  { code: 'EG', name: 'Egypt',         currency: 'EGP', tz: 'Africa/Cairo'         },
  { code: 'TN', name: 'Tunisia',       currency: 'TND', tz: 'Africa/Tunis'         },
  { code: 'Other', name: 'Other',      currency: 'USD', tz: 'UTC'                  },
]

const TIMEZONES = [
  'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Cairo',
  'Africa/Casablanca', 'Africa/Dakar', 'Africa/Dar_es_Salaam', 'Africa/Douala',
  'Africa/Harare', 'Africa/Johannesburg', 'Africa/Kampala', 'Africa/Kigali',
  'Africa/Lagos', 'Africa/Luanda', 'Africa/Lusaka', 'Africa/Maputo',
  'Africa/Nairobi', 'Africa/Tunis', 'UTC',
]

const PRESET_COLORS = [
  '#6366f1', '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

const STEPS = [
  { number: 1, label: 'Gym info',    icon: Dumbbell01Icon },
  { number: 2, label: 'Branding',    icon: Settings01Icon },
  { number: 3, label: 'Plan',        icon: PieChart01Icon },
  { number: 4, label: 'Payments',    icon: Wallet01Icon   },
  { number: 5, label: 'Launch',      icon: RocketIcon     },
]

const STORAGE_KEY = 'myfiti_onboarding'

const DEFAULT: OnboardingData = {
  gymName: '', slug: '', country: '', timezone: '', currency: 'XAF',
  town: '', quarter: '', street: '', address: '', phone: '', website: '',
  primaryColor: '#6366f1', tagline: '', logoDataUrl: '',
  selectedPlan: '', billingCycle: 'monthly',
  tranzakAppId: '', tranzakAppSecret: '', tranzakSkip: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function loadSaved(): Partial<OnboardingData> {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {} }
  catch { return {} }
}

function fmt(n: number) { return n.toLocaleString('fr-CM') }

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg: '#0a0a0a',
  surface: '#0d0d0d',
  border: '#1e1e1e',
  borderSubtle: '#141414',
  inputBg: '#0d0d0d',
  inputBorder: '#242424',
  inputFocus: '#404040',
  textPrimary: '#f0f0f0',
  textSecondary: '#888',
  textMuted: '#444',
  textDim: '#2a2a2a',
  btnPrimary: '#f0f0f0',
  btnPrimaryText: '#0a0a0a',
  errorText: '#f87171',
}

// ─── Field components ─────────────────────────────────────────────────────────

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {children}
      </label>
      {hint && <span style={{ fontSize: 11, color: T.textDim }}>{hint}</span>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', prefix }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; prefix?: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      {prefix && (
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: T.textMuted, pointerEvents: 'none', userSelect: 'none' }}>
          {prefix}
        </span>
      )}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10,
          padding: '10px 14px', paddingLeft: prefix ? '2rem' : 14,
          fontSize: 13, fontWeight: 500, color: T.textPrimary, outline: 'none', transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = T.inputFocus)}
        onBlur={e => (e.currentTarget.style.borderColor = T.inputBorder)}
      />
    </div>
  )
}

function FieldSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10,
          padding: '10px 32px 10px 14px', fontSize: 13, fontWeight: 500,
          color: value ? T.textPrimary : T.textMuted, outline: 'none', appearance: 'none',
          transition: 'border-color 0.15s', boxSizing: 'border-box',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = T.inputFocus)}
        onBlur={e => (e.currentTarget.style.borderColor = T.inputBorder)}>
        {children}
      </select>
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none"
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textMuted }}>
        <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

// ─── Step progress bar ────────────────────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        {STEPS.map((s, i) => {
          const done = step > s.number
          const active = step === s.number
          const Icon = s.icon
          return (
            <div key={s.number} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? '#f0f0f0' : active ? '#111' : '#080808',
                  border: `1px solid ${done ? '#f0f0f0' : active ? '#2a2a2a' : '#141414'}`,
                  transition: 'all 0.2s',
                }}>
                  {done
                    ? <CheckmarkCircle01Icon size={13} color="#0a0a0a" />
                    : <Icon size={12} color={active ? '#888' : '#1e1e1e'} />}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: active ? T.textPrimary : done ? '#3a3a3a' : '#1e1e1e', transition: 'color 0.2s', display: 'none' }}
                  className="sm:block">
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: done ? '#2a2a2a' : '#0f0f0f', transition: 'background 0.2s' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 1: Gym info ─────────────────────────────────────────────────────────

function Step1({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  const [slugManual, setSlugManual] = useState(false)

  function setCountry(code: string) {
    const c = COUNTRIES.find(c => c.code === code)
    onChange({ country: code, currency: c?.currency ?? data.currency, timezone: c?.tz ?? data.timezone })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <FieldLabel>Gym name</FieldLabel>
          <Input value={data.gymName} placeholder="CrossFit Lagos"
            onChange={v => onChange({ gymName: v, ...(slugManual ? {} : { slug: slugify(v) }) })} />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <FieldLabel hint="slug.myfiti.app">Subdomain</FieldLabel>
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.inputBorder}`, transition: 'border-color 0.15s' }}
            onFocusCapture={e => ((e.currentTarget as HTMLElement).style.borderColor = T.inputFocus)}
            onBlurCapture={e => ((e.currentTarget as HTMLElement).style.borderColor = T.inputBorder)}>
            <input type="text" value={data.slug} placeholder="crossfit-lagos"
              onChange={e => { setSlugManual(true); onChange({ slug: slugify(e.target.value) }) }}
              style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 500, background: T.inputBg, color: T.textPrimary, outline: 'none', border: 'none', borderRight: `1px solid ${T.inputBorder}` }} />
            <span style={{ padding: '0 14px', fontSize: 12, fontWeight: 500, color: T.textMuted, background: T.inputBg, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              .myfiti.app
            </span>
          </div>
          {data.slug && (
            <p style={{ fontSize: 11, marginTop: 6, color: '#555' }}>
              Portal: <strong style={{ color: '#666' }}>{data.slug}.myfiti.app</strong>
            </p>
          )}
        </div>

        <div>
          <FieldLabel>Country</FieldLabel>
          <FieldSelect value={data.country} onChange={setCountry}>
            <option value="">Select country…</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </FieldSelect>
        </div>

        <div>
          <FieldLabel>Currency</FieldLabel>
          <Input value={data.currency} onChange={v => onChange({ currency: v })} placeholder="XAF" />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <FieldLabel>Timezone</FieldLabel>
          <FieldSelect value={data.timezone} onChange={v => onChange({ timezone: v })}>
            <option value="">Select timezone…</option>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
          </FieldSelect>
        </div>

        <div>
          <FieldLabel hint="Optional">Phone</FieldLabel>
          <Input value={data.phone} onChange={v => onChange({ phone: v })} placeholder="+237 6XX XXX XXX" type="tel" />
        </div>

        <div>
          <FieldLabel hint="Optional">Website</FieldLabel>
          <Input value={data.website} onChange={v => onChange({ website: v })} placeholder="https://…" />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ background: T.surface, border: `1px solid ${T.borderSubtle}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Location <span style={{ textTransform: 'none', fontWeight: 400, color: T.textDim }}>(optional)</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <FieldLabel>Town / City</FieldLabel>
                <Input value={data.town} onChange={v => onChange({ town: v })} placeholder="Douala" />
              </div>
              <div>
                <FieldLabel>Quarter / District</FieldLabel>
                <Input value={data.quarter} onChange={v => onChange({ quarter: v })} placeholder="Bonanjo" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldLabel>Street / Landmark</FieldLabel>
                <Input value={data.street} onChange={v => onChange({ street: v })} placeholder="Rue de la Joie, near Total station" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldLabel hint="Shown on receipts">Full address line</FieldLabel>
                <Input value={data.address} onChange={v => onChange({ address: v })} placeholder="Rue de la Joie, Bonanjo, Douala" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Branding ─────────────────────────────────────────────────────────

function Step2({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => onChange({ logoDataUrl: reader.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <FieldLabel hint="PNG or SVG, max 2 MB">Gym logo</FieldLabel>
        <div onClick={() => fileRef.current?.click()}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '40px 24px', borderRadius: 12, cursor: 'pointer',
            border: `1.5px dashed ${T.border}`, background: T.inputBg, transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#3a3a3a')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = T.border)}>
          {data.logoDataUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={data.logoDataUrl} alt="Logo" style={{ height: 64, objectFit: 'contain', borderRadius: 8 }} />
            : <>
              <ImageUploadIcon size={22} color={T.textMuted} />
              <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                Click to upload your gym logo<br />
                <span style={{ fontSize: 11, color: T.textDim }}>PNG, SVG · max 2 MB</span>
              </p>
            </>}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg" style={{ display: 'none' }} onChange={handleFile} />
        {data.logoDataUrl && (
          <button style={{ marginTop: 8, fontSize: 12, color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => onChange({ logoDataUrl: '' })}>
            Remove logo
          </button>
        )}
      </div>

      <div>
        <FieldLabel>Primary brand color</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => onChange({ primaryColor: c })}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                outline: data.primaryColor === c ? `2px solid ${c}` : '2px solid transparent',
                outlineOffset: 2, transition: 'outline 0.15s',
              }} />
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
            <input type="color" value={data.primaryColor} onChange={e => onChange({ primaryColor: e.target.value })}
              style={{ width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', border: 'none', padding: 0, background: 'none' }} />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: T.textMuted }}>{data.primaryColor}</span>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, background: T.inputBg, border: `1px solid ${T.borderSubtle}` }}>
          <button style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', background: data.primaryColor, border: 'none', cursor: 'default' }}>
            Join now
          </button>
          <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: data.primaryColor }}>
            <CheckmarkCircle01Icon size={11} color="white" />
          </div>
          <span style={{ fontSize: 12, color: data.primaryColor, fontWeight: 500 }}>Active membership</span>
        </div>
      </div>

      <div>
        <FieldLabel hint="Optional · shown on member portal">Gym tagline</FieldLabel>
        <Input value={data.tagline} onChange={v => onChange({ tagline: v })} placeholder="Train hard. Live fit." />
      </div>
    </div>
  )
}

// ─── Step 3: Choose plan ──────────────────────────────────────────────────────

function Step3({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  const annual = data.billingCycle === 'annual'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
        All plans start with a <strong style={{ color: T.textSecondary }}>14-day free trial</strong>. Upgrade anytime.
      </p>

      <div style={{ display: 'inline-flex', background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 3 }}>
        {(['monthly', 'annual'] as const).map(c => (
          <button key={c} onClick={() => onChange({ billingCycle: c })}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
              background: data.billingCycle === c ? '#1a1a1a' : 'transparent',
              color: data.billingCycle === c ? T.textPrimary : T.textMuted,
              transition: 'all 0.15s',
            }}>
            {c === 'monthly' ? 'Monthly' : 'Annual'}
            {c === 'annual' && (
              <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500, background: '#1a1a1a', color: '#555', border: `1px solid ${T.border}` }}>
                2 months free
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MYFITI_PLANS.map(plan => {
          const selected = data.selectedPlan === plan.id
          const perMonth = annual ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice
          const price = annual ? plan.annualPrice : plan.monthlyPrice

          return (
            <button key={plan.id} type="button" onClick={() => onChange({ selectedPlan: plan.id })}
              style={{
                width: '100%', textAlign: 'left', borderRadius: 12, padding: 18, cursor: 'pointer',
                border: `1px solid ${selected ? '#f0f0f0' : T.border}`,
                background: selected ? 'rgba(255,255,255,0.03)' : T.inputBg,
                transition: 'all 0.15s',
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: selected ? T.textPrimary : T.textSecondary }}>
                      {plan.name}
                    </span>
                    {plan.highlight && (
                      <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: '#141414', color: '#555', border: `1px solid ${T.border}` }}>
                        Most popular
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 12px' }}>
                    {plan.members} · {plan.desc}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 1, height: 10, background: selected ? '#3a3a3a' : '#1e1e1e', borderRadius: 1, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: selected ? '#555' : T.textDim }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 11, color: T.textMuted }}>₣</span>
                      <span style={{ fontSize: 22, fontWeight: 600, color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(perMonth)}
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>
                      /month{annual && ` · ₣${fmt(price)}/yr`}
                    </p>
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', border: `1px solid ${selected ? '#f0f0f0' : T.textDim}`,
                    background: selected ? '#f0f0f0' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {selected && <CheckmarkCircle01Icon size={10} color="#0a0a0a" />}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{
        borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        background: data.selectedPlan === 'enterprise' ? 'rgba(255,255,255,0.02)' : T.inputBg,
        border: `1px solid ${data.selectedPlan === 'enterprise' ? '#f0f0f0' : T.border}`,
        transition: 'all 0.15s',
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Enterprise</p>
          <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
            Unlimited · White-label · Dedicated DB · SLA · Onboarding support
          </p>
        </div>
        <button onClick={() => onChange({ selectedPlan: 'enterprise' })}
          style={{
            flexShrink: 0, fontSize: 12, fontWeight: 500, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            background: data.selectedPlan === 'enterprise' ? '#f0f0f0' : '#111',
            color: data.selectedPlan === 'enterprise' ? '#0a0a0a' : T.textMuted,
            border: `1px solid ${data.selectedPlan === 'enterprise' ? '#f0f0f0' : T.border}`,
            transition: 'all 0.15s',
          }}>
          {data.selectedPlan === 'enterprise' ? '✓ Selected' : 'Contact us'}
        </button>
      </div>

      {data.selectedPlan && (
        <p style={{ fontSize: 12, color: '#444', textAlign: 'center' }}>
          {MYFITI_PLANS.find(p => p.id === data.selectedPlan)?.name ?? 'Enterprise'} selected
          {data.selectedPlan !== 'enterprise' && ' · 14-day free trial'}
        </p>
      )}
    </div>
  )
}

// ─── Step 4: Payments ─────────────────────────────────────────────────────────

function Step4({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: 16, borderRadius: 10, background: T.inputBg, border: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <FlashIcon size={16} color={T.textMuted} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Tranzak payments</p>
            <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>
              myfiti uses Tranzak to collect gym fees from your members via mobile money and cards.
              Connect your merchant account here, or skip and do it later from Settings.
            </p>
          </div>
        </div>
      </div>

      {!data.tranzakSkip ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <FieldLabel>Tranzak App ID</FieldLabel>
            <Input value={data.tranzakAppId} onChange={v => onChange({ tranzakAppId: v })} placeholder="app_xxxxxxxxxxxxxxxx" />
          </div>
          <div>
            <FieldLabel>Tranzak App Secret</FieldLabel>
            <Input value={data.tranzakAppSecret} onChange={v => onChange({ tranzakAppSecret: v })}
              placeholder="secret_xxxxxxxxxxxxxxxx" type="password" />
          </div>
          <p style={{ fontSize: 11, color: T.textDim }}>
            Find these in your Tranzak merchant dashboard under Developer → Apps.
          </p>
          <button onClick={() => onChange({ tranzakSkip: true, tranzakAppId: '', tranzakAppSecret: '' })}
            style={{ fontSize: 12, color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            Skip for now →
          </button>
        </div>
      ) : (
        <div style={{ borderRadius: 10, padding: 24, textAlign: 'center', border: `1px solid ${T.border}`, background: T.inputBg }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, margin: 0 }}>Tranzak skipped</p>
          <p style={{ fontSize: 12, color: T.textDim, marginTop: 6 }}>Connect later from Admin → Settings → Payments.</p>
          <button onClick={() => onChange({ tranzakSkip: false })}
            style={{ marginTop: 12, fontSize: 12, color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Connect Tranzak now
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Step 5: Launch ───────────────────────────────────────────────────────────

function Step5({ data }: { data: OnboardingData }) {
  const plan = MYFITI_PLANS.find(p => p.id === data.selectedPlan)
  const annual = data.billingCycle === 'annual'

  const rows = [
    { icon: Dumbbell01Icon,  label: 'Gym',        value: `${data.gymName} · ${data.slug}.myfiti.app` },
    { icon: Globe02Icon,     label: 'Country',     value: `${COUNTRIES.find(c => c.code === data.country)?.name ?? data.country} · ${data.currency}` },
    { icon: Clock01Icon,     label: 'Timezone',    value: data.timezone || '—' },
    { icon: Activity01Icon,  label: 'Location',    value: [data.town, data.quarter, data.street].filter(Boolean).join(', ') || '—' },
    { icon: Settings01Icon,  label: 'Brand color', value: data.primaryColor },
    { icon: GroupLayersIcon, label: 'Plan',        value: data.selectedPlan === 'enterprise' ? 'Enterprise (contact us)' : plan ? `${plan.name} · ₣${fmt(annual ? plan.annualPrice : plan.monthlyPrice)}/${annual ? 'yr' : 'mo'}` : '—' },
    { icon: Wallet01Icon,    label: 'Tranzak',     value: data.tranzakSkip ? 'Skip — connect later' : data.tranzakAppId ? 'Connected' : 'Not configured' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: '#111', border: `1px solid ${T.border}` }}>
          <RocketIcon size={22} color={T.textMuted} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Ready to launch</h3>
        <p style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>Review your setup, then go live.</p>
      </div>

      <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        {rows.map((row, i) => {
          const Icon = row.icon
          return (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              background: T.inputBg, borderBottom: i < rows.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#111', border: `1px solid ${T.border}` }}>
                <Icon size={13} color={T.textMuted} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 500, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{row.label}</p>
                {row.label === 'Brand color'
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: row.value }} />
                      <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'monospace', color: T.textSecondary }}>{row.value}</span>
                    </div>
                  : <p style={{ fontSize: 13, color: T.textSecondary, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</p>}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: 14, borderRadius: 10, background: T.inputBg, border: `1px solid ${T.border}` }}>
        <p style={{ fontSize: 12, color: T.textMuted, margin: 0, lineHeight: 1.6 }}>
          Clicking <strong style={{ color: T.textSecondary }}>Launch my gym</strong> provisions your private database and opens your dashboard.
          Your 14-day free trial starts now — no card needed until the trial ends.
        </p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(DEFAULT)
  const [error, setError] = useState('')
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    const saved = loadSaved()
    if (Object.keys(saved).length > 0) setData(d => ({ ...d, ...saved }))
  }, [])

  function update(partial: Partial<OnboardingData>) {
    setData(d => {
      const next = { ...d, ...partial }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setError('')
  }

  function validate(): string {
    if (step === 1) {
      if (!data.gymName.trim()) return 'Enter your gym name.'
      if (!data.slug) return 'Set a subdomain.'
      if (!/^[a-z0-9-]+$/.test(data.slug)) return 'Subdomain can only use lowercase letters, numbers, and hyphens.'
      if (!data.country) return 'Select your country.'
      if (!data.timezone) return 'Select a timezone.'
    }
    if (step === 2) {
      if (!data.primaryColor) return 'Pick a brand color.'
    }
    if (step === 3) {
      if (!data.selectedPlan) return 'Select a plan to continue.'
    }
    return ''
  }

  function next() {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    setError('')
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function launch() {
    setLaunching(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Something went wrong.'); return }
      localStorage.removeItem(STORAGE_KEY)
      router.push('/dashboard')
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLaunching(false)
    }
  }

  const headings: Record<number, { title: string; sub: string }> = {
    1: { title: 'Tell us about your gym',   sub: 'Name, location & timezone' },
    2: { title: 'Set up your branding',      sub: 'Logo, color & tagline' },
    3: { title: 'Choose your plan',          sub: 'Your myfiti subscription' },
    4: { title: 'Connect payments',          sub: 'Link your Tranzak account' },
    5: { title: 'Review & launch',           sub: 'Everything looks good? Go live.' },
  }

  const h = headings[step]

  return (
    <div style={{ width: '100%', maxWidth: 580 }}>

      {/* Logo header (shown on larger screens where auth left panel is hidden) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }} className="lg:hidden">
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Dumbbell01Icon size={13} color="#000" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f0' }}>myfiti</span>
      </div>

      {/* Step progress */}
      <StepBar step={step} />

      {/* Card */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }}>

        {/* Card header */}
        <div style={{ padding: '22px 26px 20px', borderBottom: `1px solid ${T.borderSubtle}` }}>
          <p style={{ fontSize: 10, fontWeight: 500, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Step {step} of {STEPS.length}
          </p>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>{h.title}</h2>
          <p style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{h.sub}</p>
        </div>

        {/* Card body */}
        <div style={{ padding: '22px 26px' }}>
          {step === 1 && <Step1 data={data} onChange={update} />}
          {step === 2 && <Step2 data={data} onChange={update} />}
          {step === 3 && <Step3 data={data} onChange={update} />}
          {step === 4 && <Step4 data={data} onChange={update} />}
          {step === 5 && <Step5 data={data} />}
        </div>

        {/* Card footer */}
        <div style={{ padding: '0 26px 22px' }}>
          {error && (
            <div style={{ marginBottom: 16, borderLeft: '2px solid #7f1d1d', paddingLeft: 12, fontSize: 12, color: T.errorText }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, borderTop: `1px solid ${T.borderSubtle}` }}>
            <button onClick={back} disabled={step === 1}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
                color: '#3a3a3a', background: 'none', border: 'none',
                cursor: step === 1 ? 'default' : 'pointer', opacity: step === 1 ? 0 : 1,
                padding: 0, transition: 'opacity 0.15s',
              }}>
              <ArrowLeft01Icon size={14} /> Back
            </button>

            {step < 5
              ? <button onClick={next}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: T.btnPrimary, color: T.btnPrimaryText, border: 'none', cursor: 'pointer' }}>
                  Continue <ArrowRight01Icon size={14} />
                </button>
              : <button onClick={launch} disabled={launching}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: T.btnPrimary, color: T.btnPrimaryText, border: 'none', cursor: launching ? 'not-allowed' : 'pointer', opacity: launching ? 0.6 : 1 }}>
                  {launching
                    ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '1.5px solid #0a0a0a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Launching…</>
                    : <><FlashIcon size={14} /> Launch my gym</>}
                </button>}
          </div>
        </div>
      </div>

      {/* Autosave note */}
      <p style={{ fontSize: 11, textAlign: 'center', marginTop: 16, color: T.textDim }}>
        Progress saved automatically
      </p>
    </div>
  )
}
