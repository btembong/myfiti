'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, Badge, Button,
  ThemeIcon, Divider, Box, SimpleGrid, Flex, ActionIcon, Tooltip, Modal, SegmentedControl,
} from '@mantine/core'
import {
  CreditCardIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  StarsIcon,
  CrownIcon,
  ArrowUpRight01Icon,
  Invoice01Icon,
  Wallet01Icon,
  Mail01Icon,
  Alert01Icon,
  Clock01Icon,
  SmartPhone01Icon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const } }),
}

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter', growth: 'Growth', growth_plus: 'Growth+', enterprise: 'Enterprise',
}
const PLAN_BASE_PRICE: Record<string, number> = {
  starter: 0, growth: 9900, growth_plus: 19900, enterprise: 49900,
}
// Keep PLAN_PRICE for existing references that use current plan's price
const PLAN_PRICE = PLAN_BASE_PRICE

type BillingDuration = 'monthly' | '6mo' | '1yr' | '2yr'

const DURATION_OPTIONS: { value: BillingDuration; label: string; months: number; discount: number; savingLabel: string }[] = [
  { value: 'monthly', label: 'Monthly',   months: 1,  discount: 1.00, savingLabel: '' },
  { value: '6mo',     label: '6 months',  months: 6,  discount: 0.90, savingLabel: 'Save 10%' },
  { value: '1yr',     label: '1 year',    months: 12, discount: 0.80, savingLabel: 'Save 20%' },
  { value: '2yr',     label: '2 years',   months: 24, discount: 0.70, savingLabel: 'Save 30%' },
]

function computePrice(baseMonthly: number, duration: BillingDuration) {
  const opt = DURATION_OPTIONS.find(o => o.value === duration)!
  const perMonth = Math.round(baseMonthly * opt.discount)
  const total    = perMonth * opt.months
  return { perMonth, total, months: opt.months, savingLabel: opt.savingLabel }
}

const PLANS = [
  {
    key: 'starter', name: 'Starter', basePrice: 0, cycle: 'Free forever',
    color: '#6b7280', badge: 'Free', badgeColor: 'gray',
    features: ['Up to 50 members', 'Member management', 'Check-in tracking', 'Basic payments', 'Dashboard & analytics'],
    missing:  ['Classes & scheduling', 'Trainer management', 'SMS & messaging', 'Priority support'],
  },
  {
    key: 'growth', name: 'Growth', basePrice: 9900, cycle: 'per month',
    color: '#6366f1', badge: 'Popular', badgeColor: 'indigo',
    features: ['Up to 200 members', 'Everything in Starter', 'Advanced analytics', 'Bulk email messaging', 'Custom branding'],
    missing:  ['Classes & scheduling', 'Trainer management', 'SMS campaigns'],
  },
  {
    key: 'growth_plus', name: 'Growth+', basePrice: 19900, cycle: 'per month',
    color: '#f59e0b', badge: 'Pro', badgeColor: 'yellow',
    features: ['Unlimited members', 'Everything in Growth', 'Classes & scheduling', 'Trainer management', 'SMS campaigns', 'Priority support', 'Custom integrations'],
    missing:  [],
  },
]

const ENTERPRISE = {
  key: 'enterprise', name: 'Enterprise',
  features: [
    'Everything in Growth+',
    'Dedicated account manager',
    'Custom SLA & uptime guarantee',
    'Multi-location support',
    'Priority phone & email support',
    'Custom contract & invoicing',
    'On-premise deployment option',
  ],
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingInfo {
  plan: string
  status: string
  trial_ends_at: string | null
  subscription_renewal_at: string | null
}

interface PlatformInvoice {
  id: string
  invoice_number: string
  amount_xaf: number
  status: string
  plan: string
  period_start: string
  period_end: string
  due_date: string
  paid_at: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([])
  const [paying, setPaying] = useState(false)
  const [loading, setLoading] = useState(true)

  // Iframe payment modal
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)

  // Duration picker
  const [duration, setDuration] = useState<BillingDuration>('monthly')

  // Plan change modal
  const [changePlanKey, setChangePlanKey] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)

  function reloadBilling() {
    Promise.all([
      api.get<BillingInfo>('/api/settings'),
      api.get<{ invoices: PlatformInvoice[] }>('/api/settings/billing/invoices'),
    ]).then(([b, inv]) => {
      setBilling(b)
      setInvoices(inv.invoices)
    }).catch(() => {})
  }

  useEffect(() => {
    setLoading(true)
    reloadBilling()
    setLoading(false)
  }, [])

  // Listen for iframe postMessage when payment completes
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data === 'payment_complete') {
        setPaymentUrl(null)
        notifications.show({ color: 'green', message: 'Payment received! Your billing status will update shortly.' })
        reloadBilling()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  async function handlePayNow() {
    setPaying(true)
    try {
      const res = await api.post<{ payment_url: string }>('/api/settings/billing/initiate-payment', {})
      if (res.payment_url) setPaymentUrl(res.payment_url)
    } catch {
      notifications.show({ color: 'red', message: 'Failed to initiate payment. Please try again.' })
    } finally {
      setPaying(false)
    }
  }

  async function confirmPlanChange() {
    if (!changePlanKey) return
    setChanging(true)
    try {
      await api.patch('/api/settings/billing/plan', { plan: changePlanKey, duration })
      setBilling(b => b ? { ...b, plan: changePlanKey } : b)
      const label = PLAN_LABEL[changePlanKey] ?? changePlanKey
      notifications.show({ color: 'green', message: `Plan changed to ${label} successfully.` })
      setChangePlanKey(null)
      // Reload invoices in case a new one was generated
      api.get<{ invoices: PlatformInvoice[] }>('/api/settings/billing/invoices')
        .then(inv => setInvoices(inv.invoices)).catch(() => {})
    } catch (err) {
      notifications.show({ color: 'red', message: err instanceof Error ? err.message : 'Failed to change plan.' })
    } finally {
      setChanging(false)
    }
  }

  const planKey    = billing?.plan ?? 'starter'
  const planLabel  = PLAN_LABEL[planKey] ?? planKey
  const planPrice  = PLAN_PRICE[planKey] ?? 0
  const isPaid     = planPrice > 0
  const isTrialing = billing?.status === 'trialing'
  const isPastDue  = billing?.status === 'past_due'
  const isSuspended = billing?.status === 'suspended'

  const trialEndsAt   = billing?.trial_ends_at ? new Date(billing.trial_ends_at) : null
  const renewalAt     = billing?.subscription_renewal_at ? new Date(billing.subscription_renewal_at) : null
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)) : null

  const outstandingInvoice = invoices.find(i => i.status === 'pending' || i.status === 'overdue')

  function fmtDate(d: string | null | undefined): string {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const statusColor: Record<string, string> = {
    paid: 'green', pending: 'yellow', overdue: 'red', cancelled: 'gray', draft: 'gray',
  }

  const changePlan = PLANS.find(p => p.key === changePlanKey)
  const isDowngrade = changePlanKey ? (PLAN_BASE_PRICE[changePlanKey] ?? 0) < planPrice : false

  return (
    <Stack gap="xl" p="xl" maw={820}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Billing &amp; plan
            </Title>
            <Text size="sm" c="dimmed">Subscription, invoices, and payment management.</Text>
          </Stack>
        </Group>
      </motion.div>

      {/* Status banners */}
      {(isPastDue || isSuspended) && (
        <motion.div variants={fade} custom={0.5} initial="hidden" animate="show">
          <Paper radius="xl" p="md" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
            <Group gap="sm">
              <Alert01Icon size={18} style={{ color: '#ef4444' }} />
              <Stack gap={0} style={{ flex: 1 }}>
                <Text size="sm" fw={700} style={{ color: '#991b1b' }}>
                  {isSuspended ? 'Account suspended' : 'Payment overdue'}
                </Text>
                <Text size="xs" style={{ color: '#ef4444' }}>
                  {isSuspended
                    ? 'Your gym has been suspended due to non-payment. Pay now to restore access.'
                    : `Your subscription payment is overdue.${outstandingInvoice ? ` Invoice ${outstandingInvoice.invoice_number} due ${fmtDate(outstandingInvoice.due_date)}.` : ''} Pay now to avoid suspension.`}
                </Text>
              </Stack>
              <Button size="xs" color="red" loading={paying} onClick={handlePayNow}>
                Pay now →
              </Button>
            </Group>
          </Paper>
        </motion.div>
      )}

      {isTrialing && trialDaysLeft !== null && trialDaysLeft <= 7 && (
        <motion.div variants={fade} custom={0.5} initial="hidden" animate="show">
          <Paper radius="xl" p="md" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
            <Group gap="sm">
              <Clock01Icon size={18} style={{ color: '#d97706' }} />
              <Text size="sm" style={{ color: '#92400e', flex: 1 }}>
                <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</strong> left on your free trial.
                {' '}Upgrade to keep your gym running after {fmtDate(billing?.trial_ends_at)}.
              </Text>
              <Button size="xs" color="yellow" component="a" href="#plans">
                Upgrade →
              </Button>
            </Group>
          </Paper>
        </motion.div>
      )}

      {/* Current plan banner */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4', background: '#fafbff' }}>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="md">
              <ThemeIcon size={48} radius="xl" color={isPaid ? 'indigo' : 'gray'} variant="light">
                <Wallet01Icon size={22} />
              </ThemeIcon>
              <Stack gap={2}>
                <Group gap="xs">
                  <Text fw={800} size="md" style={{ color: '#111827' }}>{planLabel} plan</Text>
                  <Badge size="sm" color={isPaid ? 'indigo' : 'gray'} variant="light">
                    {isTrialing ? 'Trial' : billing?.status ?? 'Active'}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {planPrice === 0
                    ? 'Free forever — no credit card required'
                    : renewalAt
                      ? `₣${planPrice.toLocaleString('fr-CM')}/month · Renews ${fmtDate(billing?.subscription_renewal_at)}`
                      : `₣${planPrice.toLocaleString('fr-CM')}/month`}
                </Text>
                {isTrialing && trialEndsAt && (
                  <Text size="xs" style={{ color: trialDaysLeft !== null && trialDaysLeft <= 3 ? '#ef4444' : '#d97706' }}>
                    Trial ends {fmtDate(billing?.trial_ends_at)}
                  </Text>
                )}
              </Stack>
            </Group>
            <Group gap="xs">
              {isPaid && outstandingInvoice && (
                <Button size="sm" color="red" loading={paying} onClick={handlePayNow}>
                  Pay ₣{outstandingInvoice.amount_xaf.toLocaleString('fr-CM')} →
                </Button>
              )}
              <Button
                size="sm" color="indigo"
                leftSection={<StarsIcon size={14} />}
                rightSection={<ArrowUpRight01Icon size={14} />}
                component="a" href="#plans"
              >
                {isPaid ? 'Change plan' : 'Upgrade plan'}
              </Button>
            </Group>
          </Group>
        </Paper>
      </motion.div>

      {/* Plans comparison */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Stack gap="sm" id="plans">
          <Group justify="space-between" align="center">
            <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>Plans</Text>
            <SegmentedControl
              size="xs" radius="xl" value={duration}
              onChange={v => setDuration(v as BillingDuration)}
              data={DURATION_OPTIONS.map(o => ({
                value: o.value,
                label: o.savingLabel ? `${o.label} · ${o.savingLabel}` : o.label,
              }))}
              styles={{ root: { background: '#f4f5f9' }, label: { fontWeight: 600 } }}
            />
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {PLANS.map(plan => {
              const isCurrent = plan.key === planKey
              const isUpgrade = (PLAN_BASE_PRICE[plan.key] ?? 0) > planPrice
              const pricing = plan.basePrice > 0 ? computePrice(plan.basePrice, duration) : null
              return (
                <Paper key={plan.name} radius="xl" p="xl" withBorder style={{
                  borderColor: isCurrent ? '#6366f1' : '#edeef4',
                  borderWidth: isCurrent ? 2 : 1, position: 'relative', overflow: 'visible',
                }}>
                  {isCurrent && (
                    <Box style={{ position: 'absolute', top: -10, left: 20, background: '#6366f1', borderRadius: 20, padding: '2px 10px' }}>
                      <Text size="xs" fw={700} style={{ color: 'white' }}>Your plan</Text>
                    </Box>
                  )}
                  <Group justify="space-between" mb="sm">
                    <Text fw={800} size="sm" style={{ color: '#111827' }}>{plan.name}</Text>
                    <Badge size="xs" color={plan.badgeColor} variant="light">{plan.badge}</Badge>
                  </Group>
                  <Group gap={2} align="baseline" mb={4}>
                    {!pricing ? (
                      <Text style={{ fontSize: '1.6rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>Free</Text>
                    ) : (
                      <>
                        <Text style={{ fontSize: '1.6rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                          ₣{pricing.perMonth.toLocaleString('fr-CM')}
                        </Text>
                        <Text size="xs" c="dimmed">/month</Text>
                      </>
                    )}
                  </Group>
                  {pricing && duration !== 'monthly' ? (
                    <Stack gap={2} mb="md">
                      <Text size="xs" c="dimmed">
                        ₣{pricing.total.toLocaleString('fr-CM')} billed every {pricing.months} months
                      </Text>
                      <Badge size="xs" color="green" variant="light">{computePrice(plan.basePrice, duration).savingLabel}</Badge>
                    </Stack>
                  ) : (
                    <Text size="xs" c="dimmed" mb="md">{plan.basePrice > 0 ? 'billed monthly' : plan.cycle}</Text>
                  )}
                  <Divider mb="md" />
                  <Stack gap={6} mb="lg">
                    {plan.features.map(f => (
                      <Group key={f} gap="xs">
                        <CheckmarkCircle01Icon size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                        <Text size="xs" style={{ color: '#374151' }}>{f}</Text>
                      </Group>
                    ))}
                    {plan.missing.map(f => (
                      <Group key={f} gap="xs">
                        <Cancel01Icon size={13} style={{ color: '#d1d5db', flexShrink: 0 }} />
                        <Text size="xs" c="dimmed" td="line-through">{f}</Text>
                      </Group>
                    ))}
                  </Stack>
                  {isCurrent ? (
                    <Button size="xs" variant="default" fullWidth disabled>Current plan</Button>
                  ) : (
                    <Button
                      size="xs" fullWidth
                      color={plan.key === 'growth_plus' ? 'yellow' : isUpgrade ? 'indigo' : 'gray'}
                      variant={isUpgrade ? 'filled' : 'default'}
                      leftSection={plan.key === 'growth_plus' ? <CrownIcon size={12} /> : <StarsIcon size={12} />}
                      onClick={() => setChangePlanKey(plan.key)}
                    >
                      {isUpgrade ? `Upgrade to ${plan.name}` : `Downgrade to ${plan.name}`}
                    </Button>
                  )}
                </Paper>
              )
            })}
          </SimpleGrid>

          {/* Enterprise card — compact full-width banner */}
          <Paper radius="xl" p="md" withBorder style={{
            borderColor: '#312e81', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          }}>
            <Group justify="space-between" align="center" wrap="nowrap">
              <Group gap="sm" align="center" wrap="nowrap">
                <Text fw={800} size="sm" style={{ color: '#ffffff' }}>Enterprise</Text>
                {planKey === 'enterprise' && <Badge size="xs" color="indigo" variant="filled">Your plan</Badge>}
                <Text size="xs" style={{ color: '#a5b4fc' }}>·</Text>
                {['Dedicated account manager', 'Custom SLA', 'Multi-location', 'Priority support'].map(f => (
                  <Group key={f} gap={4} wrap="nowrap">
                    <CheckmarkCircle01Icon size={11} style={{ color: '#818cf8', flexShrink: 0 }} />
                    <Text size="xs" style={{ color: '#c7d2fe' }}>{f}</Text>
                  </Group>
                ))}
              </Group>
              <Button
                component="a"
                href="mailto:sales@myfiti.fit?subject=Enterprise%20Plan%20Enquiry&body=Hi%20myfiti%20team%2C%0A%0AI%20am%20interested%20in%20the%20Enterprise%20plan.%20Please%20get%20in%20touch.%0A%0AThank%20you."
                size="xs" radius="md" style={{ background: '#6366f1', color: '#ffffff', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                leftSection={<StarsIcon size={12} />}
              >
                Contact sales
              </Button>
            </Group>
          </Paper>
        </Stack>
      </motion.div>

      {/* Payment method */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="indigo" variant="light">
              <CreditCardIcon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Payment method</Text>
              <Text size="xs" c="dimmed">Mobile Money (MTN, Orange) — payments processed via Tranzak</Text>
            </Stack>
          </Group>
          <Flex direction="column" align="center" gap="sm" py="md">
            <SmartPhone01Icon size={28} style={{ color: '#e5e7eb' }} />
            <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>Pay via mobile money</Text>
            <Text size="xs" c="dimmed" ta="center">
              Click "Pay now" to initiate a secure MTN or Orange Money payment for your subscription.
            </Text>
            {isPaid && (
              <Button size="xs" color="indigo" loading={paying} onClick={handlePayNow}
                leftSection={<SmartPhone01Icon size={12} />}>
                Pay ₣{planPrice.toLocaleString('fr-CM')} via Mobile Money
              </Button>
            )}
          </Flex>
        </Paper>
      </motion.div>

      {/* Invoice history */}
      <motion.div variants={fade} custom={4} initial="hidden" animate="show">
        <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
          <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid #f4f5f9' }}>
            <Group gap="sm">
              <ThemeIcon size={28} radius="lg" color="gray" variant="light">
                <Invoice01Icon size={14} />
              </ThemeIcon>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>
                Invoices {invoices.length > 0 && <span style={{ color: '#9ca3af', fontWeight: 400 }}>({invoices.length})</span>}
              </Text>
            </Group>
          </Group>

          {invoices.length > 0 && (
            <Group px="lg" py={8} style={{ borderBottom: '1px solid #f9fafb' }}>
              <Box style={{ flex: 1 }}><Text size="xs" fw={600} c="dimmed">Invoice</Text></Box>
              <Box style={{ width: 80 }}><Text size="xs" fw={600} c="dimmed">Status</Text></Box>
              <Box style={{ width: 110 }}><Text size="xs" fw={600} c="dimmed">Period</Text></Box>
              <Box style={{ width: 80 }}><Text size="xs" fw={600} c="dimmed">Due</Text></Box>
              <Box style={{ width: 90 }}><Text size="xs" fw={600} c="dimmed">Amount</Text></Box>
              <Box style={{ width: 60 }} />
            </Group>
          )}

          {loading ? (
            <Flex direction="column" align="center" gap="sm" py="xl">
              <Text size="xs" c="dimmed">Loading invoices…</Text>
            </Flex>
          ) : invoices.length > 0 ? (
            <Stack gap={0}>
              {invoices.map(inv => (
                <Group key={inv.id} px="lg" py="sm" style={{ borderBottom: '1px solid #f9fafb' }}>
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xs" fw={600} style={{ color: '#111827' }}>{inv.invoice_number}</Text>
                    <Text size="xs" c="dimmed">{PLAN_LABEL[inv.plan] ?? inv.plan} Plan</Text>
                  </Stack>
                  <Box style={{ width: 80 }}>
                    <Badge size="xs" radius="xl" variant="light" color={statusColor[inv.status] ?? 'gray'}>
                      {inv.status}
                    </Badge>
                  </Box>
                  <Box style={{ width: 110 }}>
                    <Text size="xs" c="dimmed">
                      {new Date(inv.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </Text>
                  </Box>
                  <Box style={{ width: 80 }}>
                    <Text size="xs" c="dimmed">{fmtDate(inv.due_date)}</Text>
                  </Box>
                  <Box style={{ width: 90 }}>
                    <Text size="xs" fw={700} style={{ color: '#111827' }}>
                      ₣{inv.amount_xaf.toLocaleString('fr-CM')}
                    </Text>
                  </Box>
                  <Box style={{ width: 60 }}>
                    {(inv.status === 'pending' || inv.status === 'overdue') && (
                      <Tooltip label="Pay this invoice" fz="xs" withArrow>
                        <ActionIcon size="sm" variant="filled" color="red" radius="md" loading={paying} onClick={handlePayNow}>
                          <Mail01Icon size={11} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Box>
                </Group>
              ))}
            </Stack>
          ) : (
            <Flex direction="column" align="center" gap="sm" py="xl">
              <Invoice01Icon size={28} style={{ color: '#e5e7eb' }} />
              <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>No invoices yet</Text>
              <Text size="xs" c="dimmed" ta="center" maw={280}>
                Invoices are generated automatically on the 1st of each month for paid plans.
              </Text>
            </Flex>
          )}
        </Paper>
      </motion.div>

      {/* Iframe payment modal */}
      <Modal
        opened={paymentUrl !== null}
        onClose={() => setPaymentUrl(null)}
        title={<Text fw={700} size="sm">Complete payment</Text>}
        radius="xl"
        size="xl"
      >
        <Text size="xs" c="dimmed" mb="sm">
          Complete your Mobile Money payment below. This window will close automatically once payment is confirmed.
        </Text>
        {paymentUrl && (
          <iframe
            src={paymentUrl}
            style={{ width: '100%', height: 560, border: 'none', borderRadius: 10 }}
            title="Tranzak payment"
          />
        )}
      </Modal>

      {/* Plan change confirmation modal */}
      <Modal
        opened={changePlanKey !== null}
        onClose={() => setChangePlanKey(null)}
        title={
          <Text fw={700} size="sm">
            {isDowngrade ? 'Downgrade plan' : 'Upgrade plan'}
          </Text>
        }
        radius="xl" size="sm"
      >
        {changePlan && (
          <Stack gap="md">
            <Box p="md" style={{ background: isDowngrade ? '#fff9f9' : '#eef2ff', borderRadius: 10, border: `1px solid ${isDowngrade ? '#fca5a5' : '#c7d2fe'}` }}>
              <Text size="sm" fw={600} style={{ color: '#111827' }} mb={4}>
                {isDowngrade ? `Downgrade to ${changePlan.name}` : `Upgrade to ${changePlan.name}`}
              </Text>
              <Text size="xs" c="dimmed">
                {isDowngrade
                  ? `You will lose access to features not included in the ${changePlan.name} plan. This takes effect immediately.`
                  : (() => {
                      const p = computePrice(changePlan.basePrice, duration)
                      return duration === 'monthly'
                        ? `You will be billed ₣${p.perMonth.toLocaleString('fr-CM')}/month. An invoice will be generated immediately.`
                        : `You will be billed ₣${p.total.toLocaleString('fr-CM')} upfront (₣${p.perMonth.toLocaleString('fr-CM')}/month × ${p.months} months). An invoice will be generated immediately.`
                    })()}
              </Text>
            </Box>
            <Group gap="md">
              <Text size="xs" c="dimmed">From</Text>
              <Badge color="gray" variant="light">{PLAN_LABEL[planKey]}</Badge>
              <Text size="xs" c="dimmed">→</Text>
              <Badge color={isDowngrade ? 'orange' : 'indigo'} variant="light">{changePlan.name}</Badge>
            </Group>
            <Group justify="flex-end" mt="xs">
              <Button variant="default" size="sm" onClick={() => setChangePlanKey(null)}>Cancel</Button>
              <Button
                size="sm"
                color={isDowngrade ? 'orange' : 'indigo'}
                loading={changing}
                onClick={confirmPlanChange}
              >
                {isDowngrade ? 'Confirm downgrade' : 'Confirm upgrade'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

    </Stack>
  )
}
