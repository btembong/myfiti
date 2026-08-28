'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search01Icon, More01Icon, UserGroupIcon,
  EyeIcon, Cancel01Icon, Refresh01Icon, ArrowUpRight01Icon,
  Download01Icon, MailSend01Icon, GitCompareIcon,
  FilterIcon,
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

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

function exportCSV(rows: GymRow[]) {
  const headers = ['Name', 'Owner', 'Email', 'Plan', 'Status', 'Members', 'Revenue/mo', 'Joined']
  const lines = rows.map(g => [g.name, g.owner, g.email, g.plan, g.status, g.members, g.revenueXAF > 0 ? g.revenueXAF : 0, g.joinedAt].join(','))
  const csv = [headers.join(','), ...lines].join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'gyms.csv'; a.click()
}

// ─── Health score ──────────────────────────────────────────────────────────────
function healthScore(gym: GymRow): number {
  const planScore    = gym.plan === 'Growth+' ? 25 : gym.plan === 'Growth' ? 18 : 10
  const statusScore  = gym.status === 'active' ? 30 : gym.status === 'trial' ? 18 : 0
  const recencyScore = gym.lastSeen.includes('min') || gym.lastSeen.includes('Now') ? 25
    : gym.lastSeen.includes('h ago') ? 20
    : gym.lastSeen.includes('Yesterday') ? 12
    : gym.lastSeen.includes('2d') ? 7 : 3
  const memberScore  = gym.members >= 80 ? 20 : gym.members >= 40 ? 14 : gym.members >= 20 ? 8 : 4
  return Math.min(100, planScore + statusScore + recencyScore + memberScore)
}

function HealthBar({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 3, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: '#f0f0f0', borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, width: 24, textAlign: 'right' }}>{score}</span>
    </div>
  )
}

// ─── Comparison panel ──────────────────────────────────────────────────────────
function ComparePanel({ ids, onClose, allGyms }: { ids: string[], onClose: () => void, allGyms: GymRow[] }) {
  const gyms = ids.map(id => allGyms.find(g => g.id === id)!).filter(Boolean)
  const metrics = [
    { label: 'Plan',       values: gyms.map(g => g.plan) },
    { label: 'Members',    values: gyms.map(g => String(g.members)) },
    { label: 'Revenue/mo', values: gyms.map(g => g.revenueXAF > 0 ? `₣${g.revenueXAF.toLocaleString('fr-CM')}` : '—') },
    { label: 'Check-ins',  values: gyms.map(g => String(g.checkins)) },
    { label: 'Status',     values: gyms.map(g => g.status) },
    { label: 'Health',     values: gyms.map(g => String(healthScore(g))) },
    { label: 'Last seen',  values: gyms.map(g => g.lastSeen) },
    { label: 'Joined',     values: gyms.map(g => g.joinedAt) },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textMuted }}>
          Side-by-side comparison
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary, padding: 2 }}>
          <Cancel01Icon size={13} />
        </button>
      </div>
      {/* Header row */}
      <div style={{ display: 'flex', padding: '10px 16px', borderBottom: `1px solid ${T.borderSubtle}` }}>
        <div style={{ width: 110 }} />
        {gyms.map(g => (
          <div key={g.id} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1a1a1a', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: '#555' }}>{g.name.slice(0, 2).toUpperCase()}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{g.name}</span>
          </div>
        ))}
      </div>
      {metrics.map(m => (
        <div key={m.label} style={{ display: 'flex', padding: '8px 16px', borderBottom: `1px solid ${T.borderSubtle}` }}>
          <div style={{ width: 110 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>{m.label}</span>
          </div>
          {m.values.map((v, i) => (
            <div key={i} style={{ flex: 1 }}>
              {m.label === 'Health'
                ? <HealthBar score={parseInt(v)} />
                : <span style={{ fontSize: 12, color: T.textSecondary }}>{v}</span>
              }
            </div>
          ))}
        </div>
      ))}
    </motion.div>
  )
}

// ─── Bulk toolbar ──────────────────────────────────────────────────────────────
function BulkToolbar({ count, onSuspend, onEmail, onExport, onClear }: {
  count: number
  onSuspend: () => void
  onEmail: () => void
  onExport: () => void
  onClear: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, background: '#1a1a1a', border: `1px solid ${T.border}`, padding: '2px 9px', borderRadius: 5 }}>
          {count} selected
        </span>
        <div style={{ width: 1, height: 16, background: T.border }} />
        <button onClick={onSuspend} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, padding: '3px 6px', borderRadius: 6 }}>
          <Cancel01Icon size={12} /> Suspend
        </button>
        <button onClick={onEmail} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, padding: '3px 6px', borderRadius: 6 }}>
          <MailSend01Icon size={12} /> Email
        </button>
        <button onClick={onExport} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, padding: '3px 6px', borderRadius: 6 }}>
          <Download01Icon size={12} /> Export CSV
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 2 }}>
          <Cancel01Icon size={13} />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Row menu ─────────────────────────────────────────────────────────────────
function RowMenu({ gym, onToggleCompare, isComparing }: { gym: GymRow, onToggleCompare: () => void, isComparing: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
      <button
        title={isComparing ? 'Remove from compare' : 'Compare'}
        onClick={onToggleCompare}
        style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isComparing ? '#1a1a1a' : 'none', border: isComparing ? `1px solid ${T.border}` : 'none', cursor: 'pointer', color: T.textSecondary }}
      >
        <GitCompareIcon size={12} />
      </button>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary }}>
          <More01Icon size={13} />
        </button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 170, background: '#0d0d0d', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', zIndex: 50 }}>
              <Link href={`/superadmin/gyms/${gym.id}`} onClick={() => setOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', textDecoration: 'none', fontSize: 12, color: T.textSecondary }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <EyeIcon size={12} /> View detail
              </Link>
              <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, textAlign: 'left' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <ArrowUpRight01Icon size={12} /> Impersonate
              </button>
              <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, textAlign: 'left' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <MailSend01Icon size={12} /> Send email
              </button>
              <div style={{ height: 1, background: T.border }} />
              {gym.status !== 'suspended' ? (
                <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#7a3a3a', textAlign: 'left' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                  <Cancel01Icon size={12} /> Suspend gym
                </button>
              ) : (
                <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, textAlign: 'left' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                  <Refresh01Icon size={12} /> Reinstate gym
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Filter pill ──────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }: { label: string, value?: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: active ? '#1a1a1a' : 'none', border: `1px solid ${active ? T.border : 'transparent'}`, color: active ? T.textPrimary : T.textMuted, cursor: 'pointer', transition: 'all 0.1s' }}>
      {label}
    </button>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function GymsPage() {
  const [gyms, setGyms]               = useState<GymRow[]>([])
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState('all')
  const [planFilter, setPlanFilter]   = useState<string | null>(null)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [comparing, setComparing]     = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

  useEffect(() => {
    superApi.get<{ gyms: Record<string, unknown>[] }>('/api/superadmin/gyms')
      .then(r => setGyms(r.gyms.map(mapGym)))
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => gyms.filter(g => {
    const matchStatus = filter === 'all' || g.status === filter
    const matchPlan   = !planFilter || g.plan === planFilter
    const matchSearch = !search
      || g.name.toLowerCase().includes(search.toLowerCase())
      || g.owner.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchPlan && matchSearch
  }), [gyms, search, filter, planFilter])

  const allSelected  = filtered.length > 0 && filtered.every(g => selected.has(g.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(g => n.delete(g.id)); return n })
    } else {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(g => n.add(g.id)); return n })
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleCompare(id: string) {
    setComparing(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }

  const STATUS_FILTERS = [
    { label: 'All',       value: 'all'       },
    { label: 'Active',    value: 'active'    },
    { label: 'Trial',     value: 'trial'     },
    { label: 'Suspended', value: 'suspended' },
  ]
  const PLAN_FILTERS = ['Starter', 'Growth', 'Growth+']

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Gyms</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>All registered gyms on the myfiti platform.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px', height: 32, background: T.surface, border: `1px solid #242424`, borderRadius: 8 }}>
              <Search01Icon size={12} style={{ color: T.textSecondary, flexShrink: 0 }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search gyms or owners…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.textPrimary, width: 200 }}
              />
            </div>
            {/* Plan filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <FilterIcon size={12} style={{ color: T.textMuted }} />
              {PLAN_FILTERS.map(p => (
                <button key={p} onClick={() => setPlanFilter(planFilter === p ? null : p)}
                  style={{ padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 500, background: planFilter === p ? '#1a1a1a' : 'none', border: `1px solid ${planFilter === p ? T.border : 'transparent'}`, color: planFilter === p ? T.textPrimary : T.textMuted, cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {STATUS_FILTERS.map(f => (
          <FilterPill key={f.value} label={f.label} value={f.value} active={filter === f.value} onClick={() => setFilter(f.value)} />
        ))}
      </div>

      {/* Bulk toolbar */}
      <AnimatePresence>
        {someSelected && (
          <div style={{ marginBottom: 10 }}>
            <BulkToolbar
              count={selected.size}
              onSuspend={() => setSelected(new Set())}
              onEmail={() => setSelected(new Set())}
              onExport={() => setSelected(new Set())}
              onClear={() => setSelected(new Set())}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Compare toolbar */}
      <AnimatePresence>
        {comparing.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ marginBottom: 10 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <GitCompareIcon size={13} style={{ color: T.textSecondary }} />
              <span style={{ fontSize: 12, color: T.textSecondary }}>Comparing {comparing.length} gyms</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {comparing.map(id => {
                  const g = gyms.find(x => x.id === id)
                  return g ? (
                    <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.textSecondary, background: '#141414', border: `1px solid ${T.border}`, padding: '2px 8px', borderRadius: 4 }}>
                      {g.name}
                      <button onClick={() => toggleCompare(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0, lineHeight: 1 }}>
                        <Cancel01Icon size={9} />
                      </button>
                    </span>
                  ) : null
                })}
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setCompareOpen(v => !v)}
                style={{ padding: '4px 12px', borderRadius: 7, fontSize: 11, fontWeight: 500, background: '#1a1a1a', border: `1px solid ${T.border}`, color: T.textPrimary, cursor: 'pointer' }}>
                {compareOpen ? 'Hide' : 'Show'} comparison
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison panel */}
      <AnimatePresence>
        {compareOpen && comparing.length >= 2 && (
          <div style={{ marginBottom: 12 }}>
            <ComparePanel ids={comparing} allGyms={gyms} onClose={() => { setCompareOpen(false); setComparing([]) }} />
          </div>
        )}
      </AnimatePresence>

      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>

          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, gap: 8 }}>
            <div style={{ width: 24 }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                style={{ accentColor: '#555', cursor: 'pointer', width: 13, height: 13 }} />
            </div>
            <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gym</span></div>
            <div style={{ width: 80 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Plan</span></div>
            <div style={{ width: 80 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Members</span></div>
            <div style={{ width: 110 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Revenue/mo</span></div>
            <div style={{ width: 120 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Health</span></div>
            <div style={{ width: 80 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span></div>
            <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Last seen</span></div>
            <div style={{ width: 56 }} />
          </div>

          {filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '32px 0' }}>No gyms match your filters.</p>
          ) : filtered.map(gym => {
            const score = healthScore(gym)
            const isSelected  = selected.has(gym.id)
            const isComparing = comparing.includes(gym.id)
            return (
              <div key={gym.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${T.borderSubtle}`, background: isSelected ? '#111' : isComparing ? '#0e0e0e' : 'transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (!isSelected && !isComparing) (e.currentTarget as HTMLElement).style.background = '#0d0d0d' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSelected ? '#111' : isComparing ? '#0e0e0e' : 'transparent' }}
              >
                <div style={{ width: 24 }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleOne(gym.id)}
                    style={{ accentColor: '#555', cursor: 'pointer', width: 13, height: 13 }} />
                </div>

                <Link href={`/superadmin/gyms/${gym.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#111', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#555' }}>{gym.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gym.name}</p>
                    <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{gym.owner} · {gym.email}</p>
                  </div>
                </Link>

                <div style={{ width: 80 }}>
                  <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>
                    {gym.plan}
                  </span>
                </div>
                <div style={{ width: 80, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <UserGroupIcon size={10} style={{ color: T.textMuted }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary }}>{gym.members}</span>
                </div>
                <div style={{ width: 110 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: gym.revenueXAF > 0 ? T.textPrimary : T.textMuted }}>
                    {gym.revenueXAF > 0 ? `₣${gym.revenueXAF.toLocaleString('fr-CM')}` : '—'}
                  </span>
                </div>
                <div style={{ width: 120 }}>
                  <HealthBar score={score} />
                </div>
                <div style={{ width: 80 }}>
                  <StatusPill label={gym.status} />
                </div>
                <div style={{ width: 90 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>{gym.lastSeen}</span>
                </div>
                <div style={{ width: 56 }}>
                  <RowMenu gym={gym} onToggleCompare={() => toggleCompare(gym.id)} isComparing={isComparing} />
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>
              {filtered.length} gym{filtered.length !== 1 ? 's' : ''} shown
              {someSelected ? ` · ${selected.size} selected` : ''}
            </span>
            <button onClick={() => exportCSV(filtered)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, padding: '3px 6px', borderRadius: 6 }}>
              <Download01Icon size={12} /> Export CSV
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
