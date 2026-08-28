'use client'

import Link from 'next/link'
import { ArrowRight01Icon, Dumbbell01Icon, Building01Icon, QrCode01Icon } from 'hugeicons-react'

export function FinalCTA() {
  return (
    <section className="py-24 px-6" style={{ background: '#000' }}>
      <div className="max-w-4xl mx-auto">
        <div className="rounded-3xl p-12 text-center relative overflow-hidden"
          style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>

          <div className="relative z-10">
            <div className="flex items-center justify-center gap-4 mb-8">
              {[
                { Icon: Dumbbell01Icon, label: 'Gym Admin' },
                { Icon: Building01Icon, label: 'SuperAdmin' },
                { Icon: QrCode01Icon,   label: 'Kiosk' },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                    <Icon size={22} color="#555" />
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: '#555' }}>{label}</span>
                </div>
              ))}
            </div>

            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#333' }}>Get started</p>
            <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6" style={{ color: '#f0f0f0' }}>
              The enterprise platform<br />your gym deserves
            </h2>
            <p className="text-lg font-medium mb-10 max-w-xl mx-auto" style={{ color: '#555' }}>
              Join gyms across Cameroon, Nigeria, Kenya, Ghana, Senegal, and Côte d&apos;Ivoire running on myfiti. 14-day free trial — no card needed.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup"
                className="inline-flex items-center justify-center gap-2 text-sm font-bold px-8 py-4 rounded-xl transition-all hover:opacity-90"
                style={{ background: '#f0f0f0', color: '#000' }}>
                Start your 14-day free trial
                <ArrowRight01Icon size={15} />
              </Link>
              <Link href="mailto:hello@myfiti.app"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-8 py-4 rounded-xl transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#888' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                Talk to our team
              </Link>
            </div>

            <p className="text-xs mt-6" style={{ color: '#333' }}>
              Setup in 5 minutes · XAF-native payments · Orange Money & MTN MoMo ready
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
