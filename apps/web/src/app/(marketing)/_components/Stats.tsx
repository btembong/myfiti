import {
  Building01Icon,
  UserGroupIcon,
  Globe02Icon,
  CheckmarkCircle01Icon,
} from 'hugeicons-react'

const STATS = [
  { icon: Building01Icon,         value: '7+',    label: 'Gyms on platform',    sub: 'and growing' },
  { icon: UserGroupIcon,          value: '390+',  label: 'Members managed',     sub: 'across all tenants' },
  { icon: Globe02Icon,            value: '6',     label: 'Countries',            sub: 'CM · NG · GH · CI · KE · SN' },
  { icon: CheckmarkCircle01Icon,  value: '99.9%', label: 'Uptime SLA',          sub: 'all systems operational' },
]

export function Stats() {
  return (
    <section className="py-14" style={{ background: '#000', borderTop: '1px solid #111', borderBottom: '1px solid #111' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="rounded-2xl p-6"
                style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                <Icon size={18} color="#555" />
                <p className="text-3xl font-black mt-3 mb-0.5 leading-none" style={{ color: '#f0f0f0' }}>{s.value}</p>
                <p className="text-sm font-semibold" style={{ color: '#555' }}>{s.label}</p>
                <p className="text-xs mt-1" style={{ color: '#333' }}>{s.sub}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
