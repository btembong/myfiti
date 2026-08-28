'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft01Icon, Loading03Icon } from 'hugeicons-react'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) return setError('Enter a valid email address.')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
      setSent(true)
    } catch {
      setError('Network error. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 16, padding: 32 }}
      >
        {sent ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#111', border: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16 }}>✓</span>
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f0f0f0', margin: 0 }}>Check your inbox</h1>
              <p style={{ fontSize: 13, color: '#444', marginTop: 8, lineHeight: 1.5 }}>
                If an account exists for <span style={{ color: '#666' }}>{email}</span>, a reset link has been sent.
              </p>
            </div>
            <Link href="/login" style={{ fontSize: 13, color: '#555', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <ArrowLeft01Icon size={13} /> Back to login
            </Link>
          </motion.div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}
              style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f0f0f0', margin: 0, letterSpacing: '-0.01em' }}>Reset password</h1>
              <p style={{ fontSize: 13, color: '#454545', marginTop: 6 }}>Enter your email and we&apos;ll send a reset link.</p>
            </motion.div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                  Email
                </label>
                <input
                  type="email" value={email} autoFocus
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="you@gymname.com"
                  style={{ width: '100%', background: '#0d0d0d', border: '1px solid #242424', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#e8e8e8', outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = '#404040')}
                  onBlur={e => (e.target.style.borderColor = '#242424')}
                />
              </div>

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ borderLeft: '2px solid #7f1d1d', paddingLeft: 12, fontSize: 12, color: '#f87171' }}>
                  {error}
                </motion.div>
              )}

              <button type="submit" disabled={loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#f0f0f0', color: '#0a0a0a', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? <><Loading03Icon size={14} className="animate-spin" /> Sending…</> : 'Send reset link'}
              </button>

              <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3a3a3a', marginTop: 4, textAlign: 'center', justifyContent: 'center' }}>
                <ArrowLeft01Icon size={12} /> Back to login
              </Link>
            </form>
          </>
        )}
      </motion.div>
    </div>
  )
}
