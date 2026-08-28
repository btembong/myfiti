'use client'

import Link from 'next/link'
import { CheckmarkCircle01Icon, ArrowRight01Icon } from 'hugeicons-react'

const PLANS = [
  {
    name: 'Starter',
    price: '15,000',
    period: '/month',
    members: 'Up to 100 members',
    desc: 'Perfect for new gyms getting off the ground.',
    features: [
      'Member management',
      'Subscription engine',
      'QR check-in kiosk',
      'Payment recording (cash, mobile money)',
      '1 admin account',
      'Email notifications',
    ],
    highlight: false,
    cta: 'Start free trial',
  },
  {
    name: 'Growth',
    price: '35,000',
    period: '/month',
    members: 'Up to 500 members',
    desc: 'For growing gyms that need more power.',
    features: [
      'Everything in Starter',
      'Class scheduling & booking',
      'Trainer portal',
      'Member mobile view',
      'SMS notifications',
      '5 staff accounts',
      'Full analytics dashboard',
      'Referral system',
    ],
    highlight: false,
    cta: 'Start free trial',
  },
  {
    name: 'Growth+',
    price: '75,000',
    period: '/month',
    members: 'Unlimited members',
    desc: 'The full platform for established gyms.',
    features: [
      'Everything in Growth',
      'REST API & webhooks',
      'Unlimited staff accounts',
      'Kiosk terminal',
      'Custom subdomain',
      'Audit log & RBAC',
      'Priority support (24h SLA)',
      'Data export & backups',
    ],
    highlight: true,
    cta: 'Start free trial',
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6" style={{ background: '#000' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#333' }}>Pricing</p>
          <h2 className="text-4xl font-black" style={{ color: '#f0f0f0' }}>Simple, transparent pricing</h2>
          <p className="mt-4 font-medium" style={{ color: '#555' }}>
            14-day free trial on all plans. No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className="rounded-2xl p-8 flex flex-col"
              style={plan.highlight
                ? { background: '#111', border: '1px solid #2a2a2a', transform: 'scale(1.03)' }
                : { background: '#0a0a0a', border: '1px solid #1a1a1a' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold" style={{ color: '#f0f0f0' }}>
                  {plan.name}
                </span>
                {plan.highlight && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.07)', color: '#888', border: '1px solid #2a2a2a' }}>
                    Most popular
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-sm" style={{ color: '#555' }}>₣</span>
                <span className="text-4xl font-black" style={{ color: '#f0f0f0' }}>{plan.price}</span>
                <span className="text-sm" style={{ color: '#555' }}>{plan.period}</span>
              </div>

              <p className="text-xs font-semibold mb-1" style={{ color: '#888' }}>
                {plan.members}
              </p>
              <p className="text-sm mb-6 font-medium" style={{ color: '#555' }}>{plan.desc}</p>

              <Link href="/signup"
                className="flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl mb-7 transition-all hover:opacity-90"
                style={{ background: '#f0f0f0', color: '#000' }}>
                {plan.cta}
                <ArrowRight01Icon size={14} />
              </Link>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckmarkCircle01Icon size={14} color="#555" style={{ flexShrink: 0 }} />
                    <span className="text-sm font-medium" style={{ color: '#888' }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Enterprise bar */}
        <div className="mt-6 rounded-2xl p-7 flex flex-col md:flex-row items-center justify-between gap-6"
          style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-black text-lg" style={{ color: '#f0f0f0' }}>Enterprise</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#555', border: '1px solid #222' }}>
                Custom
              </span>
            </div>
            <p className="text-sm font-medium" style={{ color: '#555' }}>
              Unlimited members · White-label · Dedicated infrastructure · Custom SLA · Onboarding support · SuperAdmin access
            </p>
          </div>
          <Link href="mailto:hello@myfiti.app"
            className="flex-shrink-0 flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a2a', color: '#888' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}>
            Contact us
            <ArrowRight01Icon size={14} />
          </Link>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#333' }}>
          All prices in XAF · Billed monthly · Cancel anytime · Setup takes less than 5 minutes
        </p>
      </div>
    </section>
  )
}
