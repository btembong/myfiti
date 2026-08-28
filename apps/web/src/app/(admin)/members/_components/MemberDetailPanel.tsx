'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, Avatar, Badge, Stack, Group, Text,
  Box, Tabs, Skeleton, Button, Modal, Select, Switch,
  TextInput, Textarea, NumberInput, ActionIcon, Tooltip,
} from '@mantine/core'
import {
  Mail01Icon,
  SmartPhone01Icon,
  CrownIcon,
  Calendar01Icon,
  QrCode01Icon,
  CheckmarkCircle01Icon,
  RemoveCircleIcon,
  Clock01Icon,
  Notebook01Icon,
  HeartCheckIcon,
  User02Icon,
  Wallet01Icon,
  Refresh01Icon,
  Add01Icon,
  RepeatIcon,
  PencilEdit01Icon,
  PrinterIcon,
  SentIcon,
} from 'hugeicons-react'
import QRCode from 'react-qr-code'
import { api } from '@/lib/api'
import { catchToast, showError, showSuccess } from '@/lib/notifications'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string
  name: string
  email: string
  phone: string | null
  status: 'active' | 'inactive' | 'suspended'
  qr_code: string
  pin: string | null
  avatar_url: string | null
  notes: string | null
  joined_at: string
  created_at: string
  sub_status: 'active' | 'expired' | 'cancelled' | 'frozen' | null
  expires_at: string | null
  plan_name: string | null
  plan_price: number | null
  plan_currency: string | null
}

interface CheckinRecord {
  id: string
  method: string
  checked_in_at: string
}

interface SubscriptionRecord {
  id: string
  plan_name: string
  price: string
  status: string
  created_at: string
  expires_at: string | null
  frozen_until: string | null
  duration_days: number | null
  auto_renew?: boolean
}

interface PaymentRecord {
  id: string
  amount: string
  currency: string
  provider: string
  status: string
  paid_at: string | null
  created_at: string
  plan_name: string | null
}

interface Plan {
  id: string
  name: string
  price: string
  duration_days: number
}

interface SubscriptionEvent {
  id: string
  subscription_id: string
  member_id: string
  event_type: string
  details: Record<string, unknown> | null
  actor: string | null
  actor_name: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

const fade = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } }

const EVENT_LABELS: Record<string, string> = {
  plan_assigned:  'Plan assigned',
  status_changed: 'Status changed',
  renewed:        'Subscription renewed',
  frozen:         'Subscription frozen',
  unfrozen:       'Subscription unfrozen',
  refunded:       'Payment refunded',
  reminder_sent:  'Payment reminder sent',
}

const PROVIDER_COLOR: Record<string, string> = {
  cash:          'green',
  momo:          'blue',
  bank_transfer: 'cyan',
  tranzak:       'violet',
}
const PROVIDER_LABEL: Record<string, string> = {
  cash:          'Cash',
  momo:          'MoMo',
  bank_transfer: 'Bank',
  tranzak:       'Tranzak',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Group gap="sm" py="sm" style={{ borderBottom: '1px solid #f4f5f9' }}>
      <Box
        style={{
          width: 28, height: 28, borderRadius: 8, background: '#f4f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <Icon size={13} style={{ color: '#9ca3af' }} />
      </Box>
      <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
        <Text size="xs" c="dimmed" fw={500}>{label}</Text>
        <Text size="sm" fw={600} style={{ color: '#111827' }} truncate>{value}</Text>
      </Stack>
    </Group>
  )
}

const STATUS_COLOR: Record<string, string> = {
  active: 'green', completed: 'green', succeeded: 'green',
  expired: 'red', failed: 'red', cancelled: 'gray',
  pending: 'yellow', grace_period: 'orange', expiring_soon: 'yellow',
  frozen: 'blue',
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function MemberDetailPanel({
  member: m,
  onRefresh,
}: {
  member: Member
  onRefresh?: () => void
}) {
  // ── History state ──────────────────────────────────────────────────────────
  const [checkins, setCheckins] = useState<CheckinRecord[]>([])
  const [subs, setSubs] = useState<SubscriptionRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [events, setEvents] = useState<SubscriptionEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [eventsLoading, setEventsLoading] = useState(true)

  // ── Local member fields ────────────────────────────────────────────────────
  const [localName, setLocalName]   = useState(m.name)
  const [localPhone, setLocalPhone] = useState(m.phone)
  const [localNotes, setLocalNotes] = useState(m.notes)

  // ── Local subscription state ───────────────────────────────────────────────
  const [localSubStatus, setLocalSubStatus] = useState(m.sub_status)
  const [localPlanName, setLocalPlanName]   = useState(m.plan_name)
  const [localExpiresAt, setLocalExpiresAt] = useState(m.expires_at)

  // ── Assign / Change plan modal ─────────────────────────────────────────────
  const [plans, setPlans]               = useState<Plan[]>([])
  const [assignOpen, setAssignOpen]     = useState(false)
  const [assignPlanId, setAssignPlanId] = useState<string | null>(null)
  const [assignStartDate, setAssignStartDate] = useState('')  // gap #6
  const [assignSaving, setAssignSaving] = useState(false)

  // ── Edit member modal ──────────────────────────────────────────────────────
  const [editOpen, setEditOpen]     = useState(false)
  const [editForm, setEditForm]     = useState({ name: m.name, phone: m.phone ?? '', notes: m.notes ?? '' })
  const [editSaving, setEditSaving] = useState(false)

  // ── QR + resend ───────────────────────────────────────────────────────────
  const [resendingQr, setResendingQr] = useState(false)
  const [qrOpen, setQrOpen]           = useState(false)

  // ── Auto-renew toggle ─────────────────────────────────────────────────────
  const [autoRenew, setAutoRenew]     = useState(false)
  const [renewSaving, setRenewSaving] = useState(false)

  // ── Gap #3 – renewal duration picker ──────────────────────────────────────
  const [renewDays, setRenewDays] = useState<number | string>(30)

  // ── Gap #1 – cancel subscription ──────────────────────────────────────────
  const [cancelOpen, setCancelOpen]   = useState(false)
  const [cancelSaving, setCancelSaving] = useState(false)

  // ── Gap #2 – record manual payment ────────────────────────────────────────
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '' as number | string, provider: 'cash', notes: '' })
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [receipt, setReceipt] = useState<{
    receipt_no: string; member_name: string; plan_name: string
    amount: number; currency: string; provider: string
    expires_date: string; paid_at: string; gym_name: string
    thermal_html: string | null
  } | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [resendingReceipt, setResendingReceipt] = useState(false)
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null)

  // ── Gap #10 – freeze / pause subscription ─────────────────────────────────
  const [freezeOpen, setFreezeOpen]   = useState(false)
  const [freezeDays, setFreezeDays]   = useState<number | string>(14)
  const [freezeSaving, setFreezeSaving] = useState(false)

  // ── Gap #12 – Tranzak mobile payment ──────────────────────────────────────
  const [tranzakLoading, setTranzakLoading] = useState(false)

  // ── Member PIN ─────────────────────────────────────────────────────────────
  const [localPin, setLocalPin] = useState(m.pin)
  const [pinResetLoading, setPinResetLoading] = useState(false)
  const [pinRevealOpen, setPinRevealOpen] = useState(false)
  const [newPin, setNewPin] = useState<string | null>(null)

  // ── Gap #4 / #5 – per-row remind / refund ─────────────────────────────────
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [refundingId, setRefundingId] = useState<string | null>(null)

  // ── Sync with incoming member prop ────────────────────────────────────────
  useEffect(() => {
    setLocalName(m.name)
    setLocalPhone(m.phone)
    setLocalNotes(m.notes)
    setLocalPin(m.pin)
    setLocalSubStatus(m.sub_status)
    setLocalPlanName(m.plan_name)
    setLocalExpiresAt(m.expires_at)
  }, [m.id])

  // ── Load history + events ─────────────────────────────────────────────────
  useEffect(() => {
    setHistoryLoading(true)
    setEventsLoading(true)
    Promise.all([
      api.get<{ checkins: CheckinRecord[] }>(`/api/members/${m.id}/checkins?limit=20`)
        .then(d => setCheckins(d.checkins ?? [])).catch(catchToast('Failed to load check-ins')),
      api.get<{ subscriptions: SubscriptionRecord[] }>(`/api/members/${m.id}/subscriptions`)
        .then(d => {
          const list = d.subscriptions ?? []
          setSubs(list)
          if (list[0]?.auto_renew != null) setAutoRenew(!!list[0].auto_renew)
          // Gap #3: seed renewDays from plan duration
          if (list[0]?.duration_days) setRenewDays(list[0].duration_days)
        }).catch(catchToast('Failed to load subscriptions')),
      api.get<{ payments: PaymentRecord[] }>(`/api/payments?member_id=${m.id}&limit=20`)
        .then(d => setPayments(d.payments ?? [])).catch(catchToast('Failed to load payments')),
      // Gap #11 – audit log
      api.get<{ events: SubscriptionEvent[] }>(`/api/members/${m.id}/subscription-events`)
        .then(d => { setEvents(d.events ?? []); setEventsLoading(false) })
        .catch(() => setEventsLoading(false)),
    ]).finally(() => setHistoryLoading(false))
  }, [m.id])

  // Fetch plans when assign modal opens
  useEffect(() => {
    if (!assignOpen) return
    api.get<{ plans: Plan[] }>('/api/subscriptions/plans')
      .then(d => setPlans(d.plans ?? []))
      .catch(catchToast('Failed to load plans'))
  }, [assignOpen])

  // ── Helper: refresh events sidebar ────────────────────────────────────────
  function refreshEvents() {
    api.get<{ events: SubscriptionEvent[] }>(`/api/members/${m.id}/subscription-events`)
      .then(d => setEvents(d.events ?? [])).catch(() => {})
  }
  function refreshSubs() {
    api.get<{ subscriptions: SubscriptionRecord[] }>(`/api/members/${m.id}/subscriptions`)
      .then(d => setSubs(d.subscriptions ?? [])).catch(() => {})
  }
  function refreshPayments() {
    api.get<{ payments: PaymentRecord[] }>(`/api/payments?member_id=${m.id}&limit=20`)
      .then(d => setPayments(d.payments ?? [])).catch(() => {})
  }

  // ── Mutation handlers ──────────────────────────────────────────────────────

  async function saveEdit() {
    setEditSaving(true)
    try {
      await api.patch(`/api/members/${m.id}`, {
        name:  editForm.name.trim() || undefined,
        phone: editForm.phone.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      setLocalName(editForm.name.trim() || localName)
      setLocalPhone(editForm.phone.trim() || null)
      setLocalNotes(editForm.notes.trim() || null)
      showSuccess('Member updated')
      setEditOpen(false)
      onRefresh?.()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update member')
    } finally {
      setEditSaving(false)
    }
  }

  async function resendWelcome() {
    setResendingQr(true)
    try {
      await api.post(`/api/members/${m.id}/resend-welcome`, {})
      showSuccess(`Welcome email with QR code sent to ${m.email}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setResendingQr(false)
    }
  }

  async function resetMemberPin() {
    setPinResetLoading(true)
    try {
      const res = await api.post<{ pin: string }>(`/api/members/${m.id}/reset-pin`, {})
      setLocalPin(res.pin)
      setNewPin(res.pin)
      setPinRevealOpen(true)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to reset PIN')
    } finally {
      setPinResetLoading(false)
    }
  }

  async function assignPlan() {
    if (!assignPlanId) return
    setAssignSaving(true)
    try {
      await api.post('/api/subscriptions', {
        member_id: m.id,
        plan_id: assignPlanId,
        // Gap #6: optional start date
        ...(assignStartDate ? { started_at: new Date(assignStartDate).toISOString() } : {}),
      })
      const plan = plans.find(p => p.id === assignPlanId)
      showSuccess(`Plan "${plan?.name}" assigned to ${localName}`)
      setLocalPlanName(plan?.name ?? null)
      setLocalSubStatus('active')
      setAssignOpen(false)
      setAssignPlanId(null)
      setAssignStartDate('')
      refreshSubs()
      refreshEvents()
      onRefresh?.()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to assign plan')
    } finally {
      setAssignSaving(false)
    }
  }

  // Gap #3: Renewal with variable days
  async function renewSubscription() {
    const activeSub = subs.find(s => ['active', 'expiring_soon', 'grace_period', 'expired'].includes(s.status))
    if (!activeSub) { showError('No subscription found to renew'); return }
    const days = Number(renewDays) || 30
    setRenewSaving(true)
    try {
      await api.patch(`/api/subscriptions/${activeSub.id}`, { extends_days: days })
      showSuccess(`Subscription extended by ${days} days for ${localName}`)
      setLocalSubStatus('active')
      onRefresh?.()
      refreshSubs()
      refreshEvents()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to renew subscription')
    } finally {
      setRenewSaving(false)
    }
  }

  async function reactivateSubscription() {
    const latestSub = subs[0]
    if (!latestSub) { showError('No subscription to reactivate'); return }
    setRenewSaving(true)
    try {
      await api.patch(`/api/subscriptions/${latestSub.id}`, { status: 'active' })
      showSuccess(`Subscription reactivated for ${localName}`)
      setLocalSubStatus('active')
      onRefresh?.()
      refreshSubs()
      refreshEvents()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to reactivate subscription')
    } finally {
      setRenewSaving(false)
    }
  }

  async function toggleAutoRenew(val: boolean) {
    const activeSub = subs.find(s => s.status === 'active' || s.status === 'expiring_soon')
    if (!activeSub) return
    setAutoRenew(val)
    api.patch(`/api/subscriptions/${activeSub.id}`, { auto_renew: val }).catch(() => setAutoRenew(!val))
  }

  // Gap #1: Cancel subscription
  async function cancelSubscription() {
    const activeSub = subs.find(s => ['active', 'expiring_soon', 'grace_period', 'frozen'].includes(s.status))
    if (!activeSub) { showError('No active subscription found'); return }
    setCancelSaving(true)
    try {
      await api.patch(`/api/subscriptions/${activeSub.id}`, { status: 'cancelled' })
      showSuccess(`Subscription cancelled for ${localName}`)
      setLocalSubStatus('cancelled')
      setCancelOpen(false)
      onRefresh?.()
      refreshSubs()
      refreshEvents()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setCancelSaving(false)
    }
  }

  // Gap #2: Record manual payment + activate/extend subscription
  async function recordPayment() {
    const amount = Number(paymentForm.amount)
    if (!amount || amount <= 0) { showError('Enter a valid amount'); return }
    setPaymentSaving(true)
    try {
      const activeSub = subs.find(s => ['active', 'expiring_soon', 'grace_period', 'expired', 'pending'].includes(s.status))
      const result = await api.post<{
        ok: boolean; id: string; new_expires_at: string | null
        member_email: string | null; email_sent: boolean
        receipt: {
          receipt_no: string; member_name: string; plan_name: string
          amount: number; currency: string; provider: string
          expires_date: string; paid_at: string; gym_name: string
          thermal_html: string | null
        }
      }>('/api/payments', {
        member_id:       m.id,
        subscription_id: activeSub?.id ?? null,
        amount,
        currency:        m.plan_currency ?? 'XAF',
        provider:        paymentForm.provider,
        notes:           paymentForm.notes.trim() || null,
        payment_type:    'subscription',
      })
      // Update local expiry + status immediately
      if (result.new_expires_at) {
        setLocalExpiresAt(result.new_expires_at)
        setLocalSubStatus('active')
      }
      setPaymentOpen(false)
      setPaymentForm({ amount: '', provider: 'cash', notes: '' })
      // Show receipt panel
      setReceipt(result.receipt)
      setLastPaymentId(result.id)
      setReceiptOpen(true)
      refreshPayments()
      refreshSubs()
      refreshEvents()
      onRefresh?.()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setPaymentSaving(false)
    }
  }

  // Print thermal receipt
  function printReceipt() {
    if (!receipt?.thermal_html) return
    const w = window.open('', '_blank', 'width=400,height=600')
    if (!w) return
    w.document.write(receipt.thermal_html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 250)
  }

  // Resend receipt email
  async function resendReceipt() {
    if (!lastPaymentId) return
    setResendingReceipt(true)
    try {
      const r = await api.post<{ ok: boolean; sent_to: string }>(`/api/payments/${lastPaymentId}/resend-receipt`, {})
      showSuccess(`Receipt re-sent to ${r.sent_to}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to resend receipt')
    } finally {
      setResendingReceipt(false)
    }
  }

  // Gap #4: Send payment reminder
  async function remindPayment(paymentId: string) {
    setRemindingId(paymentId)
    try {
      await api.post(`/api/payments/${paymentId}/remind`, {})
      showSuccess('Payment reminder sent')
      refreshEvents()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to send reminder')
    } finally {
      setRemindingId(null)
    }
  }

  // Gap #5: Issue refund
  async function refundPayment(paymentId: string) {
    setRefundingId(paymentId)
    try {
      await api.post(`/api/payments/${paymentId}/refund`, {})
      showSuccess('Refund processed')
      refreshPayments()
      refreshEvents()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to process refund')
    } finally {
      setRefundingId(null)
    }
  }

  // Gap #10: Freeze subscription
  async function freezeSubscription() {
    const activeSub = subs.find(s => s.status === 'active' || s.status === 'expiring_soon')
    if (!activeSub) { showError('No active subscription to freeze'); return }
    const days = Number(freezeDays) || 14
    setFreezeSaving(true)
    try {
      await api.patch(`/api/subscriptions/${activeSub.id}`, { freeze_days: days })
      showSuccess(`Subscription frozen for ${days} days — expiry extended accordingly`)
      setLocalSubStatus('frozen')
      setFreezeOpen(false)
      onRefresh?.()
      refreshSubs()
      refreshEvents()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to freeze subscription')
    } finally {
      setFreezeSaving(false)
    }
  }

  // Gap #10: Unfreeze subscription
  async function unfreezeSubscription() {
    const frozenSub = subs.find(s => s.status === 'frozen')
    if (!frozenSub) return
    setRenewSaving(true)
    try {
      await api.patch(`/api/subscriptions/${frozenSub.id}`, { unfreeze: true })
      showSuccess(`Subscription unfrozen for ${localName}`)
      setLocalSubStatus('active')
      onRefresh?.()
      refreshSubs()
      refreshEvents()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to unfreeze subscription')
    } finally {
      setRenewSaving(false)
    }
  }

  // Gap #12: Initiate Tranzak mobile payment
  async function initiateTranzak() {
    if (!m.plan_price) return
    setTranzakLoading(true)
    try {
      const activeSub = subs.find(s => ['active', 'expiring_soon', 'grace_period'].includes(s.status))
      const res = await api.post<{ payment_url: string }>('/api/payments/tranzak/initiate', {
        member_id:       m.id,
        subscription_id: activeSub?.id ?? null,
        amount:          m.plan_price,
        currency:        m.plan_currency ?? 'XAF',
        payment_type:    'subscription',
      })
      window.open(res.payment_url, '_blank')
      showSuccess('Payment link opened — member approves on their phone')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to initiate mobile payment')
    } finally {
      setTranzakLoading(false)
    }
  }

  // ── Computed display values ────────────────────────────────────────────────

  const statusConfig = {
    active:    { label: 'Active',    color: 'green'  as const },
    inactive:  { label: 'Inactive',  color: 'gray'   as const },
    suspended: { label: 'Suspended', color: 'red'    as const },
  }
  const memberStatus = statusConfig[m.status] ?? statusConfig.inactive

  const SubIcon = localSubStatus === 'active' || localSubStatus === 'expiring_soon'
    ? CheckmarkCircle01Icon
    : localSubStatus === 'frozen'
    ? Clock01Icon
    : localSubStatus === 'expired'
    ? RemoveCircleIcon
    : Clock01Icon

  const subColor = localSubStatus === 'active' ? '#059669'
    : localSubStatus === 'frozen' ? '#3b82f6'
    : localSubStatus === 'expired' ? '#ef4444'
    : '#9ca3af'

  const expiresLabel = localExpiresAt
    ? (() => {
        const d = daysUntil(localExpiresAt)
        return d > 0 ? `Expires in ${d} days (${fmt(localExpiresAt)})` : `Expired ${fmt(localExpiresAt)}`
      })()
    : 'No expiry date'

  // Gap #7: urgency badge
  const daysLeft = localExpiresAt && localSubStatus !== 'cancelled' ? daysUntil(localExpiresAt) : null
  const urgencyBadge = daysLeft !== null && daysLeft > 0 && daysLeft <= 14
    ? { color: daysLeft <= 3 ? 'red' : daysLeft <= 7 ? 'orange' : 'yellow', label: `${daysLeft}d left` }
    : null

  const hasActiveSub      = localSubStatus === 'active' || localSubStatus === 'expiring_soon'
  const isFrozen          = localSubStatus === 'frozen'
  const isExpiredOrCancelled = localSubStatus === 'expired' || localSubStatus === 'cancelled'
  const canCancel         = hasActiveSub || isFrozen
  const latestSubId       = subs[0]?.id

  return (
    <motion.div
      variants={fade} initial="hidden" animate="show"
      style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {/* ── Identity card ── */}
      <Paper radius="xl" p="md" withBorder style={{ borderColor: '#edeef4', background: '#fafafa' }}>
        <Group gap="md" align="flex-start">
          <Avatar size={52} radius="xl" color="indigo" variant="filled" fw={700}>
            {initials(localName)}
          </Avatar>
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Text size="md" fw={800} style={{ color: '#111827' }} truncate>{localName}</Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }} truncate>{m.qr_code}</Text>
            <Group gap="xs" mt={2}>
              <Badge size="sm" color={memberStatus.color} variant="light" radius="xl">
                {memberStatus.label}
              </Badge>
            </Group>
          </Stack>
          <Button
            size="xs" variant="subtle" color="gray"
            leftSection={<PencilEdit01Icon size={12} />}
            onClick={() => { setEditForm({ name: localName, phone: localPhone ?? '', notes: localNotes ?? '' }); setEditOpen(true) }}
          >
            Edit
          </Button>
        </Group>
      </Paper>

      {/* ── Contact details ── */}
      <Box>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.1em' }} mb="xs">
          Contact
        </Text>
        <Paper radius="lg" withBorder style={{ borderColor: '#edeef4' }} px="md">
          <InfoRow icon={Mail01Icon}       label="Email" value={m.email} />
          <InfoRow icon={SmartPhone01Icon} label="Phone" value={localPhone ?? '—'} />

          {/* PIN row */}
          <Group gap="sm" py="sm" style={{ borderBottom: '1px solid #f4f5f9' }}>
            <Box style={{ width: 28, height: 28, borderRadius: 8, background: '#f4f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <QrCode01Icon size={13} style={{ color: '#9ca3af' }} />
            </Box>
            <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" c="dimmed" fw={500}>Kiosk PIN</Text>
              <Group gap="xs" align="center">
                <Text size="sm" fw={700} style={{ color: '#111827', fontFamily: 'monospace', letterSpacing: '0.25em' }}>
                  {localPin ?? '—'}
                </Text>
                <Button
                  size="xs" variant="subtle" color="gray" px={6}
                  loading={pinResetLoading}
                  onClick={resetMemberPin}
                >
                  Reset
                </Button>
              </Group>
            </Stack>
          </Group>

          <Box py="sm">
            <Group gap="sm">
              <Box style={{ width: 28, height: 28, borderRadius: 8, background: '#f4f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar01Icon size={13} style={{ color: '#9ca3af' }} />
              </Box>
              <Stack gap={1} style={{ flex: 1 }}>
                <Text size="xs" c="dimmed" fw={500}>Joined</Text>
                <Text size="sm" fw={600} style={{ color: '#111827' }}>{fmt(m.joined_at ?? m.created_at)}</Text>
              </Stack>
            </Group>
          </Box>
        </Paper>
      </Box>

      {/* ── Subscription ── */}
      <Box>
        <Group justify="space-between" mb="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.1em' }}>
            Subscription
          </Text>
          <Button
            size="xs" variant="subtle" color="indigo"
            leftSection={localPlanName ? <Refresh01Icon size={11} /> : <Add01Icon size={11} />}
            onClick={() => setAssignOpen(true)}
          >
            {localPlanName ? 'Change plan' : 'Assign plan'}
          </Button>
        </Group>
        <Paper radius="lg" p="md" withBorder style={{ borderColor: '#edeef4' }}>
          <Stack gap="sm">
            {/* Plan name + price */}
            <Group justify="space-between">
              <Group gap="xs">
                <CrownIcon size={13} style={{ color: '#4f46e5' }} />
                <Text size="sm" fw={700} style={{ color: '#111827' }}>
                  {localPlanName ?? 'No plan assigned'}
                </Text>
              </Group>
              {m.plan_price != null && (
                <Text size="xs" fw={700} style={{ color: '#4f46e5' }}>
                  {m.plan_currency ?? 'XAF'} {m.plan_price.toLocaleString('fr-CM')}
                </Text>
              )}
            </Group>

            {/* Status + expiry + urgency badge (Gap #7) */}
            <Group gap="xs" justify="space-between">
              <Group gap="xs">
                {localSubStatus && <SubIcon size={13} style={{ color: subColor }} />}
                <Text size="xs" c="dimmed">{expiresLabel}</Text>
              </Group>
              {urgencyBadge && (
                <Badge size="xs" color={urgencyBadge.color} variant="filled" radius="xl">
                  {urgencyBadge.label}
                </Badge>
              )}
            </Group>

            {/* Frozen info */}
            {isFrozen && subs[0]?.frozen_until && (
              <Group gap="xs">
                <Clock01Icon size={12} style={{ color: '#3b82f6' }} />
                <Text size="xs" style={{ color: '#3b82f6' }}>
                  Frozen until {fmt(subs[0].frozen_until)}
                </Text>
              </Group>
            )}

            {/* Auto-renew toggle (active / expiring only) */}
            {hasActiveSub && latestSubId && (
              <Group justify="space-between" pt={4} style={{ borderTop: '1px solid #f4f5f9' }}>
                <Stack gap={0}>
                  <Text size="xs" fw={600} style={{ color: '#374151' }}>Auto-renew</Text>
                  <Text size="xs" c="dimmed">Renew automatically when plan expires</Text>
                </Stack>
                <Switch
                  size="xs" color="indigo" checked={autoRenew}
                  onChange={e => toggleAutoRenew(e.currentTarget.checked)}
                />
              </Group>
            )}

            {/* Gap #3: Renewal duration picker */}
            {(hasActiveSub || isExpiredOrCancelled) && localPlanName && (
              <Group gap="xs" pt={hasActiveSub ? 0 : 4}>
                <RepeatIcon size={12} style={{ color: '#6b7280' }} />
                <NumberInput
                  value={renewDays}
                  onChange={setRenewDays}
                  min={1} max={365} size="xs"
                  style={{ width: 72 }}
                  styles={{ input: { textAlign: 'center', fontWeight: 700 } }}
                />
                <Text size="xs" c="dimmed">days</Text>
                <Button
                  size="xs" variant="light" color="indigo" style={{ flex: 1 }}
                  loading={renewSaving}
                  onClick={renewSubscription}
                >
                  {hasActiveSub ? 'Extend' : 'Renew'}
                </Button>
              </Group>
            )}

            {/* Reactivate (expired / cancelled) */}
            {isExpiredOrCancelled && localPlanName && (
              <Button
                size="xs" variant="light" color="green" fullWidth
                leftSection={<CheckmarkCircle01Icon size={12} />}
                loading={renewSaving}
                onClick={reactivateSubscription}
              >
                Reactivate subscription
              </Button>
            )}

            {/* Gap #10: Unfreeze */}
            {isFrozen && (
              <Button
                size="xs" variant="light" color="blue" fullWidth
                leftSection={<CheckmarkCircle01Icon size={12} />}
                loading={renewSaving}
                onClick={unfreezeSubscription}
              >
                Unfreeze subscription
              </Button>
            )}

            {/* Gap #1 + #10: Cancel + Freeze row */}
            {(hasActiveSub || isFrozen) && (
              <Group gap="xs" pt={4} style={{ borderTop: '1px solid #f4f5f9' }}>
                {hasActiveSub && (
                  <Button
                    size="xs" variant="subtle" color="orange" style={{ flex: 1 }}
                    leftSection={<Clock01Icon size={11} />}
                    onClick={() => setFreezeOpen(true)}
                  >
                    Freeze
                  </Button>
                )}
                <Button
                  size="xs" variant="subtle" color="red" style={{ flex: 1 }}
                  leftSection={<RemoveCircleIcon size={11} />}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel
                </Button>
              </Group>
            )}

            {/* Gap #12: Tranzak mobile payment */}
            {localPlanName && m.plan_price != null && (
              <Button
                size="xs" variant="outline" color="violet" fullWidth
                leftSection={<SmartPhone01Icon size={12} />}
                loading={tranzakLoading}
                onClick={initiateTranzak}
              >
                Request mobile payment
              </Button>
            )}
          </Stack>
        </Paper>
      </Box>

      {/* ── History tabs ── */}
      <Box>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.1em' }} mb="xs">
          History
        </Text>
        <Paper radius="lg" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
          <Tabs defaultValue="checkins" variant="default" keepMountedMode="display-none">
            <Tabs.List style={{ borderBottom: '1px solid #f4f5f9' }}>
              <Tabs.Tab value="checkins" leftSection={<HeartCheckIcon size={12} />}>
                <Text size="xs" fw={600}>Check-ins</Text>
              </Tabs.Tab>
              <Tabs.Tab value="subscriptions" leftSection={<CrownIcon size={12} />}>
                <Text size="xs" fw={600}>Plans</Text>
              </Tabs.Tab>
              <Tabs.Tab value="payments" leftSection={<Wallet01Icon size={12} />}>
                <Text size="xs" fw={600}>Payments</Text>
              </Tabs.Tab>
              <Tabs.Tab value="activity" leftSection={<Notebook01Icon size={12} />}>
                <Text size="xs" fw={600}>Activity</Text>
              </Tabs.Tab>
            </Tabs.List>

            {historyLoading ? (
              <Stack gap="xs" p="md">
                <Skeleton height={16} radius="sm" />
                <Skeleton height={16} radius="sm" width="80%" />
                <Skeleton height={16} radius="sm" width="60%" />
              </Stack>
            ) : (
              <>
                {/* Check-ins tab */}
                <Tabs.Panel value="checkins" p="sm">
                  {checkins.length > 0 ? (
                    <Stack gap={0}>
                      {checkins.map(ci => (
                        <Group key={ci.id} justify="space-between" py={6} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <Group gap="xs">
                            <HeartCheckIcon size={11} style={{ color: '#9ca3af' }} />
                            <Text size="xs" fw={600} style={{ color: '#374151' }}>
                              {fmt(ci.checked_in_at)}
                            </Text>
                            <Text size="xs" c="dimmed">{fmtTime(ci.checked_in_at)}</Text>
                          </Group>
                          <Badge size="xs" variant="light" color="gray">{ci.method ?? 'qr'}</Badge>
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="xs" c="dimmed" ta="center" py="md">No check-ins recorded yet.</Text>
                  )}
                </Tabs.Panel>

                {/* Subscriptions tab */}
                <Tabs.Panel value="subscriptions" p="sm">
                  {subs.length > 0 ? (
                    <Stack gap={0}>
                      {subs.map(sub => (
                        <Group key={sub.id} justify="space-between" py={6} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <Stack gap={1}>
                            <Text size="xs" fw={600} style={{ color: '#374151' }}>{sub.plan_name}</Text>
                            <Text size="xs" c="dimmed">
                              {fmt(sub.created_at)}{sub.expires_at ? ` → ${fmt(sub.expires_at)}` : ''}
                            </Text>
                          </Stack>
                          <Group gap="xs">
                            <Text size="xs" fw={600} style={{ color: '#111827' }}>
                              ₣{parseFloat(sub.price ?? '0').toLocaleString('fr-CM')}
                            </Text>
                            <Badge size="xs" variant="light" color={STATUS_COLOR[sub.status] ?? 'gray'}>
                              {sub.status}
                            </Badge>
                          </Group>
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="xs" c="dimmed" ta="center" py="md">No subscriptions found.</Text>
                  )}
                </Tabs.Panel>

                {/* Payments tab — Gap #8 (provider badge), Gap #4/#5 (remind/refund), Gap #9 (record button) */}
                <Tabs.Panel value="payments" p="sm">
                  <Group justify="flex-end" mb="xs">
                    <Button
                      size="xs" variant="light" color="green"
                      leftSection={<Add01Icon size={11} />}
                      onClick={() => setPaymentOpen(true)}
                    >
                      Record payment
                    </Button>
                  </Group>
                  {payments.length > 0 ? (
                    <Stack gap={0}>
                      {payments.map(pay => (
                        <Group key={pay.id} justify="space-between" py={6} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <Stack gap={1}>
                            <Text size="xs" fw={600} style={{ color: '#374151' }}>
                              {pay.plan_name ?? 'Payment'}
                            </Text>
                            <Group gap={4}>
                              <Text size="xs" c="dimmed">{fmt(pay.paid_at ?? pay.created_at)}</Text>
                              {/* Gap #8: payment method badge */}
                              <Badge size="xs" variant="dot" color={PROVIDER_COLOR[pay.provider] ?? 'gray'}>
                                {PROVIDER_LABEL[pay.provider] ?? pay.provider}
                              </Badge>
                            </Group>
                          </Stack>
                          <Group gap="xs">
                            <Stack gap={1} align="flex-end">
                              <Text size="xs" fw={600} style={{ color: '#111827' }}>
                                ₣{parseFloat(pay.amount ?? '0').toLocaleString('fr-CM')}
                              </Text>
                              <Badge size="xs" variant="light" color={STATUS_COLOR[pay.status] ?? 'gray'}>
                                {pay.status}
                              </Badge>
                            </Stack>
                            {/* Gap #4: remind */}
                            {(pay.status === 'pending' || pay.status === 'failed') && (
                              <Tooltip label="Send reminder" position="left">
                                <ActionIcon
                                  size="xs" variant="subtle" color="blue"
                                  loading={remindingId === pay.id}
                                  onClick={() => remindPayment(pay.id)}
                                >
                                  <Mail01Icon size={11} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                            {/* Gap #5: refund */}
                            {(pay.status === 'completed' || pay.status === 'paid' || pay.status === 'succeeded') && (
                              <Tooltip label="Issue refund" position="left">
                                <ActionIcon
                                  size="xs" variant="subtle" color="red"
                                  loading={refundingId === pay.id}
                                  onClick={() => refundPayment(pay.id)}
                                >
                                  <Refresh01Icon size={11} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="xs" c="dimmed" ta="center" py="md">No payments recorded yet.</Text>
                  )}
                </Tabs.Panel>

                {/* Gap #11: Activity / audit log tab */}
                <Tabs.Panel value="activity" p="sm">
                  {eventsLoading ? (
                    <Stack gap="xs">
                      <Skeleton height={14} radius="sm" />
                      <Skeleton height={14} radius="sm" width="70%" />
                    </Stack>
                  ) : events.length > 0 ? (
                    <Stack gap={0}>
                      {events.map(ev => (
                        <Box key={ev.id} py={6} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <Group justify="space-between">
                            <Text size="xs" fw={600} style={{ color: '#374151' }}>
                              {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                            </Text>
                            <Text size="xs" c="dimmed">{fmt(ev.created_at)}</Text>
                          </Group>
                          {ev.actor_name && (
                            <Text size="xs" c="dimmed">by {ev.actor_name}</Text>
                          )}
                          {ev.details && Object.keys(ev.details).length > 0 && (
                            <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                              {Object.entries(ev.details)
                                .filter(([k]) => !['plan_id', 'member_id'].includes(k))
                                .map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
                            </Text>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="xs" c="dimmed" ta="center" py="md">No activity recorded yet.</Text>
                  )}
                </Tabs.Panel>
              </>
            )}
          </Tabs>
        </Paper>
      </Box>

      {/* ── Notes ── */}
      {localNotes && (
        <Box>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.1em' }} mb="xs">
            Notes
          </Text>
          <Paper radius="lg" p="md" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
            <Group gap="sm" align="flex-start">
              <Notebook01Icon size={13} style={{ color: '#d97706', marginTop: 2, flexShrink: 0 }} />
              <Text size="sm" style={{ color: '#92400e' }}>{localNotes}</Text>
            </Group>
          </Paper>
        </Box>
      )}

      {/* ── Quick actions ── */}
      <Box>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.1em' }} mb="xs">
          Actions
        </Text>
        <Stack gap="xs">
          {[
            {
              label: 'Edit member details',
              icon: User02Icon,
              onClick: () => { setEditForm({ name: localName, phone: localPhone ?? '', notes: localNotes ?? '' }); setEditOpen(true) },
            },
            {
              label: 'Resend QR code email',
              icon: Mail01Icon,
              onClick: resendWelcome,
              loading: resendingQr,
            },
            {
              label: 'Show QR code',
              icon: QrCode01Icon,
              onClick: () => setQrOpen(true),
            },
          ].map(({ label, icon: Icon, onClick, loading }) => (
            <Paper
              key={label}
              component="button"
              radius="lg"
              px="md"
              py="sm"
              withBorder
              style={{
                borderColor: '#f0f1f5', cursor: loading ? 'wait' : 'pointer', width: '100%',
                background: '#fff', transition: 'background 0.12s',
                opacity: loading ? 0.7 : 1,
              }}
              onClick={loading ? undefined : onClick}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff' }}
            >
              <Group gap="sm">
                <Box style={{ width: 28, height: 28, borderRadius: 8, background: '#f4f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={13} style={{ color: '#6b7280' }} />
                </Box>
                <Text size="sm" fw={500} style={{ color: '#374151' }}>{loading ? 'Sending…' : label}</Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Box>

      {/* ════════════════════════════════════════════
          MODALS
          ════════════════════════════════════════════ */}

      {/* ── Gap #1: Cancel subscription confirm ── */}
      <Modal
        opened={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={<Text fw={700} size="sm">Cancel subscription</Text>}
        radius="xl" size="sm" centered
      >
        <Stack gap="md">
          <Text size="sm" style={{ color: '#374151' }}>
            This will immediately cancel <strong>{localName}</strong>&apos;s{' '}
            <strong>{localPlanName}</strong> subscription. They will lose access at the next check-in.
          </Text>
          <Text size="xs" c="dimmed">This action can be undone by reactivating the subscription.</Text>
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setCancelOpen(false)}>Go back</Button>
            <Button color="red" size="sm" loading={cancelSaving} onClick={cancelSubscription}>
              Yes, cancel subscription
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Gap #2: Record manual payment ── */}
      <Modal
        opened={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title={<Text fw={700} size="sm">Record payment — {localName}</Text>}
        radius="xl" size="sm"
      >
        <Stack gap="md">
          {/* Subscription context banner */}
          {(() => {
            const sub = subs.find(s => ['active','expiring_soon','grace_period','expired','pending'].includes(s.status))
            if (!sub) return (
              <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '10px 14px' }}>
                <Text size="xs" fw={600} c="yellow.8">No active subscription found — payment will be recorded but no plan will be activated automatically.</Text>
              </div>
            )
            const isExpired = sub.status === 'expired' || sub.status === 'grace_period'
            return (
              <div style={{ background: isExpired ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isExpired ? '#fca5a5' : '#86efac'}`, borderRadius: 10, padding: '10px 14px' }}>
                <Text size="xs" fw={700} c={isExpired ? 'red.7' : 'green.7'}>
                  {sub.plan_name ?? 'Subscription'} · {sub.status.replace('_', ' ')}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {isExpired ? 'Expired' : 'Expires'}: {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '—'}
                  {sub.duration_days ? ` · Payment will extend by ${sub.duration_days} days` : ''}
                </Text>
              </div>
            )
          })()}

          <NumberInput
            label={`Amount (${m.plan_currency ?? 'XAF'})`}
            placeholder={`e.g. ${m.plan_price ?? 15000}`}
            value={paymentForm.amount}
            onChange={v => setPaymentForm(f => ({ ...f, amount: v }))}
            min={0} radius="md" size="sm"
            leftSection={<Wallet01Icon size={14} style={{ color: '#9ca3af' }} />}
          />
          <Select
            label="Payment method"
            value={paymentForm.provider}
            onChange={v => setPaymentForm(f => ({ ...f, provider: v ?? 'cash' }))}
            data={[
              { value: 'cash',          label: '💵 Cash' },
              { value: 'momo',          label: '📱 Mobile Money (MoMo)' },
              { value: 'bank_transfer', label: '🏦 Bank transfer' },
              { value: 'tranzak',       label: 'Tranzak' },
            ]}
            radius="md" size="sm"
          />
          <TextInput
            label="Reference / notes"
            description="Optional — receipt number, transaction ID, etc."
            value={paymentForm.notes}
            onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
            radius="md" size="sm"
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button
              color="green" size="sm" loading={paymentSaving}
              disabled={!paymentForm.amount || Number(paymentForm.amount) <= 0}
              onClick={recordPayment}
            >
              Confirm &amp; record
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Receipt panel (shown after cash payment) ── */}
      <Modal
        opened={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title={<Text fw={700} size="sm">Payment confirmed</Text>}
        radius="xl" size="sm" centered
      >
        {receipt && (
          <Stack gap="md">
            {/* Success header */}
            <div style={{ background: 'linear-gradient(135deg,#052e16,#14532d)', borderRadius: 14, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '2px solid rgba(74,222,128,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckmarkCircle01Icon size={22} color="#4ade80" />
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {receipt.currency} {receipt.amount.toLocaleString('fr-CM')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>
                  Payment recorded · {receipt.provider === 'cash' ? 'Cash' : receipt.provider}
                </div>
              </div>
            </div>

            {/* Details */}
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Receipt no.', value: receipt.receipt_no },
                { label: 'Member',      value: receipt.member_name },
                { label: 'Plan',        value: receipt.plan_name },
                { label: 'Active until', value: new Date(receipt.expires_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Gym',         value: receipt.gym_name },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text size="xs" c="dimmed">{row.label}</Text>
                  <Text size="xs" fw={600}>{row.value}</Text>
                </div>
              ))}
            </div>

            {/* Email status */}
            <Text size="xs" c="dimmed" ta="center">
              {m.email
                ? `Receipt emailed to ${m.email}`
                : 'No email on file — print only'}
            </Text>

            {/* Actions */}
            <Group grow>
              {receipt.thermal_html && (
                <Button
                  variant="light" color="gray" size="sm" radius="md"
                  leftSection={<PrinterIcon size={14} />}
                  onClick={printReceipt}
                >
                  Print receipt
                </Button>
              )}
              {m.email && (
                <Button
                  variant="light" color="indigo" size="sm" radius="md"
                  leftSection={<SentIcon size={14} />}
                  loading={resendingReceipt}
                  onClick={resendReceipt}
                >
                  Resend email
                </Button>
              )}
            </Group>

            <Button variant="subtle" color="gray" size="xs" onClick={() => setReceiptOpen(false)}>
              Close
            </Button>
          </Stack>
        )}
      </Modal>

      {/* ── Gap #10: Freeze subscription ── */}
      <Modal
        opened={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        title={<Text fw={700} size="sm">Freeze subscription — {localName}</Text>}
        radius="xl" size="sm" centered
      >
        <Stack gap="md">
          <Text size="sm" style={{ color: '#374151' }}>
            Freezing pauses the membership and extends the expiry date by the same number of days.
            Use this when a member is injured, travelling, or temporarily unavailable.
          </Text>
          <NumberInput
            label="Freeze for how many days?"
            value={freezeDays}
            onChange={setFreezeDays}
            min={1} max={180}
            radius="md" size="sm"
            leftSection={<Clock01Icon size={14} style={{ color: '#9ca3af' }} />}
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setFreezeOpen(false)}>Cancel</Button>
            <Button
              color="orange" size="sm" loading={freezeSaving}
              disabled={!freezeDays || Number(freezeDays) < 1}
              onClick={freezeSubscription}
            >
              Freeze subscription
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Edit member modal ── */}
      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title={<Text fw={700} size="sm">Edit member — {localName}</Text>}
        radius="xl" size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Full name" required
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            leftSection={<User02Icon size={14} style={{ color: '#9ca3af' }} />}
            radius="md" size="sm"
          />
          <TextInput
            label="Phone number" description="Optional"
            value={editForm.phone}
            onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
            leftSection={<SmartPhone01Icon size={14} style={{ color: '#9ca3af' }} />}
            radius="md" size="sm"
          />
          <Textarea
            label="Notes" description="Optional"
            value={editForm.notes}
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
            radius="md" size="sm" autosize minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              size="sm" color="indigo" loading={editSaving}
              disabled={!editForm.name.trim()}
              onClick={saveEdit}
            >
              Save changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── QR code display modal ── */}
      <Modal
        opened={qrOpen}
        onClose={() => setQrOpen(false)}
        title={<Text fw={700} size="sm">QR code — {localName}</Text>}
        radius="xl" size="sm"
        centered
      >
        <Stack gap="md" align="center" py="md">
          <Box style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
            padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <QRCode
              value={m.qr_code}
              size={200}
              bgColor="#ffffff"
              fgColor="#1e1b4b"
              level="M"
              style={{ borderRadius: 8 }}
            />
            <Text
              size="sm" fw={700}
              style={{ fontFamily: 'monospace', letterSpacing: '0.1em', color: '#6b7280' }}
            >
              {m.qr_code}
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              Member scans this code at the gym kiosk to check in.
            </Text>
          </Box>
          <Button
            fullWidth variant="light" color="indigo" size="sm"
            leftSection={<Mail01Icon size={14} />}
            loading={resendingQr}
            onClick={async () => { await resendWelcome(); setQrOpen(false) }}
          >
            Resend QR to {m.email}
          </Button>
        </Stack>
      </Modal>

      {/* ── PIN reveal modal (shown after reset) ── */}
      <Modal
        opened={pinRevealOpen}
        onClose={() => { setPinRevealOpen(false); setNewPin(null) }}
        title={<Text fw={700} size="sm">New PIN for {localName}</Text>}
        radius="xl" size="xs" centered
      >
        <Stack gap="md" align="center" py="sm">
          <Text size="xs" c="dimmed" ta="center">
            Tell this PIN to the member. They can use it at the kiosk instead of their QR code.
          </Text>
          <Box style={{
            background: '#f0f0ff', border: '2px solid #6366f1', borderRadius: 16,
            padding: '20px 32px', textAlign: 'center',
          }}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.1em' }} mb={4}>
              Kiosk PIN
            </Text>
            <Text
              fw={900}
              style={{ fontSize: 42, fontFamily: 'monospace', letterSpacing: '0.35em', color: '#1e1b4b' }}
            >
              {newPin}
            </Text>
          </Box>
          <Text size="xs" c="dimmed" ta="center">
            This is the only time the PIN is shown in full. The member can also find it in their welcome email.
          </Text>
          <Button
            fullWidth color="indigo" size="sm"
            onClick={() => { setPinRevealOpen(false); setNewPin(null) }}
          >
            Done
          </Button>
        </Stack>
      </Modal>

      {/* ── Assign / Change Plan modal (Gap #6: start date) ── */}
      <Modal
        opened={assignOpen}
        onClose={() => { setAssignOpen(false); setAssignPlanId(null); setAssignStartDate('') }}
        title={<Text fw={700} size="sm">{localPlanName ? 'Change plan' : 'Assign plan'} for {localName}</Text>}
        radius="xl" size="sm"
      >
        <Stack gap="md">
          <Select
            label="Membership plan"
            placeholder="Select a plan…"
            value={assignPlanId}
            onChange={setAssignPlanId}
            data={plans.map(p => ({
              value: p.id,
              label: `${p.name} — ₣${parseFloat(p.price).toLocaleString('fr-CM')} / ${p.duration_days}d`,
            }))}
            radius="md" size="sm" searchable
          />
          {/* Gap #6: start date */}
          <Box>
            <Text size="sm" fw={500} mb={4}>Start date</Text>
            <Text size="xs" c="dimmed" mb={6}>Leave blank to start today</Text>
            <input
              type="date"
              value={assignStartDate}
              onChange={e => setAssignStartDate(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid #dee2e6', fontSize: 14, color: '#111827',
                fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
              }}
            />
          </Box>
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              size="sm" color="indigo" loading={assignSaving}
              disabled={!assignPlanId}
              onClick={assignPlan}
            >
              {localPlanName ? 'Change plan' : 'Assign plan'}
            </Button>
          </Group>
        </Stack>
      </Modal>

    </motion.div>
  )
}
