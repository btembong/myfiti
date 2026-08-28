'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building01Icon,
  QrCode01Icon,
  Analytics01Icon,
  WebhookIcon,
  ArrowRight01Icon,
  Shield01Icon,
  Dumbbell01Icon,
} from 'hugeicons-react'

const SOLUTIONS = [
  { icon: Dumbbell01Icon, title: 'Gym Admin',    desc: 'Members, check-ins, payments & classes',        href: '/dashboard' },
  { icon: Building01Icon, title: 'SuperAdmin',   desc: 'Multi-tenant platform overview & payouts',       href: '/superadmin' },
  { icon: QrCode01Icon,   title: 'Kiosk',        desc: 'Self-service check-in terminal',                 href: '/kiosk' },
  { icon: Analytics01Icon,title: 'Analytics',    desc: 'Revenue trends, member growth, retention',       href: '#' },
  { icon: WebhookIcon,    title: 'Integrations', desc: 'Webhooks, REST API, custom workflows',           href: '#' },
  { icon: Shield01Icon,   title: 'Security',     desc: 'Audit logs, RBAC, SOC 2-ready infra',           href: '#' },
]

export function Navbar() {
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setSolutionsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        className="relative w-full max-w-6xl"
      >
        <nav
          className="flex items-center justify-between gap-4 rounded-2xl px-5 py-3"
          style={{
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 1px 40px rgba(0,0,0,0.8)',
          }}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <Dumbbell01Icon size={16} color="#888" />
            </div>
            <span className="font-bold text-sm tracking-tight" style={{ color: '#f0f0f0' }}>myfiti</span>
            <span className="hidden sm:inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#555', border: '1px solid #222' }}>
              Enterprise
            </span>
          </Link>

          {/* Center links (desktop) */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setSolutionsOpen(v => !v)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ color: solutionsOpen ? '#f0f0f0' : '#555', background: solutionsOpen ? 'rgba(255,255,255,0.06)' : 'transparent' }}
            >
              Solutions
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"
                style={{ transition: 'transform 0.2s', transform: solutionsOpen ? 'rotate(180deg)' : 'none', opacity: 0.6 }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {['Pricing', 'Enterprise', 'Docs'].map(l => (
              <Link key={l} href={`#${l.toLowerCase()}`}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
                style={{ color: '#555' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f0f0f0' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}>
                {l}
              </Link>
            ))}
          </div>

          {/* CTAs (desktop) */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login"
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
              style={{ color: '#555' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f0f0f0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}>
              Sign in
            </Link>
            <Link href="/signup"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: '#f0f0f0', color: '#000' }}>
              Book a demo
              <ArrowRight01Icon size={14} />
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg transition-all"
            style={{ color: '#555' }}
            onClick={() => setMobileOpen(v => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              {mobileOpen
                ? <path fillRule="evenodd" clipRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                : <path fillRule="evenodd" clipRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
              }
            </svg>
          </button>
        </nav>

        {/* Solutions dropdown */}
        {solutionsOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl p-4"
            style={{
              background: 'rgba(5,5,5,0.97)',
              border: '1px solid rgba(255,255,255,0.07)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 px-1" style={{ color: '#333' }}>
              Platform solutions
            </p>
            <div className="grid grid-cols-3 gap-2">
              {SOLUTIONS.map(s => {
                const Icon = s.icon
                return (
                  <Link key={s.title} href={s.href} onClick={() => setSolutionsOpen(false)}
                    className="flex items-start gap-3 p-3 rounded-xl transition-all"
                    style={{ borderRadius: 12 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: '#1a1a1a' }}>
                      <Icon size={16} color="#555" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs" style={{ color: '#f0f0f0' }}>{s.title}</p>
                      <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: '#555' }}>{s.desc}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
            <div className="mt-3 pt-3 flex items-center justify-between px-1" style={{ borderTop: '1px solid #1a1a1a' }}>
              <p className="text-xs" style={{ color: '#333' }}>Trusted by gyms across West & East Africa</p>
              <Link href="/signup" onClick={() => setSolutionsOpen(false)}
                className="flex items-center gap-1 text-xs font-semibold transition-colors"
                style={{ color: '#888' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f0f0f0' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888' }}>
                Get started free <ArrowRight01Icon size={12} />
              </Link>
            </div>
          </motion.div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mt-2 rounded-2xl p-4"
            style={{ background: 'rgba(5,5,5,0.97)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)' }}
          >
            <div className="flex flex-col gap-1 mb-3">
              {['Solutions', 'Pricing', 'Enterprise', 'Docs'].map(l => (
                <Link key={l} href={`#${l.toLowerCase()}`} onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium"
                  style={{ color: '#555' }}>
                  {l}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
              <Link href="/login" onClick={() => setMobileOpen(false)}
                className="py-2.5 text-center rounded-xl text-sm font-medium"
                style={{ color: '#555', background: 'rgba(255,255,255,0.04)' }}>
                Sign in
              </Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)}
                className="py-2.5 text-center rounded-xl text-sm font-semibold"
                style={{ background: '#f0f0f0', color: '#000' }}>
                Book a demo
              </Link>
            </div>
          </motion.div>
        )}
      </motion.div>
    </header>
  )
}
