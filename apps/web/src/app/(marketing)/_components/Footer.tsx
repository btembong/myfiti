'use client'

import Link from 'next/link'
import { Dumbbell01Icon } from 'hugeicons-react'

const LINKS = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Changelog', href: '#' },
    { label: 'Roadmap', href: '#' },
    { label: 'Status page', href: '#' },
  ],
  Portals: [
    { label: 'Gym Admin', href: '/dashboard' },
    { label: 'SuperAdmin', href: '/superadmin' },
    { label: 'Kiosk terminal', href: '/kiosk' },
    { label: 'API docs', href: '#' },
    { label: 'Webhooks', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  Legal: [
    { label: 'Privacy policy', href: '#' },
    { label: 'Terms of service', href: '#' },
    { label: 'NDPR compliance', href: '#' },
    { label: 'GDPR', href: '#' },
  ],
}

const COUNTRIES = [
  { flag: '🇨🇲', name: 'CM' },
  { flag: '🇳🇬', name: 'NG' },
  { flag: '🇬🇭', name: 'GH' },
  { flag: '🇨🇮', name: 'CI' },
  { flag: '🇰🇪', name: 'KE' },
  { flag: '🇸🇳', name: 'SN' },
]

export function Footer() {
  return (
    <footer className="px-6 py-16" style={{ background: '#000', borderTop: '1px solid #111' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <Dumbbell01Icon size={16} color="#888" />
              </div>
              <span className="font-bold text-sm tracking-tight" style={{ color: '#f0f0f0' }}>myfiti</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#555', border: '1px solid #222' }}>
                Enterprise
              </span>
            </Link>
            <p className="text-sm leading-relaxed mb-5" style={{ color: '#333' }}>
              The enterprise gym management platform built for Africa. Three portals, one platform.
            </p>

            <div className="flex gap-2 flex-wrap">
              {COUNTRIES.map(c => (
                <span key={c.name} title={c.name} className="text-lg cursor-default" style={{ filter: 'saturate(0.7) brightness(0.8)' }}>
                  {c.flag}
                </span>
              ))}
            </div>
          </div>

          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: '#333' }}>{group}</p>
              <ul className="space-y-2.5">
                {items.map(item => (
                  <li key={item.label}>
                    <Link href={item.href}
                      className="text-sm font-medium transition-colors"
                      style={{ color: '#555' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#888' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#555' }}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid #111' }}>
          <p className="text-xs font-medium" style={{ color: '#333' }}>
            © {new Date().getFullYear()} myfiti. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-xs" style={{ color: '#333' }}>
              Payments via <span style={{ color: '#555' }}>Tranzak</span>
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#4a7a5a' }} />
              <span className="text-xs" style={{ color: '#333' }}>All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
