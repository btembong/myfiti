'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import {
  Drawer, TextInput, Textarea, Button, Stack, Group,
  Text, ThemeIcon, Alert, Box, Select,
  Divider, SegmentedControl,
} from '@mantine/core'
import {
  UserAdd01Icon, User02Icon, Mail01Icon, SmartPhone01Icon,
  File01Icon, CheckmarkCircle01Icon, Loading01Icon, Alert01Icon,
  CrownIcon, MoneyReceive01Icon, ArrowRight01Icon,
} from 'hugeicons-react'

interface Plan { id: string; name: string; price: number; duration_days: number; currency: string }

interface Props {
  open: boolean
  onClose: () => void
  onAdded: () => void
}

export function AddMemberDrawer({ open, onClose, onAdded }: Props) {
  const [step, setStep] = useState<'info' | 'plan'>('info')
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'tranzak'>('cash')
  const [paymentRef, setPaymentRef] = useState('')
  const [tranzakPhone, setTranzakPhone] = useState('')
  const [tranzakPolling, setTranzakPolling] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      api.get<{ plans: Plan[] }>('/api/subscriptions/plans')
        .then(d => setPlans(d.plans ?? []))
        .catch(() => {})
    }
  }, [open])

  // Clean up polling interval on unmount
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  function reset() {
    setStep('info')
    setForm({ name: '', email: '', phone: '', notes: '' })
    setSelectedPlanId(null)
    setPaymentMethod('cash')
    setPaymentRef('')
    setTranzakPhone('')
    setTranzakPolling(false)
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    setError('')
    setSuccess(false)
  }

  function close() { reset(); onClose() }

  function goToPlan() {
    if (!form.name.trim()) { setError('Full name is required.'); return }
    if (!form.email.includes('@')) { setError('Please enter a valid email address.'); return }
    setError('')
    setStep('plan')
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      // 1. Create member
      const { id: memberId } = await api.post<{ id: string; qrCode: string }>('/api/members', form)

      // 2. Create subscription if plan selected
      if (selectedPlanId) {
        const { id: subId } = await api.post<{ id: string }>('/api/subscriptions', {
          member_id: memberId,
          plan_id: selectedPlanId,
        })

        const plan = plans.find(p => p.id === selectedPlanId)
        if (plan) {
          if (paymentMethod === 'tranzak') {
            // S2S USSD push — sends a prompt to the member's phone
            const phone = tranzakPhone.trim() || form.phone.trim()
            if (!phone) { setError('Enter the member\'s Mobile Money number.'); setLoading(false); return }
            const result = await api.post<{ ok: boolean; payment_id: string; request_id: string }>('/api/payments/tranzak/charge', {
              member_id: memberId,
              subscription_id: subId,
              amount: plan.price,
              currency: plan.currency ?? 'XAF',
              payment_type: 'subscription',
              phone,
            })
            setTranzakPolling(true)
            onAdded()
            setLoading(false)
            // Start polling for confirmation
            pollingRef.current = setInterval(async () => {
              try {
                const status = await api.get<{ status: string }>(`/api/payments/${result.payment_id}`)
                if (status.status === 'completed') {
                  clearInterval(pollingRef.current!); pollingRef.current = null
                  setTranzakPolling(false)
                  setSuccess(true)
                  setTimeout(() => { reset(); onClose() }, 1800)
                } else if (status.status === 'failed') {
                  clearInterval(pollingRef.current!); pollingRef.current = null
                  setTranzakPolling(false)
                  setError('Payment was declined or failed. Please try again.')
                }
              } catch { /* keep polling */ }
            }, 3000)
            return
          } else {
            // Cash / card / bank transfer — record immediately as completed
            await api.post('/api/payments', {
              member_id: memberId,
              subscription_id: subId,
              amount: plan.price,
              currency: plan.currency ?? 'XAF',
              provider: paymentMethod,
              provider_ref: paymentRef.trim() || undefined,
              payment_type: 'subscription',
            })
          }
        }
      }

      setSuccess(true)
      onAdded()
      setTimeout(() => { reset(); onClose() }, 1800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add member.')
    } finally {
      setLoading(false)
    }
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId)

  return (
    <Drawer
      opened={open}
      onClose={close}
      position="right"
      size="md"
      padding={0}
      withCloseButton={false}
      styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <Box px="xl" py="lg" style={{ borderBottom: '1px solid #f0f1f5', flexShrink: 0 }}>
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ThemeIcon size={36} radius="xl" color="indigo" variant="light">
              <UserAdd01Icon size={17} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Add new member</Text>
              <Text size="xs" c="dimmed">
                {step === 'info' ? 'Step 1 of 2 — Member details' : 'Step 2 of 2 — Plan & payment (optional)'}
              </Text>
            </Stack>
          </Group>
          <Button variant="subtle" color="gray" size="xs" onClick={close} px="xs">✕</Button>
        </Group>

        {/* Step indicator */}
        <Group gap={4} mt="sm">
          {(['info', 'plan'] as const).map((s, i) => (
            <Box
              key={s}
              style={{
                height: 3, flex: 1, borderRadius: 99,
                background: i === 0 ? '#6366f1' : (step === 'plan' ? '#6366f1' : '#e5e7eb'),
                transition: 'background 0.2s',
              }}
            />
          ))}
        </Group>
      </Box>

      {/* Form body */}
      <Box px="xl" py="lg" style={{ flex: 1, overflowY: 'auto' }}>
        {step === 'info' ? (
          <Stack gap="md">
            <TextInput
              label="Full name" placeholder="Amara Osei" required
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }}
              leftSection={<User02Icon size={14} style={{ color: '#9ca3af' }} />}
              radius="md" size="sm"
            />
            <TextInput
              label="Email address" placeholder="amara@example.com" type="email" required
              value={form.email}
              onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setError('') }}
              leftSection={<Mail01Icon size={14} style={{ color: '#9ca3af' }} />}
              radius="md" size="sm"
            />
            <TextInput
              label="Phone number" description="Optional" placeholder="+237 6XX XXX XXX" type="tel"
              value={form.phone}
              onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setError('') }}
              leftSection={<SmartPhone01Icon size={14} style={{ color: '#9ca3af' }} />}
              radius="md" size="sm"
            />
            <Textarea
              label="Notes" description="Optional" placeholder="Any notes about this member…"
              value={form.notes}
              onChange={e => { setForm(f => ({ ...f, notes: e.target.value })); setError('') }}
              leftSection={<File01Icon size={14} style={{ color: '#9ca3af' }} />}
              radius="md" size="sm" autosize minRows={3}
            />
            {error && <Alert icon={<Alert01Icon size={14} />} color="red" variant="light" radius="md">{error}</Alert>}
          </Stack>
        ) : tranzakPolling ? (
          /* ── S2S waiting for USSD approval ── */
          <Stack gap="md" align="center" py="md">
            <Box style={{ position: 'relative', width: 80, height: 80 }}>
              <Box style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', animation: 'pulse 2s ease-in-out infinite' }} />
              <Box style={{ position: 'absolute', inset: 12, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', animation: 'pulse 2s ease-in-out infinite 0.3s' }} />
              <Box style={{ position: 'absolute', inset: 22, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SmartPhone01Icon size={18} color="white" />
              </Box>
            </Box>
            <Text size="sm" fw={700} ta="center">USSD sent to {tranzakPhone.trim() || form.phone}</Text>
            <Text size="xs" c="dimmed" ta="center">
              The member will receive a prompt on their phone. Once they enter their MoMo PIN,
              this will confirm automatically.
            </Text>
            <Stack gap={6} w="100%">
              {['Member receives USSD on their phone', 'They enter their MTN or Orange PIN', 'Subscription activates automatically'].map((s, i) => (
                <Group key={i} gap="sm" p="xs" style={{ background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <Box style={{ width: 20, height: 20, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Text size="xs" fw={900} c="indigo">{i + 1}</Text>
                  </Box>
                  <Text size="xs" c="dimmed">{s}</Text>
                </Group>
              ))}
            </Stack>
            {error && <Alert icon={<Alert01Icon size={14} />} color="red" variant="light" radius="md">{error}</Alert>}
          </Stack>
        ) : (
          <Stack gap="md">
            <Select
              label="Membership plan"
              description="Optional — assign a plan now or later"
              placeholder="No plan (add later)"
              clearable
              value={selectedPlanId}
              onChange={v => setSelectedPlanId(v)}
              leftSection={<CrownIcon size={14} style={{ color: '#9ca3af' }} />}
              data={plans.map(p => ({
                value: p.id,
                label: `${p.name} — ${p.price.toLocaleString()} ${p.currency} / ${p.duration_days}d`,
              }))}
              radius="md" size="sm"
            />

            {selectedPlan && (
              <>
                <Divider label="Payment" labelPosition="left" />

                <Box p="md" style={{ background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Amount due</Text>
                    <Text size="sm" fw={700} style={{ color: '#111827' }}>
                      {selectedPlan.price.toLocaleString()} {selectedPlan.currency}
                    </Text>
                  </Group>
                </Box>

                <Stack gap={6}>
                  <Text size="xs" fw={600} c="dimmed">Payment method</Text>
                  <SegmentedControl
                    size="xs" radius="md"
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
                </Stack>

                {paymentMethod === 'tranzak' ? (
                  <TextInput
                    label="Member's Mobile Money number"
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
              </>
            )}

            {!selectedPlanId && (
              <Alert variant="light" color="blue" radius="md" icon={<CrownIcon size={14} />}>
                <Text size="xs">You can assign a plan later from the member&apos;s profile.</Text>
              </Alert>
            )}

            {error && <Alert icon={<Alert01Icon size={14} />} color="red" variant="light" radius="md">{error}</Alert>}
          </Stack>
        )}
      </Box>

      {/* Footer */}
      <Box px="xl" py="lg" style={{ borderTop: '1px solid #f0f1f5', flexShrink: 0 }}>
        {success ? (
          <Group justify="center" gap="xs" py="sm"
            style={{ background: '#ecfdf5', borderRadius: 10, border: '1px solid #bbf7d0' }}>
            <CheckmarkCircle01Icon size={16} style={{ color: '#059669' }} />
            <Text size="sm" fw={700} style={{ color: '#059669' }}>Member added successfully!</Text>
          </Group>
        ) : tranzakPolling ? (
          <Button fullWidth variant="default" onClick={close}>Close (payment still pending)</Button>
        ) : step === 'info' ? (
          <Group gap="sm">
            <Button flex={1} variant="default" onClick={close}>Cancel</Button>
            <Button flex={1} color="indigo" onClick={goToPlan}
              rightSection={<ArrowRight01Icon size={14} />}>
              Next
            </Button>
          </Group>
        ) : (
          <Group gap="sm">
            <Button flex={1} variant="default" onClick={() => { setStep('info'); setError('') }}>Back</Button>
            <Button flex={1} color="indigo" onClick={handleSubmit} loading={loading}
              leftSection={loading ? <Loading01Icon size={14} /> : <UserAdd01Icon size={14} />}>
              {loading
                ? 'Adding…'
                : paymentMethod === 'tranzak'
                  ? 'Add & send USSD prompt'
                  : selectedPlanId ? 'Add & record payment' : 'Add member'}
            </Button>
          </Group>
        )}
      </Box>
    </Drawer>
  )
}
