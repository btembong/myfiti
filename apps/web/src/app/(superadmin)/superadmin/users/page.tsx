'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Search01Icon, More01Icon, Mail01Icon,
  Cancel01Icon, EyeIcon, Building01Icon, ShieldUserIcon,
} from 'hugeicons-react'
import { superApi } from '@/lib/api'

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

type User = {
  id: string
  name: string
  email: string
  role: string
  gymId: string
  gymName: string
  gymSlug: string
  status: string
  joinedAt: string
}

type UsersResponse = {
  users: User[]
  total: number
  ownerCount: number
  staffCount: number
  trainerCount: number
  suspendedCount: number
}

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a1a', padding: '2px 9px', borderRadius: 4 }}>
      {label}
    </span>
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

function UserMenu({ user, onSuspend }: { user: User; onSuspend: (u: User) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary }}>
        <More01Icon size={13} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 170, background: '#0d0d0d', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', zIndex: 50 }}>
            {user.gymId && (
              <Link href={`/superadmin/gyms/${user.gymId}`} onClick={() => setOpen(false)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', textDecoration: 'none', fontSize: 12, color: T.textSecondary }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
                <Building01Icon size={12} /> View gym
              </Link>
            )}
            <button onClick={() => { setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, textAlign: 'left' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <EyeIcon size={12} /> View profile
            </button>
            <button onClick={() => { setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSecondary, textAlign: 'left' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <ShieldUserIcon size={12} /> Change role
            </button>
            <div style={{ height: 1, background: T.border }} />
            <button onClick={() => { setOpen(false); onSuspend(user) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#7a3a3a', textAlign: 'left' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#141414')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <Cancel01Icon size={12} /> Suspend user
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const ROLE_FILTERS = [
  { label: 'All',           value: 'all'          },
  { label: 'Owners',        value: 'owner'        },
  { label: 'Staff',         value: 'staff'        },
  { label: 'Trainers',      value: 'trainer'      },
  { label: 'Receptionist',  value: 'receptionist' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function UsersPage() {
  const [data, setData]       = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [gymFilter, setGymFilter]   = useState('all')

  useEffect(() => {
    superApi.get<UsersResponse>('/api/superadmin/users')
      .then(r => setData(r))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const users = data?.users ?? []

  // Unique gym list for the gym filter dropdown
  const gyms = Array.from(
    new Map(users.filter(u => u.gymId).map(u => [u.gymId, { id: u.gymId, name: u.gymName }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all'
      ? true
      : roleFilter === 'staff'
        ? ['admin', 'receptionist'].includes(u.role)
        : u.role === roleFilter
    const matchGym    = gymFilter === 'all' || u.gymId === gymFilter
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchGym && matchSearch
  })

  function handleSuspend(_user: User) {
    // TODO: wire to PATCH /api/superadmin/gyms/:gymId with { status: 'suspended' }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>

      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Users</h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>All user accounts across the platform — owners, staff, and trainers.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px', height: 32, background: T.surface, border: `1px solid #242424`, borderRadius: 8 }}>
              <Search01Icon size={12} style={{ color: T.textSecondary, flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.textPrimary, width: 200 }} />
            </div>
            {/* Gym filter */}
            <div style={{ position: 'relative' }}>
              <select value={gymFilter} onChange={e => setGymFilter(e.target.value)}
                style={{ padding: '0 12px', height: 32, background: T.surface, border: `1px solid #242424`, borderRadius: 8, fontSize: 12, color: T.textSecondary, outline: 'none', cursor: 'pointer', appearance: 'none', paddingRight: 28 }}>
                <option value="all">All gyms</option>
                {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Role filter pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {ROLE_FILTERS.map(f => (
          <FilterPill key={f.value} label={f.label} active={roleFilter === f.value} onClick={() => setRoleFilter(f.value)} />
        ))}
      </div>

      {/* Stats */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show"
        style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total users',  value: data?.total ?? 0           },
          { label: 'Owners',       value: data?.ownerCount ?? 0      },
          { label: 'Staff',        value: data?.staffCount ?? 0      },
          { label: 'Trainers',     value: data?.trainerCount ?? 0    },
          { label: 'Suspended',    value: data?.suspendedCount ?? 0  },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, margin: '0 0 3px', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Table */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, gap: 8 }}>
            <div style={{ flex: 1 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>User</span></div>
            <div style={{ width: 100 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Role</span></div>
            <div style={{ width: 180 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gym</span></div>
            <div style={{ width: 90 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span></div>
            <div style={{ width: 100 }}><span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Joined</span></div>
            <div style={{ width: 32 }} />
          </div>

          {loading ? (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '32px 0' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '32px 0' }}>No users found.</p>
          ) : filtered.map(user => (
            <div key={user.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${T.borderSubtle}`, transition: 'background 0.1s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0d0d0d')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1a1a1a', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#555' }}>
                    {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail01Icon size={9} style={{ color: T.textMuted }} />
                    <span style={{ fontSize: 11, color: T.textMuted }}>{user.email}</span>
                  </div>
                </div>
              </div>
              <div style={{ width: 100 }}>
                <span style={{ fontSize: 10, color: T.textSecondary, background: '#111', border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 4 }}>{user.role}</span>
              </div>
              <div style={{ width: 180 }}>
                {user.gymId ? (
                  <Link href={`/superadmin/gyms/${user.gymId}`}
                    style={{ fontSize: 12, color: T.textSecondary, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = T.textPrimary)}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = T.textSecondary)}>
                    {user.gymName}
                  </Link>
                ) : <span style={{ fontSize: 12, color: T.textMuted }}>—</span>}
              </div>
              <div style={{ width: 90 }}>
                <StatusPill label={user.status} />
              </div>
              <div style={{ width: 100 }}>
                <span style={{ fontSize: 11, color: T.textMuted }}>{fmtDate(user.joinedAt)}</span>
              </div>
              <div style={{ width: 32 }}>
                <UserMenu user={user} onSuspend={handleSuspend} />
              </div>
            </div>
          ))}

          <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>
              {filtered.length} user{filtered.length !== 1 ? 's' : ''} shown of {data?.total ?? 0} total
            </span>
          </div>
        </div>
      </motion.div>

    </div>
  )
}
