'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, Badge, Avatar,
  Button, TextInput, SegmentedControl, Alert, Menu,
  ActionIcon, ThemeIcon, SimpleGrid, Divider, Box,
  Modal, Textarea, Checkbox, Tooltip,
} from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import {
  UserGroupIcon,
  UserAdd01Icon,
  Search01Icon,
  More01Icon,
  Mail01Icon,
  SmartPhone01Icon,
  Calendar01Icon,
  CrownIcon,
  Shield01Icon,
  Clock01Icon,
  UserBlock01Icon,
  Loading01Icon,
  Refresh01Icon,
  Alert01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Dumbbell01Icon,
  PencilEdit01Icon,
  Upload04Icon,
  Link01Icon,
  Delete01Icon,
  Wallet01Icon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { showError, showSuccess } from '@/lib/notifications'
import { useSort, usePagination, SortableHeader, PaginationBar } from '../_components/DataTable'
import { AddMemberDrawer } from './_components/AddMemberDrawer'
import { ImportCsvDrawer } from './_components/ImportCsvDrawer'
import { MemberDetailPanel } from './_components/MemberDetailPanel'
import { useRightPanel } from '../_components/RightPanelContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string
  name: string
  email: string
  phone: string | null
  status: 'active' | 'inactive' | 'suspended'
  qr_code: string
  avatar_url: string | null
  notes: string | null
  joined_at: string
  created_at: string
  sub_status: 'active' | 'expiring_soon' | 'expired' | 'cancelled' | 'frozen' | null
  expires_at: string | null
  plan_name: string | null
  plan_price: number | null
  plan_currency: string | null
  pin: string | null
  payment_status: 'pending_payment' | 'completed' | null
  payment_method: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(_name: string) {
  return 'indigo'
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

// ─── Status badges ────────────────────────────────────────────────────────────

function MemberStatusBadge({ status }: { status: Member['status'] }) {
  const map = {
    active:    { color: 'teal',  label: 'Active' },
    inactive:  { color: 'gray',  label: 'Inactive' },
    suspended: { color: 'red',   label: 'Suspended' },
  } as const
  const s = map[status] ?? map.inactive
  return <Badge size="sm" color={s.color} variant="light" radius="xl">{s.label}</Badge>
}

function SubBadge({ sub, expires }: { sub: Member['sub_status']; expires: string | null }) {
  if (!sub) return <Text size="xs" c="dimmed">No plan</Text>
  if (sub === 'active' && expires) {
    const days = daysUntil(expires)
    if (days <= 7) return (
      <Badge size="sm" color="yellow" variant="light" radius="xl"
        leftSection={<Clock01Icon size={9} />}>{days}d left</Badge>
    )
    return (
      <Badge size="sm" color="teal" variant="light" radius="xl"
        leftSection={<CheckmarkCircle01Icon size={9} />}>Active</Badge>
    )
  }
  if (sub === 'expired') return (
    <Badge size="sm" color="red" variant="light" radius="xl"
      leftSection={<Cancel01Icon size={9} />}>Expired</Badge>
  )
  return <Badge size="sm" color="gray" variant="light" radius="xl">{sub}</Badge>
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: {
  label: string; value: number
  icon: (props: { size?: number; style?: React.CSSProperties }) => React.ReactElement | null
}) {
  return (
    <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
      <Group justify="space-between" mb="md">
        <Icon size={18} style={{ color: '#6b7280' }} />
      </Group>
      <Text style={{ fontSize: '2rem', fontWeight: 900, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value.toLocaleString()}
      </Text>
      <Text size="sm" fw={600} mt="xs" style={{ color: '#374151' }}>{label}</Text>
    </Paper>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ search, onAdd }: { search: string; onAdd: () => void }) {
  return (
    <Stack align="center" py={80} px="xl" gap="sm">
      <ThemeIcon size={64} radius="xl" color="gray" variant="light">
        {search ? <Search01Icon size={28} /> : <Dumbbell01Icon size={28} />}
      </ThemeIcon>
      <Text fw={700} size="lg" style={{ color: '#1e1b4b' }}>
        {search ? 'No members found' : 'No members yet'}
      </Text>
      <Text size="sm" c="dimmed" ta="center" maw={300}>
        {search
          ? `No results for "${search}". Try a different name, email or phone.`
          : 'Add your first member to start managing your gym community.'}
      </Text>
      {!search && (
        <Button
          onClick={onAdd}
          variant="filled"
          color="indigo"
          size="sm"
          leftSection={<UserAdd01Icon size={14} />}
          mt="xs"
        >
          Add first member
        </Button>
      )}
    </Stack>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending',  label: 'Pending payment' },
  { value: 'expiring', label: 'Expiring soon' },
]

const GRID = '40px 2.5fr 1.8fr 1.2fr 1.4fr 1.2fr 1fr 44px'

export default function MembersPage() {
  const { open: openPanel } = useRightPanel()
  const clipboard = useClipboard({ timeout: 2000 })
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkEmailing, setBulkEmailing] = useState(false)
  const [bulkRemoving, setBulkRemoving] = useState(false)

  // Email modal
  const [emailTarget, setEmailTarget] = useState<Member | null>(null)
  const [emailForm, setEmailForm]     = useState({ subject: '', body: '' })
  const [emailSending, setEmailSending] = useState(false)

  // Edit modal
  const [editTarget, setEditTarget]   = useState<Member | null>(null)
  const [editForm, setEditForm]       = useState({ name: '', phone: '', notes: '' })
  const [editSaving, setEditSaving]   = useState(false)

  // Bulk email modal
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false)
  const [bulkEmailForm, setBulkEmailForm] = useState({ subject: '', body: '' })

  // Quick payment confirmation modal
  const [paymentTarget, setPaymentTarget] = useState<Member | null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', provider: 'cash', notes: '' })
  const [paymentSaving, setPaymentSaving] = useState(false)

  function getJoinLink() {
    const slug = typeof window !== 'undefined' ? localStorage.getItem('myfiti_tenant') : null
    return slug ? `${window.location.origin}/join/${slug}` : null
  }

  function copyJoinLink() {
    const link = getJoinLink()
    if (link) {
      clipboard.copy(link)
      showSuccess('Join link copied to clipboard')
    } else {
      showError('Tenant slug not found')
    }
  }

  async function sendEmail() {
    if (!emailTarget) return
    setEmailSending(true)
    try {
      await api.post(`/api/members/${emailTarget.id}/email`, emailForm)
      showSuccess(`Email sent to ${emailTarget.name}`)
      setEmailTarget(null)
      setEmailForm({ subject: '', body: '' })
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setEmailSending(false)
    }
  }

  async function saveEdit() {
    if (!editTarget) return
    setEditSaving(true)
    try {
      await api.patch(`/api/members/${editTarget.id}`, {
        name:  editForm.name  || undefined,
        phone: editForm.phone || undefined,
        notes: editForm.notes,
      })
      showSuccess('Member updated')
      setEditTarget(null)
      fetchMembers()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update member')
    } finally {
      setEditSaving(false)
    }
  }

  async function sendBulkEmail() {
    if (!bulkEmailForm.subject.trim() || !bulkEmailForm.body.trim()) return
    setBulkEmailing(true)
    try {
      const ids = Array.from(selectedIds)
      await Promise.all(ids.map(id => api.post(`/api/members/${id}/email`, bulkEmailForm)))
      showSuccess(`Email sent to ${ids.length} member${ids.length !== 1 ? 's' : ''}`)
      setBulkEmailOpen(false)
      setBulkEmailForm({ subject: '', body: '' })
      setSelectedIds(new Set())
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to send bulk email')
    } finally {
      setBulkEmailing(false)
    }
  }

  async function confirmPayment() {
    if (!paymentTarget) return
    const amount = Number(paymentForm.amount)
    if (!amount || amount <= 0) { showError('Enter a valid amount'); return }
    setPaymentSaving(true)
    try {
      await api.post('/api/payments', {
        member_id: paymentTarget.id,
        amount,
        currency: paymentTarget.plan_currency ?? 'XAF',
        provider: paymentForm.provider,
        notes: paymentForm.notes.trim() || null,
        payment_type: 'subscription',
      })
      showSuccess(`Payment recorded for ${paymentTarget.name}`)
      setPaymentTarget(null)
      setPaymentForm({ amount: '', provider: 'cash', notes: '' })
      fetchMembers()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setPaymentSaving(false)
    }
  }

  function bulkRemove() {
    const count = selectedIds.size
    modals.openConfirmModal({
      title: `Remove ${count} member${count !== 1 ? 's' : ''}`,
      children: `Are you sure? This will deactivate ${count} account${count !== 1 ? 's' : ''} and cancel any active subscriptions.`,
      labels: { confirm: 'Remove all', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setBulkRemoving(true)
        try {
          await Promise.all(Array.from(selectedIds).map(id => api.delete(`/api/members/${id}`)))
          showSuccess(`${count} member${count !== 1 ? 's' : ''} removed`)
          setSelectedIds(new Set())
          fetchMembers()
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Failed to remove members')
        } finally {
          setBulkRemoving(false)
        }
      },
    })
  }

  function viewMember(m: Member) {
    openPanel(m.name, <MemberDetailPanel member={m} />)
  }

  function removeMember(m: Member) {
    modals.openConfirmModal({
      title: 'Remove member',
      children: `Are you sure you want to remove ${m.name}? This will deactivate their account and cancel any active subscriptions.`,
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/api/members/${m.id}`)
          showSuccess(`${m.name} removed`)
          fetchMembers()
        } catch (err) { showError(err instanceof Error ? err.message : 'Failed to remove member') }
      },
    })
  }

  const fetchMembers = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (statusTab !== 'all' && statusTab !== 'expiring' && statusTab !== 'pending') qs.set('status', statusTab)
      const res = await fetch(`/api/members?${qs}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to load members.'); return }
      let list: Member[] = data.members ?? []
      if (statusTab === 'expiring') {
        list = list.filter(m => m.expires_at && daysUntil(m.expires_at) <= 7 && m.sub_status === 'active')
      }
      if (statusTab === 'pending') {
        list = list.filter(m => m.payment_status === 'pending_payment')
      }
      setMembers(list)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [search, statusTab])

  useEffect(() => {
    const t = setTimeout(fetchMembers, search ? 350 : 0)
    return () => clearTimeout(t)
  }, [fetchMembers, search])

  const active   = members.filter(m => m.status === 'active')
  const expiring = members.filter(m => m.expires_at && daysUntil(m.expires_at) <= 7 && m.sub_status === 'active')
  const inactive = members.filter(m => m.status !== 'active')
  const pending = members.filter(m => m.payment_status === 'pending_payment')

  const { sorted, sortKey, sortDir, toggleSort } = useSort(members, 'name', 'asc')
  const { paged, page, totalPages, total, perPage, goTo, changePerPage } = usePagination(sorted)

  const allPageSelected = paged.length > 0 && paged.every(m => selectedIds.has(m.id))
  const someSelected = selectedIds.size > 0

  function toggleSelectAll() {
    if (allPageSelected) {
      const next = new Set(selectedIds)
      paged.forEach(m => next.delete(m.id))
      setSelectedIds(next)
    } else {
      const next = new Set(selectedIds)
      paged.forEach(m => next.add(m.id))
      setSelectedIds(next)
    }
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  return (
    <>
      <Stack gap="lg" p="xl" maw={1400}>

        {/* ── Page header ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Group justify="space-between" align="flex-end" pb="lg"
            style={{ borderBottom: '1px solid #edeef4' }}>
            <Stack gap={4}>
              <Text size="xs" fw={600} style={{ color: '#9ca3af' }}>
                {loading ? 'Loading…' : `${members.length.toLocaleString()} member${members.length !== 1 ? 's' : ''}`}
              </Text>
              <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Members
              </Title>
              <Text size="sm" c="dimmed">Manage your gym members and their subscriptions.</Text>
            </Stack>
            <Group gap="sm">
              <ActionIcon
                variant="default"
                size="lg"
                radius="md"
                onClick={fetchMembers}
                loading={loading}
              >
                <Refresh01Icon size={16} style={{ color: '#6b7280' }} />
              </ActionIcon>
              <Tooltip label={clipboard.copied ? 'Copied!' : 'Copy member join link'} withArrow>
                <Button
                  onClick={copyJoinLink}
                  variant="default"
                  size="sm"
                  color={clipboard.copied ? 'teal' : undefined}
                  leftSection={<Link01Icon size={15} style={{ color: clipboard.copied ? undefined : '#6b7280' }} />}
                >
                  {clipboard.copied ? 'Copied!' : 'Join link'}
                </Button>
              </Tooltip>
              <Button
                onClick={() => setImportOpen(true)}
                variant="default"
                size="sm"
                leftSection={<Upload04Icon size={15} style={{ color: '#6b7280' }} />}
              >
                Import CSV
              </Button>
              <Button
                onClick={() => setDrawerOpen(true)}
                variant="filled"
                color="indigo"
                size="sm"
                leftSection={<UserAdd01Icon size={15} />}
              >
                Add member
              </Button>
            </Group>
          </Group>
        </motion.div>

        {/* ── Stat cards ── */}
        <SimpleGrid cols={{ base: 2, xl: 5 }} spacing="md">
          {[
            { label: 'Total members', value: members.length,  icon: UserGroupIcon },
            { label: 'Active',         value: active.length,   icon: CheckmarkCircle01Icon },
            { label: 'Pending payment', value: pending.length, icon: Clock01Icon },
            { label: 'Expiring soon',  value: expiring.length, icon: Clock01Icon },
            { label: 'Inactive',       value: inactive.length, icon: UserBlock01Icon },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}>
              <StatCard {...s} />
            </motion.div>
          ))}
        </SimpleGrid>

        {/* ── Search + filter ── */}
        <Group gap="md" align="center" wrap="wrap">
          <TextInput
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftSection={<Search01Icon size={14} style={{ color: '#9ca3af' }} />}
            radius="md"
            size="sm"
            style={{ flex: '1 1 260px', maxWidth: 360 }}
          />
          <SegmentedControl
            size="xs"
            radius="xl"
            value={statusTab}
            onChange={setStatusTab}
            data={STATUS_TABS}
            styles={{
              root: { background: '#f4f5f9', border: '1px solid #edeef4' },
              indicator: { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
              label: { fontWeight: 600 },
            }}
          />
        </Group>

        {/* ── Error ── */}
        {error && (
          <Alert
            icon={<Alert01Icon size={16} />}
            color="red"
            variant="light"
            radius="lg"
            title="Error loading members"
          >
            {error}
          </Alert>
        )}

        {/* ── Table ── */}
        <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>

          {/* Header row */}
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              padding: '10px 20px',
              background: '#fafafa',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <Checkbox
              checked={allPageSelected}
              indeterminate={someSelected && !allPageSelected}
              onChange={toggleSelectAll}
              size="xs"
            />
            <SortableHeader label="Member" sortKey="name" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Member)} />
            <SortableHeader label="Email" sortKey="email" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Member)} />
            <Text size="xs" fw={700} style={{ color: '#9ca3af' }}>Phone</Text>
            <SortableHeader label="Plan / Sub" sortKey="plan_name" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Member)} />
            <SortableHeader label="Status" sortKey="status" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Member)} />
            <SortableHeader label="Joined" sortKey="joined_at" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof Member)} />
            <Text size="xs" fw={700} style={{ color: '#9ca3af' }}></Text>
          </Box>

          {/* Body */}
          {loading ? (
            <Stack align="center" py={80} gap="sm">
              <Loading01Icon size={24} style={{ color: '#9ca3af' }} />
              <Text size="sm" c="dimmed">Loading members…</Text>
            </Stack>
          ) : members.length === 0 ? (
            <EmptyState search={search} onAdd={() => setDrawerOpen(true)} />
          ) : (
            <AnimatePresence initial={false}>
              {paged.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.2 }}
                  onClick={() => viewMember(m)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: GRID,
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: i < members.length - 1 ? '1px solid #f9fafb' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    background: selectedIds.has(m.id) ? '#f5f3ff' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!selectedIds.has(m.id)) (e.currentTarget as HTMLElement).style.background = '#fafafa'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = selectedIds.has(m.id) ? '#f5f3ff' : 'transparent'
                  }}
                >
                  {/* Checkbox */}
                  <div onClick={e => toggleSelect(m.id, e)}>
                    <Checkbox
                      checked={selectedIds.has(m.id)}
                      onChange={() => {}}
                      size="xs"
                    />
                  </div>

                  {/* Avatar + name */}
                  <Group gap="sm" style={{ minWidth: 0 }}>
                    <Avatar
                      size={34}
                      radius="xl"
                      color={avatarColor(m.name)}
                      variant="light"
                      style={{ flexShrink: 0 }}
                    >
                      {initials(m.name)}
                    </Avatar>
                    <Stack gap={1} style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate style={{ color: '#111827' }}>{m.name}</Text>
                      {m.qr_code && (
                        <Text size="xs" ff="monospace" truncate style={{ color: '#d1d5db' }}>{m.qr_code}</Text>
                      )}
                    </Stack>
                  </Group>

                  {/* Email */}
                  <Group gap={6} style={{ minWidth: 0 }}>
                    <Mail01Icon size={11} style={{ color: '#d1d5db', flexShrink: 0 }} />
                    <Text size="sm" truncate style={{ color: '#6b7280' }}>{m.email}</Text>
                  </Group>

                  {/* Phone */}
                  <Group gap={6}>
                    {m.phone
                      ? <><SmartPhone01Icon size={11} style={{ color: '#d1d5db' }} /><Text size="sm" style={{ color: '#6b7280' }}>{m.phone}</Text></>
                      : <Text size="sm" style={{ color: '#d1d5db' }}>—</Text>}
                  </Group>

                  {/* Plan + sub */}
                  <Stack gap={4}>
                    {m.plan_name
                      ? <Group gap={4}><CrownIcon size={11} style={{ color: '#6366f1' }} /><Text size="xs" fw={700} style={{ color: '#4f46e5' }}>{m.plan_name}</Text></Group>
                      : <Text size="xs" style={{ color: '#d1d5db' }}>No plan</Text>}
                    <SubBadge sub={m.sub_status} expires={m.expires_at} />
                  </Stack>

                  {/* Status */}
                  <div><MemberStatusBadge status={m.status} /></div>

                  {/* Joined */}
                  <Group gap={6}>
                    <Calendar01Icon size={11} style={{ color: '#d1d5db' }} />
                    <Text size="xs" style={{ color: '#9ca3af' }}>{formatDate(m.joined_at ?? m.created_at)}</Text>
                  </Group>

                  {/* Row action menu */}
                  <div onClick={e => e.stopPropagation()}>
                    <Menu shadow="lg" radius="lg" width={180} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          radius="md"
                          style={{ opacity: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                          onFocus={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                        >
                          <More01Icon size={14} style={{ color: '#6b7280' }} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<Shield01Icon size={13} />}
                          onClick={() => viewMember(m)}
                        >
                          <Text size="sm" c="dark">View profile</Text>
                        </Menu.Item>
                        {m.payment_status === 'pending_payment' && (
                          <Menu.Item
                            leftSection={<Wallet01Icon size={13} />}
                            onClick={() => { setPaymentTarget(m); setPaymentForm({ amount: m.plan_price?.toString() ?? '', provider: 'cash', notes: '' }) }}
                          >
                            <Text size="sm" c="blue">Record payment</Text>
                          </Menu.Item>
                        )}
                        <Menu.Item leftSection={<Mail01Icon size={13} />} onClick={() => { setEmailTarget(m); setEmailForm({ subject: '', body: '' }) }}>
                          <Text size="sm" c="dark">Send email</Text>
                        </Menu.Item>
                        <Menu.Item leftSection={<PencilEdit01Icon size={13} />} onClick={() => { setEditTarget(m); setEditForm({ name: m.name, phone: m.phone ?? '', notes: m.notes ?? '' }) }}>
                          <Text size="sm" c="dark">Edit member</Text>
                        </Menu.Item>
                        <Divider />
                        <Menu.Item leftSection={<UserBlock01Icon size={13} />} c="red" onClick={() => removeMember(m)}>
                          <Text size="sm" c="red">Remove member</Text>
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {total > 0 && (
            <PaginationBar
              page={page} totalPages={totalPages} total={total}
              perPage={perPage} onPageChange={goTo} onPerPageChange={changePerPage}
            />
          )}
        </Paper>

      </Stack>

      {/* ── Bulk action bar ── */}
      <AnimatePresence>
        {someSelected && (
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 200,
            }}
          >
            <Paper
              radius="xl"
              px="xl"
              py="md"
              shadow="xl"
              style={{
                background: '#1e1b4b',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                {selectedIds.size} selected
              </Text>
              <Divider orientation="vertical" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
              <Button
                size="xs"
                variant="white"
                color="dark"
                leftSection={<Mail01Icon size={13} />}
                onClick={() => { setBulkEmailForm({ subject: '', body: '' }); setBulkEmailOpen(true) }}
              >
                Email all
              </Button>
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<Delete01Icon size={13} />}
                loading={bulkRemoving}
                onClick={bulkRemove}
              >
                Remove all
              </Button>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <Cancel01Icon size={14} />
              </ActionIcon>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      <AddMemberDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdded={fetchMembers}
      />

      <ImportCsvDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchMembers}
      />

      {/* ── Send Email Modal ── */}
      <Modal
        opened={!!emailTarget}
        onClose={() => setEmailTarget(null)}
        title={<Text fw={700} size="sm">Email to {emailTarget?.name}</Text>}
        radius="lg" size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Subject"
            placeholder="Message subject…"
            value={emailForm.subject}
            onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
            size="sm" required
          />
          <Textarea
            label="Message"
            placeholder="Write your message…"
            value={emailForm.body}
            onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))}
            size="sm" minRows={4} autosize required
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setEmailTarget(null)}>Cancel</Button>
            <Button size="sm" color="indigo" loading={emailSending} onClick={sendEmail}
              disabled={!emailForm.subject.trim() || !emailForm.body.trim()}>
              Send email
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Edit Member Modal ── */}
      <Modal
        opened={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={<Text fw={700} size="sm">Edit {editTarget?.name}</Text>}
        radius="lg" size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Full name"
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            size="sm" required
          />
          <TextInput
            label="Phone"
            placeholder="+237 6XX XXX XXX"
            value={editForm.phone}
            onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
            size="sm"
          />
          <Textarea
            label="Notes"
            placeholder="Internal notes about this member…"
            value={editForm.notes}
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
            size="sm" minRows={3} autosize
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button size="sm" color="indigo" loading={editSaving} onClick={saveEdit}
              disabled={!editForm.name.trim()}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Bulk Email Modal ── */}
      <Modal
        opened={bulkEmailOpen}
        onClose={() => setBulkEmailOpen(false)}
        title={<Text fw={700} size="sm">Email to {selectedIds.size} member{selectedIds.size !== 1 ? 's' : ''}</Text>}
        radius="lg" size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Subject"
            placeholder="Message subject…"
            value={bulkEmailForm.subject}
            onChange={e => setBulkEmailForm(f => ({ ...f, subject: e.target.value }))}
            size="sm" required
          />
          <Textarea
            label="Message"
            placeholder="Write your message…"
            value={bulkEmailForm.body}
            onChange={e => setBulkEmailForm(f => ({ ...f, body: e.target.value }))}
            size="sm" minRows={4} autosize required
          />
          <Text size="xs" c="dimmed">
            This email will be sent individually to each of the {selectedIds.size} selected members.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setBulkEmailOpen(false)}>Cancel</Button>
            <Button size="sm" color="indigo" loading={bulkEmailing} onClick={sendBulkEmail}
              disabled={!bulkEmailForm.subject.trim() || !bulkEmailForm.body.trim()}>
              Send to all
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Quick Payment Confirmation Modal ── */}
      <Modal
        opened={!!paymentTarget}
        onClose={() => { setPaymentTarget(null); setPaymentForm({ amount: '', provider: 'cash', notes: '' }) }}
        title={<Text fw={700} size="sm">Record payment — {paymentTarget?.name}</Text>}
        radius="lg" size="sm"
      >
        <Stack gap="md">
          <Alert icon={<Wallet01Icon size={14} />} color="blue" variant="light" radius="md" title="Payment confirmation">
            <Text size="xs">This will activate the member's subscription and extend it by the plan duration.</Text>
          </Alert>
          <TextInput
            label={`Amount (${paymentTarget?.plan_currency ?? 'XAF'})`}
            placeholder={`e.g. ${paymentTarget?.plan_price ?? 15000}`}
            value={paymentForm.amount}
            onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
            size="sm"
            type="number"
            leftSection={<Wallet01Icon size={14} style={{ color: '#9ca3af' }} />}
          />
          <Select
            label="Payment method"
            value={paymentForm.provider}
            onChange={v => setPaymentForm(f => ({ ...f, provider: v ?? 'cash' }))}
            data={[
              { value: 'cash', label: 'Cash' },
              { value: 'momo', label: 'Mobile Money' },
              { value: 'bank_transfer', label: 'Bank transfer' },
              { value: 'tranzak', label: 'Tranzak' },
            ]}
            size="sm"
          />
          <TextInput
            label="Reference / notes"
            description="Optional — receipt number, transaction ID, etc."
            placeholder="e.g. CASH-001"
            value={paymentForm.notes}
            onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
            size="sm"
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => { setPaymentTarget(null); setPaymentForm({ amount: '', provider: 'cash', notes: '' }) }}>
              Cancel
            </Button>
            <Button
              color="green" size="sm" loading={paymentSaving}
              disabled={!paymentForm.amount || Number(paymentForm.amount) <= 0}
              onClick={confirmPayment}
            >
              Confirm & activate
            </Button>
          </Group>
        </Stack>
      </Modal>

    </>
  )
}
