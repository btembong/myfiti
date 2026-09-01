'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  Stack, Text, Title, TextInput, Button, Select,
  Box, ThemeIcon, Alert, Badge, Paper, Loader, Group, Divider, SegmentedControl,
} from '@mantine/core'
import {
  CheckmarkCircle01Icon, Alert01Icon, Dumbbell01Icon,
  User02Icon, Mail01Icon, SmartPhone01Icon, CrownIcon,
  Loading01Icon, MoneyReceive01Icon, ArrowRight01Icon,
} from 'hugeicons-react'

interface Gym {
  id: string; name: string; slug: string
  logo_url: string | null; primary_color: string
  currency: string
}

interface Plan {
  id: string; name: string; price: number; currency: string
  duration_days: number; description: string | null
}

export default function JoinPage() {
  const { slug } = useParams<{ slug: string }>()

  const [gym, setGym]   = useState<Gym | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({ name: '', email: '', phone: '', plan_id: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'tranzak'>('cash')
  const [paymentRef, setPaymentRef] = useState('')
  const [tranzakPhone, setTranzakPhone] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [tranzakPolling, setTranzakPolling] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!slug) return
    Promise.all([
      fetch(`/api/public/gym/${slug}`).then(r => r.json()),
      fetch(`/api/public/gym/${slug}/plans`).then(r => r.json()),
    ]).then(([gymData, plansData]) => {
      if (gymData.error) { setLoadError(gymData.error); return }
      setGym(gymData.gym)
      setPlans(plansData.plans ?? [])
    }).catch(() => setLoadError('Failed to load gym details.'))
      .finally(() => setLoading(false))
  }, [slug])

  // Clean up polling interval on unmount
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Full name is required.'); return }
    if (!form.email.trim() || !form.email.includes('@')) { setError('A valid email address is required.'); return }

    // If plan is selected, show payment modal first
    if (form.plan_id) {
      setShowPaymentModal(true)
      return
    }

    // No plan — proceed directly to registration
    await submitRegistration()
  }

  async function submitRegistration(paymentRef?: string, paymentMethod?: string) {
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/public/gym/${slug}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          plan_id: form.plan_id || undefined,
          payment_method: paymentMethod,
          payment_ref: paymentRef,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Registration failed.'); return }
      setSuccess(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePaymentSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const selectedPlan = plans.find(p => p.id === form.plan_id)
      if (!selectedPlan) { setError('Plan not found.'); return }

      const phoneForPayment = (paymentMethod === 'tranzak' ? tranzakPhone : form.phone).trim()

      if (paymentMethod === 'tranzak' && phoneForPayment) {
        // Send USSD prompt
        try {
          const result = await fetch(`/api/public/gym/${slug}/register-with-tranzak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone.trim() || undefined,
              plan_id: form.plan_id,
              phone_for_payment: phoneForPayment,
            }),
          })
          const data = await result.json()
          if (!result.ok) { setError(data.error || 'Failed to send USSD prompt.'); setSubmitting(false); return }

          setTranzakPolling(true)
          setShowPaymentModal(false)
          setSubmitting(false)

          // Start polling for payment confirmation
          pollingRef.current = setInterval(async () => {
            try {
              const statusRes = await fetch(`/api/payments/${data.payment_id}`)
              const statusData = await statusRes.json()
              if (statusData.status === 'completed') {
                clearInterval(pollingRef.current!); pollingRef.current = null
                setTranzakPolling(false)
                setSuccess(true)
              } else if (statusData.status === 'failed') {
                clearInterval(pollingRef.current!); pollingRef.current = null
                setTranzakPolling(false)
                setError('Payment was declined or failed.')
              }
            } catch { /* keep polling */ }
          }, 3000)
        } catch (err) {
          setError('Failed to send USSD prompt.')
          setSubmitting(false)
        }
      } else {
        // Cash / card / bank transfer
        const ref = paymentRef.trim() || `REF-${Date.now()}`
        await submitRegistration(ref, paymentMethod)
      }
    } catch (err) {
      setError('Payment processing failed.')
      setSubmitting(false)
    }
  }

  const selectedPlan = plans.find(p => p.id === form.plan_id)

  if (loading) {
    return (
      <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <Loader color="indigo" size="md" />
      </Box>
    )
  }

  if (loadError || !gym) {
    return (
      <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: 24 }}>
        <Paper radius="xl" p="xl" withBorder style={{ maxWidth: 400, textAlign: 'center' }}>
          <ThemeIcon size={48} radius="xl" color="red" variant="light" style={{ margin: '0 auto 16px' }}>
            <Alert01Icon size={22} />
          </ThemeIcon>
          <Text fw={700} size="lg" mb={4}>Gym not found</Text>
          <Text size="sm" c="dimmed">{loadError || 'This registration link is invalid or has expired.'}</Text>
        </Paper>
      </Box>
    )
  }

  return (
    <Box style={{ minHeight: '100vh', background: '#f9fafb', padding: '40px 16px' }}>
      <Stack align="center" gap="xl" style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Gym header */}
        <Stack align="center" gap="xs">
          <ThemeIcon size={56} radius="xl" color="indigo" variant="filled">
            <Dumbbell01Icon size={26} />
          </ThemeIcon>
          <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>
            Join {gym.name}
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Fill in your details below to register your membership.
          </Text>
        </Stack>

        {success ? (
          /* ── Success state ── */
          <Paper radius="xl" p="xl" withBorder style={{ width: '100%', textAlign: 'center' }}>
            <ThemeIcon size={56} radius="xl" color="teal" variant="light" style={{ margin: '0 auto 16px' }}>
              <CheckmarkCircle01Icon size={26} />
            </ThemeIcon>
            <Title order={3} mb={8} style={{ color: '#065f46' }}>You're registered!</Title>
            <Text size="sm" c="dimmed" mb="md">
              Welcome to {gym.name}. Check your email — we've sent your membership QR code so you can check in at the gym.
            </Text>
            {selectedPlan && (
              <Badge color="indigo" variant="light" size="lg">
                {selectedPlan.name} — {selectedPlan.price.toLocaleString()} {selectedPlan.currency}
              </Badge>
            )}
          </Paper>
        ) : tranzakPolling ? (
          /* ── Tranzak USSD waiting ── */
          <Paper radius="xl" p="xl" withBorder style={{ width: '100%' }}>
            <Stack gap="md" align="center">
              <Box style={{ position: 'relative', width: 80, height: 80 }}>
                <Box style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', animation: 'pulse 2s ease-in-out infinite' }} />
                <Box style={{ position: 'absolute', inset: 12, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', animation: 'pulse 2s ease-in-out infinite 0.3s' }} />
                <Box style={{ position: 'absolute', inset: 22, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SmartPhone01Icon size={18} color="white" />
                </Box>
              </Box>
              <Text size="sm" fw={700} ta="center">USSD sent to {tranzakPhone.trim() || form.phone}</Text>
              <Text size="xs" c="dimmed" ta="center">
                The member will receive a prompt on their phone. Once they enter their MoMo PIN, registration will complete automatically.
              </Text>
              {error && (
                <Alert icon={<Alert01Icon size={14} />} color="red" variant="light" radius="md" w="100%">
                  {error}
                </Alert>
              )}
            </Stack>
          </Paper>
        ) : (
          /* ── Registration form or Payment modal ── */
          <Paper radius="xl" p="xl" withBorder style={{ width: '100%' }}>
            <Stack gap="md">
              {!showPaymentModal ? (
                <>
                  <TextInput
                    label="Full name" placeholder="Your full name" required
                    value={form.name}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }}
                    leftSection={<User02Icon size={14} style={{ color: '#9ca3af' }} />}
                    radius="md" size="sm"
                  />
                  <TextInput
                    label="Email address" placeholder="your@email.com" type="email" required
                    value={form.email}
                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setError('') }}
                    leftSection={<Mail01Icon size={14} style={{ color: '#9ca3af' }} />}
                    radius="md" size="sm"
                  />
                  <TextInput
                    label="Phone number" description="Optional" placeholder="+237 6XX XXX XXX"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    leftSection={<SmartPhone01Icon size={14} style={{ color: '#9ca3af' }} />}
                    radius="md" size="sm"
                  />

                  {plans.length > 0 && (
                    <Select
                      label="Membership plan" description="Optional — your gym can assign one later"
                      placeholder="Choose a plan…"
                      clearable
                      value={form.plan_id || null}
                      onChange={v => setForm(f => ({ ...f, plan_id: v ?? '' }))}
                      leftSection={<CrownIcon size={14} style={{ color: '#9ca3af' }} />}
                      data={plans.map(p => ({
                        value: p.id,
                        label: `${p.name} — ${p.price.toLocaleString()} ${p.currency} / ${p.duration_days}d`,
                      }))}
                      radius="md" size="sm"
                    />
                  )}

                  {selectedPlan?.description && (
                    <Text size="xs" c="dimmed" pl="xs">{selectedPlan.description}</Text>
                  )}

                  {error && (
                    <Alert icon={<Alert01Icon size={14} />} color="red" variant="light" radius="md">
                      {error}
                    </Alert>
                  )}

                  <Button
                    fullWidth color="indigo" size="md" radius="md"
                    loading={submitting} onClick={handleSubmit}
                    mt={4}
                  >
                    {submitting ? 'Registering…' : 'Register membership'}
                  </Button>

                  <Text size="xs" c="dimmed" ta="center">
                    By registering you agree to {gym.name}'s membership terms.
                    Your QR code will be emailed to you.
                  </Text>
                </>
              ) : (
                /* ── Payment modal ── */
                <>
                  <div>
                    <Text fw={700} size="sm" mb={4}>Payment method</Text>
                    <SegmentedControl
                      size="xs" radius="md" fullWidth
                      value={paymentMethod}
                      onChange={v => setPaymentMethod(v as typeof paymentMethod)}
                      data={[
                        { value: 'cash', label: 'Cash' },
                        { value: 'card', label: 'Card' },
                        { value: 'bank_transfer', label: 'Bank transfer' },
                        { value: 'tranzak', label: 'Mobile Money' },
                      ]}
                      styles={{ root: { background: '#f4f5f9' } }}
                    />
                  </div>

                  {selectedPlan && (
                    <Box p="md" style={{ background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">Amount due</Text>
                        <Text size="sm" fw={700} style={{ color: '#111827' }}>
                          {selectedPlan.price.toLocaleString()} {selectedPlan.currency}
                        </Text>
                      </Group>
                    </Box>
                  )}

                  {paymentMethod === 'tranzak' ? (
                    <TextInput
                      label="Mobile Money number"
                      description="A USSD prompt will be sent to this number"
                      placeholder="237655123456"
                      type="tel"
                      value={tranzakPhone || form.phone}
                      onChange={e => setTranzakPhone(e.target.value)}
                      leftSection={<SmartPhone01Icon size={14} style={{ color: '#9ca3af' }} />}
                      radius="md" size="sm"
                    />
                  ) : (
                    <TextInput
                      label="Reference / Receipt number"
                      description="Optional"
                      placeholder="e.g. REC-001"
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      leftSection={<MoneyReceive01Icon size={14} style={{ color: '#9ca3af' }} />}
                      radius="md" size="sm"
                    />
                  )}

                  {error && (
                    <Alert icon={<Alert01Icon size={14} />} color="red" variant="light" radius="md">
                      {error}
                    </Alert>
                  )}

                  <Group gap="sm" mt={4}>
                    <Button
                      flex={1} variant="default" onClick={() => { setShowPaymentModal(false); setError('') }}
                    >
                      Back
                    </Button>
                    <Button
                      flex={1} color="indigo" onClick={handlePaymentSubmit} loading={submitting}
                      leftSection={submitting ? <Loading01Icon size={14} /> : <CrownIcon size={14} />}
                    >
                      {paymentMethod === 'tranzak' ? 'Send USSD prompt' : 'Complete registration'}
                    </Button>
                  </Group>
                </>
              )}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Box>
  )
}
