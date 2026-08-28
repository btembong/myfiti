'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Stack, Text, Title, TextInput, Button, Select,
  Box, ThemeIcon, Alert, Badge, Paper, Loader,
} from '@mantine/core'
import {
  CheckmarkCircle01Icon, Alert01Icon, Dumbbell01Icon,
  User02Icon, Mail01Icon, SmartPhone01Icon, CrownIcon,
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

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Full name is required.'); return }
    if (!form.email.trim() || !form.email.includes('@')) { setError('A valid email address is required.'); return }

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

  const selectedPlan = plans.find(p => p.id === form.plan_id)

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
            <Title order={3} mb={8} style={{ color: '#065f46' }}>You&apos;re registered!</Title>
            <Text size="sm" c="dimmed" mb="md">
              Welcome to {gym.name}. Check your email — we&apos;ve sent your membership QR code so you can check in at the gym.
            </Text>
            {selectedPlan && (
              <Badge color="indigo" variant="light" size="lg">
                {selectedPlan.name} — {selectedPlan.price.toLocaleString()} {selectedPlan.currency}
              </Badge>
            )}
          </Paper>
        ) : (
          /* ── Registration form ── */
          <Paper radius="xl" p="xl" withBorder style={{ width: '100%' }}>
            <Stack gap="md">
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
                By registering you agree to {gym.name}&apos;s membership terms.
                Your QR code will be emailed to you.
              </Text>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Box>
  )
}
