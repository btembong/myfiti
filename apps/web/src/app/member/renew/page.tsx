'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const C = {
  bg: '#000000', card: '#0a0a0a', border: '#1a1a1a', surface: '#0d0d0d',
  pri: '#f0f0f0', sec: '#888888', mut: '#444444',
  ok: '#4ade80', err: '#f87171',
  btnBg: '#f0f0f0', btnText: '#0a0a0a',
}

interface GymInfo {
  id: string; name: string; slug: string
  logo_url: string | null; primary_color: string; currency: string
}

interface Plan {
  id: string; name: string; description: string | null
  price: number; currency: string; duration_days: number; cycle: string
  features: unknown
}

export default function MemberRenewPage() {
  const searchParams = useSearchParams()
  const gymSlug = searchParams.get('gym')

  const [gym, setGym]       = useState<GymInfo | null>(null)
  const [plans, setPlans]   = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!gymSlug) { setError('No gym specified.'); setLoading(false); return }

    Promise.all([
      fetch(`${API_URL}/api/public/gym/${gymSlug}`).then(r => r.json()),
      fetch(`${API_URL}/api/public/gym/${gymSlug}/plans`).then(r => r.json()),
    ]).then(([gymData, plansData]) => {
      if (gymData.gym) setGym(gymData.gym)
      else setError(gymData.error ?? 'Gym not found.')
      if (plansData.plans) setPlans(plansData.plans)
    }).catch(() => setError('Failed to load gym info.'))
      .finally(() => setLoading(false))
  }, [gymSlug])

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '44px 20px 60px',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 32 }}>
        <div style={{
          width: 22, height: 22, background: '#fff', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#000', letterSpacing: '-0.03em' }}>m</span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.pri, letterSpacing: '-0.02em' }}>myfiti</span>
        <span style={{
          fontSize: 10, fontWeight: 500, color: C.mut, background: '#111',
          border: '1px solid #1e1e1e', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.02em',
        }}>Membership</span>
      </div>

      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Loading */}
        {loading && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '48px 32px', textAlign: 'center',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: C.mut }}>Loading…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '40px 32px', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: C.err }}>Something went wrong</p>
            <p style={{ margin: 0, fontSize: 13, color: C.mut }}>{error}</p>
          </div>
        )}

        {/* Main */}
        {!loading && !error && gym && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '32px 32px 0' }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 500, color: C.mut, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Renew membership
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.pri, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {gym.name}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: C.sec, lineHeight: 1.6 }}>
                Your membership has expired or is expiring soon. Select a plan below to renew your access.
              </p>
            </div>

            {/* Plans */}
            <div style={{ padding: '24px 32px' }}>
              {plans.length === 0 ? (
                <div style={{
                  background: C.surface, border: '1px solid #242424', borderRadius: 10,
                  padding: '24px 18px', textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: C.mut }}>No membership plans available. Contact your gym directly.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {plans.map(plan => (
                    <div key={plan.id} style={{
                      background: C.surface, border: `1px solid #242424`, borderRadius: 12,
                      padding: '18px 20px', cursor: 'default',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.pri }}>{plan.name}</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: C.pri, letterSpacing: '-0.02em' }}>
                          {plan.currency} {plan.price.toLocaleString('fr-CM')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: C.mut }}>
                          {plan.duration_days} days &middot; {plan.cycle}
                        </span>
                      </div>
                      {plan.description && (
                        <p style={{ margin: '8px 0 0', fontSize: 12, color: C.sec, lineHeight: 1.5 }}>
                          {plan.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info callout */}
            <div style={{ padding: '0 32px 24px' }}>
              <div style={{
                background: C.surface, border: '1px solid #242424', borderRadius: 10, padding: '14px 18px',
              }}>
                <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 500, color: C.sec }}>How to renew</p>
                <p style={{ margin: 0, fontSize: 12, color: C.mut, lineHeight: 1.6 }}>
                  Visit {gym.name} in person or contact them to complete your renewal and payment.
                  Show them this page as reference.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 32px' }}>
              <p style={{ margin: 0, fontSize: 11, color: C.mut }}>
                &copy; {new Date().getFullYear()} myfiti &middot;{' '}
                <a href="https://myfiti.app" style={{ color: C.mut, textDecoration: 'none' }}>myfiti.app</a>
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
