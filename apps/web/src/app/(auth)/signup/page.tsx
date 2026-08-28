'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  EyeIcon as Eye, ViewOffSlashIcon as EyeOff,
  ArrowRight01Icon as ArrowRight, ArrowLeft01Icon as ArrowLeft,
  Tick01Icon as Check, ArrowDown01Icon as ChevronDown,
  GiftIcon as Gift,
  Mail01Icon as Mail,
  Loading03Icon as Loader2, UserCircleIcon as UserRound,
  Key01Icon as KeyRound, MailOpenIcon as MailCheck,
} from 'hugeicons-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: 'CM', name: 'Cameroon',      dialCode: '+237', placeholder: '6XX XXX XXX',   pattern: /^[267]\d{8}$/, hint: '9 digits starting with 6, 7 or 2' },
  { code: 'NG', name: 'Nigeria',       dialCode: '+234', placeholder: '7XX XXX XXXX',  pattern: /^[789]\d{9}$/, hint: '10 digits starting with 7, 8 or 9' },
  { code: 'GH', name: 'Ghana',         dialCode: '+233', placeholder: '2X XXX XXXX',   pattern: /^[235]\d{8}$/, hint: '9 digits starting with 2, 3 or 5' },
  { code: 'KE', name: 'Kenya',         dialCode: '+254', placeholder: '7XX XXX XXX',   pattern: /^[71]\d{8}$/,  hint: '9 digits starting with 7 or 1' },
  { code: 'ZA', name: 'South Africa',  dialCode: '+27',  placeholder: '6X XXX XXXX',   pattern: /^[678]\d{8}$/, hint: '9 digits starting with 6, 7 or 8' },
  { code: 'EG', name: 'Egypt',         dialCode: '+20',  placeholder: '1XX XXX XXXX',  pattern: /^1\d{9}$/,     hint: '10 digits starting with 1' },
  { code: 'SN', name: 'Senegal',       dialCode: '+221', placeholder: '7X XXX XXXX',   pattern: /^7\d{8}$/,     hint: '9 digits starting with 7' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225', placeholder: 'XX XX XX XXXX', pattern: /^\d{10}$/,     hint: '10 digits' },
  { code: 'TZ', name: 'Tanzania',      dialCode: '+255', placeholder: '7XX XXX XXX',   pattern: /^[67]\d{8}$/,  hint: '9 digits starting with 6 or 7' },
  { code: 'UG', name: 'Uganda',        dialCode: '+256', placeholder: '7XX XXX XXX',   pattern: /^[347]\d{8}$/, hint: '9 digits starting with 3, 4 or 7' },
  { code: 'ET', name: 'Ethiopia',      dialCode: '+251', placeholder: '9X XXX XXXX',   pattern: /^[97]\d{8}$/,  hint: '9 digits starting with 9 or 7' },
  { code: 'RW', name: 'Rwanda',        dialCode: '+250', placeholder: '7XX XXX XXX',   pattern: /^7\d{8}$/,     hint: '9 digits starting with 7' },
  { code: 'MA', name: 'Morocco',       dialCode: '+212', placeholder: '6XX XXX XXX',   pattern: /^[567]\d{8}$/, hint: '9 digits starting with 5, 6 or 7' },
  { code: 'TN', name: 'Tunisia',       dialCode: '+216', placeholder: '2X XXX XXX',    pattern: /^[24579]\d{7}$/, hint: '8 digits starting with 2, 4, 5, 7 or 9' },
  { code: 'Other', name: 'Other',      dialCode: '+',    placeholder: 'XXX XXX XXXX',  pattern: /^\d{5,15}$/,   hint: '5–15 digits' },
]

const STEPS = [
  { label: 'Account',  icon: UserRound },
  { label: 'Security', icon: KeyRound },
  { label: 'Verify',   icon: MailCheck },
]

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

function extractLocal(phone: string, dialCode: string): string {
  const stripped = phone.startsWith(dialCode) ? phone.slice(dialCode.length) : phone
  return stripped.replace(/\s+/g, '')
}

function validatePhone(phone: string, countryCode: string): { valid: boolean; hint: string } {
  const country = COUNTRIES.find(c => c.code === countryCode)
  if (!country) return { valid: false, hint: 'Select a country first.' }
  const local = extractLocal(phone, country.dialCode)
  if (!local) return { valid: false, hint: country.hint }
  return { valid: country.pattern.test(local), hint: country.hint }
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const T = {
  bg: '#0a0a0a',
  surface: '#0d0d0d',
  border: '#1e1e1e',
  borderSubtle: '#161616',
  inputBg: '#0d0d0d',
  inputBorder: '#242424',
  inputFocus: '#404040',
  textPrimary: '#f0f0f0',
  textSecondary: '#888',
  textMuted: '#444',
  textDim: '#2a2a2a',
  btnPrimary: '#f0f0f0',
  btnPrimaryText: '#0a0a0a',
  btnSecondary: '#141414',
  btnSecondaryBorder: '#242424',
  btnSecondaryText: '#666',
  errorText: '#f87171',
  successText: '#6ee7b7',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 500,
  color: T.textPrimary,
  outline: 'none',
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: T.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 7,
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 36 : -36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -36 : 36, opacity: 0 }),
}

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.28, ease: EASE } }),
}

const shakeVariants = {
  shake: { x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.4, ease: 'easeInOut' as const } },
  rest: { x: 0 },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ]
  if (!password) return null
  const score = checks.filter(c => c.ok).length
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      style={{ marginTop: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            flex: 1, height: 2, borderRadius: 2,
            background: i < score ? '#f0f0f0' : '#1e1e1e',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {checks.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.ok ? '#f0f0f0' : '#1e1e1e', transition: 'background 0.2s' }}>
              {c.ok && <Check size={7} color="#0a0a0a" />}
            </div>
            <span style={{ fontSize: 11, color: c.ok ? '#888' : '#333' }}>{c.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function PinDots({ value, mismatch }: { value: string; mismatch?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      {[0, 1, 2, 3].map(i => (
        <motion.div key={i}
          animate={{ scale: i === value.length - 1 && value.length > 0 ? [1, 1.3, 1] : 1 }}
          transition={{ duration: 0.15 }}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i < value.length ? (mismatch ? '#ef4444' : '#f0f0f0') : '#1e1e1e',
            transition: 'background 0.15s',
          }} />
      ))}
    </div>
  )
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }} onClick={onChange}>
      <div style={{
        marginTop: 2, width: 14, height: 14, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: checked ? '#f0f0f0' : 'transparent',
        border: `1px solid ${checked ? '#f0f0f0' : '#2a2a2a'}`,
        transition: 'all 0.15s',
      }}>
        {checked && <Check size={8} color="#0a0a0a" />}
      </div>
      <span style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

function TextInput({ label, hint, value, onChange, type = 'text', placeholder, autoComplete, suffix }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; autoComplete?: string; suffix?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <label style={labelStyle}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: T.textMuted }}>{hint}</span>}
      </div>
      <div style={{ position: 'relative' }}>
        <input type={type} value={value} placeholder={placeholder} autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, borderColor: focused ? T.inputFocus : T.inputBorder, paddingRight: suffix ? 38 : 14 }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        {suffix && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{suffix}</div>}
      </div>
    </div>
  )
}

function StepBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
      {STEPS.map((s, i) => {
        const n = i + 1
        const done = step > n
        const active = step === n
        const Icon = s.icon
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <motion.div
                animate={{ background: done ? '#f0f0f0' : active ? '#1e1e1e' : '#111', borderColor: done ? '#f0f0f0' : active ? '#3a3a3a' : '#1e1e1e' }}
                transition={{ duration: 0.2 }}
                style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid' }}>
                {done
                  ? <Check size={12} color="#0a0a0a" />
                  : <Icon size={13} style={{ color: active ? '#888' : '#2a2a2a' }} />}
              </motion.div>
              <span style={{ fontSize: 10, fontWeight: 500, color: active ? '#555' : done ? '#444' : '#2a2a2a', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 48, height: 1, margin: '0 8px', marginBottom: 16, background: step > n ? '#2a2a2a' : '#161616', transition: 'background 0.3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      style={{ borderLeft: '2px solid #7f1d1d', paddingLeft: 12, fontSize: 12, color: T.errorText }}>
      {msg}
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface FormState {
  name: string; email: string; password: string; confirm: string
  phone: string; country: string; pin: string; confirmPin: string
  referralCode: string; agreeTerms: boolean; marketingOptIn: boolean
}

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState<FormState>({
    name: '', email: '', password: '', confirm: '',
    phone: '', country: '', pin: '', confirmPin: '',
    referralCode: '', agreeTerms: false, marketingOptIn: false,
  })
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpShake, setOtpShake] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const verifyEmail = searchParams.get('verify')
    if (verifyEmail) {
      setForm(f => ({ ...f, email: decodeURIComponent(verifyEmail) }))
      setStep(3)
      setTimeout(() => otpRefs.current[0]?.focus(), 400)
    }
  }, [searchParams])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  function goTo(n: number) {
    setDir(n > step ? 1 : -1)
    setStep(n)
    setError('')
  }

  function validateStep1(): string {
    if (!form.name.trim()) return 'Enter your full name.'
    if (!form.email.includes('@')) return 'Enter a valid email address.'
    if (form.password.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(form.password)) return 'Password needs at least one uppercase letter.'
    if (!/\d/.test(form.password)) return 'Password needs at least one number.'
    if (form.password !== form.confirm) return 'Passwords do not match.'
    return ''
  }

  function validateStep2(): string {
    if (!form.country) return 'Select your country.'
    if (!form.phone.trim()) return 'Enter your phone number.'
    const { valid, hint } = validatePhone(form.phone, form.country)
    if (!valid) return `Invalid phone for ${COUNTRIES.find(c => c.code === form.country)?.name}. ${hint}.`
    if (!/^\d{4}$/.test(form.pin)) return 'PIN must be exactly 4 digits.'
    if (form.pin !== form.confirmPin) return 'PINs do not match.'
    if (!form.agreeTerms) return 'You must agree to the Terms and Privacy Policy.'
    return ''
  }

  function handleNext1() {
    const err = validateStep1()
    if (err) { setError(err); return }
    goTo(2)
  }

  async function handleSubmit2(e: React.FormEvent) {
    e.preventDefault()
    const err = validateStep2()
    if (err) { setError(err); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email, password: form.password,
          phone: form.phone, country: form.country, pin: form.pin,
          referralCode: form.referralCode || null, marketingOptIn: form.marketingOptIn,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Registration failed.'); return }
      sessionStorage.setItem('myfiti_owner', JSON.stringify({ name: form.name, email: form.email, country: form.country }))
      setResendCooldown(60)
      goTo(3)
      setTimeout(() => otpRefs.current[0]?.focus(), 400)
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = useCallback(async (code: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Incorrect code.')
        setOtpShake(true)
        setTimeout(() => setOtpShake(false), 500)
        setOtp(['', '', '', '', '', ''])
        setTimeout(() => otpRefs.current[0]?.focus(), 50)
        return
      }
      router.push('/onboarding')
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }, [form.email, router])

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)
    setError('')
    if (digit) {
      if (index < 5) otpRefs.current[index + 1]?.focus()
      else if (next.join('').length === 6) verifyOtp(next.join(''))
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    const next = ['', '', '', '', '', '']
    digits.forEach((d, i) => { next[i] = d })
    setOtp(next)
    otpRefs.current[Math.min(digits.length, 5)]?.focus()
    if (digits.length === 6) verifyOtp(next.join(''))
  }

  async function resendOtp() {
    if (resendCooldown > 0 || resending) return
    setResending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to resend.'); return }
      setOtp(['', '', '', '', '', ''])
      setResendCooldown(60)
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch {
      setError('Network error.')
    } finally {
      setResending(false)
    }
  }

  const pinMismatch = form.confirmPin.length === 4 && form.pin !== form.confirmPin

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <StepBar step={step} />

      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <AnimatePresence mode="wait" custom={dir}>

          {/* Step 1 — Account */}
          {step === 1 && (
            <motion.div key="s1" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.28, ease: EASE }}
              style={{ padding: 32 }}>
              <motion.div variants={fieldVariants} custom={0} initial="hidden" animate="show" style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Create your account</h1>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>14-day free trial · No credit card required</p>
              </motion.div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <motion.div variants={fieldVariants} custom={1} initial="hidden" animate="show">
                  <TextInput label="Full name" value={form.name} onChange={v => set('name', v)} placeholder="Amara Osei" autoComplete="name" />
                </motion.div>
                <motion.div variants={fieldVariants} custom={2} initial="hidden" animate="show">
                  <TextInput label="Email" value={form.email} onChange={v => set('email', v)} placeholder="amara@crossfitlagos.com" type="email" autoComplete="email" />
                </motion.div>
                <motion.div variants={fieldVariants} custom={3} initial="hidden" animate="show">
                  <TextInput label="Password" value={form.password} onChange={v => set('password', v)}
                    placeholder="Min. 8 characters" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                    suffix={
                      <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                        style={{ color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    } />
                  <PasswordStrength password={form.password} />
                </motion.div>
                <motion.div variants={fieldVariants} custom={4} initial="hidden" animate="show">
                  <TextInput label="Confirm password" value={form.confirm} onChange={v => set('confirm', v)}
                    placeholder="Repeat your password" type={showConfirm ? 'text' : 'password'} autoComplete="new-password"
                    suffix={
                      <button type="button" tabIndex={-1} onClick={() => setShowConfirm(s => !s)}
                        style={{ color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    } />
                </motion.div>

                {error && <ErrorBanner msg={error} />}

                <motion.div variants={fieldVariants} custom={5} initial="hidden" animate="show">
                  <button type="button" onClick={handleNext1}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: T.btnPrimary, color: T.btnPrimaryText, border: 'none', cursor: 'pointer' }}>
                    Continue <ArrowRight size={14} />
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Step 2 — Security */}
          {step === 2 && (
            <motion.div key="s2" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.28, ease: EASE }}
              style={{ padding: 32 }}>
              <motion.div variants={fieldVariants} custom={0} initial="hidden" animate="show" style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Secure your account</h1>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Your phone and PIN protect your gym OS.</p>
              </motion.div>

              <form onSubmit={handleSubmit2} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Country */}
                <motion.div variants={fieldVariants} custom={1} initial="hidden" animate="show">
                  <label style={labelStyle}>Country</label>
                  <div style={{ position: 'relative' }}>
                    <select value={form.country}
                      onChange={e => {
                        const selected = COUNTRIES.find(c => c.code === e.target.value)
                        set('country', e.target.value)
                        if (selected && (!form.phone || /^\+\d{1,4}\s?$/.test(form.phone)))
                          set('phone', selected.dialCode + ' ')
                      }}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: 32, color: form.country ? T.textPrimary : T.textMuted }}
                      onFocus={e => (e.target.style.borderColor = T.inputFocus)}
                      onBlur={e => (e.target.style.borderColor = T.inputBorder)}>
                      <option value="">Select country…</option>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={12} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
                  </div>
                </motion.div>

                {/* Phone */}
                <motion.div variants={fieldVariants} custom={2} initial="hidden" animate="show">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <label style={labelStyle}>Phone</label>
                    <span style={{ fontSize: 11, color: T.textMuted }}>For account recovery</span>
                  </div>
                  <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.inputBorder}`, transition: 'border-color 0.15s' }}
                    onFocusCapture={e => ((e.currentTarget as HTMLElement).style.borderColor = T.inputFocus)}
                    onBlurCapture={e => ((e.currentTarget as HTMLElement).style.borderColor = T.inputBorder)}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderRight: `1px solid ${T.inputBorder}`, background: '#0d0d0d' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#666', minWidth: 32 }}>
                        {COUNTRIES.find(c => c.code === form.country)?.dialCode ?? '+'}
                      </span>
                    </div>
                    <input type="tel" autoComplete="tel"
                      value={(() => {
                        const dialCode = COUNTRIES.find(c => c.code === form.country)?.dialCode
                        if (dialCode && form.phone.startsWith(dialCode)) return form.phone.slice(dialCode.length).trimStart()
                        return form.phone
                      })()}
                      onChange={e => {
                        const dialCode = COUNTRIES.find(c => c.code === form.country)?.dialCode ?? ''
                        set('phone', dialCode ? `${dialCode} ${e.target.value}` : e.target.value)
                      }}
                      placeholder={COUNTRIES.find(c => c.code === form.country)?.placeholder ?? 'XXX XXX XXXX'}
                      style={{ flex: 1, padding: '10px 12px', fontSize: 13, fontWeight: 500, color: T.textPrimary, background: T.inputBg, outline: 'none', border: 'none' }} />
                  </div>
                  {form.phone && form.country && (() => {
                    const { valid, hint } = validatePhone(form.phone, form.country)
                    const local = extractLocal(form.phone, COUNTRIES.find(c => c.code === form.country)?.dialCode ?? '')
                    if (!local) return null
                    return <p style={{ fontSize: 11, marginTop: 6, color: valid ? T.successText : '#f87171' }}>{valid ? '✓ Valid' : `✗ ${hint}`}</p>
                  })()}
                </motion.div>

                {/* PIN */}
                <motion.div variants={fieldVariants} custom={3} initial="hidden" animate="show">
                  <div style={{ background: '#0d0d0d', border: `1px solid ${T.borderSubtle}`, borderRadius: 10, padding: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 500, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>4-digit access PIN</p>
                    <p style={{ fontSize: 11, color: '#2a2a2a', marginTop: 4, marginBottom: 14 }}>For kiosk &amp; device access — different from your password</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[
                        { label: 'Set PIN', field: 'pin' as const, value: form.pin },
                        { label: 'Confirm PIN', field: 'confirmPin' as const, value: form.confirmPin },
                      ].map(({ label, field, value }) => (
                        <div key={field}>
                          <label style={{ ...labelStyle, marginBottom: 6 }}>{label}</label>
                          <input type="password" inputMode="numeric" maxLength={4} value={value}
                            onChange={e => set(field, e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="••••"
                            style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.5em' }}
                            onFocus={e => (e.target.style.borderColor = T.inputFocus)}
                            onBlur={e => (e.target.style.borderColor = T.inputBorder)} />
                          <PinDots value={value} mismatch={field === 'confirmPin' ? pinMismatch : false} />
                          {field === 'confirmPin' && value.length === 4 && (
                            <p style={{ fontSize: 11, marginTop: 4, color: pinMismatch ? '#f87171' : T.successText }}>
                              {pinMismatch ? '✗ No match' : '✓ Match'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Referral */}
                <motion.div variants={fieldVariants} custom={4} initial="hidden" animate="show">
                  <button type="button" onClick={() => setShowReferral(s => !s)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <Gift size={12} />
                    {showReferral ? 'Hide referral code' : 'Have a referral code?'}
                  </button>
                  <AnimatePresence>
                    {showReferral && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden' }}>
                        <input type="text" value={form.referralCode}
                          onChange={e => set('referralCode', e.target.value.toUpperCase())}
                          placeholder="MYFITI-XXXX"
                          style={{ ...inputStyle, marginTop: 10 }}
                          onFocus={e => (e.target.style.borderColor = T.inputFocus)}
                          onBlur={e => (e.target.style.borderColor = T.inputBorder)} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Consent */}
                <motion.div variants={fieldVariants} custom={5} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Checkbox checked={form.agreeTerms} onChange={() => set('agreeTerms', !form.agreeTerms)}>
                    I agree to the{' '}
                    <Link href="/terms" style={{ color: '#555', textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>Terms</Link>{' '}and{' '}
                    <Link href="/privacy" style={{ color: '#555', textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>Privacy Policy</Link>.
                    {' '}Data processed in compliance with NDPR.
                  </Checkbox>
                  <Checkbox checked={form.marketingOptIn} onChange={() => set('marketingOptIn', !form.marketingOptIn)}>
                    Send me product updates and gym management tips.
                  </Checkbox>
                </motion.div>

                {error && <ErrorBanner msg={error} />}

                <motion.div variants={fieldVariants} custom={6} initial="hidden" animate="show"
                  style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => goTo(1)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, background: T.btnSecondary, color: T.btnSecondaryText, border: `1px solid ${T.btnSecondaryBorder}`, cursor: 'pointer' }}>
                    <ArrowLeft size={13} /> Back
                  </button>
                  <button type="submit" disabled={loading}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: T.btnPrimary, color: T.btnPrimaryText, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                    {loading ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : <><span>Create account</span><ArrowRight size={13} /></>}
                  </button>
                </motion.div>
              </form>
            </motion.div>
          )}

          {/* Step 3 — OTP */}
          {step === 3 && (
            <motion.div key="s3" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.28, ease: EASE }}
              style={{ padding: 32 }}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                style={{ textAlign: 'center', marginBottom: 28 }}>
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 240, damping: 20 }}
                  style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: '#111', border: `1px solid ${T.border}` }}>
                  <Mail size={22} style={{ color: '#555' }} />
                </motion.div>
                <h1 style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, margin: 0 }}>Check your email</h1>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>
                  We sent a 6-digit code to<br />
                  <span style={{ color: '#666', fontWeight: 500 }}>{form.email}</span>
                </p>
              </motion.div>

              <motion.div
                animate={otpShake ? 'shake' : 'rest'}
                variants={shakeVariants}
                style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}
                onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <motion.input key={i}
                    ref={el => { otpRefs.current[i] = el }}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    disabled={loading}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.04 }}
                    style={{
                      width: 44, height: 52, borderRadius: 10, textAlign: 'center', fontSize: 18, fontWeight: 600,
                      background: digit ? '#141414' : '#0d0d0d',
                      border: `1px solid ${digit ? '#2a2a2a' : T.inputBorder}`,
                      color: T.textPrimary, outline: 'none', transition: 'all 0.15s',
                      opacity: loading ? 0.5 : 1,
                    }}
                    onFocus={e => (e.target.style.borderColor = T.inputFocus)}
                    onBlur={e => (e.target.style.borderColor = digit ? '#2a2a2a' : T.inputBorder)}
                  />
                ))}
              </motion.div>

              <p style={{ fontSize: 11, color: '#2a2a2a', textAlign: 'center', marginBottom: 20 }}>
                {loading ? 'Verifying…' : 'Expires in 10 minutes'}
              </p>

              {error && <div style={{ marginBottom: 16 }}><ErrorBanner msg={error} /></div>}

              {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: '#444' }} />
                </div>
              )}

              <p style={{ fontSize: 12, color: '#333', textAlign: 'center' }}>
                Didn&apos;t receive it?{' '}
                <button type="button" onClick={resendOtp} disabled={resendCooldown > 0 || resending}
                  style={{ fontSize: 12, fontWeight: 500, color: resendCooldown > 0 ? '#333' : '#666', background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer', padding: 0 }}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : resending ? 'Sending…' : 'Resend code'}
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: '#333', marginTop: 20 }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: '#666', fontWeight: 500 }}>Sign in</Link>
      </p>
    </div>
  )
}
