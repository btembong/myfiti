'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CheckmarkCircle01Icon,
  ArrowRight01Icon,
  UserGroupIcon,
  Wallet01Icon,
  Activity01Icon,
  QrCode01Icon,
  Building01Icon,
  Dumbbell01Icon,
  Alert01Icon,
} from 'hugeicons-react'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE, delay: i * 0.09 } }),
}

// ─── Admin Portal Mockup ───────────────────────────────────────────────────────
function AdminMockup() {
  const members = [
    { name: 'Amina Nkosi',    plan: 'Growth+', status: 'active',  days: '28d left' },
    { name: 'Kofi Mensah',    plan: 'Growth',  status: 'active',  days: '11d left' },
    { name: 'Jean-Paul Eto',  plan: 'Starter', status: 'expired', days: 'Expired'  },
    { name: 'Wambui Kariuki', plan: 'Growth+', status: 'active',  days: '59d left' },
  ]
  return (
    <div style={{ background: '#050505', borderRadius: 16, overflow: 'hidden', border: '1px solid #1a1a1a', fontSize: 0 }}>
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#333','#333','#333'].map((c, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: '#050505', borderRadius: 5, padding: '3px 12px', fontSize: 9, color: '#555', fontWeight: 600 }}>powerfit.myfiti.app/dashboard</div>
        </div>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4a7a5a' }} />
      </div>
      <div style={{ display: 'flex', minHeight: 280 }}>
        <div style={{ width: 36, background: '#0a0a0a', borderRight: '1px solid #1a1a1a', padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
            <Dumbbell01Icon size={11} color="#888" />
          </div>
          {[UserGroupIcon, Wallet01Icon, QrCode01Icon, Activity01Icon].map((Icon, i) => (
            <Icon key={i} size={13} color={i === 0 ? '#f0f0f0' : '#333'} />
          ))}
        </div>
        <div style={{ flex: 1, padding: '12px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
            {[
              { label: 'Members',  value: '87'    },
              { label: 'Revenue',  value: '₣1.8M' },
              { label: 'Check-ins',value: '61'    },
              { label: 'Expiring', value: '5'     },
            ].map(k => (
              <div key={k.label} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, padding: '7px 9px' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#f0f0f0', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 8, color: '#555', marginTop: 3, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#333' }}>Members</span>
            </div>
            {members.map((m, i) => (
              <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: i < members.length - 1 ? '1px solid #141414' : 'none' }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 7, fontWeight: 900, color: '#555' }}>{m.name.split(' ').map(w => w[0]).join('')}</span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#f0f0f0', flex: 1 }}>{m.name}</span>
                <span style={{ fontSize: 8, fontWeight: 600, color: '#555' }}>{m.plan}</span>
                <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: m.status === 'active' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', color: m.status === 'active' ? '#888' : '#444' }}>{m.days}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Kiosk Mockup ─────────────────────────────────────────────────────────────
function KioskMockup() {
  return (
    <div style={{ background: '#ffffff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', fontSize: 0 }}>
      <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#888', fontSize: 7, fontWeight: 900 }}>PF</span>
          </div>
          <span style={{ fontSize: 8, fontWeight: 800, color: '#0f172a' }}>PowerFit Douala</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a7a5a' }} />
            <span style={{ fontSize: 7, color: '#4a7a5a', fontWeight: 700 }}>23/60</span>
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#0f172a' }}>09:14</span>
        </div>
      </div>
      <div style={{ padding: '18px 14px 14px', background: '#ffffff' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a' }}>PowerFit Douala</div>
          <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>Your fitness journey starts here.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { icon: QrCode01Icon,   label: 'Check in' },
            { icon: UserGroupIcon,  label: 'Walk-in' },
            { icon: Activity01Icon, label: 'Classes' },
          ].map(item => {
            const Icon = item.icon
            return (
              <div key={item.label} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 6px', textAlign: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                  <Icon size={14} color="#555" />
                </div>
                <div style={{ fontSize: 8, fontWeight: 800, color: '#0f172a' }}>{item.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── SuperAdmin Mockup ────────────────────────────────────────────────────────
function SuperAdminMockup() {
  const gyms = [
    { name: 'PowerFit Douala',   flag: '🇨🇲', plan: 'Growth+', score: 94, status: 'active' },
    { name: 'PeakPulse Nairobi', flag: '🇰🇪', plan: 'Growth+', score: 97, status: 'active' },
    { name: 'GymCore Dakar',     flag: '🇸🇳', plan: 'Growth',  score: 31, status: 'suspended' },
    { name: 'FitLife Lagos',     flag: '🇳🇬', plan: 'Starter', score: 68, status: 'trial' },
  ]
  return (
    <div style={{ background: '#050505', borderRadius: 16, overflow: 'hidden', border: '1px solid #1a1a1a', fontSize: 0 }}>
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#333','#333','#333'].map((c, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: '#050505', borderRadius: 5, padding: '3px 12px', fontSize: 9, color: '#555', fontWeight: 600 }}>myfiti.app/superadmin</div>
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
          {[
            { label: 'MRR',       value: '₣69.6k' },
            { label: 'Gyms',      value: '7'       },
            { label: 'Suspended', value: '1'       },
          ].map(k => (
            <div key={k.label} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, padding: '7px 9px' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#f0f0f0', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 8, color: '#555', marginTop: 3 }}>{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
          {gyms.map((g, i) => (
            <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: i < gyms.length - 1 ? '1px solid #141414' : 'none' }}>
              <span style={{ fontSize: 10 }}>{g.flag}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#f0f0f0', flex: 1 }}>{g.name}</span>
              <span style={{ fontSize: 7, fontWeight: 700, color: '#555' }}>{g.plan}</span>
              <div style={{ width: 28, height: 4, borderRadius: 2, background: '#1a1a1a', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${g.score}%`, background: '#f0f0f0', borderRadius: 2 }} />
              </div>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: g.status === 'active' ? '#4a7a5a' : g.status === 'trial' ? '#7a6a3a' : '#7a3a3a' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type Tab = 'Gym Admin' | 'SuperAdmin' | 'Kiosk'
const TABS: Tab[] = ['Gym Admin', 'SuperAdmin', 'Kiosk']
const TAB_ICONS: Record<Tab, React.FC<{ size: number; color: string }>> = {
  'Gym Admin':  Dumbbell01Icon,
  'SuperAdmin': Building01Icon,
  'Kiosk':      QrCode01Icon,
}

export function Hero() {
  const [tab, setTab] = useState<Tab>('Gym Admin')

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-16 px-6 overflow-hidden"
      style={{ background: '#000' }}
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: 'linear-gradient(#f0f0f0 1px, transparent 1px), linear-gradient(90deg, #f0f0f0 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full flex flex-col items-center">

        {/* Badge */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <span className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#888' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#555' }} />
            Three portals. One platform. Built for Africa.
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUp} custom={1} initial="hidden" animate="show"
          className="text-center font-black leading-[1.03] tracking-tight max-w-4xl"
          style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)', color: '#f0f0f0' }}
        >
          The enterprise OS{' '}
          <span style={{ color: '#888' }}>
            for African gyms
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p variants={fadeUp} custom={2} initial="hidden" animate="show"
          className="text-center text-lg mt-6 max-w-2xl leading-relaxed font-medium"
          style={{ color: '#555' }}>
          Gym Admin dashboard. SuperAdmin platform console. Self-service Kiosk terminal.
          One subscription — every role covered, from member check-in to payout reconciliation.
        </motion.p>

        {/* Trust pills */}
        <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show" className="flex flex-wrap justify-center gap-2 mt-5">
          {['14-day free trial', 'XAF-native payments', '99.9% uptime SLA', 'Offline-capable kiosk'].map(f => (
            <span key={f} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }}>
              <CheckmarkCircle01Icon size={11} color="#555" />
              {f}
            </span>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show" className="flex flex-col sm:flex-row gap-3 mt-9">
          <Link href="/signup"
            className="inline-flex items-center justify-center gap-2 text-sm font-bold px-7 py-3.5 rounded-xl transition-all hover:opacity-90"
            style={{ background: '#f0f0f0', color: '#000' }}>
            Start 14-day trial <ArrowRight01Icon size={15} />
          </Link>
          <Link href="#portals"
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-xl transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#888' }}>
            Explore the platform
          </Link>
        </motion.div>

        {/* Product preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 32 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE, delay: 0.45 }}
          className="mt-16 w-full"
        >
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a', background: '#050505', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
            {/* Chrome */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#333' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#333' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#333' }} />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="rounded-lg px-3 py-1 text-xs max-w-xs" style={{ background: '#050505', border: '1px solid #1a1a1a', color: '#555' }}>
                  {tab === 'Gym Admin' ? 'powerfit.myfiti.app/dashboard' : tab === 'SuperAdmin' ? 'myfiti.app/superadmin' : 'powerfit.myfiti.app/kiosk'}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#4a7a5a' }} />
                <span className="text-[9px] font-semibold" style={{ color: '#4a7a5a' }}>Live</span>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 px-4 py-3" style={{ borderBottom: '1px solid #1a1a1a' }}>
              {TABS.map(t => {
                const Icon = TAB_ICONS[t]
                const active = tab === t
                return (
                  <button key={t} onClick={() => setTab(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={active
                      ? { background: 'rgba(255,255,255,0.08)', color: '#f0f0f0', border: '1px solid rgba(255,255,255,0.12)' }
                      : { color: '#555', border: '1px solid transparent' }
                    }>
                    <Icon size={12} color={active ? '#f0f0f0' : '#555'} />
                    {t}
                  </button>
                )
              })}
              <div className="flex-1" />
              <div className="flex items-center gap-1" style={{ opacity: 0.5 }}>
                <Alert01Icon size={12} color="#555" />
                <span className="text-[10px]" style={{ color: '#333' }}>0 alerts</span>
              </div>
            </div>

            {/* Mockup area */}
            <div className="p-5">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                {tab === 'Gym Admin' && <AdminMockup />}
                {tab === 'SuperAdmin' && <SuperAdminMockup />}
                {tab === 'Kiosk' && (
                  <div className="flex gap-5 items-center justify-center">
                    <div className="w-64">
                      <KioskMockup />
                    </div>
                    <div className="flex flex-col gap-3 text-left max-w-xs">
                      <div className="text-sm font-black" style={{ color: '#f0f0f0' }}>Self-service check-in terminal</div>
                      <div className="text-xs leading-relaxed" style={{ color: '#555' }}>
                        White, clean enterprise UI. Members scan QR codes or use their PIN.
                        Walk-ins pay by cash, MTN MoMo, or Orange Money and receive a day pass QR instantly.
                      </div>
                      {[
                        'QR scan + PIN check-in',
                        'Walk-in & day pass flow',
                        'Orange Money + MTN MoMo',
                        'Offline JWT validation',
                      ].map(f => (
                        <div key={f} className="flex items-center gap-2">
                          <CheckmarkCircle01Icon size={13} color="#555" />
                          <span className="text-xs font-medium" style={{ color: '#888' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Bottom stats */}
        <motion.div variants={fadeUp} custom={6} initial="hidden" animate="show"
          className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-3">
          {[
            { value: '7+',    label: 'Gyms live' },
            { value: '390+',  label: 'Members' },
            { value: '6',     label: 'Countries' },
            { value: '99.9%', label: 'Uptime' },
            { value: '3',     label: 'Portals' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-black" style={{ color: '#f0f0f0' }}>{s.value}</div>
              <div className="text-xs" style={{ color: '#333' }}>{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
