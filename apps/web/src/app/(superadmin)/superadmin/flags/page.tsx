'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search01Icon } from 'hugeicons-react'
import { superApi } from '@/lib/api'
import { type GymRow, mapGym } from '../page'

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

const T = {
  card: '#0a0a0a', border: '#1a1a1a', borderSubtle: '#141414',
  surface: '#0d0d0d', textPrimary: '#f0f0f0', textSecondary: '#555', textMuted: '#333',
}

type Flag = {
  key: string; label: string; description: string; group: string
  global: boolean; overrides: Record<string, boolean>
  risk: 'low' | 'medium' | 'high'
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled}
      style={{ width: 36, height: 20, borderRadius: 10, background: checked ? T.textPrimary : '#1a1a1a', border: `1px solid ${checked ? T.textPrimary : T.border}`, cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', transition: 'all 0.15s', padding: 0, flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: checked ? '#000' : T.textMuted, position: 'absolute', top: 2, left: checked ? 18 : 2, transition: 'left 0.15s' }} />
    </button>
  )
}

function SLabel({ children }: { children: string }) {
  return <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{children}</p>
}

export default function FlagsPage() {
  const [flags, setFlags]     = useState<Flag[]>([])
  const [gyms, setGyms]       = useState<GymRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [group, setGroup]     = useState('All')
  const [overrideGym, setOverrideGym] = useState<string>('')

  useEffect(() => {
    Promise.all([
      superApi.get<{ flags: Flag[] }>('/api/superadmin/flags'),
      superApi.get<{ gyms: Record<string, unknown>[] }>('/api/superadmin/gyms'),
    ]).then(([fr, gr]) => {
      setFlags(fr.flags ?? [])
      const mapped = (gr.gyms ?? []).map(mapGym)
      setGyms(mapped)
      if (mapped.length > 0) setOverrideGym(mapped[0].id)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const GROUPS = ['All', ...Array.from(new Set(flags.map(f => f.group)))]

  const filtered = flags.filter(f => {
    const matchGroup  = group === 'All' || f.group === group
    const matchSearch = !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase())
    return matchGroup && matchSearch
  })

  async function toggleGlobal(key: string) {
    const flag = flags.find(f => f.key === key)
    if (!flag) return
    setSaving(key + '_global')
    try {
      await superApi.patch(`/api/superadmin/flags/${key}`, { global: !flag.global })
      setFlags(prev => prev.map(f => f.key === key ? { ...f, global: !f.global } : f))
    } catch { /* noop */ } finally { setSaving(null) }
  }

  async function toggleOverride(flagKey: string, gymId: string) {
    const flag = flags.find(f => f.key === flagKey)
    if (!flag) return
    const hasOverride = flag.overrides[gymId] === true
    setSaving(flagKey + '_override_' + gymId)
    try {
      if (hasOverride) {
        await superApi.delete(`/api/superadmin/flags/${flagKey}/override/${gymId}`)
        setFlags(prev => prev.map(f => {
          if (f.key !== flagKey) return f
          const overrides = { ...f.overrides }
          delete overrides[gymId]
          return { ...f, overrides }
        }))
      } else {
        await superApi.post(`/api/superadmin/flags/${flagKey}/override`, { tenantId: gymId, enabled: true })
        setFlags(prev => prev.map(f =>
          f.key === flagKey ? { ...f, overrides: { ...f.overrides, [gymId]: true } } : f,
        ))
      }
    } catch { /* noop */ } finally { setSaving(null) }
  }

  const RISK_DOT: Record<string, string> = { low: '#4a7a5a', medium: '#7a6a3a', high: '#7a3a3a' }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Feature flags</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Toggle platform features globally or override per-gym. Changes persist immediately.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px', height: 32, background: T.surface, border: `1px solid #242424`, borderRadius: 8 }}>
              <Search01Icon size={12} style={{ color: T.textSecondary, flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search flags…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.textPrimary, width: 160 }} />
            </div>
            <select value={group} onChange={e => setGroup(e.target.value)}
              style={{ background: T.surface, border: `1px solid #242424`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: T.textSecondary, outline: 'none', cursor: 'pointer' }}>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total flags',    value: flags.length },
          { label: 'Globally on',    value: flags.filter(f => f.global).length },
          { label: 'Globally off',   value: flags.filter(f => !f.global).length },
          { label: 'With overrides', value: flags.filter(f => Object.keys(f.overrides).length > 0).length },
          { label: 'High risk',      value: flags.filter(f => f.risk === 'high').length },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, margin: '0 0 3px', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Flags table */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show" style={{ marginBottom: 14 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, gap: 8 }}>
            <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Flag</span></div>
            <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Group</span></div>
            <div style={{ width: 70 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk</span></div>
            <div style={{ width: 100 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overrides</span></div>
            <div style={{ width: 70, textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Global</span></div>
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: 40, background: '#111', borderRadius: 6, marginBottom: 8 }} />
              ))}
            </div>
          ) : filtered.map(flag => (
            <div key={flag.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.borderSubtle}` }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: 0 }}>{flag.label}</p>
                  {Object.keys(flag.overrides).length > 0 && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.textSecondary }} />
                  )}
                </div>
                <p style={{ fontSize: 11, color: T.textMuted, margin: '0 0 2px' }}>{flag.description}</p>
                <p style={{ fontSize: 10, color: T.textMuted, margin: 0, fontFamily: 'monospace' }}>{flag.key}</p>
              </div>
              <div style={{ width: 90 }}>
                <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{flag.group}</span>
              </div>
              <div style={{ width: 70, display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: RISK_DOT[flag.risk] }} />
                <span style={{ fontSize: 11, color: T.textSecondary }}>{flag.risk}</span>
              </div>
              <div style={{ width: 100 }}>
                {Object.keys(flag.overrides).length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {Object.keys(flag.overrides).map(gymId => {
                      const g = gyms.find(gg => gg.id === gymId)
                      return (
                        <span key={gymId} style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '1px 5px', borderRadius: 3 }}>
                          {g?.name.split(' ')[0] ?? gymId.slice(0, 6)}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: T.textMuted }}>—</span>
                )}
              </div>
              <div style={{ width: 70, display: 'flex', justifyContent: 'center' }}>
                <Toggle checked={flag.global} onChange={() => toggleGlobal(flag.key)} disabled={saving === flag.key + '_global'} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Per-gym override panel */}
      {gyms.length > 0 && (
        <motion.div variants={fade} custom={3} initial="hidden" animate="show">
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SLabel>Per-gym overrides</SLabel>
              <select value={overrideGym} onChange={e => setOverrideGym(e.target.value)}
                style={{ background: T.surface, border: `1px solid #242424`, borderRadius: 8, padding: '5px 10px', fontSize: 12, color: T.textSecondary, outline: 'none', cursor: 'pointer', width: 200 }}>
                {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {flags.map(flag => {
                const hasOverride = flag.overrides[overrideGym] === true
                const effective   = hasOverride ? true : flag.global
                const isSaving    = saving === flag.key + '_override_' + overrideGym
                return (
                  <div key={flag.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.surface, borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, margin: '0 0 2px' }}>{flag.label}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Global: {flag.global ? 'on' : 'off'}</p>
                        {hasOverride && <span style={{ fontSize: 10, color: '#7a6a3a', background: '#1a1500', border: '1px solid #3a3000', padding: '1px 5px', borderRadius: 3 }}>overridden</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 11, color: effective ? '#4a7a5a' : T.textMuted }}>{effective ? 'Active' : 'Inactive'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Toggle checked={hasOverride} onChange={() => toggleOverride(flag.key, overrideGym)} disabled={isSaving} />
                        <span style={{ fontSize: 11, color: T.textMuted }}>Override</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
