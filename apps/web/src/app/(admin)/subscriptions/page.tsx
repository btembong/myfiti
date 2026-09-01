'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, Badge, Avatar,
  Button, TextInput, SegmentedControl, Menu, ActionIcon,
  Box, Flex, Divider, Modal, NumberInput, Select, Switch,
} from '@mantine/core'
import {
  CreditCardIcon,
  UserAdd01Icon,
  Search01Icon,
  More01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Alert01Icon,
  ArrowRight01Icon,
  PencilEdit01Icon,
  Refresh01Icon,
  Download01Icon,
  UserGroupIcon,
  Coins01Icon,
  Archive01Icon,
  RepeatIcon,
} from 'hugeicons-react'
import { modals } from '@mantine/modals'
import { api } from '@/lib/api'
import { catchToast, showError, showSuccess } from '@/lib/notifications'
import { PageSkeleton } from '../_components/Skeletons'
import { useSort, usePagination, SortableHeader, PaginationBar } from '../_components/DataTable'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string; name: string; cycle: 'monthly' | 'quarterly' | 'annual'
  price: number; currency: string; members: number; duration_days: number
  access_type: 'open' | 'time_slot'
  access_start_time: string | null
  access_end_time: string | null
}

interface Subscription {
  id: string; memberName: string; memberEmail: string
  plan: string; status: 'active' | 'expiring' | 'expired' | 'cancelled'
  startDate: string; endDate: string; amount: number; currency: string
  duration_days: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active: 'green', expiring: 'yellow', expired: 'red', cancelled: 'gray',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newPlan, setNewPlan] = useState({ name: '', price: 0, cycle: 'monthly', access_type: 'open', access_start_time: '06:00', access_end_time: '22:00' })
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Edit plan modal
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [editForm, setEditForm] = useState({ name: '', price: 0, cycle: 'monthly', access_type: 'open', access_start_time: '06:00', access_end_time: '22:00' })
  const [editSaving, setEditSaving] = useState(false)

  // Vouchers
  interface Voucher { id: string; code: string; value: number; currency: string; status: string; batch_label: string | null; redeemed_by_name: string | null; redeemed_at: string | null; expires_at: string | null; created_at: string }
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [voucherFilter, setVoucherFilter] = useState('active')
  const [voucherTotal, setVoucherTotal] = useState(0)
  const [genOpen, setGenOpen] = useState(false)
  const [genForm, setGenForm] = useState({ count: 1, value: 5000, expires_at: '', batch_label: '' })
  const [genSaving, setGenSaving] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])

  function loadVouchers(status = voucherFilter) {
    api.get<{ vouchers: Voucher[]; total: number }>(`/api/vouchers?status=${status}&limit=50`)
      .then(d => { setVouchers(d.vouchers ?? []); setVoucherTotal(d.total ?? 0) })
      .catch(catchToast('Failed to load vouchers'))
  }

  useEffect(() => { loadVouchers() }, [voucherFilter])

  async function generateVouchers() {
    if (!genForm.value || genForm.value <= 0) { showError('Enter a valid value'); return }
    setGenSaving(true)
    try {
      const body: Record<string, unknown> = { count: genForm.count, value: genForm.value }
      if (genForm.expires_at) body.expires_at = genForm.expires_at
      if (genForm.batch_label.trim()) body.batch_label = genForm.batch_label.trim()
      const res = await api.post<{ codes: string[] }>('/api/vouchers/generate', body)
      setGeneratedCodes(res.codes ?? [])
      loadVouchers('active')
      showSuccess(`${res.codes?.length ?? 0} voucher code(s) generated`)
    } catch (err) { showError(err instanceof Error ? err.message : 'Failed to generate vouchers') }
    finally { setGenSaving(false) }
  }

  function cancelVoucher(v: Voucher) {
    modals.openConfirmModal({
      title: 'Cancel voucher',
      children: `Cancel voucher ${v.code}? This cannot be undone.`,
      labels: { confirm: 'Cancel voucher', cancel: 'Keep' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.patch(`/api/vouchers/${v.id}/cancel`, {})
          showSuccess(`Voucher ${v.code} cancelled`)
          loadVouchers()
        } catch (err) { showError(err instanceof Error ? err.message : 'Failed to cancel voucher') }
      },
    })
  }

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get<{ plans: Array<{ id: string; name: string; price: string; duration_days: number; subscriber_count: string; access_type?: string; access_start_time?: string | null; access_end_time?: string | null }> }>('/api/subscriptions/plans')
        .then(d => setPlans((d.plans ?? []).map(p => ({
          id: p.id, name: p.name,
          cycle: p.duration_days <= 31 ? 'monthly' as const : p.duration_days <= 100 ? 'quarterly' as const : 'annual' as const,
          price: parseFloat(p.price ?? '0'), currency: 'XAF',
          members: parseInt(p.subscriber_count ?? '0'),
          duration_days: p.duration_days,
          access_type: (p.access_type ?? 'open') as 'open' | 'time_slot',
          access_start_time: p.access_start_time ?? null,
          access_end_time: p.access_end_time ?? null,
        }))))
        .catch(catchToast('Failed to load plans')),

      api.get<{ subscriptions: Array<{ id: string; member_name: string; member_email: string; plan_name: string; status: string; started_at: string; expires_at: string; price: string; duration_days: number }> }>('/api/subscriptions')
        .then(d => setSubscriptions((d.subscriptions ?? []).map(s => ({
          id: s.id, memberName: s.member_name, memberEmail: s.member_email,
          plan: s.plan_name,
          status: (['active','expiring_soon','grace_period'].includes(s.status) ? (s.status === 'expiring_soon' ? 'expiring' : 'active') : s.status === 'cancelled' ? 'cancelled' : 'expired') as Subscription['status'],
          startDate: s.started_at?.slice(0, 10) ?? '',
          endDate: s.expires_at?.slice(0, 10) ?? '',
          amount: parseFloat(s.price ?? '0'), currency: 'XAF',
          duration_days: s.duration_days ?? 30,
        }))))
        .catch(catchToast('Failed to load subscriptions')),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function createPlan() {
    if (!newPlan.name || !newPlan.price) return
    setSaving(true)
    try {
      const duration = newPlan.cycle === 'monthly' ? 30 : newPlan.cycle === 'quarterly' ? 90 : 365
      await api.post('/api/subscriptions/plans', {
        name: newPlan.name, price: newPlan.price, duration_days: duration,
        access_type: newPlan.access_type,
        access_start_time: newPlan.access_type === 'time_slot' ? newPlan.access_start_time : null,
        access_end_time:   newPlan.access_type === 'time_slot' ? newPlan.access_end_time   : null,
      })
      showSuccess(`Plan "${newPlan.name}" created`)
      setCreateOpen(false)
      setNewPlan({ name: '', price: 0, cycle: 'monthly', access_type: 'open', access_start_time: '06:00', access_end_time: '22:00' })
      fetchData()
    } catch (err) { showError(err instanceof Error ? err.message : 'Failed to create plan') }
    finally { setSaving(false) }
  }

  async function savePlanEdit() {
    if (!editPlan || !editForm.name || !editForm.price) return
    setEditSaving(true)
    try {
      const duration = editForm.cycle === 'monthly' ? 30 : editForm.cycle === 'quarterly' ? 90 : 365
      await api.patch(`/api/subscriptions/plans/${editPlan.id}`, {
        name: editForm.name, price: editForm.price, duration_days: duration,
        access_type: editForm.access_type,
        access_start_time: editForm.access_type === 'time_slot' ? editForm.access_start_time : null,
        access_end_time:   editForm.access_type === 'time_slot' ? editForm.access_end_time   : null,
      })
      showSuccess(`Plan "${editForm.name}" updated`)
      setEditPlan(null)
      fetchData()
    } catch (err) { showError(err instanceof Error ? err.message : 'Failed to update plan') }
    finally { setEditSaving(false) }
  }

  function openEditPlan(plan: Plan) {
    setEditPlan(plan)
    setEditForm({
      name: plan.name, price: plan.price, cycle: plan.cycle,
      access_type: plan.access_type ?? 'open',
      access_start_time: plan.access_start_time ?? '06:00',
      access_end_time:   plan.access_end_time   ?? '22:00',
    })
  }

  function archivePlan(plan: Plan) {
    modals.openConfirmModal({
      title: 'Archive plan',
      children: `Archive "${plan.name}"? Existing subscriptions won't be affected, but no new subscriptions can use this plan.`,
      labels: { confirm: 'Archive', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/api/subscriptions/plans/${plan.id}`)
          showSuccess(`Plan "${plan.name}" archived`)
          fetchData()
        } catch (err) { showError(err instanceof Error ? err.message : 'Failed to archive plan') }
      },
    })
  }

  function cancelSubscription(sub: Subscription) {
    modals.openConfirmModal({
      title: 'Cancel subscription',
      children: `Cancel ${sub.memberName}'s ${sub.plan} subscription? This cannot be undone.`,
      labels: { confirm: 'Cancel subscription', cancel: 'Keep' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.patch(`/api/subscriptions/${sub.id}`, { status: 'cancelled' })
          showSuccess(`${sub.memberName}'s subscription cancelled`)
          fetchData()
        } catch (err) { showError(err instanceof Error ? err.message : 'Failed to cancel subscription') }
      },
    })
  }

  async function renewSubscription(sub: Subscription) {
    const days = sub.duration_days ?? 30
    try {
      await api.patch(`/api/subscriptions/${sub.id}`, { extends_days: days })
      showSuccess(`${sub.memberName}'s subscription renewed (+${days} days)`)
      fetchData()
    } catch (err) { showError(err instanceof Error ? err.message : 'Failed to renew subscription') }
  }

  // ── Stats computed from loaded data ───────────────────────────────────────
  const stats = {
    active:   subscriptions.filter(s => s.status === 'active').length,
    expiring: subscriptions.filter(s => s.status === 'expiring').length,
    expired:  subscriptions.filter(s => s.status === 'expired').length,
    mrr:      subscriptions.filter(s => s.status === 'active' || s.status === 'expiring').reduce((sum, s) => sum + s.amount, 0),
  }

  const filtered = subscriptions.filter(s => {
    const matchStatus = filter === 'all' || s.status === filter
    const matchSearch = s.memberName.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'endDate', 'desc')
  const { paged, page, totalPages, total, perPage, goTo, changePerPage } = usePagination(sorted)

  if (loading) return <PageSkeleton statCount={3} tableRows={6} tableCols={6} />

  return (
    <Stack gap="lg" p="xl" maw={1400}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Subscriptions
            </Title>
            <Text size="sm" c="dimmed">Manage membership plans and member subscriptions.</Text>
          </Stack>
          <Group gap="sm">
            <Button variant="default" size="sm" leftSection={<Download01Icon size={14} />}>Export</Button>
            <Button size="sm" color="indigo" leftSection={<CreditCardIcon size={14} />}
              onClick={() => setCreateOpen(true)}>
              Create plan
            </Button>
          </Group>
        </Group>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <Group gap="md" grow>
          {[
            { label: 'Active',        value: stats.active,   color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Expiring soon', value: stats.expiring, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
            { label: 'Expired',       value: stats.expired,  color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
            { label: 'MRR (active)',  value: `₣${stats.mrr.toLocaleString('fr-CM')}`, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
          ].map(stat => (
            <Paper key={stat.label} radius="xl" p="md" style={{ background: stat.bg, border: `1px solid ${stat.border}` }}>
              <Text style={{ fontSize: '1.5rem', fontWeight: 900, lineHeight: 1, color: stat.color, letterSpacing: '-0.02em' }}>
                {stat.value}
              </Text>
              <Text size="xs" fw={600} style={{ color: stat.color, opacity: 0.8 }} mt={4}>{stat.label}</Text>
            </Paper>
          ))}
        </Group>
      </motion.div>

      {/* Plans row */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Stack gap="sm">
          <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
            Membership plans
          </Text>
          <Group gap="md" wrap="wrap">
            {plans.length > 0 ? plans.map(plan => (
              <Paper key={plan.id} radius="xl" p="lg" withBorder
                style={{ borderColor: '#edeef4', minWidth: 200, flex: '1 1 200px', maxWidth: 260 }}>
                <Group justify="space-between" mb="sm">
                  <Badge size="xs" color="indigo" variant="light">{plan.cycle}</Badge>
                  <Group gap={4}>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => openEditPlan(plan)}>
                      <PencilEdit01Icon size={12} />
                    </ActionIcon>
                    <ActionIcon size="xs" variant="subtle" color="red" onClick={() => archivePlan(plan)}>
                      <Archive01Icon size={12} />
                    </ActionIcon>
                  </Group>
                </Group>
                <Text fw={800} size="sm" style={{ color: '#111827' }}>{plan.name}</Text>
                <Text style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1.1, color: '#111827', letterSpacing: '-0.02em' }} mt={4}>
                  ₣{plan.price.toLocaleString('fr-CM')}
                </Text>
                <Text size="xs" c="dimmed" mb="sm">per {plan.cycle === 'monthly' ? 'month' : plan.cycle === 'quarterly' ? 'quarter' : 'year'}</Text>
                {plan.access_type === 'time_slot' && plan.access_start_time && plan.access_end_time && (
                  <Badge size="xs" color="violet" variant="light" mb="xs">
                    {plan.access_start_time.slice(0, 5)} – {plan.access_end_time.slice(0, 5)}
                  </Badge>
                )}
                <Divider mb="sm" />
                <Group gap="xs">
                  <UserGroupIcon size={13} style={{ color: '#9ca3af' }} />
                  <Text size="xs" c="dimmed">{plan.members} members</Text>
                </Group>
              </Paper>
            )) : (
              <Paper radius="xl" p="lg" withBorder
                style={{ borderColor: '#edeef4', borderStyle: 'dashed', minWidth: 200, cursor: 'pointer' }}
                onClick={() => setCreateOpen(true)}>
                <Flex direction="column" align="center" gap="xs" py="sm">
                  <CreditCardIcon size={22} style={{ color: '#d1d5db' }} />
                  <Text size="xs" fw={600} style={{ color: '#9ca3af' }}>No plans yet</Text>
                  <Text size="xs" c="dimmed" ta="center">Click to create your first membership plan</Text>
                </Flex>
              </Paper>
            )}

            {/* Add plan card */}
            {plans.length > 0 && (
              <Paper radius="xl" p="lg" withBorder
                style={{ borderColor: '#edeef4', borderStyle: 'dashed', minWidth: 160, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setCreateOpen(true)}>
                <Stack align="center" gap={4}>
                  <Text size="xl" fw={300} style={{ color: '#d1d5db', lineHeight: 1 }}>+</Text>
                  <Text size="xs" c="dimmed">Add plan</Text>
                </Stack>
              </Paper>
            )}
          </Group>
        </Stack>
      </motion.div>

      {/* Subscriptions table */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>

          {/* Table header */}
          <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid #f4f5f9' }}>
            <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
              All subscriptions
            </Text>
            <Group gap="sm">
              <TextInput
                size="xs" radius="md" placeholder="Search member…"
                value={search} onChange={e => setSearch(e.target.value)}
                leftSection={<Search01Icon size={13} style={{ color: '#9ca3af' }} />}
                style={{ width: 200 }}
              />
              <SegmentedControl
                size="xs" radius="xl" value={filter} onChange={setFilter}
                data={[
                  { label: 'All', value: 'all' },
                  { label: 'Active', value: 'active' },
                  { label: 'Expiring', value: 'expiring' },
                  { label: 'Expired', value: 'expired' },
                ]}
                styles={{ root: { background: '#f4f5f9' }, label: { fontWeight: 600 } }}
              />
            </Group>
          </Group>

          {/* Column headers */}
          <Group px="lg" py={8} style={{ borderBottom: '1px solid #f9fafb' }}>
            <Box style={{ flex: 1 }}><SortableHeader label="Member" sortKey="memberName" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Subscription)} /></Box>
            <Box style={{ width: 120 }}><SortableHeader label="Plan" sortKey="plan" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Subscription)} /></Box>
            <Box style={{ width: 90 }}><SortableHeader label="Status" sortKey="status" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Subscription)} /></Box>
            <Box style={{ width: 100 }}><SortableHeader label="Started" sortKey="startDate" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Subscription)} /></Box>
            <Box style={{ width: 100 }}><SortableHeader label="Expires" sortKey="endDate" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Subscription)} /></Box>
            <Box style={{ width: 90 }}><SortableHeader label="Amount" sortKey="amount" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Subscription)} /></Box>
            <Box style={{ width: 32 }} />
          </Group>

          {/* Rows */}
          {paged.length > 0 ? (
            <Stack gap={0}>
              {paged.map((sub) => (
                <Group key={sub.id} px="lg" py="sm"
                  style={{ borderBottom: '1px solid #f9fafb', transition: 'background 0.1s', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                    <Avatar size={28} radius="xl" color="indigo" variant="filled" fz={10} fw={700}>
                      {initials(sub.memberName)}
                    </Avatar>
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="xs" fw={600} style={{ color: '#111827' }} truncate>{sub.memberName}</Text>
                      <Text size="xs" c="dimmed" truncate>{sub.memberEmail}</Text>
                    </Stack>
                  </Group>
                  <Box style={{ width: 120 }}>
                    <Text size="xs" fw={600} style={{ color: '#374151' }}>{sub.plan}</Text>
                  </Box>
                  <Box style={{ width: 90 }}>
                    <Badge size="xs" radius="xl" variant="light" color={STATUS_COLOR[sub.status] ?? 'gray'}>
                      {sub.status}
                    </Badge>
                  </Box>
                  <Box style={{ width: 100 }}>
                    <Text size="xs" c="dimmed">{sub.startDate}</Text>
                  </Box>
                  <Box style={{ width: 100 }}>
                    <Text size="xs" c="dimmed">{sub.endDate}</Text>
                  </Box>
                  <Box style={{ width: 90 }}>
                    <Text size="xs" fw={600} style={{ color: '#111827' }}>
                      ₣{sub.amount.toLocaleString('fr-CM')}
                    </Text>
                  </Box>
                  <Box style={{ width: 32 }}>
                    <Menu shadow="lg" radius="lg" width={160} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon size="sm" variant="subtle" color="gray">
                          <More01Icon size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<RepeatIcon size={13} />}
                          onClick={() => renewSubscription(sub)}
                        >
                          Renew (+30 days)
                        </Menu.Item>
                        <Divider />
                        <Menu.Item
                          leftSection={<Cancel01Icon size={13} />}
                          color="red"
                          onClick={() => cancelSubscription(sub)}
                          disabled={sub.status === 'cancelled'}
                        >
                          Cancel
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Box>
                </Group>
              ))}
            </Stack>
          ) : (
            <Flex direction="column" align="center" justify="center" gap="sm" py="xl">
              <CreditCardIcon size={28} style={{ color: '#e5e7eb' }} />
              <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>
                {search || filter !== 'all' ? 'No subscriptions match your filter' : 'No subscriptions yet'}
              </Text>
              {!search && filter === 'all' && (
                <Text size="xs" c="dimmed">Add members and assign plans to see subscriptions here.</Text>
              )}
            </Flex>
          )}

          {total > 0 && (
            <PaginationBar
              page={page} totalPages={totalPages} total={total}
              perPage={perPage} onPageChange={goTo} onPerPageChange={changePerPage}
            />
          )}
        </Paper>
      </motion.div>

      {/* Vouchers section */}
      <motion.div variants={fade} custom={4} initial="hidden" animate="show">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
                Vouchers
              </Text>
              <Text size="xs" c="dimmed">Generate scratch-card codes members redeem to top up their wallet.</Text>
            </Stack>
            <Button size="xs" color="indigo" leftSection={<Coins01Icon size={13} />} onClick={() => { setGeneratedCodes([]); setGenOpen(true) }}>
              Generate codes
            </Button>
          </Group>

          <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
            <Group px="lg" py="sm" style={{ borderBottom: '1px solid #f4f5f9' }} gap="xs">
              {['active', 'redeemed', 'cancelled'].map(s => (
                <Button
                  key={s} size="xs" radius="xl"
                  variant={voucherFilter === s ? 'filled' : 'subtle'}
                  color={voucherFilter === s ? 'indigo' : 'gray'}
                  onClick={() => setVoucherFilter(s)}
                  styles={{ root: { textTransform: 'capitalize' } }}
                >
                  {s}
                </Button>
              ))}
              <Text size="xs" c="dimmed" ml="auto">{voucherTotal} total</Text>
            </Group>

            {vouchers.length === 0 ? (
              <Flex direction="column" align="center" justify="center" gap="sm" py="xl">
                <Coins01Icon size={28} style={{ color: '#e5e7eb' }} />
                <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>No {voucherFilter} vouchers</Text>
              </Flex>
            ) : (
              <Stack gap={0}>
                {vouchers.map(v => (
                  <Group key={v.id} px="lg" py="sm" style={{ borderBottom: '1px solid #f9fafb' }} justify="space-between">
                    <Group gap="sm">
                      <Text size="sm" fw={700} style={{ fontFamily: 'monospace', color: '#111827', letterSpacing: '0.05em' }}>{v.code}</Text>
                      {v.batch_label && <Badge size="xs" color="gray" variant="light">{v.batch_label}</Badge>}
                    </Group>
                    <Group gap="lg">
                      <Text size="sm" fw={700} style={{ color: '#111827' }}>₣{Number(v.value).toLocaleString('fr-CM')}</Text>
                      <Badge size="xs" color={v.status === 'active' ? 'green' : v.status === 'redeemed' ? 'blue' : 'red'} variant="light">
                        {v.status}
                      </Badge>
                      {v.redeemed_by_name && (
                        <Text size="xs" c="dimmed">by {v.redeemed_by_name}</Text>
                      )}
                      {v.expires_at && (
                        <Text size="xs" c="dimmed">exp {new Date(v.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</Text>
                      )}
                      {v.status === 'active' && (
                        <ActionIcon size="xs" variant="subtle" color="red" onClick={() => cancelVoucher(v)}>
                          <Cancel01Icon size={12} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </motion.div>

      {/* Generate vouchers modal */}
      <Modal
        opened={genOpen} onClose={() => setGenOpen(false)}
        title={<Text fw={700} size="sm">Generate voucher codes</Text>}
        radius="xl" size="sm"
      >
        <Stack gap="md">
          {generatedCodes.length > 0 ? (
            <>
              <Text size="sm" fw={600} style={{ color: '#10b981' }}>
                {generatedCodes.length} code{generatedCodes.length > 1 ? 's' : ''} generated — print or share these:
              </Text>
              <Paper radius="md" p="md" style={{ background: '#f9fafb', border: '1px solid #edeef4' }}>
                <Stack gap={4}>
                  {generatedCodes.map(c => (
                    <Text key={c} size="sm" fw={700} style={{ fontFamily: 'monospace', letterSpacing: '0.08em', color: '#111827' }}>{c}</Text>
                  ))}
                </Stack>
              </Paper>
              <Button fullWidth variant="default" size="sm" onClick={() => { setGenOpen(false); setGeneratedCodes([]) }}>Done</Button>
            </>
          ) : (
            <>
              <NumberInput
                label="Number of codes" min={1} max={200}
                value={genForm.count} onChange={v => setGenForm(f => ({ ...f, count: Number(v) }))}
                radius="md" size="sm"
              />
              <NumberInput
                label="Value per code (XAF)" min={100}
                value={genForm.value} onChange={v => setGenForm(f => ({ ...f, value: Number(v) }))}
                leftSection={<Text size="xs" c="dimmed">₣</Text>}
                radius="md" size="sm"
              />
              <TextInput
                label="Batch label (optional)" placeholder="August promo"
                value={genForm.batch_label} onChange={e => setGenForm(f => ({ ...f, batch_label: e.target.value }))}
                radius="md" size="sm"
              />
              <TextInput
                label="Expires on (optional)" type="date"
                value={genForm.expires_at} onChange={e => setGenForm(f => ({ ...f, expires_at: e.target.value }))}
                radius="md" size="sm"
              />
              <Group justify="flex-end" mt="xs">
                <Button variant="default" size="sm" onClick={() => setGenOpen(false)}>Cancel</Button>
                <Button size="sm" color="indigo" loading={genSaving} onClick={generateVouchers}>
                  Generate
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {/* Create plan modal */}
      <Modal
        opened={createOpen} onClose={() => setCreateOpen(false)}
        title={<Text fw={700} size="sm">Create membership plan</Text>}
        radius="xl" size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Plan name" placeholder="Monthly membership"
            value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))}
            radius="md" size="sm"
          />
          <NumberInput
            label="Price (XAF)" placeholder="15000"
            value={newPlan.price} onChange={v => setNewPlan(p => ({ ...p, price: Number(v) }))}
            leftSection={<Text size="xs" c="dimmed">₣</Text>}
            radius="md" size="sm" min={0}
          />
          <Select
            label="Billing cycle"
            value={newPlan.cycle}
            onChange={v => setNewPlan(p => ({ ...p, cycle: v ?? 'monthly' }))}
            data={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly (every 3 months)' },
              { value: 'annual', label: 'Annual (yearly)' },
            ]}
            radius="md" size="sm"
          />
          <Switch
            label="Restrict access to time window"
            description="Members on this plan can only check in during the set hours."
            checked={newPlan.access_type === 'time_slot'}
            onChange={e => setNewPlan(p => ({ ...p, access_type: e.currentTarget.checked ? 'time_slot' : 'open' }))}
            size="sm"
          />
          {newPlan.access_type === 'time_slot' && (
            <Group grow gap="sm">
              <TextInput
                label="Start time" type="time"
                value={newPlan.access_start_time}
                onChange={e => setNewPlan(p => ({ ...p, access_start_time: e.target.value }))}
                radius="md" size="sm"
              />
              <TextInput
                label="End time" type="time"
                value={newPlan.access_end_time}
                onChange={e => setNewPlan(p => ({ ...p, access_end_time: e.target.value }))}
                radius="md" size="sm"
              />
            </Group>
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" color="indigo" loading={saving} leftSection={<CheckmarkCircle01Icon size={14} />}
              onClick={createPlan}>
              Create plan
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit plan modal */}
      <Modal
        opened={!!editPlan} onClose={() => setEditPlan(null)}
        title={<Text fw={700} size="sm">Edit plan</Text>}
        radius="xl" size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Plan name"
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            radius="md" size="sm"
          />
          <NumberInput
            label="Price (XAF)"
            value={editForm.price}
            onChange={v => setEditForm(f => ({ ...f, price: Number(v) }))}
            leftSection={<Text size="xs" c="dimmed">₣</Text>}
            radius="md" size="sm" min={0}
          />
          <Select
            label="Billing cycle"
            value={editForm.cycle}
            onChange={v => setEditForm(f => ({ ...f, cycle: v ?? 'monthly' }))}
            data={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly (every 3 months)' },
              { value: 'annual', label: 'Annual (yearly)' },
            ]}
            radius="md" size="sm"
          />
          <Switch
            label="Restrict access to time window"
            description="Members on this plan can only check in during the set hours."
            checked={editForm.access_type === 'time_slot'}
            onChange={e => setEditForm(f => ({ ...f, access_type: e.currentTarget.checked ? 'time_slot' : 'open' }))}
            size="sm"
          />
          {editForm.access_type === 'time_slot' && (
            <Group grow gap="sm">
              <TextInput
                label="Start time" type="time"
                value={editForm.access_start_time}
                onChange={e => setEditForm(f => ({ ...f, access_start_time: e.target.value }))}
                radius="md" size="sm"
              />
              <TextInput
                label="End time" type="time"
                value={editForm.access_end_time}
                onChange={e => setEditForm(f => ({ ...f, access_end_time: e.target.value }))}
                radius="md" size="sm"
              />
            </Group>
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={() => setEditPlan(null)}>Cancel</Button>
            <Button size="sm" color="indigo" loading={editSaving} onClick={savePlanEdit}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </Modal>

    </Stack>
  )
}
