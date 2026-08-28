'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ViewIcon, ViewOffIcon, Loading03Icon } from 'hugeicons-react'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) setError('Invalid or missing reset token.')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to reset password.'); return }
      setDone(true)
      setTimeout(() => router.replace('/login'), 3000)
    } catch {
      setError('Network error. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d0d0d', border: '1px solid #242424',
    borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500,
    color: '#e8e8e8', outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 16, padding: 32 }}
      >
        {done ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#111', border: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16 }}>✓</span>
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f0f0f0', margin: 0 }}>Password updated</h1>
              <p style={{ fontSize: 13, color: '#444', marginTop: 8 }}>Redirecting you to login…</p>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }} style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f0f0f0', margin: 0, letterSpacing: '-0.01em' }}>Set new password</h1>
              <p style={{ fontSize: 13, color: '#454545', marginTop: 6 }}>Choose a strong password for your account.</p>
            </motion.div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                  New password
                </label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} autoFocus
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="Min. 8 characters"
                    style={{ ...inputStyle, paddingRight: 38 }}
                    onFocus={e => (e.target.style.borderColor = '#404040')}
                    onBlur={e => (e.target.style.borderColor = '#242424')}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#3a3a3a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {showPw ? <ViewOffIcon size={15} /> : <ViewIcon size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                  Confirm password
                </label>
                <input type={showPw ? 'text' : 'password'} value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  placeholder="Repeat password"
                  style={inputStyle}
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

              <button type="submit" disabled={loading || !token}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#f0f0f0', color: '#0a0a0a', border: 'none', cursor: (loading || !token) ? 'not-allowed' : 'pointer', opacity: (loading || !token) ? 0.6 : 1 }}>
                {loading ? <><Loading03Icon size={14} className="animate-spin" /> Updating…</> : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
