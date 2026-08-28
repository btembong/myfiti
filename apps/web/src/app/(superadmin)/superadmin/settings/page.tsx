'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings01Icon, Alert01Icon, Mail01Icon,
  Key01Icon, CheckmarkCircle01Icon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

const T = {
  card: '#0a0a0a', border: '#1a1a1a', surface: '#0d0d0d',
  textPrimary: '#f0f0f0', textSecondary: '#555', textMuted: '#333',
}

function SLabel({ children }: { children: string }) {
  return <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{children}</p>
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const Icon = icon
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
        <Icon size={13} style={{ color: T.textMuted }} />
        <SLabel>{title}</SLabel>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      style={{ width: 36, height: 20, borderRadius: 10, background: on ? '#f0f0f0' : '#1a1a1a', border: `1px solid ${T.border}`, position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: on ? '#0a0a0a' : '#333', transition: 'left 0.2s' }} />
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: T.surface, border: `1px solid #242424`, borderRadius: 8,
  padding: '8px 12px', fontSize: 13, color: T.textPrimary, outline: 'none',
  transition: 'border-color 0.15s', boxSizing: 'border-box',
}

type Settings = Record<string, string>

export default function SuperAdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [dangerLoading, setDangerLoading] = useState<string | null>(null)

  useEffect(() => {
    superApi.get<{ settings: Settings }>('/api/superadmin/settings')
      .then(r => setSettings(r.settings))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }
  function toggle(key: string) {
    setSettings(prev => ({ ...prev, [key]: prev[key] === 'true' ? 'false' : 'true' }))
  }

  async function save() {
    setSaving(true)
    try {
      await superApi.patch('/api/superadmin/settings', settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* noop */ } finally { setSaving(false) }
  }

  async function runDangerAction(action: string) {
    setDangerLoading(action)
    try {
      if (action === 'maintenance') {
        const next = settings.maintenance_mode === 'true' ? 'false' : 'true'
        await superApi.patch('/api/superadmin/settings', { maintenance_mode: next })
        set('maintenance_mode', next)
      } else if (action === 'expire_trials') {
        await superApi.patch('/api/superadmin/settings', { trial_enabled: 'false' })
        set('trial_enabled', 'false')
        alert('Trial period disabled — no new trials will be granted.')
      } else if (action === 'shutdown') {
        await superApi.patch('/api/superadmin/settings', { maintenance_mode: 'true' })
        set('maintenance_mode', 'true')
        alert('Platform set to maintenance mode.')
      }
    } catch { /* noop */ } finally { setDangerLoading(null) }
  }

  const maintenance   = settings.maintenance_mode === 'true'
  const registrations = settings.new_registrations !== 'false'
  const trialEnabled  = settings.trial_enabled !== 'false'

  const TZ_OPTIONS = [
    { value: 'Africa/Douala',  label: 'Africa/Douala (WAT)' },
    { value: 'Africa/Lagos',   label: 'Africa/Lagos (WAT)'  },
    { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
    { value: 'Africa/Accra',   label: 'Africa/Accra (GMT)'  },
    { value: 'Africa/Dakar',   label: 'Africa/Dakar (GMT)'  },
    { value: 'UTC',            label: 'UTC' },
  ]

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 120, background: '#0a0a0a', borderRadius: 12, marginBottom: 12 }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Platform settings</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Global platform configuration and email settings.</p>
          </div>
          <button onClick={save} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#f0f0f0', color: '#0a0a0a', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saved ? <><CheckmarkCircle01Icon size={14} /> Saved</> : saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </motion.div>

      <motion.div variants={fade} custom={1} initial="hidden" animate="show" style={{ marginBottom: 12 }}>
        <SectionCard title="Platform controls" icon={Settings01Icon}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              background: maintenance ? '#1c0a0a' : T.surface,
              border: `1px solid ${maintenance ? '#7f1d1d' : T.border}`,
              borderRadius: 10, padding: '14px 16px', transition: 'all 0.3s',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Maintenance mode</span>
                  {maintenance && <span style={{ fontSize: 10, color: '#7a3a3a', background: '#1c0a0a', border: '1px solid #7f1d1d', padding: '1px 7px', borderRadius: 4 }}>Active</span>}
                </div>
                <p style={{ fontSize: 12, color: T.textSecondary, margin: 0 }}>All gym portals show a maintenance banner. Check-in kiosks continue offline.</p>
              </div>
              <Toggle on={maintenance} onChange={() => toggle('maintenance_mode')} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: '0 0 4px' }}>New gym registrations</p>
                <p style={{ fontSize: 12, color: T.textSecondary, margin: 0 }}>Allow new gyms to sign up via the public registration flow.</p>
              </div>
              <Toggle on={registrations} onChange={() => toggle('new_registrations')} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: '0 0 4px' }}>Free trial period</p>
                <p style={{ fontSize: 12, color: T.textSecondary, margin: 0 }}>New gyms start with a {settings.trial_days ?? 14}-day free trial on the Growth plan.</p>
              </div>
              <Toggle on={trialEnabled} onChange={() => toggle('trial_enabled')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Platform timezone</label>
                <select value={settings.platform_timezone ?? 'Africa/Douala'} onChange={e => set('platform_timezone', e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' }}>
                  {TZ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Default currency</label>
                <select value={settings.default_currency ?? 'XAF'} onChange={e => set('default_currency', e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="XAF">XAF — CFA Franc</option>
                  <option value="NGN">NGN — Nigerian Naira</option>
                  <option value="KES">KES — Kenyan Shilling</option>
                  <option value="GHS">GHS — Ghanaian Cedi</option>
                </select>
              </div>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      <motion.div variants={fade} custom={2} initial="hidden" animate="show" style={{ marginBottom: 12 }}>
        <SectionCard title="Email configuration" icon={Mail01Icon}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>From name</label>
                <input value={settings.email_name ?? ''} onChange={e => set('email_name', e.target.value)} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#404040')} onBlur={e => (e.target.style.borderColor = '#242424')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>From email</label>
                <input value={settings.email_from ?? ''} onChange={e => set('email_from', e.target.value)} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#404040')} onBlur={e => (e.target.style.borderColor = '#242424')} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Email is delivered via Brevo (configured via BREVO_API_KEY env var). These display values are saved to platform settings and used in email templates.</p>
          </div>
        </SectionCard>
      </motion.div>

      <motion.div variants={fade} custom={3} initial="hidden" animate="show" style={{ marginBottom: 12 }}>
        <SectionCard title="API keys" icon={Key01Icon}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Brevo API key',          env: 'BREVO_API_KEY',           masked: 'xsmtpsib-••••••••••' },
              { label: 'Tranzak webhook secret',  env: 'TRANZAK_WEBHOOK_SECRET',  masked: 'whsec_••••••••••••' },
              { label: 'Platform JWT secret',     env: 'JWT_SECRET',              masked: '••••••••••••••••••••' },
              { label: 'Database URL',            env: 'DATABASE_URL',            masked: 'postgres://••••••' },
            ].map(key => (
              <div key={key.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: '0 0 2px' }}>{key.label}</p>
                  <p style={{ fontSize: 10, color: T.textMuted, margin: 0, fontFamily: 'monospace' }}>{key.env}</p>
                </div>
                <div style={{ background: '#111', borderRadius: 6, padding: '4px 10px' }}>
                  <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>{key.masked}</span>
                </div>
              </div>
            ))}
            <p style={{ fontSize: 11, color: T.textMuted, margin: '4px 0 0' }}>API keys are managed via server environment variables. Rotate by updating env and redeploying.</p>
          </div>
        </SectionCard>
      </motion.div>

      <motion.div variants={fade} custom={4} initial="hidden" animate="show">
        <div style={{ background: T.card, border: '1px solid #7f1d1d', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid #7f1d1d' }}>
            <Alert01Icon size={13} style={{ color: '#7a3a3a' }} />
            <SLabel>Danger zone</SLabel>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'maintenance', label: 'Toggle maintenance mode', desc: maintenance ? 'Platform is in maintenance mode — click to disable.' : 'Put the entire platform in maintenance mode immediately.' },
              { key: 'expire_trials', label: 'Disable free trials', desc: 'Stop granting free trials to new signups going forward.' },
              { key: 'shutdown',    label: 'Emergency shutdown',     desc: 'Take the entire platform offline. Sets maintenance mode on.' },
            ].map(action => (
              <div key={action.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: '0 0 3px' }}>{action.label}</p>
                  <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{action.desc}</p>
                </div>
                <button onClick={() => runDangerAction(action.key)} disabled={dangerLoading === action.key}
                  style={{ padding: '6px 14px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'none', border: '1px solid #7f1d1d', color: '#7a3a3a', cursor: 'pointer', whiteSpace: 'nowrap', opacity: dangerLoading === action.key ? 0.5 : 1 }}>
                  {dangerLoading === action.key ? 'Working…' : action.label.split(' ').slice(0, 2).join(' ')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

    </div>
  )
}
