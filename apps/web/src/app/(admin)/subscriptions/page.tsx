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
}

interface Subscription {
  id: string; memberName: string; memberEmail: string
  plan: string; status: 'active' | 'expiring' | 'expired' | 'cancelled'
  startDate: string; endDate: string; amount: number; currency: string
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
  const [newPlan, setNewPlan] = useState({ name: '', price: 0, cycle: 'monthly' })
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Edit plan modal
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [editForm, setEditForm] = useState({ name: '', price: 0, cycle: 'monthly' })
  const [editSaving, setEditSaving] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get<{ plans: Array<{ id: string; name: string; price: string; duration_days: number; subscriber_count: string }> }>('/api/subscriptions/plans')
        .then(d => setPlans((d.plans ?? []).map(p => ({
          id: p.id, name: p.name,
          cycle: p.duration_days <= 31 ? 'monthly' as const : p.duration_days <= 100 ? 'quarterly' as const : 'annual' as const,
          price: parseFloat(p.price ?? '0'), currency: 'XAF',
          members: parseInt(p.subscriber_count ?? '0'),
          duration_days: p.duration_days,
        }))))
        .catch(catchToast('Failed to load plans')),

      api.get<{ subscriptions: Array<{ id: string; member_name: string; member_email: string; plan_name: string; status: string; started_at: string; expires_at: string; price: string }> }>('/api/subscriptions')
        .then(d => setSubscriptions((d.subscriptions ?? []).map(s => ({
          id: s.id, memberName: s.member_name, memberEmail: s.member_email,
          plan: s.plan_name,
          status: (['active','expiring_soon','grace_period'].includes(s.status) ? (s.status === 'expiring_soon' ? 'expiring' : 'active') : s.status === 'cancelled' ? 'cancelled' : 'expired') as Subscription['status'],
          startDate: s.started_at?.slice(0, 10) ?? '',
          endDate: s.expires_at?.slice(0, 10) ?? '',
          amount: parseFloat(s.price ?? '0'), currency: 'XAF',
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
      await api.post('/api/subscriptions/plans', { name: newPlan.name, price: newPlan.price, duration_days: duration })
      showSuccess(`Plan "${newPlan.name}" created`)
      setCreateOpen(false)
      setNewPlan({ name: '', price: 0, cycle: 'monthly' })
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
      })
      showSuccess(`Plan "${editForm.name}" updated`)
      setEditPlan(null)
      fetchData()
    } catch (err) { showError(err instanceof Error ? err.message : 'Failed to update plan') }
    finally { setEditSaving(false) }
  }

  function openEditPlan(plan: Plan) {
    setEditPlan(plan)
    setEditForm({ name: plan.name, price: plan.price, cycle: plan.cycle })
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
    try {
      await api.patch(`/api/subscriptions/${sub.id}`, { extends_days: 30 })
      showSuccess(`${sub.memberName}'s subscription renewed (+30 days)`)
      fetchData()
    } catch (err) { showError(err instanceof Error ? err.message : 'Failed to renew subscription') }
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

      {/* Plans row */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
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
