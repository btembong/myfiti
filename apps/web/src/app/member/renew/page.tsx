'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const C = {
  bg: '#000000', card: '#0a0a0a', border: '#1a1a1a', surface: '#0d0d0d',
  pri: '#f0f0f0', sec: '#888888', mut: '#444444',
  ok: '#4ade80', err: '#f87171', warn: '#fbbf24',
  btnBg: '#f0f0f0', btnText: '#0a0a0a',
}

interface GymInfo { id: string; name: string; slug: string; logo_url: string | null; primary_color: string; currency: string }
interface Plan { id: string; name: string; description: string | null; price: number; currency: string; duration_days: number; cycle: string }
interface MemberInfo { id: string; name: string; email: string; status: string }
interface SubInfo { id: string; status: string; expires_at: string; plan_name: string }

type Step = 'identify' | 'select-plan' | 'select-payment' | 'processing' | 'success' | 'cash-pending'

export default function MemberRenewPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
      <MemberRenewContent />
    </Suspense>
  )
}

function MemberRenewContent() {
  const searchParams = useSearchParams()
  const gymSlug  = searchParams.get('gym') ?? ''
  const midParam = searchParams.get('mid') ?? ''
  const paymentResult = searchParams.get('payment')

  const [gym, setGym]           = useState<GymInfo | null>(null)
  const [plans, setPlans]       = useState<Plan[]>([])
  const [member, setMember]     = useState<MemberInfo | null>(null)
  const [sub, setSub]           = useState<SubInfo | null>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const [loadingGym, setLoadingGym] = useState(true)
  const [gymError, setGymError] = useState<string | null>(null)

  const [step, setStep]                 = useState<Step>('identify')
  const [email, setEmail]               = useState('')
  const [emailError, setEmailError]     = useState<string | null>(null)
  const [lookingUp, setLookingUp]       = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'mobile_money' | 'cash' | null>(null)
  const [processing, setProcessing]     = useState(false)
  const [result, setResult]             = useState<{ expires_at?: string; reference?: string; amount?: number; currency?: string; plan_name?: string; payment_url?: string } | null>(null)
  const [renewError, setRenewError]     = useState<string | null>(null)

  // Load gym + plans
  useEffect(() => {
    if (!gymSlug) { setGymError('No gym specified.'); setLoadingGym(false); return }
    Promise.all([
      fetch(`/api/public/gym/${gymSlug}`).then(r => r.json()),
      fetch(`/api/public/gym/${gymSlug}/plans`).then(r => r.json()),
    ]).then(([gymData, plansData]) => {
      if (gymData.gym) setGym(gymData.gym)
      else setGymError(gymData.error ?? 'Gym not found.')
      if (plansData.plans) setPlans(plansData.plans)
    }).catch(() => setGymError('Failed to load gym info.'))
      .finally(() => setLoadingGym(false))
  }, [gymSlug])

  // Auto-lookup if mid param present in URL (coming from email link)
  useEffect(() => {
    if (!midParam || !gymSlug) return
    lookupMember(undefined, midParam)
  }, [midParam, gymSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Tranzak redirect back
  useEffect(() => {
    if (paymentResult === 'success' && midParam && gymSlug) {
      setStep('success')
      setResult({ expires_at: new Date(Date.now() + 30 * 86400000).toISOString() })
    }
  }, [paymentResult, midParam, gymSlug])

  async function lookupMember(emailInput?: string, mid?: string) {
    setLookingUp(true)
    setEmailError(null)
    try {
      const qs = mid ? `mid=${mid}` : `email=${encodeURIComponent(emailInput!.trim())}`
      const res = await fetch(`/api/public/gym/${gymSlug}/member?${qs}`)
      const data = await res.json()
      if (!res.ok) { setEmailError(data.error ?? 'Member not found.'); return }
      setMember(data.member)
      setSub(data.subscription)
      setWalletBalance(data.wallet_balance ?? 0)
      setStep('select-plan')
    } catch {
      setEmailError('Failed to look up membership.')
    } finally {
      setLookingUp(false)
    }
  }

  async function handleRenew() {
    if (!member || !selectedPlan || !paymentMethod) return
    setProcessing(true)
    setRenewError(null)
    try {
      const res = await fetch(`/api/public/gym/${gymSlug}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id, plan_id: selectedPlan.id, payment_method: paymentMethod }),
      })
      const data = await res.json()
      if (!res.ok) { setRenewError(data.error ?? 'Renewal failed.'); setProcessing(false); return }

      if (paymentMethod === 'mobile_money' && data.payment_url) {
        window.location.href = data.payment_url
        return
      }
      if (paymentMethod === 'cash') {
        setResult(data)
        setStep('cash-pending')
      } else {
        setResult(data)
        setStep('success')
      }
    } catch {
      setRenewError('Renewal failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const fmt = (amount: number, currency = 'XAF') =>
    `${currency} ${amount.toLocaleString('fr-CM')}`

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  if (loadingGym) return (
    <Shell>
      <Card><p style={{ margin: 0, fontSize: 13, color: C.mut, textAlign: 'center' }}>Loading…</p></Card>
    </Shell>
  )

  if (gymError) return (
    <Shell>
      <Card><p style={{ margin: 0, fontSize: 15, color: C.err, textAlign: 'center' }}>{gymError}</p></Card>
    </Shell>
  )

  return (
    <Shell gym={gym}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* ── Deep link banner ─────────────────────────────────────── */}
        <div style={{
          background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10,
          padding: '10px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: C.sec }}>Have the myfiti app?</span>
          <a
            href={`gymflow://member/renew?gym=${gymSlug}${midParam ? `&mid=${midParam}` : ''}`}
            style={{
              fontSize: 11, fontWeight: 700, color: C.ok,
              textDecoration: 'none', letterSpacing: '0.02em',
            }}
          >
            Open in App →
          </a>
        </div>

        {/* ── Step: Identify ───────────────────────────────────────── */}
        {step === 'identify' && (
          <Card title="Renew membership" subtitle={gym?.name}>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: C.sec, lineHeight: 1.6 }}>
              Enter the email address associated with your membership.
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupMember(email)}
              placeholder="your@email.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#111', border: `1px solid ${emailError ? C.err : '#2a2a2a'}`,
                borderRadius: 8, padding: '10px 14px', color: C.pri,
                fontSize: 14, outline: 'none', marginBottom: 8,
              }}
            />
            {emailError && <p style={{ margin: '0 0 12px', fontSize: 12, color: C.err }}>{emailError}</p>}
            <Btn onClick={() => lookupMember(email)} disabled={!email.trim() || lookingUp} loading={lookingUp}>
              Find my membership
            </Btn>
          </Card>
        )}

        {/* ── Step: Select Plan ────────────────────────────────────── */}
        {step === 'select-plan' && member && (
          <Card title="Select a plan" subtitle={`Hi, ${member.name}`}>
            {sub && (
              <div style={{
                background: '#111', border: '1px solid #222', borderRadius: 8,
                padding: '10px 14px', marginBottom: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: C.sec }}>Current: {sub.plan_name}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: sub.status === 'active' ? C.ok : sub.status === 'grace_period' ? C.warn : C.err,
                }}>
                  {sub.status === 'active' ? `Expires ${fmtDate(sub.expires_at)}`
                    : sub.status === 'grace_period' ? 'Grace period'
                    : 'Expired'}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {plans.map(plan => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  style={{
                    background: selectedPlan?.id === plan.id ? '#0f1f0f' : '#111',
                    border: `1px solid ${selectedPlan?.id === plan.id ? C.ok : '#222'}`,
                    borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.pri }}>{plan.name}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.pri }}>
                      {fmt(plan.price, plan.currency)}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: C.mut }}>{plan.duration_days} days · {plan.cycle}</span>
                  {plan.description && <p style={{ margin: '6px 0 0', fontSize: 12, color: C.sec, lineHeight: 1.5 }}>{plan.description}</p>}
                </div>
              ))}
            </div>
            <Btn onClick={() => setStep('select-payment')} disabled={!selectedPlan}>
              Continue →
            </Btn>
          </Card>
        )}

        {/* ── Step: Select Payment ─────────────────────────────────── */}
        {step === 'select-payment' && member && selectedPlan && (
          <Card title="How would you like to pay?" subtitle={`${selectedPlan.name} · ${fmt(selectedPlan.price, selectedPlan.currency)}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>

              {/* Wallet */}
              <PayOption
                selected={paymentMethod === 'wallet'}
                onClick={() => setPaymentMethod('wallet')}
                title="Wallet"
                subtitle={`Balance: ${fmt(walletBalance, gym?.currency)}`}
                badge={walletBalance >= selectedPlan.price ? 'Sufficient' : 'Insufficient'}
                badgeOk={walletBalance >= selectedPlan.price}
                disabled={walletBalance < selectedPlan.price}
              />

              {/* Mobile Money */}
              <PayOption
                selected={paymentMethod === 'mobile_money'}
                onClick={() => setPaymentMethod('mobile_money')}
                title="Mobile Money"
                subtitle="MTN / Orange — instant activation"
              />

              {/* Cash */}
              <PayOption
                selected={paymentMethod === 'cash'}
                onClick={() => setPaymentMethod('cash')}
                title="Pay at Gym"
                subtitle="Bring reference code — admin confirms"
              />
            </div>

            {renewError && <p style={{ margin: '0 0 12px', fontSize: 12, color: C.err }}>{renewError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep('select-plan')}
                style={{
                  flex: 1, padding: '11px 0', background: 'transparent',
                  border: '1px solid #2a2a2a', borderRadius: 8,
                  color: C.sec, fontSize: 13, cursor: 'pointer',
                }}
              >
                Back
              </button>
              <Btn onClick={handleRenew} disabled={!paymentMethod || processing} loading={processing} style={{ flex: 2 }}>
                {paymentMethod === 'cash' ? 'Get reference code'
                  : paymentMethod === 'mobile_money' ? 'Pay with Mobile Money'
                  : 'Pay with Wallet'}
              </Btn>
            </div>
          </Card>
        )}

        {/* ── Step: Success ─────────────────────────────────────────── */}
        {step === 'success' && (
          <Card>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
              <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: C.ok }}>Membership renewed!</p>
              {result?.expires_at && (
                <p style={{ margin: '0 0 20px', fontSize: 13, color: C.sec }}>
                  Valid until {fmtDate(result.expires_at)}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 12, color: C.mut, lineHeight: 1.6 }}>
                Open the myfiti app to access your membership QR code.
              </p>
            </div>
          </Card>
        )}

        {/* ── Step: Cash Pending ───────────────────────────────────── */}
        {step === 'cash-pending' && result && (
          <Card title="Visit the gym to pay">
            <div style={{
              background: '#111', border: '1px solid #2a2a2a', borderRadius: 10,
              padding: '20px', textAlign: 'center', marginBottom: 16,
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: C.mut, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Reference code</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: C.pri, letterSpacing: '0.08em', fontFamily: 'monospace' }}>
                {result.reference}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <Row label="Plan" value={result.plan_name ?? selectedPlan?.name ?? ''} />
              <Row label="Amount due" value={fmt(result.amount ?? 0, result.currency)} />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: C.mut, lineHeight: 1.6 }}>
              Show this code at {gym?.name}. Your membership activates once the gym confirms your payment.
            </p>
          </Card>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', margin: '20px 0 0', fontSize: 11, color: C.mut }}>
          &copy; {new Date().getFullYear()} myfiti &middot;{' '}
          <a href="https://app.myfiti.fit" style={{ color: C.mut, textDecoration: 'none' }}>app.myfiti.fit</a>
        </p>
      </div>
    </Shell>
  )
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function Shell({ children, gym }: { children: React.ReactNode; gym?: GymInfo | null }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '44px 20px 60px',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 32 }}>
        <div style={{
          width: 22, height: 22, background: '#fff', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#000', letterSpacing: '-0.03em' }}>m</span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.pri, letterSpacing: '-0.02em' }}>myfiti</span>
        {gym?.name && (
          <span style={{
            fontSize: 10, fontWeight: 500, color: C.mut, background: '#111',
            border: '1px solid #1e1e1e', padding: '2px 8px', borderRadius: 4,
          }}>{gym.name}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Card({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  return (
    <div style={{
      width: '100%', maxWidth: 480,
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden',
      padding: '28px 28px',
    }}>
      {title && <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: C.pri, letterSpacing: '-0.02em' }}>{title}</p>}
      {subtitle && <p style={{ margin: '0 0 20px', fontSize: 13, color: C.sec }}>{subtitle}</p>}
      {children}
    </div>
  )
}

function Btn({ children, onClick, disabled, loading, style }: {
  children: React.ReactNode; onClick?: () => void
  disabled?: boolean; loading?: boolean; style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%', padding: '11px 0',
        background: disabled || loading ? '#1a1a1a' : C.btnBg,
        color: disabled || loading ? C.mut : C.btnText,
        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        letterSpacing: '0.01em', ...style,
      }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

function PayOption({ selected, onClick, title, subtitle, badge, badgeOk, disabled }: {
  selected: boolean; onClick: () => void; title: string; subtitle: string
  badge?: string; badgeOk?: boolean; disabled?: boolean
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        background: selected ? '#0a1a0a' : '#111',
        border: `1px solid ${selected ? C.ok : '#222'}`,
        borderRadius: 10, padding: '14px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <div>
        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: C.pri }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12, color: C.sec }}>{subtitle}</p>
      </div>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          background: badgeOk ? '#0f2a0f' : '#2a0f0f',
          color: badgeOk ? C.ok : C.err,
        }}>{badge}</span>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: C.sec }}>{label}</span>
      <span style={{ color: C.pri, fontWeight: 600 }}>{value}</span>
    </div>
  )
}
