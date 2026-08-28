'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format, startOfDay, endOfDay } from 'date-fns'
import {
  Paper, Text, Title, Group, Stack, Badge, Avatar,
  Button, TextInput, Box, Flex, Divider, ActionIcon, SimpleGrid,
  Modal, Alert, Tooltip, Pagination, CopyButton,
} from '@mantine/core'
import {
  QrCode01Icon, UserAdd01Icon, Search01Icon, CheckmarkCircle01Icon,
  Activity01Icon, UserGroupIcon, Clock01Icon, Download01Icon,
  Refresh01Icon, Cancel01Icon, Alert01Icon, Copy01Icon,
  ArrowExpand01Icon, Calendar01Icon, UserStar01Icon,
} from 'hugeicons-react'
import QRCode from 'react-qr-code'
import { api } from '@/lib/api'
import { catchToast, showError, showSuccess } from '@/lib/notifications'
import { PageSkeleton } from '../_components/Skeletons'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LookupMember {
  id: string; name: string; email: string; phone: string | null
  sub_status: 'active' | 'expired' | 'cancelled' | null; expires_at: string | null
}

interface CheckIn {
  id: string
  memberName: string
  memberPlan: string | null
  method: string
  time: string
  rawTime: string
  type: 'new' | 'returning' | 'guest'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function methodLabel(method: string) {
  const map: Record<string, string> = { qr: 'QR Scan', pin: 'PIN', manual: 'Manual', daypass: 'Day Pass' }
  return map[method] ?? method
}

function methodColor(method: string) {
  return method === 'qr' ? 'indigo' : method === 'pin' ? 'violet' : method === 'daypass' ? 'orange' : 'gray'
}

function exportCSV(rows: CheckIn[], gymName: string) {
  const header = ['Time', 'Member', 'Plan', 'Method', 'Type']
  const lines = rows.map(r => [
    r.rawTime, `"${r.memberName}"`, `"${r.memberPlan ?? ''}"`, methodLabel(r.method), r.type,
  ].join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${gymName.replace(/\s/g, '-')}-checkins-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadQRPng(containerId: string) {
  const svg = document.querySelector(`#${containerId} svg`) as SVGElement | null
  if (!svg) return
  const serialized = new XMLSerializer().serializeToString(svg)
  const canvas = document.createElement('canvas')
  canvas.width = 400; canvas.height = 400
  const img = new Image()
  img.onload = () => {
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 400, 400)
    ctx.drawImage(img, 20, 20, 360, 360)
    const a = document.createElement('a')
    a.download = 'checkin-qr.png'
    a.href = canvas.toDataURL('image/png')
    a.click()
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized)
}

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckInsPage() {
  const [search, setSearch]     = useState('')
  const [checkins, setCheckins] = useState<CheckIn[]>([])
  const [liveStats, setLiveStats] = useState({ today: 0, last_hour: 0, last_7d: 0, day_passes_today: 0 })
  const [loading, setLoading]   = useState(true)
  const [qrUrl, setQrUrl]       = useState('')
  const [qrFullscreen, setQrFullscreen] = useState(false)

  // Date range filter
  const today = new Date()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const LIMIT = 50

  const isFiltered = fromDate !== '' || toDate !== ''

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Manual check-in modal
  const [manualOpen, setManualOpen]       = useState(false)
  const [memberQuery, setMemberQuery]     = useState('')
  const [memberResults, setMemberResults] = useState<LookupMember[]>([])
  const [selectedMember, setSelectedMember] = useState<LookupMember | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [checkinSaving, setCheckinSaving] = useState(false)

  // ─── Fetch live ─────────────────────────────────────────────────────────────

  const fetchLive = useCallback(() => {
    return api.get<{
      stats: { today: string; last_hour: string; last_7d: string; day_passes_today?: string }
      recent: Array<{ id: string; name: string; checked_in_at: string; method: string; plan_name?: string | null; is_first_today?: boolean }>
    }>('/api/checkin/live')
      .then(d => {
        setLiveStats({
          today:            parseInt(d.stats?.today         ?? '0'),
          last_hour:        parseInt(d.stats?.last_hour     ?? '0'),
          last_7d:          parseInt(d.stats?.last_7d       ?? '0'),
          day_passes_today: parseInt(d.stats?.day_passes_today ?? '0'),
        })
        setCheckins((d.recent ?? []).map(r => ({
          id:         r.id,
          memberName: r.name,
          memberPlan: r.plan_name ?? null,
          method:     r.method,
          time:       new Date(r.checked_in_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
          rawTime:    r.checked_in_at,
          type:       r.method === 'daypass' ? 'guest' : r.is_first_today ? 'new' : 'returning',
        })))
        setTotal(d.recent?.length ?? 0)
      }).catch(catchToast('Failed to load check-ins'))
  }, [])

  // ─── Fetch historical (date-filtered) ───────────────────────────────────────

  const fetchFiltered = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (fromDate) params.set('from', startOfDay(new Date(fromDate)).toISOString())
    if (toDate)   params.set('to',   endOfDay(new Date(toDate)).toISOString())
    return api.get<{
      checkins: Array<{ id: string; member_name: string; method: string; checked_in_at: string }>
      total: number
    }>(`/api/checkin?${params}`)
      .then(d => {
        setCheckins((d.checkins ?? []).map(r => ({
          id:         r.id,
          memberName: r.member_name,
          memberPlan: null,
          method:     r.method,
          time:       new Date(r.checked_in_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
          rawTime:    r.checked_in_at,
          type:       r.method === 'daypass' ? 'guest' : 'returning',
        })))
        setTotal(d.total ?? 0)
      }).catch(catchToast('Failed to load check-ins'))
  }, [fromDate, toDate, page])

  useEffect(() => {
    api.get<{ url: string }>('/api/checkin/qr-url')
      .then(d => setQrUrl(d.url))
      .catch(catchToast('Failed to load QR URL'))

    fetchLive().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchLive, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchLive])

  // When date filter changes, switch to filtered mode
  useEffect(() => {
    if (!isFiltered) { fetchLive(); return }
    if (pollRef.current) clearInterval(pollRef.current)
    fetchFiltered()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, page])

  // ─── Member lookup ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!memberQuery.trim()) { setMemberResults([]); return }
    const t = setTimeout(async () => {
      setLookupLoading(true)
      try {
        const d = await api.post<{ members: LookupMember[] }>('/api/checkin/lookup', { query: memberQuery })
        setMemberResults(d.members ?? [])
      } catch { setMemberResults([]) }
      finally { setLookupLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [memberQuery])

  // ─── Manual check-in ────────────────────────────────────────────────────────

  async function doCheckin() {
    if (!selectedMember) return
    setCheckinSaving(true)
    try {
      await api.post('/api/checkin', { member_id: selectedMember.id, method: 'manual' })
      showSuccess(`${selectedMember.name} checked in`)
      closeManual()
      if (!isFiltered) fetchLive()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Check-in failed')
    } finally {
      setCheckinSaving(false)
    }
  }

  function closeManual() {
    setManualOpen(false); setMemberQuery(''); setMemberResults([]); setSelectedMember(null)
  }

  function clearFilter() {
    setFromDate(''); setToDate(''); setPage(1)
    if (pollRef.current) clearInterval(pollRef.current)
    fetchLive()
    pollRef.current = setInterval(fetchLive, 30000)
  }

  const filtered = checkins.filter(c =>
    c.memberName.toLowerCase().includes(search.toLowerCase())
  )

  // Truncated URL for display (hides the full JWT)
  const qrUrlShort = qrUrl ? `${qrUrl.slice(0, 48)}…` : 'Loading…'

  if (loading) return <PageSkeleton statCount={5} tableRows={6} tableCols={4} />

  return (
    <>
    <Stack gap="lg" p="xl" maw={1400}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Text size="xs" fw={600} style={{ color: '#b0b7c3', letterSpacing: '0.04em' }}>
              {format(today, 'EEEE, d MMMM yyyy')}
            </Text>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Check-ins
            </Title>
            <Text size="sm" c="dimmed">Live attendance log and QR code access.</Text>
          </Stack>
          <Group gap="sm">
            <Button
              variant="default" size="sm" leftSection={<Download01Icon size={14} />}
              onClick={() => exportCSV(filtered, 'Gym')}
            >
              Export CSV
            </Button>
            <Button size="sm" color="indigo" leftSection={<UserAdd01Icon size={14} />} onClick={() => setManualOpen(true)}>
              Manual check-in
            </Button>
          </Group>
        </Group>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md">
          {[
            { label: 'Total today',     value: liveStats.today,            icon: Activity01Icon, color: '#6366f1' },
            { label: 'Last hour',       value: liveStats.last_hour,        icon: UserAdd01Icon,  color: '#10b981' },
            { label: 'Last 7 days',     value: liveStats.last_7d,          icon: UserGroupIcon,  color: '#f59e0b' },
            { label: 'Avg / day',       value: liveStats.last_7d > 0 ? Math.round(liveStats.last_7d / 7) : 0, icon: Clock01Icon, color: '#8b5cf6' },
            { label: 'Day passes today', value: liveStats.day_passes_today, icon: Calendar01Icon, color: '#ec4899' },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <Paper key={i} radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                <Icon size={17} style={{ color: '#9ca3af' }} />
                <Text style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1, color: '#111827', letterSpacing: '-0.02em', marginTop: 12 }}>
                  {stat.value}
                </Text>
                <Text size="xs" fw={600} mt={4} style={{ color: '#374151' }}>{stat.label}</Text>
              </Paper>
            )
          })}
        </SimpleGrid>
      </motion.div>

      {/* Main grid */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Group gap="md" align="flex-start">

          {/* Live feed */}
          <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden', flex: 1 }}>

            <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid #f4f5f9' }}>
              <Group gap="sm">
                <Box style={{ width: 7, height: 7, borderRadius: '50%', background: isFiltered ? '#f59e0b' : '#10b981' }} />
                <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
                  {isFiltered ? 'Filtered view' : 'Live feed'}
                </Text>
                {isFiltered && (
                  <Badge size="xs" color="yellow" variant="light" style={{ cursor: 'pointer' }} onClick={clearFilter}>
                    Clear filter ✕
                  </Badge>
                )}
              </Group>
              <Group gap="xs">
                {/* Date filter */}
                <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1) }}
                  style={{ fontSize: '0.75rem', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, color: '#374151' }} />
                <Text size="xs" c="dimmed">—</Text>
                <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1) }}
                  style={{ fontSize: '0.75rem', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, color: '#374151' }} />
                <TextInput
                  size="xs" radius="md" placeholder="Search…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  leftSection={<Search01Icon size={13} style={{ color: '#9ca3af' }} />}
                  style={{ width: 160 }}
                />
                <Tooltip label="Refresh">
                  <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => isFiltered ? fetchFiltered() : fetchLive()}>
                    <Refresh01Icon size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {/* Column headers */}
            <Group px="lg" py={8} style={{ borderBottom: '1px solid #f9fafb' }}>
              <Box style={{ flex: 1 }}><Text size="xs" fw={600} c="dimmed">Member</Text></Box>
              <Box style={{ width: 120 }}><Text size="xs" fw={600} c="dimmed">Plan</Text></Box>
              <Box style={{ width: 90 }}><Text size="xs" fw={600} c="dimmed">Method</Text></Box>
              <Box style={{ width: 80 }}><Text size="xs" fw={600} c="dimmed">Type</Text></Box>
              <Box style={{ width: 60 }}><Text size="xs" fw={600} c="dimmed">Time</Text></Box>
            </Group>

            {filtered.length > 0 ? (
              <Stack gap={0}>
                {filtered.map(c => (
                  <Group key={c.id} px="lg" py="sm" style={{ borderBottom: '1px solid #f9fafb' }}>
                    <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                      <Avatar size={28} radius="xl" color="indigo" variant="filled" fz={10} fw={700}>
                        {initials(c.memberName)}
                      </Avatar>
                      <Text size="xs" fw={600} style={{ color: '#111827' }} truncate>{c.memberName}</Text>
                    </Group>
                    <Box style={{ width: 120 }}>
                      <Text size="xs" c="dimmed" truncate>{c.memberPlan ?? '—'}</Text>
                    </Box>
                    <Box style={{ width: 90 }}>
                      <Badge size="xs" radius="xl" variant="light" color={methodColor(c.method)}>
                        {methodLabel(c.method)}
                      </Badge>
                    </Box>
                    <Box style={{ width: 80 }}>
                      <Badge size="xs" radius="xl" variant="light"
                        color={c.type === 'new' ? 'indigo' : c.type === 'guest' ? 'orange' : 'gray'}>
                        {c.type === 'new' ? 'New' : c.type === 'guest' ? 'Guest' : 'Returning'}
                      </Badge>
                    </Box>
                    <Box style={{ width: 60 }}>
                      <Text size="xs" c="dimmed">{c.time}</Text>
                    </Box>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Flex direction="column" align="center" justify="center" gap="sm" py="xl">
                <Activity01Icon size={28} style={{ color: '#e5e7eb' }} />
                <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>
                  {isFiltered ? 'No check-ins in this date range' : 'No check-ins today'}
                </Text>
                <Text size="xs" c="dimmed" ta="center" maw={260}>
                  {isFiltered ? 'Try adjusting the date range.' : 'Check-ins appear here in real time as members scan the QR code.'}
                </Text>
              </Flex>
            )}

            {/* Pagination (only when date-filtered) */}
            {isFiltered && total > LIMIT && (
              <Flex justify="center" p="md" style={{ borderTop: '1px solid #f4f5f9' }}>
                <Pagination
                  value={page} onChange={setPage}
                  total={Math.ceil(total / LIMIT)}
                  size="sm" radius="xl"
                />
              </Flex>
            )}
            {!isFiltered && (
              <Box px="lg" py="xs" style={{ borderTop: '1px solid #f9fafb' }}>
                <Text size="xs" c="dimmed">Showing last {checkins.length} check-ins · updates every 30s</Text>
              </Box>
            )}
          </Paper>

          {/* Right: QR + how it works */}
          <Stack gap="md" style={{ width: 280, flexShrink: 0 }}>

            <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
              <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }} mb="md">
                Check-in QR
              </Text>

              {qrUrl ? (
                <Box id="checkin-qr" style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: 16, background: '#fff', borderRadius: 16, border: '1px solid #edeef4' }}>
                  <QRCode value={qrUrl} size={160} fgColor="#111827" bgColor="#ffffff" level="M" />
                </Box>
              ) : (
                <Box style={{ width: '100%', aspectRatio: '1', borderRadius: 16, background: '#f4f5f9', border: '1px solid #edeef4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <QrCode01Icon size={48} style={{ color: '#d1d5db' }} />
                  <Text size="xs" c="dimmed" ta="center">Loading QR…</Text>
                </Box>
              )}

              <Divider my="md" />

              {/* Secure URL display — copy button instead of raw JWT */}
              <Group gap="xs" mb="sm">
                <Text size="xs" c="dimmed" style={{ flex: 1, wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                  {qrUrlShort}
                </Text>
                <CopyButton value={qrUrl} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied!' : 'Copy link'} withArrow position="left">
                      <ActionIcon size="sm" variant="subtle" color={copied ? 'green' : 'gray'} onClick={copy}>
                        <Copy01Icon size={13} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>

              <Group gap="xs">
                <Button size="xs" variant="default" style={{ flex: 1 }} leftSection={<Download01Icon size={12} />}
                  onClick={() => downloadQRPng('checkin-qr')}>
                  Download
                </Button>
                <Button size="xs" color="indigo" style={{ flex: 1 }} leftSection={<ArrowExpand01Icon size={12} />}
                  onClick={() => setQrFullscreen(true)}>
                  Fullscreen
                </Button>
              </Group>
            </Paper>

            <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
              <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }} mb="md">
                How it works
              </Text>
              <Stack gap="sm">
                {[
                  { step: '1', text: 'Print or display the QR code at your gym entrance' },
                  { step: '2', text: 'Members scan with their phone camera' },
                  { step: '3', text: 'Check-in is logged instantly here' },
                ].map(s => (
                  <Group key={s.step} gap="sm" align="flex-start">
                    <Box style={{ width: 20, height: 20, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Text size="xs" fw={700} style={{ color: '#6366f1' }}>{s.step}</Text>
                    </Box>
                    <Text size="xs" c="dimmed" style={{ flex: 1 }}>{s.text}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>

          </Stack>
        </Group>
      </motion.div>

    </Stack>

    {/* ── QR Fullscreen Modal ── */}
    <Modal
      opened={qrFullscreen} onClose={() => setQrFullscreen(false)}
      title={<Text fw={700} size="sm">Check-in QR Code</Text>}
      radius="xl" size="sm" centered
    >
      <Stack align="center" gap="md" p="sm">
        {qrUrl && (
          <Box style={{ padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #edeef4' }}>
            <QRCode value={qrUrl} size={280} fgColor="#111827" bgColor="#ffffff" level="M" />
          </Box>
        )}
        <Text size="xs" c="dimmed" ta="center" maw={280}>
          Display this at your entrance. Members scan it with their phone to check in.
        </Text>
        <Group gap="sm">
          <CopyButton value={qrUrl} timeout={2000}>
            {({ copied, copy }) => (
              <Button size="sm" variant="default" leftSection={<Copy01Icon size={13} />} onClick={copy} color={copied ? 'green' : undefined}>
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
            )}
          </CopyButton>
          <Button size="sm" color="indigo" leftSection={<Download01Icon size={13} />}
            onClick={() => { downloadQRPng('checkin-qr'); setQrFullscreen(false) }}>
            Download PNG
          </Button>
        </Group>
      </Stack>
    </Modal>

    {/* ── Manual Check-in Modal ── */}
    <Modal
      opened={manualOpen} onClose={closeManual}
      title={<Text fw={700} size="sm">Manual check-in</Text>}
      radius="xl" size="sm"
    >
      <Stack gap="md">
        <TextInput
          placeholder="Search by name, email or phone…"
          value={memberQuery}
          onChange={e => { setMemberQuery(e.target.value); setSelectedMember(null) }}
          leftSection={<Search01Icon size={14} style={{ color: '#9ca3af' }} />}
          size="sm" autoFocus
        />

        {memberResults.length > 0 && !selectedMember && (
          <Paper radius="lg" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
            <Stack gap={0}>
              {memberResults.map(mem => {
                const isActive  = mem.sub_status === 'active'
                const isBlocked = !mem.sub_status || mem.sub_status === 'expired' || mem.sub_status === 'cancelled'
                return (
                  <Group key={mem.id} px="md" py="sm"
                    style={{ borderBottom: '1px solid #f4f5f9', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                    onClick={() => setSelectedMember(mem)}
                  >
                    <Avatar size={28} radius="xl" color="indigo" variant="filled" fz={10} fw={700}>
                      {mem.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                    </Avatar>
                    <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" fw={600} style={{ color: '#111827' }} truncate>{mem.name}</Text>
                      <Text size="xs" c="dimmed" truncate>{mem.email}</Text>
                    </Stack>
                    <Badge size="xs" variant="light" color={isActive ? 'green' : isBlocked ? 'red' : 'gray'}>
                      {mem.sub_status ?? 'no sub'}
                    </Badge>
                  </Group>
                )
              })}
            </Stack>
          </Paper>
        )}

        {lookupLoading && <Text size="xs" c="dimmed" ta="center">Searching…</Text>}

        {selectedMember && (() => {
          const isActive  = selectedMember.sub_status === 'active'
          const isBlocked = !selectedMember.sub_status || selectedMember.sub_status === 'expired' || selectedMember.sub_status === 'cancelled'
          return (
            <Stack gap="sm">
              <Paper radius="lg" p="sm" withBorder style={{ borderColor: isBlocked ? '#fecaca' : isActive ? '#bbf7d0' : '#edeef4' }}>
                <Group gap="sm">
                  <Avatar size={36} radius="xl" color="indigo" variant="filled" fz={12} fw={700}>
                    {selectedMember.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </Avatar>
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text size="sm" fw={700} style={{ color: '#111827' }}>{selectedMember.name}</Text>
                    <Group gap={6}>
                      <Badge size="xs" variant="light" color={isActive ? 'green' : isBlocked ? 'red' : 'gray'}>
                        {selectedMember.sub_status ?? 'no subscription'}
                      </Badge>
                      {selectedMember.expires_at && (
                        <Text size="xs" c="dimmed">
                          expires {new Date(selectedMember.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      )}
                    </Group>
                  </Stack>
                  <Cancel01Icon size={14} style={{ color: '#9ca3af', cursor: 'pointer' }} onClick={() => setSelectedMember(null)} />
                </Group>
              </Paper>

              {isBlocked && (
                <Alert color="red" radius="lg" icon={<Alert01Icon size={14} />}>
                  <Text size="xs" fw={600}>Subscription {selectedMember.sub_status ?? 'missing'}</Text>
                  <Text size="xs" c="dimmed">This member does not have an active subscription. You can still override and check them in.</Text>
                </Alert>
              )}

              <Group justify="flex-end">
                <Button variant="default" size="sm" onClick={closeManual}>Cancel</Button>
                <Button size="sm" color={isBlocked ? 'orange' : 'indigo'} loading={checkinSaving}
                  leftSection={<CheckmarkCircle01Icon size={14} />} onClick={doCheckin}>
                  {isBlocked ? 'Override & check in' : 'Check in'}
                </Button>
              </Group>
            </Stack>
          )
        })()}
      </Stack>
    </Modal>
    </>
  )
}
