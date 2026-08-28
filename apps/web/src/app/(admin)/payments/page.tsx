'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, Badge, Avatar,
  Button, TextInput, Menu, ActionIcon,
  Box, Flex, SimpleGrid, Modal, Select, NumberInput, Checkbox, Tabs,
} from '@mantine/core'
import {
  Wallet01Icon,
  Search01Icon,
  More01Icon,
  Download01Icon,
  Refresh01Icon,
  Coins01Icon,
  Ticket01Icon,
  Money01Icon,
  Invoice01Icon,
  ArrowDown01Icon,
  Add01Icon,
  Mail01Icon,
} from 'hugeicons-react'
import { api, downloadCsv } from '@/lib/api'
import { catchToast } from '@/lib/notifications'
import { notifications } from '@mantine/notifications'
import { PageSkeleton } from '../_components/Skeletons'
import { useSort, usePagination, SortableHeader, PaginationBar } from '../_components/DataTable'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string; memberName: string; plan: string
  amount: number; currency: string; provider: string
  status: 'succeeded' | 'pending' | 'failed' | 'refunded'
  date: string; reference: string
}

interface DayPass {
  id: string
  guest_name: string
  guest_phone: string | null
  pass_type: string
  amount: number
  currency: string
  payment_method: string
  status: string
  valid_date: string
  checked_in_at: string | null
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  succeeded: 'green', pending: 'yellow', failed: 'red', refunded: 'gray',
  completed: 'green', paid: 'green',
}

const DP_STATUS_COLOR: Record<string, string> = {
  active: 'green', used: 'blue', expired: 'gray', pending: 'yellow', refunded: 'red',
}

const PASS_TYPE_LABEL: Record<string, string> = {
  standard: 'Standard', peak: 'Peak', off_peak: 'Off-peak',
  student: 'Student', bundle_10: 'Bundle ×10',
}

const METHOD_LABEL: Record<string, string> = {
  mobile_money: 'Mobile Money', cash: 'Cash', card: 'Card',
  tranzak: 'Mobile Money', bank_transfer: 'Bank transfer',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

// ─── Shared filter bar ───────────────────────────────────────────────────────

// ─── Member / Plan for record modal ─────────────────────────────────────────

interface Member { id: string; name: string }
interface Plan   { id: string; name: string; price: string; currency: string }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<string | null>('subscriptions')
  const [payments, setPayments] = useState<Payment[]>([])
  const [dayPasses, setDayPasses] = useState<DayPass[]>([])
  const [revenue, setRevenue] = useState({ today: 0, mtd: 0, lastMonth: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  const [searchSub, setSearchSub] = useState('')
  const [searchDp, setSearchDp]   = useState('')
  const [filterSub, setFilterSub] = useState('all')

  // Record payment modal
  const [recordOpen, setRecordOpen]     = useState(false)
  const [memberList, setMemberList]     = useState<Member[]>([])
  const [planList, setPlanList]         = useState<Plan[]>([])
  const [recordSaving, setRecordSaving] = useState(false)
  const [recordForm, setRecordForm]     = useState({
    memberId: '', planId: '', amount: 0, method: 'cash', reference: '', createSub: false,
  })

  // Receipt modal
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)

  useEffect(() => {
    if (!recordOpen) return
    Promise.all([
      api.get<{ members: Member[] }>('/api/members').then(d => setMemberList(d.members ?? [])),
      api.get<{ plans: Plan[] }>('/api/subscriptions/plans').then(d => setPlanList(d.plans ?? [])),
    ]).catch(() => {})
  }, [recordOpen])

  function loadAll() {
    setLoading(true)
    Promise.all([
      api.get<{ payments: Array<Record<string, string>> }>('/api/payments?limit=200')
        .then(d => setPayments((d.payments ?? []).map(p => ({
          id: p.id, memberName: p.member_name ?? '', plan: p.plan_name ?? '—',
          amount: parseFloat(p.amount ?? '0'), currency: 'XAF',
          provider: p.provider ?? 'cash',
          status: (['completed','paid'].includes(p.status) ? 'succeeded' : p.status === 'pending' ? 'pending' : p.status === 'failed' ? 'failed' : 'refunded') as Payment['status'],
          date: p.created_at?.slice(0, 10) ?? '',
          reference: p.provider_ref ?? `REF-${p.id.slice(0, 8).toUpperCase()}`,
        })))),

      api.get<{ day_passes: DayPass[] }>('/api/day-passes?limit=200')
        .then(d => setDayPasses(d.day_passes ?? [])),

      api.get<{ today: number; mtd: number; last_month: number; total_all_time: number }>('/api/payments/summary')
        .then(d => setRevenue({
          today:     d.today     ?? 0,
          mtd:       d.mtd       ?? 0,
          lastMonth: d.last_month ?? 0,
          total:     d.total_all_time ?? 0,
        })),
    ])
      .catch(catchToast('Failed to load payments'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [])

  async function submitRecord() {
    if (!recordForm.memberId || !recordForm.amount) return
    setRecordSaving(true)
    try {
      let subscriptionId: string | undefined
      if (recordForm.createSub && recordForm.planId) {
        const sub = await api.post<{ id: string }>('/api/subscriptions', {
          member_id: recordForm.memberId,
          plan_id:   recordForm.planId,
        })
        subscriptionId = sub.id
      }
      await api.post('/api/payments', {
        member_id:       recordForm.memberId,
        subscription_id: subscriptionId,
        amount:          recordForm.amount,
        provider:        recordForm.method,
        provider_ref:    recordForm.reference || undefined,
      })
      notifications.show({ color: 'green', message: 'Payment recorded.' })
      setRecordOpen(false)
      setRecordForm({ memberId: '', planId: '', amount: 0, method: 'cash', reference: '', createSub: false })
      loadAll()
    } catch {
      notifications.show({ color: 'red', message: 'Failed to record payment.' })
    } finally {
      setRecordSaving(false)
    }
  }

  async function handleRemind(id: string) {
    try {
      await api.post(`/api/payments/${id}/remind`, {})
      notifications.show({ color: 'green', message: 'Payment reminder sent.' })
    } catch {
      notifications.show({ color: 'red', message: 'Failed to send reminder.' })
    }
  }

  async function handleRefund(id: string) {
    try {
      await api.post(`/api/payments/${id}/refund`, {})
      setPayments(ps => ps.map(p => p.id === id ? { ...p, status: 'refunded' } : p))
      notifications.show({ color: 'green', message: 'Payment refunded.' })
    } catch {
      notifications.show({ color: 'red', message: 'Refund failed.' })
    }
  }

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filteredSub = payments.filter(p => {
    const matchStatus = filterSub === 'all' || p.status === filterSub
    const matchSearch = p.memberName.toLowerCase().includes(searchSub.toLowerCase())
    return matchStatus && matchSearch
  })

  const filteredDp = dayPasses.filter(p =>
    !searchDp || p.guest_name.toLowerCase().includes(searchDp.toLowerCase()) || (p.guest_phone ?? '').includes(searchDp)
  )

  const { sorted: sortedSub, sortKey: skSub, sortDir: sdSub, toggleSort: tsSub } = useSort(filteredSub, 'date', 'desc')
  const subPag = usePagination(sortedSub)

  const { sorted: sortedDp, sortKey: skDp, sortDir: sdDp, toggleSort: tsDp } = useSort(filteredDp, 'created_at', 'desc')
  const dpPag = usePagination(sortedDp)

  if (loading) return <PageSkeleton statCount={4} tableRows={8} tableCols={6} />

  return (
    <Stack gap="lg" p="xl" maw={1400}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Payments
            </Title>
            <Text size="sm" c="dimmed">Revenue collected and transaction history.</Text>
          </Stack>
          <Group gap="sm">
            <Button variant="default" size="sm" leftSection={<Download01Icon size={14} />}
              onClick={() => downloadCsv('/api/payments/export', 'payments.csv').catch(catchToast('Export failed'))}>
              Export
            </Button>
            <Button size="sm" color="indigo" leftSection={<Add01Icon size={14} />} onClick={() => setRecordOpen(true)}>
              Record payment
            </Button>
          </Group>
        </Group>
      </motion.div>

      {/* Revenue summary cards — combined totals */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {[
            { label: 'Today',          value: revenue.today,     icon: Coins01Icon  },
            { label: 'This month (MTD)', value: revenue.mtd,     icon: Wallet01Icon },
            { label: 'Last month',     value: revenue.lastMonth, icon: Money01Icon  },
            { label: 'All time',       value: revenue.total,     icon: Invoice01Icon },
          ].map((s, i) => {
            const Icon = s.icon
            return (
              <Paper key={i} radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                <Icon size={17} style={{ color: '#9ca3af' }} />
                <Text style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1, color: '#111827', letterSpacing: '-0.02em', marginTop: 12 }}>
                  ₣{s.value.toLocaleString('fr-CM')}
                </Text>
                <Text size="xs" fw={600} mt={4} style={{ color: '#374151' }}>{s.label}</Text>
              </Paper>
            )
          })}
        </SimpleGrid>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Tabs value={activeTab} onChange={setActiveTab} radius="md" keepMountedMode="display-none">
          <Tabs.List mb="md" style={{ borderBottom: '1px solid #edeef4' }}>
            <Tabs.Tab value="subscriptions" leftSection={<Wallet01Icon size={14} />}>
              Subscriptions
              <Badge size="xs" ml={6} color="gray" variant="light">{payments.length}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="day_passes" leftSection={<Ticket01Icon size={14} />}>
              Day Passes
              <Badge size="xs" ml={6} color="gray" variant="light">{dayPasses.length}</Badge>
            </Tabs.Tab>
          </Tabs.List>

          {/* ── Subscriptions tab ── */}
          <Tabs.Panel value="subscriptions">
            <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
              <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid #f4f5f9' }}>
                <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
                  Subscription payments
                </Text>
                <Group gap="sm">
                  <TextInput size="xs" radius="md" placeholder="Search member…" value={searchSub} onChange={e => setSearchSub(e.target.value)} leftSection={<Search01Icon size={13} style={{ color: '#9ca3af' }} />} style={{ width: 200 }} />
                  <select
                    value={filterSub}
                    onChange={e => setFilterSub(e.target.value)}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f4f5f9', color: '#374151' }}
                  >
                    <option value="all">All</option>
                    <option value="succeeded">Succeeded</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </Group>
              </Group>

              <Group px="lg" py={8} style={{ borderBottom: '1px solid #f9fafb' }}>
                <Box style={{ flex: 1 }}><SortableHeader label="Member" sortKey="memberName" currentKey={skSub as string} currentDir={sdSub} onSort={k => tsSub(k as keyof Payment)} /></Box>
                <Box style={{ width: 120 }}><SortableHeader label="Plan" sortKey="plan" currentKey={skSub as string} currentDir={sdSub} onSort={k => tsSub(k as keyof Payment)} /></Box>
                <Box style={{ width: 100 }}><Text size="xs" fw={600} c="dimmed">Method</Text></Box>
                <Box style={{ width: 90 }}><SortableHeader label="Status" sortKey="status" currentKey={skSub as string} currentDir={sdSub} onSort={k => tsSub(k as keyof Payment)} /></Box>
                <Box style={{ width: 100 }}><SortableHeader label="Date" sortKey="date" currentKey={skSub as string} currentDir={sdSub} onSort={k => tsSub(k as keyof Payment)} /></Box>
                <Box style={{ width: 100 }}><SortableHeader label="Amount" sortKey="amount" currentKey={skSub as string} currentDir={sdSub} onSort={k => tsSub(k as keyof Payment)} /></Box>
                <Box style={{ width: 32 }} />
              </Group>

              {subPag.paged.length > 0 ? (
                <Stack gap={0}>
                  {subPag.paged.map(p => (
                    <Group key={p.id} px="lg" py="sm"
                      style={{ borderBottom: '1px solid #f9fafb', transition: 'background 0.1s', cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                        <Avatar size={28} radius="xl" color="indigo" variant="filled" fz={10} fw={700}>
                          {initials(p.memberName)}
                        </Avatar>
                        <Text size="xs" fw={600} style={{ color: '#111827' }} truncate>{p.memberName}</Text>
                      </Group>
                      <Box style={{ width: 120 }}>
                        <Text size="xs" style={{ color: '#374151' }}>{p.plan}</Text>
                      </Box>
                      <Box style={{ width: 100 }}>
                        <Text size="xs" c="dimmed">{METHOD_LABEL[p.provider] ?? p.provider}</Text>
                      </Box>
                      <Box style={{ width: 90 }}>
                        <Badge size="xs" radius="xl" variant="light" color={STATUS_COLOR[p.status] ?? 'gray'}>
                          {p.status}
                        </Badge>
                      </Box>
                      <Box style={{ width: 100 }}>
                        <Text size="xs" c="dimmed">{p.date}</Text>
                      </Box>
                      <Box style={{ width: 100 }}>
                        <Text size="xs" fw={700} style={{ color: p.status === 'failed' ? '#ef4444' : '#111827' }}>
                          {p.status === 'refunded' ? '−' : ''}₣{p.amount.toLocaleString('fr-CM')}
                        </Text>
                      </Box>
                      <Box style={{ width: 32 }}>
                        <Menu shadow="lg" radius="lg" width={160} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon size="sm" variant="subtle" color="gray"><More01Icon size={14} /></ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<Invoice01Icon size={13} />} onClick={() => setReceiptPayment(p)}>Receipt</Menu.Item>
                            {p.status === 'pending' && (
                              <Menu.Item leftSection={<Mail01Icon size={13} />} onClick={() => handleRemind(p.id)}>Send reminder</Menu.Item>
                            )}
                            {p.status === 'failed' && (
                              <Menu.Item leftSection={<Refresh01Icon size={13} />} onClick={() => {}}>Retry</Menu.Item>
                            )}
                            {p.status === 'succeeded' && (
                              <Menu.Item leftSection={<ArrowDown01Icon size={13} />} color="red" onClick={() => handleRefund(p.id)}>Refund</Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Box>
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Flex direction="column" align="center" justify="center" gap="sm" py="xl">
                  <Wallet01Icon size={28} style={{ color: '#e5e7eb' }} />
                  <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>
                    {searchSub || filterSub !== 'all' ? 'No transactions match your filter' : 'No payments recorded yet'}
                  </Text>
                </Flex>
              )}

              {subPag.total > 0 && (
                <PaginationBar
                  page={subPag.page} totalPages={subPag.totalPages} total={subPag.total}
                  perPage={subPag.perPage} onPageChange={subPag.goTo} onPerPageChange={subPag.changePerPage}
                />
              )}
            </Paper>
          </Tabs.Panel>

          {/* ── Day Passes tab ── */}
          <Tabs.Panel value="day_passes">
            <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
              <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid #f4f5f9' }}>
                <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
                  Day pass payments
                </Text>
                <TextInput size="xs" radius="md" placeholder="Search guest…" value={searchDp} onChange={e => setSearchDp(e.target.value)} leftSection={<Search01Icon size={13} style={{ color: '#9ca3af' }} />} style={{ width: 200 }} />
              </Group>

              <Group px="lg" py={8} style={{ borderBottom: '1px solid #f9fafb' }}>
                <Box style={{ flex: 1 }}><SortableHeader label="Guest" sortKey="guest_name" currentKey={skDp as string} currentDir={sdDp} onSort={k => tsDp(k as keyof DayPass)} /></Box>
                <Box style={{ width: 100 }}><Text size="xs" fw={600} c="dimmed">Type</Text></Box>
                <Box style={{ width: 100 }}><Text size="xs" fw={600} c="dimmed">Method</Text></Box>
                <Box style={{ width: 80 }}><SortableHeader label="Status" sortKey="status" currentKey={skDp as string} currentDir={sdDp} onSort={k => tsDp(k as keyof DayPass)} /></Box>
                <Box style={{ width: 100 }}><SortableHeader label="Date" sortKey="created_at" currentKey={skDp as string} currentDir={sdDp} onSort={k => tsDp(k as keyof DayPass)} /></Box>
                <Box style={{ width: 90 }}><SortableHeader label="Amount" sortKey="amount" currentKey={skDp as string} currentDir={sdDp} onSort={k => tsDp(k as keyof DayPass)} /></Box>
              </Group>

              {dpPag.paged.length > 0 ? (
                <Stack gap={0}>
                  {dpPag.paged.map(p => (
                    <Group key={p.id} px="lg" py="sm"
                      style={{ borderBottom: '1px solid #f9fafb', transition: 'background 0.1s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fffbeb' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                        <Text size="xs" fw={600} style={{ color: '#111827' }} truncate>{p.guest_name}</Text>
                        {p.guest_phone && <Text size="xs" c="dimmed">{p.guest_phone}</Text>}
                      </Stack>
                      <Box style={{ width: 100 }}>
                        <Badge size="xs" radius="xl" variant="light" color="indigo">
                          {PASS_TYPE_LABEL[p.pass_type] ?? p.pass_type}
                        </Badge>
                      </Box>
                      <Box style={{ width: 100 }}>
                        <Text size="xs" c="dimmed">{METHOD_LABEL[p.payment_method] ?? p.payment_method}</Text>
                      </Box>
                      <Box style={{ width: 80 }}>
                        <Badge size="xs" radius="xl" variant="light" color={DP_STATUS_COLOR[p.status] ?? 'gray'}>
                          {p.status}
                        </Badge>
                      </Box>
                      <Box style={{ width: 100 }}>
                        <Text size="xs" c="dimmed">{p.created_at?.slice(0, 10)}</Text>
                        {p.checked_in_at && (
                          <Text size="xs" style={{ color: '#6366f1' }}>in {p.checked_in_at.slice(11, 16)}</Text>
                        )}
                      </Box>
                      <Box style={{ width: 90 }}>
                        <Text size="xs" fw={700} style={{ color: '#111827' }}>
                          ₣{Number(p.amount).toLocaleString('fr-CM')}
                        </Text>
                      </Box>
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Flex direction="column" align="center" justify="center" gap="sm" py="xl">
                  <Ticket01Icon size={28} style={{ color: '#e5e7eb' }} />
                  <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>
                    {searchDp ? 'No passes match your filter' : 'No day passes yet'}
                  </Text>
                </Flex>
              )}

              {dpPag.total > 0 && (
                <PaginationBar
                  page={dpPag.page} totalPages={dpPag.totalPages} total={dpPag.total}
                  perPage={dpPag.perPage} onPageChange={dpPag.goTo} onPerPageChange={dpPag.changePerPage}
                />
              )}
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </motion.div>

      {/* ── Record Payment Modal ── */}
      <Modal
        opened={recordOpen}
        onClose={() => setRecordOpen(false)}
        title={<Text fw={700} size="sm">Record payment</Text>}
        radius="lg" size="sm"
      >
        <Stack gap="sm">
          <Select
            label="Member" placeholder="Select member…" searchable
            data={memberList.map(m => ({ value: m.id, label: m.name }))}
            value={recordForm.memberId}
            onChange={v => setRecordForm(f => ({ ...f, memberId: v ?? '' }))}
            size="sm" required
          />
          <Select
            label="Plan (optional)" placeholder="Select plan…" clearable
            data={planList.map(p => ({ value: p.id, label: `${p.name} — ${p.currency} ${parseFloat(p.price).toLocaleString()}` }))}
            value={recordForm.planId}
            onChange={v => {
              const plan = planList.find(p => p.id === v)
              setRecordForm(f => ({ ...f, planId: v ?? '', amount: plan ? parseFloat(plan.price) : f.amount }))
            }}
            size="sm"
          />
          <NumberInput
            label="Amount" value={recordForm.amount}
            onChange={v => setRecordForm(f => ({ ...f, amount: Number(v) }))}
            min={0} size="sm" required
            leftSection={<Text size="xs" c="dimmed">₣</Text>}
          />
          <Select
            label="Payment method" value={recordForm.method}
            onChange={v => setRecordForm(f => ({ ...f, method: v ?? 'cash' }))}
            data={[
              { value: 'cash',         label: 'Cash' },
              { value: 'mobile_money', label: 'Mobile Money' },
              { value: 'card',         label: 'Card' },
            ]}
            size="sm"
          />
          <TextInput
            label="Reference (optional)" placeholder="Transaction ID, receipt no…"
            value={recordForm.reference}
            onChange={e => setRecordForm(f => ({ ...f, reference: e.target.value }))}
            size="sm"
          />
          {recordForm.planId && (
            <Checkbox
              size="sm"
              label="Also create / renew subscription for this plan"
              checked={recordForm.createSub}
              onChange={e => setRecordForm(f => ({ ...f, createSub: e.currentTarget.checked }))}
            />
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={() => setRecordOpen(false)}>Cancel</Button>
            <Button size="sm" color="indigo" loading={recordSaving} onClick={submitRecord}
              disabled={!recordForm.memberId || !recordForm.amount}>
              Record payment
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Receipt Modal ── */}
      <Modal
        opened={!!receiptPayment}
        onClose={() => setReceiptPayment(null)}
        title={<Text fw={700} size="sm">Receipt</Text>}
        radius="lg" size="sm"
      >
        {receiptPayment && (
          <Stack gap="xs">
            {[
              { label: 'Member',    value: receiptPayment.memberName },
              { label: 'Plan',      value: receiptPayment.plan },
              { label: 'Amount',    value: `₣${receiptPayment.amount.toLocaleString('fr-CM')}` },
              { label: 'Method',    value: METHOD_LABEL[receiptPayment.provider] ?? receiptPayment.provider },
              { label: 'Status',    value: receiptPayment.status },
              { label: 'Date',      value: receiptPayment.date },
              { label: 'Reference', value: receiptPayment.reference },
            ].map(row => (
              <Group key={row.label} justify="space-between">
                <Text size="xs" c="dimmed">{row.label}</Text>
                <Text size="xs" fw={600}>{row.value}</Text>
              </Group>
            ))}
          </Stack>
        )}
      </Modal>

    </Stack>
  )
}
