'use client'

import { motion } from 'framer-motion'
import {
  UserGroupIcon,
  QrCode01Icon,
  Wallet01Icon,
  Calendar01Icon,
  Analytics01Icon,
  WebhookIcon,
  Shield01Icon,
  Building01Icon,
  SmartPhone01Icon,
  Activity01Icon,
  FlashIcon,
  UserAdd01Icon,
  MoneySend01Icon,
  Invoice01Icon,
  CallIncoming01Icon,
  CheckmarkCircle01Icon,
} from 'hugeicons-react'

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
}

const CORE = [
  {
    icon: UserGroupIcon,
    title: 'Subscription engine',
    desc: 'Full lifecycle state machine — active → expiring → grace → suspended. Automatic reminders. Revenue never slips.',
    tags: ['Active', 'Expiring', 'Grace', 'Suspended'],
  },
  {
    icon: Calendar01Icon,
    title: 'Class scheduling',
    desc: 'Recurring classes, trainer assignment, capacity caps, waitlist promotion, and no-show tracking all in one place.',
  },
  {
    icon: Analytics01Icon,
    title: 'Revenue analytics',
    desc: 'MRR, churn, plan breakdown, at-risk members — real-time on the owner dashboard.',
  },
  {
    icon: Building01Icon,
    title: 'SuperAdmin portal',
    desc: 'Multi-tenant overview with gym health scoring, payout reconciliation, and per-gym feature flags.',
  },
  {
    icon: WebhookIcon,
    title: 'Webhooks & REST API',
    desc: 'Signed webhook events for member state changes, check-ins, and payment confirmations. Full developer access.',
  },
  {
    icon: Shield01Icon,
    title: 'RBAC & audit log',
    desc: 'Role-based access control with granular permissions. Every admin action is timestamped and immutable.',
  },
  {
    icon: SmartPhone01Icon,
    title: 'Member mobile view',
    desc: 'White-labeled member portal showing plan, check-in history, class schedule, and upcoming renewals.',
  },
  {
    icon: Activity01Icon,
    title: 'Gym health scoring',
    desc: 'Composite score (plan + activity + members) surfaced in SuperAdmin — spot at-risk gyms before they churn.',
  },
  {
    icon: FlashIcon,
    title: 'Feature flags per gym',
    desc: 'Toggle scheduling, SMS, API, and kiosk per gym at runtime. Zero code changes, instant effect.',
  },
]

const WALKIN_STEPS = [
  { icon: UserAdd01Icon,         step: '01', label: 'Walk-in arrives',        desc: 'Staff enters guest name and phone at the kiosk — no app, no sign-up required.' },
  { icon: Invoice01Icon,         step: '02', label: 'Select day pass',        desc: 'Standard · Peak · Off-peak · Student · 10-day bundle — with XAF pricing shown upfront.' },
  { icon: MoneySend01Icon,       step: '03', label: 'Choose payment method',  desc: 'Cash collection, MTN MoMo QR, Orange Money QR, or SMS payment link (Tranzak).' },
  { icon: QrCode01Icon,          step: '04', label: 'QR code issued',         desc: 'Signed day pass QR (JWT, expires midnight). Print, SMS to guest, or scan on-screen.' },
  { icon: CheckmarkCircle01Icon, step: '05', label: 'Access granted',         desc: 'Kiosk validates offline. No internet needed at the gate. Green screen, door opens.' },
  { icon: CallIncoming01Icon,    step: '06', label: 'Follow-up sent',         desc: 'Auto SMS next morning: "Join us as a member — click to sign up". Turns visits into revenue.' },
]

export function Features() {
  return (
    <section id="features" className="py-24 px-6" style={{ background: '#000' }}>
      <div className="max-w-6xl mx-auto">

        <motion.div
          className="text-center mb-16"
          variants={fade} custom={0} initial="hidden" whileInView="show" viewport={{ once: true }}
        >
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#333' }}>Platform features</p>
          <h2 className="text-4xl font-black" style={{ color: '#f0f0f0' }}>Enterprise-grade. Africa-first.</h2>
          <p className="mt-4 max-w-xl mx-auto font-medium" style={{ color: '#555' }}>
            Every feature built for the realities of running a gym in West and East Africa — not retrofitted from a Western SaaS template.
          </p>
        </motion.div>

        {/* Walk-in & Day Pass — full-width highlight */}
        <motion.div
          variants={fade} custom={1} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="mb-6 rounded-3xl overflow-hidden"
          style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}
        >
          {/* Header strip */}
          <div className="px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            style={{ borderBottom: '1px solid #1a1a1a' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#1a1a1a' }}>
                <UserAdd01Icon size={20} color="#555" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#555', letterSpacing: '0.12em' }}>Walk-in &amp; Day Pass</p>
                <h3 className="text-xl font-black" style={{ color: '#f0f0f0' }}>Onsite physical flow — cash in, QR out</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #222' }}>
                Offline-capable
              </span>
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #222' }}>
                Kiosk-native
              </span>
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #222' }}>
                MoMo · Cash · SMS
              </span>
            </div>
          </div>

          {/* 6-step flow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px" style={{ background: '#1a1a1a' }}>
            {WALKIN_STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.div
                  key={s.step}
                  variants={fade} custom={i + 2} initial="hidden" whileInView="show" viewport={{ once: true }}
                  className="p-6 flex flex-col gap-3"
                  style={{ background: '#0a0a0a' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: '#111' }}>
                      <Icon size={16} color="#555" />
                    </div>
                    <span className="text-xs font-black" style={{ color: '#1a1a1a', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                      {s.step}
                    </span>
                  </div>
                  <p className="text-sm font-black" style={{ color: '#f0f0f0' }}>{s.label}</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#555' }}>{s.desc}</p>
                </motion.div>
              )
            })}
          </div>

          {/* Payment methods footer */}
          <div className="px-8 py-4 flex flex-wrap items-center gap-x-6 gap-y-2"
            style={{ borderTop: '1px solid #1a1a1a' }}>
            <span className="text-xs" style={{ color: '#333' }}>Day pass types:</span>
            {['Standard ₣2 000', 'Peak ₣2 500', 'Off-peak ₣1 500', 'Student ₣1 000', '10-day bundle ₣18 000'].map(t => (
              <span key={t} className="text-xs font-semibold" style={{ color: '#555' }}>{t}</span>
            ))}
            <span className="ml-auto text-xs font-bold" style={{ color: '#333' }}>
              Leads log · SMS follow-up · One-click convert to member
            </span>
          </div>
        </motion.div>

        {/* Kiosk check-in card (wide) + core grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Kiosk tall card */}
          <motion.div
            variants={fade} custom={8} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="md:col-span-1 md:row-span-2 rounded-2xl p-7 flex flex-col justify-between"
            style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', minHeight: 300 }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: '#1a1a1a' }}>
              <QrCode01Icon size={22} color="#555" />
            </div>
            <div>
              <h3 className="text-xl font-black mb-3" style={{ color: '#f0f0f0' }}>QR check-in kiosk</h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#555' }}>
                Self-service terminal — member scans QR, kiosk verifies offline JWT, full-screen confirmation.
                PIN fallback for members without phones. Walk-in registration built-in.
              </p>
              <div className="flex flex-wrap gap-2">
                {['QR scan', 'PIN fallback', 'Walk-in', 'Offline', 'Day pass'].map(t => (
                  <span key={t} className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #222' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Payments card */}
          <motion.div
            variants={fade} custom={9} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="md:col-span-2 rounded-2xl p-7"
            style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
              style={{ background: '#1a1a1a' }}>
              <Wallet01Icon size={22} color="#555" />
            </div>
            <h3 className="text-xl font-black mb-2" style={{ color: '#f0f0f0' }}>XAF-native payments</h3>
            <p className="text-sm leading-relaxed mb-5" style={{ color: '#555' }}>
              Orange Money, MTN MoMo, cash recording, and Tranzak SMS payment links — all supported at the kiosk and from the admin dashboard. No international card processor required.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'MTN MoMo',     sub: 'QR at kiosk' },
                { label: 'Orange Money', sub: 'QR at kiosk' },
                { label: 'Cash',         sub: 'Staff confirms' },
                { label: 'SMS link',     sub: 'Tranzak · async' },
              ].map(p => (
                <div key={p.label} className="rounded-xl px-4 py-3"
                  style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                  <p className="text-xs font-black" style={{ color: '#f0f0f0' }}>{p.label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#555' }}>{p.sub}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Core feature cards */}
          {CORE.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                variants={fade} custom={i + 10} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl p-6"
                style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: '#111' }}>
                  <Icon size={18} color="#555" />
                </div>
                <h3 className="text-sm font-bold mb-1.5" style={{ color: '#f0f0f0' }}>{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#555' }}>{f.desc}</p>
                {f.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {f.tags.map(t => (
                      <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #222' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )
          })}

        </div>
      </div>
    </section>
  )
}
