import Link from 'next/link'
import { Dumbbell01Icon } from 'hugeicons-react'

const PERKS = [
  '14-day free trial — no credit card required',
  'Enterprise RBAC with per-role audit logging',
  'XAF-native payments across 6 African markets',
  'Gym Admin, SuperAdmin, and Kiosk in one platform',
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: '#000' }}>

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[40%] flex-col justify-between p-12"
        style={{ borderRight: '1px solid #1a1a1a' }}>

        <div>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-16">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#fff' }}>
              <Dumbbell01Icon size={16} color="#000" />
            </div>
            <span className="font-semibold text-sm tracking-tight" style={{ color: '#f0f0f0' }}>myfiti</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: '#111', color: '#444', border: '1px solid #1e1e1e' }}>
              Enterprise
            </span>
          </Link>

          {/* Headline */}
          <h2 className="text-[2rem] font-semibold leading-[1.2] mb-4 tracking-tight" style={{ color: '#f0f0f0' }}>
            The operating system<br />for African gyms.
          </h2>
          <p className="text-sm leading-relaxed mb-12" style={{ color: '#4a4a4a', maxWidth: 320 }}>
            Three integrated portals powering the full member lifecycle — from check-in to payout reconciliation.
          </p>

          {/* Perks */}
          <ul className="space-y-4">
            {PERKS.map(p => (
              <li key={p} className="flex items-start gap-3">
                <div className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: '#3a3a3a' }} />
                <span className="text-sm leading-relaxed" style={{ color: '#4a4a4a' }}>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            {['🇨🇲','🇳🇬','🇬🇭','🇨🇮','🇰🇪','🇸🇳'].map(f => (
              <span key={f} style={{ opacity: 0.45, fontSize: 16 }}>{f}</span>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#282828' }}>
            Trusted by gyms across West &amp; East Africa
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col" style={{ background: '#000' }}>
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #141414' }}>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#fff' }}>
              <Dumbbell01Icon size={14} color="#000" />
            </div>
            <span className="font-semibold text-sm" style={{ color: '#f0f0f0' }}>myfiti</span>
          </Link>
          <Link href="/" className="text-xs" style={{ color: '#3a3a3a' }}>← Back to home</Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          {children}
        </main>

        <footer className="px-6 py-4 text-center">
          <p className="text-xs" style={{ color: '#252525' }}>
            © {new Date().getFullYear()} myfiti ·{' '}
            <Link href="/privacy" className="hover:underline" style={{ color: '#303030' }}>Privacy</Link>
            {' · '}
            <Link href="/terms" className="hover:underline" style={{ color: '#303030' }}>Terms</Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
