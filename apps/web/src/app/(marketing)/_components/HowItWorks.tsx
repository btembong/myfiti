import {
  Dumbbell01Icon,
  Building01Icon,
  QrCode01Icon,
  UserGroupIcon,
  Wallet01Icon,
  Calendar01Icon,
  Analytics01Icon,
  WebhookIcon,
  Shield01Icon,
  CheckmarkCircle01Icon,
  Activity01Icon,
  SmartPhone01Icon,
} from 'hugeicons-react'

const PORTALS = [
  {
    icon: Dumbbell01Icon,
    tag: 'Gym Admin',
    title: 'Run your gym from one dashboard',
    desc: 'Everything a gym owner needs — member management, subscriptions, payments, check-ins, and classes — unified in a single dark-mode admin portal.',
    features: [
      { icon: UserGroupIcon,  label: 'Member management & subscriptions' },
      { icon: Wallet01Icon,   label: 'Orange Money, MTN MoMo & cash payments' },
      { icon: Calendar01Icon, label: 'Class scheduling & trainer management' },
      { icon: Analytics01Icon,label: 'Revenue analytics & at-risk member alerts' },
    ],
    href: '/dashboard',
  },
  {
    icon: Building01Icon,
    tag: 'SuperAdmin',
    title: 'Full platform visibility & control',
    desc: 'A separate dark portal for the platform operator — monitor all gyms, track MRR, reconcile payouts, and manage feature flags without touching gym-level data.',
    features: [
      { icon: Analytics01Icon, label: 'Multi-tenant MRR, ARR & churn tracking' },
      { icon: Wallet01Icon,     label: 'Payout reconciliation (85% / 15% split)' },
      { icon: WebhookIcon,      label: 'Gym health scoring & activity feed' },
      { icon: Shield01Icon,     label: 'Suspend, upgrade, or feature-flag any gym' },
    ],
    href: '/superadmin',
  },
  {
    icon: QrCode01Icon,
    tag: 'Kiosk',
    title: 'Self-service terminal for the gym floor',
    desc: 'A full-screen touchscreen app for the gym entrance. Members scan QR codes or use their PIN. Walk-ins can pay on-the-spot with mobile money.',
    features: [
      { icon: QrCode01Icon,         label: 'QR scan + PIN check-in with offline support' },
      { icon: SmartPhone01Icon,     label: 'Orange Money & MTN MoMo day passes' },
      { icon: Activity01Icon,       label: 'Real-time capacity counter & status display' },
      { icon: CheckmarkCircle01Icon,label: 'Staff mode with PIN-protected admin access' },
    ],
    href: '/kiosk',
  },
]

export function HowItWorks() {
  return (
    <section id="portals" className="py-24 px-6" style={{ background: '#000' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#333' }}>Three portals, one platform</p>
          <h2 className="text-4xl font-black" style={{ color: '#f0f0f0' }}>Built for every role in your business</h2>
          <p className="mt-4 max-w-xl mx-auto font-medium" style={{ color: '#555' }}>
            Each portal is purpose-designed for its audience — gym owner, platform operator, or member at the door.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PORTALS.map(p => {
            const Icon = p.icon
            return (
              <div key={p.tag} className="rounded-2xl p-7 flex flex-col" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#1a1a1a' }}>
                    <Icon size={20} color="#555" />
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #222' }}>
                    {p.tag}
                  </span>
                </div>

                <h3 className="text-lg font-black mb-3" style={{ color: '#f0f0f0' }}>{p.title}</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: '#555' }}>{p.desc}</p>

                <ul className="space-y-2.5 flex-1">
                  {p.features.map(f => {
                    const FIcon = f.icon
                    return (
                      <li key={f.label} className="flex items-center gap-2.5">
                        <FIcon size={13} color="#555" style={{ flexShrink: 0 }} />
                        <span className="text-xs font-medium" style={{ color: '#888' }}>{f.label}</span>
                      </li>
                    )
                  })}
                </ul>

                <a href={p.href}
                  className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold transition-opacity hover:opacity-80"
                  style={{ color: '#555' }}>
                  Open {p.tag} →
                </a>
              </div>
            )
          })}
        </div>

        {/* How it works steps */}
        <div className="mt-16">
          <p className="text-xs font-bold tracking-widest uppercase text-center mb-10" style={{ color: '#333' }}>
            Up and running in one day
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { num: '01', title: 'Sign up & configure', desc: 'Create your gym, upload your logo, set your colors, and configure your plans. Your subdomain is live in under 5 minutes.' },
              { num: '02', title: 'Add members & payments', desc: 'Import via CSV or let members self-register. Connect Orange Money or Tranzak — payments go live immediately.' },
              { num: '03', title: 'myfiti runs the rest', desc: 'Subscription reminders go out automatically. The kiosk handles check-ins. You watch the numbers on your dashboard.' },
            ].map((s, i) => (
              <div key={s.num} className="relative rounded-2xl p-8" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 -right-3 w-6 h-px" style={{ background: '#1a1a1a' }} />
                )}
                <span className="text-5xl font-black" style={{ color: '#1a1a1a' }}>{s.num}</span>
                <h3 className="text-base font-bold mt-4 mb-2" style={{ color: '#f0f0f0' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#555' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
