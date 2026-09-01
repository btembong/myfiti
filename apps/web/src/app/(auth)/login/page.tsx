'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { setToken, setTenantSlug, decodeToken } from '@/lib/auth'
import { ViewIcon, ViewOffIcon, Loading03Icon, LockIcon, Mail01Icon, ArrowRight01Icon } from 'hugeicons-react'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

const fade = (i: number) => ({
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: EASE } },
})

// Shared input style helpers
const inputBase: React.CSSProperties = {
  background: '#0d0d0d',
  border: '1px solid #242424',
  color: '#e8e8e8',
  borderRadius: 10,
  width: '100%',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 500,
  outline: 'none',
  transition: 'border-color 0.15s',
}

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [suspended, setSuspended] = useState<{ tenantName: string } | null>(null)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.includes('@')) return setError('Enter a valid email address.')
    if (!form.password) return setError('Enter your password.')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsVerification) {
          router.push(`/signup?verify=${encodeURIComponent(form.email)}`)
          return
        }
        if (data.suspended) {
          setSuspended({ tenantName: data.tenantName ?? 'your gym' })
          return
        }
        setError(data.error || 'Invalid email or password.')
        return
      }
      if (data.token) {
        setToken(data.token)
        const slug = data.tenantSlug ?? decodeToken(data.token)?.tenant_slug
        if (slug) setTenantSlug(slug as string)
      }
      router.push(data.onboardingComplete ? '/dashboard' : '/onboarding')
    } catch {
      setError('Network error. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  if (suspended) {
    return (
      <div className="w-full" style={{ maxWidth: 420 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          style={{ background: '#0a0a0a', border: '1px solid #2a1515', borderRadius: 16, padding: 32 }}
        >
          {/* Icon */}
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1a0a0a', border: '1px solid #3a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <LockIcon size={22} color="#ef4444" />
          </div>

          {/* Heading */}
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f0', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            Account Suspended
          </h2>
          <p style={{ fontSize: 13, color: '#555', margin: '0 0 20px', lineHeight: 1.6 }}>
            <strong style={{ color: '#888' }}>{suspended.tenantName}</strong> has been suspended on the myfiti platform.
            Access to your dashboard and member data is temporarily restricted.
          </p>

          {/* Reasons */}
          <div style={{ background: '#0f0f0f', border: '1px solid #1f1f1f', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
              Common reasons
            </p>
            {[
              'Outstanding subscription payment not received',
              'Subscription plan expired with no renewal',
              'Violation of myfiti Terms of Service',
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: i < 2 ? 8 : 0 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#3a3a3a', marginTop: 5, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>

          {/* Next steps */}
          <p style={{ fontSize: 12, fontWeight: 600, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            What to do next
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {[
              { step: '1', text: 'Contact myfiti billing support to understand the reason for suspension.' },
              { step: '2', text: 'Settle any outstanding balance or clarify the issue with our team.' },
              { step: '3', text: 'Once resolved, your account will be reactivated within 24 hours.' },
            ].map(({ step, text }) => (
              <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: '#141414', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#555' }}>{step}</span>
                </div>
                <span style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a
              href={`mailto:billing@myfiti.fit?subject=Account%20Suspension%20-%20${encodeURIComponent(suspended.tenantName)}&body=Hello%20myfiti%20team%2C%0A%0AMy%20gym%20account%20(${encodeURIComponent(suspended.tenantName)})%20has%20been%20suspended.%20I%20would%20like%20to%20resolve%20this%20issue.%0A%0AEmail%3A%20${encodeURIComponent(form.email)}%0A%0APlease%20advise%20on%20the%20next%20steps.%0A%0AThank%20you.`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#f0f0f0', color: '#0a0a0a', textDecoration: 'none', boxSizing: 'border-box' }}
            >
              <Mail01Icon size={15} /> Email Support
              <ArrowRight01Icon size={14} />
            </a>
            <button
              onClick={() => setSuspended(null)}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 500, background: 'none', border: '1px solid #1f1f1f', color: '#444', cursor: 'pointer' }}
            >
              Back to sign in
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="w-full" style={{ maxWidth: 400 }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        style={{
          background: '#0a0a0a',
          border: '1px solid #1a1a1a',
          borderRadius: 16,
          padding: 32,
        }}
      >
        {/* Header */}
        <motion.div variants={fade(0)} initial="hidden" animate="show" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f0f0f0', margin: 0, letterSpacing: '-0.01em' }}>
            Sign in
          </h1>
          <p style={{ fontSize: 13, color: '#454545', marginTop: 6 }}>
            myfiti dashboard
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Email */}
          <motion.div variants={fade(1)} initial="hidden" animate="show">
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
              Email
            </label>
            <input
              type="email" autoComplete="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="you@gymname.com"
              style={inputBase}
              onFocus={e => (e.target.style.borderColor = '#404040')}
              onBlur={e => (e.target.style.borderColor = '#242424')}
            />
          </motion.div>

          {/* Password */}
          <motion.div variants={fade(2)} initial="hidden" animate="show">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password
              </label>
              <Link href="/forgot-password" style={{ fontSize: 12, color: '#3a3a3a' }}>
                Forgot?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} autoComplete="current-password"
                value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="Your password"
                style={{ ...inputBase, paddingRight: 38 }}
                onFocus={e => (e.target.style.borderColor = '#404040')}
                onBlur={e => (e.target.style.borderColor = '#242424')}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#3a3a3a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPw ? <ViewOffIcon size={15} /> : <ViewIcon size={15} />}
              </button>
            </div>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              style={{ borderLeft: '2px solid #7f1d1d', paddingLeft: 12, fontSize: 12, color: '#f87171', paddingTop: 2, paddingBottom: 2 }}>
              {error}
            </motion.div>
          )}

          {/* Submit */}
          <motion.div variants={fade(3)} initial="hidden" animate="show">
            <button type="submit" disabled={loading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: '#f0f0f0', color: '#0a0a0a', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
              }}>
              {loading
                ? <><Loading03Icon size={14} className="animate-spin" /> Signing in…</>
                : 'Sign in'}
            </button>
          </motion.div>
        </form>
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
        style={{ textAlign: 'center', fontSize: 13, color: '#333', marginTop: 20 }}>
        No account?{' '}
        <Link href="/signup" style={{ color: '#888', fontWeight: 500 }}>Get started free</Link>
      </motion.p>
    </div>
  )
}
