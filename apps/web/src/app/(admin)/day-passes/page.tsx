'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, Badge,
  TextInput, Select, Box, Flex, SimpleGrid,
  Menu, ActionIcon,
} from '@mantine/core'
import {
  Search01Icon,
  More01Icon,
  Ticket01Icon,
  Wallet01Icon,
  UserCheck01Icon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { catchToast } from '@/lib/notifications'
import { PageSkeleton } from '../_components/Skeletons'
import { useSort, usePagination, SortableHeader, PaginationBar } from '../_components/DataTable'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  notes: string | null
  created_at: string
}

interface Summary {
  today_revenue: string
  mtd_revenue: string
  today_count: string
  used_count: string
  active_count: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active: 'green',
  used: 'blue',
  expired: 'gray',
  pending: 'yellow',
  refunded: 'red',
}

const PASS_TYPE_LABEL: Record<string, string> = {
  standard: 'Standard',
  peak: 'Peak',
  off_peak: 'Off-peak',
  student: 'Student',
  bundle_10: 'Bundle ×10',
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  tranzak: 'Mobile Money',
  card: 'Card',
  bank_transfer: 'Bank transfer',
}

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DayPassesPage() {
  const [passes, setPasses]     = useState<DayPass[]>([])
  const [summary, setSummary]   = useState<Summary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter]     = useState<string | null>(null)

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (statusFilter) params.set('status', statusFilter)
    if (typeFilter)   params.set('pass_type', typeFilter)
    api.get<{ day_passes: DayPass[]; summary: Summary }>(`/api/day-passes?${params}`)
      .then(d => {
        setPasses(d.day_passes ?? [])
        setSummary(d.summary ?? null)
      })
      .catch(catchToast('Failed to load day passes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter, typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = passes.filter(p =>
    !search || p.guest_name.toLowerCase().includes(search.toLowerCase()) || (p.guest_phone ?? '').includes(search)
  )

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'created_at', 'desc')
  const { paged, page, totalPages, total, perPage, goTo, changePerPage } = usePagination(sorted)

  if (loading) return <PageSkeleton statCount={4} tableRows={8} tableCols={6} />

  const todayRevenue = parseFloat(summary?.today_revenue ?? '0')
  const mtdRevenue   = parseFloat(summary?.mtd_revenue   ?? '0')
  const todayCount   = parseInt(summary?.today_count ?? '0')
  const usedCount    = parseInt(summary?.used_count  ?? '0')

  return (
    <Stack gap="lg" p="xl" maw={1400}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Day Passes
            </Title>
            <Text size="sm" c="dimmed">Walk-in guest access and daily revenue.</Text>
          </Stack>
        </Group>
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {[
            { label: 'Revenue today',     value: `₣${todayRevenue.toLocaleString('fr-CM')}`, icon: Ticket01Icon },
            { label: 'Revenue this month', value: `₣${mtdRevenue.toLocaleString('fr-CM')}`,  icon: Wallet01Icon },
            { label: 'Passes today',       value: todayCount.toString(),                       icon: Ticket01Icon },
            { label: 'Total used',         value: usedCount.toString(),                        icon: UserCheck01Icon },
          ].map((s, i) => {
            const Icon = s.icon
            return (
              <Paper key={i} radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                <Icon size={17} style={{ color: '#9ca3af' }} />
                <Text style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1, color: '#111827', letterSpacing: '-0.02em', marginTop: 12 }}>
                  {s.value}
                </Text>
                <Text size="xs" fw={600} mt={4} style={{ color: '#374151' }}>{s.label}</Text>
              </Paper>
            )
          })}
        </SimpleGrid>
      </motion.div>

      {/* Table */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>

          <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid #f4f5f9' }}>
            <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
              Day passes
            </Text>
            <Group gap="sm">
              <TextInput
                size="xs" radius="md" placeholder="Search guest…"
                value={search} onChange={e => setSearch(e.target.value)}
                leftSection={<Search01Icon size={13} style={{ color: '#9ca3af' }} />}
                style={{ width: 180 }}
              />
              <Select
                size="xs" radius="md" placeholder="All statuses" clearable
                value={statusFilter} onChange={setStatusFilter}
                data={[
                  { value: 'active',  label: 'Active' },
                  { value: 'used',    label: 'Used' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'expired', label: 'Expired' },
                ]}
                style={{ width: 140 }}
              />
              <Select
                size="xs" radius="md" placeholder="All types" clearable
                value={typeFilter} onChange={setTypeFilter}
                data={Object.entries(PASS_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
                style={{ width: 140 }}
              />
            </Group>
          </Group>

          {/* Column headers */}
          <Group px="lg" py={8} style={{ borderBottom: '1px solid #f9fafb' }}>
            <Box style={{ flex: 1 }}><SortableHeader label="Guest" sortKey="guest_name" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof DayPass)} /></Box>
            <Box style={{ width: 100 }}><Text size="xs" fw={600} c="dimmed">Type</Text></Box>
            <Box style={{ width: 100 }}><Text size="xs" fw={600} c="dimmed">Method</Text></Box>
            <Box style={{ width: 80 }}><SortableHeader label="Status" sortKey="status" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof DayPass)} /></Box>
            <Box style={{ width: 90 }}><SortableHeader label="Date" sortKey="created_at" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof DayPass)} /></Box>
            <Box style={{ width: 90 }}><SortableHeader label="Amount" sortKey="amount" currentKey={sortKey as string} currentDir={sortDir} onSort={k => toggleSort(k as keyof DayPass)} /></Box>
            <Box style={{ width: 32 }} />
          </Group>

          {paged.length > 0 ? (
            <Stack gap={0}>
              {paged.map(p => (
                <Group key={p.id} px="lg" py="sm"
                  style={{ borderBottom: '1px solid #f9fafb', transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
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
                    <Badge size="xs" radius="xl" variant="light" color={STATUS_COLOR[p.status] ?? 'gray'}>
                      {p.status}
                    </Badge>
                  </Box>
                  <Box style={{ width: 90 }}>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">{p.created_at?.slice(0, 10)}</Text>
                      {p.checked_in_at && (
                        <Text size="xs" style={{ color: '#6366f1' }}>in {p.checked_in_at.slice(11, 16)}</Text>
                      )}
                    </Stack>
                  </Box>
                  <Box style={{ width: 90 }}>
                    <Text size="xs" fw={700} style={{ color: '#111827' }}>
                      ₣{Number(p.amount).toLocaleString('fr-CM')}
                    </Text>
                  </Box>
                  <Box style={{ width: 32 }}>
                    <Menu shadow="lg" radius="lg" width={140} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon size="sm" variant="subtle" color="gray">
                          <More01Icon size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item onClick={() => {}}>View details</Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Box>
                </Group>
              ))}
            </Stack>
          ) : (
            <Flex direction="column" align="center" justify="center" gap="sm" py="xl">
              <Ticket01Icon size={28} style={{ color: '#e5e7eb' }} />
              <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>
                {search || statusFilter || typeFilter ? 'No passes match your filter' : 'No day passes yet'}
              </Text>
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

    </Stack>
  )
}
