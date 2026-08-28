'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ReactElement } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Paper, Text, Title, Group, Stack, Badge, Avatar,
  Progress, Box, Flex, SegmentedControl, Grid,
  SimpleGrid, UnstyledButton, Anchor, Button, Divider,
  TextInput, ActionIcon,
} from '@mantine/core'
import {
  UserGroupIcon,
  Activity01Icon,
  ChartUpIcon,
  Alert01Icon,
  UserAdd01Icon,
  QrCode01Icon,
  CreditCardIcon,
  ArrowRight01Icon,
  FlashIcon,
  CheckmarkCircle01Icon,
  BarChartIcon,
  Wallet01Icon,
  Medal01Icon,
  PartyIcon,
  Building01Icon,
  PencilEdit01Icon,
  Cancel01Icon,
  UserGroupIcon as PeopleIcon,
} from 'hugeicons-react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart,
} from 'recharts'
import { api } from '@/lib/api'
import { catchToast } from '@/lib/notifications'
import { PageSkeleton } from '../_components/Skeletons'

// ─── Types ────────────────────────────────────────────────────────────────────

type IconComponent = (props: { size?: number; style?: React.CSSProperties }) => ReactElement | null

interface KpiDef {
  id: string; label: string; value: number | string
  icon: IconComponent; trend: string | null; sub: string; href: string
  currency?: boolean; isPercent?: boolean; sparkData?: number[]
}

interface AlertItem {
  id: string; level: 'warn' | 'error' | 'info'
  message: string; action: string; href: string
}

interface OutstandingItem {
  id: string; name: string; amount: number; days_overdue: number
}

interface PlanRow {
  name: string; members: number; revenue: number; max: number
}

interface ScheduleItem {
  time: string; name: string; capacity: number; max: number; instructor: string
}

interface Milestone {
  id: string; type: 'birthday' | 'anniversary'; name: string; detail: string
}

interface ActivityEvent {
  id: string; dot: string; label: string; sub: string; time: Date
}

interface ChartPoint { label: string; revenue: number; members: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(date: Date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ─── Static data ──────────────────────────────────────────────────────────────

const KPI_DEFS = [
  { id: 'members',   label: 'Total members',   icon: UserGroupIcon,  sub: 'Registered',       href: '/members' },
  { id: 'checkins',  label: 'Check-ins today', icon: Activity01Icon, sub: 'Door entries',      href: '/checkins' },
  { id: 'revenue',   label: 'Revenue (MTD)',   icon: ChartUpIcon,    sub: 'XAF collected',     href: '/payments', currency: true },
  { id: 'retention', label: 'Retention rate',  icon: BarChartIcon,   sub: 'Active last month', href: '/members', isPercent: true },
  { id: 'expiring',  label: 'Expiring soon',   icon: Alert01Icon,    sub: 'Next 7 days',       href: '/subscriptions' },
]

const PEAK_SLOTS = ['6–9am', '9–12pm', '12–3pm', '3–6pm', '6–9pm']
const PEAK_SLOT_HOURS = [[6,9],[9,12],[12,15],[15,18],[18,21]]
const PEAK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DOW_TO_COL = [6, 0, 1, 2, 3, 4, 5] // Sun=0 → col 6, Mon=1 → col 0

const QUICK_ACTIONS = [
  { label: 'Add member',    icon: UserAdd01Icon  as IconComponent, href: '/members' },
  { label: 'New plan',      icon: CreditCardIcon as IconComponent, href: '/subscriptions' },
  { label: 'Scan check-in', icon: QrCode01Icon   as IconComponent, href: '/checkins' },
  { label: 'View payments', icon: Wallet01Icon   as IconComponent, href: '/payments' },
]

const QUICKSTART_ITEMS = [
  { step: 1, title: 'Create a membership plan', href: '/subscriptions', icon: CreditCardIcon as IconComponent },
  { step: 2, title: 'Add your first member',    href: '/members',       icon: UserAdd01Icon  as IconComponent },
  { step: 3, title: 'Share the check-in QR',   href: '/checkins',      icon: QrCode01Icon   as IconComponent },
]

// ─── Animation ────────────────────────────────────────────────────────────────

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <Paper shadow="lg" radius="md" p="sm"
      style={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.08)' }}>
      <Text size="xs" fw={700} mb={4} style={{ color: '#818cf8' }}>{label}</Text>
      {payload.map(p => (
        <Group key={p.name} gap="xs">
          <Box style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <Text size="xs" fw={600} c="white">
            {p.name === 'revenue' ? `XAF ${p.value.toLocaleString('fr-CM')}` : `${p.value} members`}
          </Text>
        </Group>
      ))}
    </Paper>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ kpi, i }: { kpi: KpiDef; i: number }) {
  const Icon = kpi.icon
  const display = kpi.currency
    ? `₣${(kpi.value as number).toLocaleString('fr-CM')}`
    : kpi.isPercent && kpi.value !== '—'
    ? `${kpi.value}%`
    : String(kpi.value)

  const sparkPoints = kpi.sparkData?.map(v => ({ v }))
  const hasSpark = sparkPoints && sparkPoints.length > 1 && sparkPoints.some(p => p.v > 0)
  const sparkColor = kpi.id === 'expiring' ? '#f59e0b' : '#6366f1'

  return (
    <motion.div variants={fade} custom={i} initial="hidden" animate="show">
      <UnstyledButton component={Link} href={kpi.href} style={{ display: 'block', width: '100%' }}>
        <Paper
          radius="xl" p="lg" withBorder
          style={{ borderColor: '#edeef4', transition: 'transform 0.15s, box-shadow 0.15s' }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.transform = 'translateY(-2px)'
            el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.07)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.transform = 'translateY(0)'
            el.style.boxShadow = ''
          }}
        >
          <Group justify="space-between" mb="md">
            <Icon size={17} style={{ color: '#9ca3af' }} />
            {kpi.trend && <Badge size="xs" color={kpi.trend.startsWith('+') ? 'green' : 'red'} variant="light">{kpi.trend}</Badge>}
          </Group>
          <Text style={{ fontSize: '2.1rem', fontWeight: 900, lineHeight: 1, color: '#111827', letterSpacing: '-0.03em' }}>
            {display}
          </Text>
          <Text size="sm" fw={600} mt={6} style={{ color: '#374151' }}>{kpi.label}</Text>
          <Text size="xs" c="dimmed" mt={2}>{kpi.sub}</Text>
          {hasSpark && (
            <Box mt="sm" style={{ height: 36, marginLeft: -4, marginRight: -4 }}>
              <ResponsiveContainer width="100%" height={36}>
                <LineChart data={sparkPoints} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Line
                    type="monotone" dataKey="v"
                    stroke={sparkColor} strokeWidth={1.5}
                    dot={false} isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </UnstyledButton>
    </motion.div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function Label({ children }: { children: string }) {
  return (
    <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
      {children}
    </Text>
  )
}

function PanelHeader({ label, action, href }: { label: string; action?: string; href?: string }) {
  return (
    <Group justify="space-between" mb="sm">
      <Label>{label}</Label>
      {action && href && (
        <Anchor component={Link} href={href} size="xs" c="dimmed" fw={600}>{action} →</Anchor>
      )}
    </Group>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalMembers: number
  activeMembers: number
  expiringSoon: number
  checkinsToday: number
  revenueThisMonth: number
  overduePayments: number
  deltaRevenue: number
  deltaNewMembers: number
  deltaCheckins: number
  chartData: ChartPoint[]
  checkinsWeek: number[]
  staffName: string | null
}

type Period = '7d' | '30d' | '90d' | 'ytd'

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [done, setDone] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem('myfiti_checklist_done')
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
    } catch { return new Set() }
  })
  const [goalInput, setGoalInput] = useState('500000')
  const [editingGoal, setEditingGoal] = useState(false)
  const [goal, setGoal] = useState(() => {
    if (typeof window === 'undefined') return 500000
    const saved = localStorage.getItem('myfiti_revenue_goal')
    return saved ? parseInt(saved, 10) || 500000 : 500000
  })
  const [gymName, setGymName] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentMembers, setRecentMembers] = useState<Array<{ name: string; plan: string | null; status: 'active' | 'inactive'; joined: string }>>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [outstanding, setOutstanding] = useState<OutstandingItem[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [capacity, setCapacity] = useState({ current: 0, max: 50 })
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([])
  const [peakGrid, setPeakGrid] = useState<number[][]>(
    Array.from({ length: 5 }, () => Array(7).fill(0))
  )
  const [chartData, setChartData] = useState<ChartPoint[]>([])

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashData, membersData, plansData, outstandingData, milestonesData, activityData, capacityData, classesData, settingsData] = await Promise.all([
        api.get<DashboardStats>(`/api/analytics/dashboard?period=${period}`),
        api.get<{ members: Array<{ name: string; status: string; created_at: string; plan_name?: string }> }>('/api/members?limit=6'),
        api.get<{ plans: Array<{ name: string; subscriber_count: string; price: string }> }>('/api/subscriptions/plans'),
        api.get<{ outstanding: OutstandingItem[] }>('/api/analytics/outstanding'),
        api.get<{ milestones: Milestone[] }>('/api/analytics/milestones'),
        api.get<{ events: Array<{ type: string; name: string; time: string; amount?: number; currency?: string }> }>('/api/analytics/activity'),
        api.get<{ current: number; max: number }>('/api/analytics/capacity'),
        api.get<{ classes: Array<{ name: string; starts_at: string; capacity: number; trainer_name?: string }> }>('/api/classes?status=scheduled&limit=5').catch(() => ({ classes: [] })),
        api.get<{ gym_name?: string }>('/api/settings').catch(() => ({})),
      ])

      setStats(dashData)
      setChartData(dashData.chartData ?? [])
      if (settingsData.gym_name) setGymName(settingsData.gym_name)

      const newAlerts: AlertItem[] = []
      if (dashData.expiringSoon > 0) {
        newAlerts.push({ id: 'exp', level: 'warn', message: `${dashData.expiringSoon} membership${dashData.expiringSoon > 1 ? 's' : ''} expiring in the next 7 days`, action: 'Renew', href: '/subscriptions' })
      }
      if (dashData.overduePayments > 0) {
        newAlerts.push({ id: 'ovd', level: 'error', message: `${dashData.overduePayments} member${dashData.overduePayments > 1 ? 's' : ''} in grace period — payment overdue`, action: 'Collect', href: '/payments' })
      }
      setAlerts(newAlerts)

      setRecentMembers((membersData.members ?? []).map(m => ({
        name: m.name,
        plan: m.plan_name ?? null,
        status: m.status === 'active' ? 'active' as const : 'inactive' as const,
        joined: new Date(m.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short' }),
      })))

      const maxSubs = Math.max(...(plansData.plans ?? []).map(p => parseInt(p.subscriber_count ?? '0')), 1)
      setPlans((plansData.plans ?? []).map(p => ({
        name: p.name,
        members: parseInt(p.subscriber_count ?? '0'),
        revenue: parseInt(p.subscriber_count ?? '0') * parseFloat(p.price ?? '0'),
        max: maxSubs,
      })))

      setOutstanding(outstandingData.outstanding ?? [])
      setMilestones(milestonesData.milestones ?? [])
      setCapacity(capacityData)

      // Build activity events
      const events: ActivityEvent[] = (activityData.events ?? []).map((e, i) => ({
        id: String(i),
        dot: e.type === 'checkin' ? '#6366f1' : e.type === 'payment' ? '#10b981' : '#f59e0b',
        label: e.type === 'checkin' ? `${e.name} checked in`
          : e.type === 'payment' ? `${e.name} paid ₣${(e.amount ?? 0).toLocaleString('fr-CM')}`
          : `${e.name} joined`,
        sub: e.type === 'checkin' ? 'QR scan' : e.type === 'payment' ? 'Payment received' : 'New member',
        time: new Date(e.time),
      }))
      setActivity(events)

      // Today's classes
      const today = new Date().toDateString()
      const todayClasses = (classesData.classes ?? [])
        .filter(c => new Date(c.starts_at).toDateString() === today)
        .map(c => ({
          time: new Date(c.starts_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
          name: c.name,
          capacity: 0,
          max: c.capacity,
          instructor: c.trainer_name ?? 'Staff',
        }))
      setTodaySchedule(todayClasses)
    } catch (err) {
      catchToast('Failed to load dashboard')(err)
    } finally {
      setLoading(false)
    }
  }, [period])

  // Fetch peak hours grid
  useEffect(() => {
    api.get<{ peakGrid: Array<{ hour: number; dow: number; count: string }> }>('/api/analytics/checkins?period=90d')
      .then(d => {
        const grid = Array.from({ length: 5 }, () => Array(7).fill(0))
        for (const row of d.peakGrid ?? []) {
          const slotIdx = PEAK_SLOT_HOURS.findIndex(([start, end]) => row.hour >= start && row.hour < end)
          if (slotIdx < 0) continue
          const colIdx = DOW_TO_COL[row.dow] ?? 0
          grid[slotIdx][colIdx] = (grid[slotIdx][colIdx] ?? 0) + parseInt(row.count ?? '0')
        }
        setPeakGrid(grid)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchDashboard()
  }, [fetchDashboard])

  // Poll activity every 30s
  useEffect(() => {
    const id = setInterval(() => {
      api.get<{ events: Array<{ type: string; name: string; time: string; amount?: number }> }>('/api/analytics/activity')
        .then(d => {
          const events: ActivityEvent[] = (d.events ?? []).map((e, i) => ({
            id: String(i),
            dot: e.type === 'checkin' ? '#6366f1' : e.type === 'payment' ? '#10b981' : '#f59e0b',
            label: e.type === 'checkin' ? `${e.name} checked in`
              : e.type === 'payment' ? `${e.name} paid ₣${(e.amount ?? 0).toLocaleString('fr-CM')}`
              : `${e.name} joined`,
            sub: e.type === 'checkin' ? 'QR scan' : e.type === 'payment' ? 'Payment received' : 'New member',
            time: new Date(e.time),
          }))
          setActivity(events)
        })
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const today = new Date()
  const doneCount = done.size
  const allDone = doneCount === QUICKSTART_ITEMS.length
  const isChartEmpty = chartData.every(d => d.revenue === 0 && d.members === 0)
  const peakMax = Math.max(...peakGrid.flat(), 1)
  const collected = stats?.revenueThisMonth ?? 0
  const goalPct = Math.min(Math.round((collected / goal) * 100), 100)
  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate()
  const capacityPct = Math.round((capacity.current / capacity.max) * 100)
  const staffName = stats?.staffName ?? null

  function toggleStep(step: number) {
    setDone(prev => {
      const next = new Set(prev)
      next.has(step) ? next.delete(step) : next.add(step)
      try { localStorage.setItem('myfiti_checklist_done', JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  function saveGoal() {
    const n = parseInt(goalInput.replace(/\D/g, ''), 10)
    if (n > 0) {
      setGoal(n)
      try { localStorage.setItem('myfiti_revenue_goal', String(n)) } catch {}
    }
    setEditingGoal(false)
  }

  if (loading) return <PageSkeleton statCount={5} tableRows={6} tableCols={4} />

  return (
    <Stack gap="lg" p="xl" maw={1400}>

      {/* ── ZONE 1: Page header ── */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" wrap="nowrap" pb="lg"
          style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Text size="xs" fw={600} style={{ color: '#b0b7c3', letterSpacing: '0.04em' }}>
              {format(today, 'EEEE, d MMMM yyyy')}
            </Text>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {getGreeting(today)}{staffName ? `, ${staffName.split(' ')[0]}` : ''}
            </Title>
            <Text size="sm" c="dimmed">Here&apos;s what&apos;s happening at {gymName ?? 'your gym'} today.</Text>
          </Stack>

          <Group gap="md" wrap="nowrap">
            <Group gap={6} px="md" py="xs"
              style={{ background: '#f4f5f9', borderRadius: 10, border: '1px solid #edeef4' }}>
              <Box style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: capacityPct >= 90 ? '#ef4444' : capacityPct >= 70 ? '#f59e0b' : '#10b981',
              }} />
              <Building01Icon size={13} style={{ color: '#9ca3af' }} />
              <Text size="xs" fw={600} style={{ color: '#374151' }}>
                {capacity.current} / {capacity.max}
              </Text>
              <Text size="xs" c="dimmed">today</Text>
            </Group>

            <Button
              component={Link} href="/members"
              variant="filled" color="indigo" size="sm"
              leftSection={<UserAdd01Icon size={14} />} radius="md"
            >
              Add member
            </Button>
          </Group>
        </Group>
      </motion.div>

      {/* ── ZONE 2: KPI strip ── */}
      <SimpleGrid cols={{ base: 2, sm: 3, xl: 5 }} spacing="md">
        {KPI_DEFS.map((def, i) => {
          let value: number | string = 0
          let trend: string | null = null
          let sparkData: number[] | undefined
          if (stats) {
            const last7 = chartData.slice(-7)
            if (def.id === 'members') {
              value = stats.totalMembers
              sparkData = last7.map(d => d.members)
            }
            else if (def.id === 'checkins') {
              value = stats.checkinsToday
              if (stats.deltaCheckins !== 0) trend = `${stats.deltaCheckins > 0 ? '+' : ''}${stats.deltaCheckins}%`
              sparkData = stats.checkinsWeek
            }
            else if (def.id === 'revenue') {
              value = stats.revenueThisMonth
              if (stats.deltaRevenue !== 0) trend = `${stats.deltaRevenue > 0 ? '+' : ''}${stats.deltaRevenue}%`
              sparkData = last7.map(d => d.revenue)
            }
            else if (def.id === 'retention') value = stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : '—'
            else if (def.id === 'expiring') value = stats.expiringSoon
          }
          const kpi: KpiDef = { ...def, value, trend, sparkData }
          return <KpiCard key={def.id} kpi={kpi} i={i + 1} />
        })}
      </SimpleGrid>

      {/* ── ZONE 3: Alerts ── */}
      {alerts.length > 0 && (
        <motion.div variants={fade} custom={6} initial="hidden" animate="show">
          <Paper radius="xl" withBorder style={{ borderColor: '#fecaca' }} px="lg" py="md">
            <Label>Needs attention</Label>
            <Stack gap="xs" mt="sm">
              {alerts.map(a => {
                const alertColor = a.level === 'error' ? '#ef4444' : a.level === 'warn' ? '#f59e0b' : '#6366f1'
                const alertBg   = a.level === 'error' ? '#fef2f2' : a.level === 'warn' ? '#fffbeb' : '#eef2ff'
                return (
                  <Group key={a.id} justify="space-between" wrap="nowrap" px="md" py="sm"
                    style={{ background: alertBg, borderRadius: 10 }}>
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Box style={{ width: 6, height: 6, borderRadius: '50%', background: alertColor, flexShrink: 0 }} />
                      <Text size="xs" fw={600} style={{ color: '#374151' }} truncate>{a.message}</Text>
                    </Group>
                    <Anchor component={Link} href={a.href} size="xs" fw={700} style={{ color: alertColor, whiteSpace: 'nowrap' }}>
                      {a.action} →
                    </Anchor>
                  </Group>
                )
              })}
            </Stack>
          </Paper>
        </motion.div>
      )}

      {/* ── ZONE 4: Main grid ── */}
      <Grid gap="md" style={{ alignItems: 'flex-start' }}>

        {/* ── 4A: Main content (8 cols) ── */}
        <Grid.Col span={{ base: 12, xl: 8 }}>
          <Stack gap="md">

            {/* Revenue & Growth chart */}
            <motion.div variants={fade} custom={7} initial="hidden" animate="show">
              <Paper radius="xl" withBorder style={{ borderColor: '#edeef4' }}>
                <Flex align="center" justify="space-between" wrap="wrap" gap="sm" px="lg" pt="lg" pb="md">
                  <Stack gap={4}>
                    <Text fw={700} size="sm" style={{ color: '#111827' }}>Revenue &amp; Growth</Text>
                    <Group gap="lg">
                      <Group gap={6}>
                        <Box style={{ width: 10, height: 10, borderRadius: 2, background: '#6366f1', flexShrink: 0 }} />
                        <Text size="xs" c="dimmed" fw={500}>Revenue (XAF)</Text>
                      </Group>
                      <Group gap={6}>
                        <Box style={{ width: 14, height: 2, background: '#10b981', flexShrink: 0, borderRadius: 1 }} />
                        <Text size="xs" c="dimmed" fw={500}>New members</Text>
                      </Group>
                    </Group>
                  </Stack>
                  <SegmentedControl
                    size="xs" radius="xl" value={period}
                    onChange={v => setPeriod(v as Period)}
                    data={[
                      { label: '7D', value: '7d' }, { label: '30D', value: '30d' },
                      { label: '90D', value: '90d' }, { label: 'YTD', value: 'ytd' },
                    ]}
                    styles={{
                      root: { background: '#f4f5f9', border: '1px solid #edeef4' },
                      indicator: { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
                      label: { fontWeight: 700 },
                    }}
                  />
                </Flex>

                {isChartEmpty ? (
                  <Flex direction="column" align="center" justify="center" gap="xs"
                    style={{ height: 200, paddingBottom: 16 }}>
                    <BarChartIcon size={28} style={{ color: '#e5e7eb' }} />
                    <Text size="sm" fw={600} style={{ color: '#d1d5db' }}>No data yet</Text>
                    <Text size="xs" c="dimmed" ta="center" maw={260}>
                      Revenue and signups will appear here as you collect payments.
                    </Text>
                  </Flex>
                ) : (
                  <Box px="sm" pb="lg">
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />
                        <Area type="monotone" dataKey="revenue" name="revenue" stroke="#6366f1" strokeWidth={2.5}
                          fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="members" name="members" stroke="#10b981" strokeWidth={2}
                          dot={false} activeDot={{ r: 4, fill: '#059669', strokeWidth: 0 }} strokeDasharray="4 2" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Paper>
            </motion.div>

            {/* Plan distribution + Peak hours */}
            <Grid gap="md">
              <Grid.Col span={6}>
                <motion.div variants={fade} custom={8} initial="hidden" animate="show" style={{ height: '100%' }}>
                  <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4', height: '100%' }}>
                    <PanelHeader label="Plan distribution" action="Manage" href="/subscriptions" />
                    {plans.length > 0 ? (
                      <Stack gap="sm" mt="xs">
                        {plans.map((plan, i) => {
                          const pct = Math.round((plan.members / plan.max) * 100)
                          return (
                            <Box key={`${plan.name}-${i}`}>
                              <Group justify="space-between" mb={4}>
                                <Text size="xs" fw={600} style={{ color: '#374151' }}>{plan.name}</Text>
                                <Group gap="xs">
                                  <Text size="xs" c="dimmed">{plan.members} members</Text>
                                  <Text size="xs" fw={600} style={{ color: '#6366f1' }}>
                                    ₣{plan.revenue.toLocaleString('fr-CM')}
                                  </Text>
                                </Group>
                              </Group>
                              <Progress value={pct} size={4} radius="xl" color="indigo" />
                            </Box>
                          )
                        })}
                      </Stack>
                    ) : (
                      <Flex direction="column" align="center" justify="center" gap={6} py="lg">
                        <CreditCardIcon size={24} style={{ color: '#e5e7eb' }} />
                        <Text size="xs" c="dimmed" ta="center">No plans created yet.</Text>
                        <Anchor component={Link} href="/subscriptions" size="xs" c="indigo" fw={600}>
                          Create first plan →
                        </Anchor>
                      </Flex>
                    )}
                  </Paper>
                </motion.div>
              </Grid.Col>

              <Grid.Col span={6}>
                <motion.div variants={fade} custom={9} initial="hidden" animate="show" style={{ height: '100%' }}>
                  <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4', height: '100%' }}>
                    <PanelHeader label="Peak hours" action="Check-ins" href="/checkins" />
                    <Group gap={0} mb={6} pl={56}>
                      {PEAK_DAYS.map((d, i) => (
                        <Box key={i} style={{ flex: 1, textAlign: 'center' }}>
                          <Text size="xs" c="dimmed" fw={600}>{d}</Text>
                        </Box>
                      ))}
                    </Group>
                    <Stack gap={4}>
                      {PEAK_SLOTS.map((slot, si) => (
                        <Group key={slot} gap={0} wrap="nowrap">
                          <Text size="xs" c="dimmed" style={{ width: 56, flexShrink: 0, fontSize: 10 }}>{slot}</Text>
                          {peakGrid[si].map((count, di) => {
                            const intensity = count / peakMax
                            return (
                              <Box key={di} style={{ flex: 1, padding: '0 2px' }}>
                                <Box style={{
                                  height: 18, borderRadius: 4,
                                  background: count === 0 ? '#f4f5f9' : `rgba(99,102,241,${0.15 + intensity * 0.75})`,
                                  transition: 'background 0.2s',
                                }} />
                              </Box>
                            )
                          })}
                        </Group>
                      ))}
                    </Stack>
                    {peakGrid.every(r => r.every(c => c === 0)) && (
                      <Text size="xs" c="dimmed" mt="sm" ta="center">
                        Check-in heatmap builds after members start visiting.
                      </Text>
                    )}
                  </Paper>
                </motion.div>
              </Grid.Col>
            </Grid>

            {/* Recent members table */}
            <motion.div variants={fade} custom={10} initial="hidden" animate="show">
              <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
                <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid #f4f5f9' }}>
                  <Label>Recent members</Label>
                  <Anchor component={Link} href="/members" size="xs" fw={600} c="dimmed">
                    <Group gap={4}>View all <ArrowRight01Icon size={12} /></Group>
                  </Anchor>
                </Group>
                <Group px="lg" py={8} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <Box style={{ flex: 1 }}><Text size="xs" fw={600} c="dimmed">Name</Text></Box>
                  <Box style={{ width: 80 }}><Text size="xs" fw={600} c="dimmed">Status</Text></Box>
                  <Box style={{ width: 110 }}><Text size="xs" fw={600} c="dimmed">Joined</Text></Box>
                  <Box style={{ width: 24 }} />
                </Group>
                {recentMembers.length > 0 ? (
                  <Stack gap={0}>
                    {recentMembers.map((m, i) => (
                      <UnstyledButton key={i} component={Link} href="/members" w="100%"
                        px="lg" py="sm"
                        style={{
                          display: 'flex', alignItems: 'center',
                          borderBottom: '1px solid #f9fafb', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                          <Avatar size={28} radius="xl" color="indigo" variant="filled" fz={10} fw={700}>
                            {initials(m.name)}
                          </Avatar>
                          <Stack gap={0} style={{ minWidth: 0 }}>
                            <Text size="xs" fw={600} style={{ color: '#111827' }} truncate>{m.name}</Text>
                            {m.plan && <Text size="xs" c="dimmed" truncate>{m.plan}</Text>}
                          </Stack>
                        </Group>
                        <Box style={{ width: 80 }}>
                          <Badge size="xs" radius="xl" variant="light" color={m.status === 'active' ? 'green' : 'gray'}>
                            {m.status}
                          </Badge>
                        </Box>
                        <Box style={{ width: 110 }}>
                          <Text size="xs" c="dimmed">{m.joined}</Text>
                        </Box>
                        <Box style={{ width: 24 }}>
                          <ArrowRight01Icon size={12} style={{ color: '#d1d5db' }} />
                        </Box>
                      </UnstyledButton>
                    ))}
                  </Stack>
                ) : (
                  <Flex direction="column" align="center" justify="center" gap={6} py="xl">
                    <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>No members yet</Text>
                    <Anchor component={Link} href="/members" size="xs" c="indigo" fw={600}>
                      Add your first member →
                    </Anchor>
                  </Flex>
                )}
              </Paper>
            </motion.div>

          </Stack>
        </Grid.Col>

        {/* ── 4B: Right panel (4 cols) ── */}
        <Grid.Col span={{ base: 12, xl: 4 }}>
          <motion.div variants={fade} custom={11} initial="hidden" animate="show">
            <Stack gap="md">

              {/* 1. Revenue target */}
              <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                <Group justify="space-between" mb="sm">
                  <Label>Monthly target</Label>
                  <ActionIcon size="xs" variant="subtle" color="gray"
                    onClick={() => { setGoalInput(String(goal)); setEditingGoal(true) }}>
                    <PencilEdit01Icon size={12} />
                  </ActionIcon>
                </Group>
                {editingGoal ? (
                  <Group gap="xs">
                    <TextInput
                      size="xs" flex={1} radius="md"
                      value={goalInput}
                      onChange={e => setGoalInput(e.target.value)}
                      leftSection={<Text size="xs" c="dimmed">₣</Text>}
                      onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditingGoal(false) }}
                      autoFocus
                    />
                    <ActionIcon size="sm" color="indigo" variant="light" onClick={saveGoal}>
                      <CheckmarkCircle01Icon size={13} />
                    </ActionIcon>
                    <ActionIcon size="sm" color="gray" variant="subtle" onClick={() => setEditingGoal(false)}>
                      <Cancel01Icon size={13} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <Stack gap={6}>
                    <Group justify="space-between" align="flex-end">
                      <Stack gap={1}>
                        <Text style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1, color: '#111827', letterSpacing: '-0.02em' }}>
                          ₣{collected.toLocaleString('fr-CM')}
                        </Text>
                        <Text size="xs" c="dimmed">of ₣{goal.toLocaleString('fr-CM')} goal</Text>
                      </Stack>
                      <Stack gap={1} align="flex-end">
                        <Text size="sm" fw={800} style={{ color: goalPct >= 100 ? '#10b981' : '#374151' }}>
                          {goalPct}%
                        </Text>
                        <Text size="xs" c="dimmed">{daysLeft}d left</Text>
                      </Stack>
                    </Group>
                    <Progress value={goalPct} size={5} radius="xl"
                      color={goalPct >= 100 ? 'green' : goalPct >= 70 ? 'indigo' : 'gray'} />
                  </Stack>
                )}
              </Paper>

              {/* 2. Outstanding payments */}
              <Paper radius="xl" p="lg" withBorder style={{ borderColor: outstanding.length > 0 ? '#fecaca' : '#edeef4' }}>
                <PanelHeader
                  label="Outstanding"
                  action={outstanding.length > 0 ? 'View all' : undefined}
                  href="/payments"
                />
                {outstanding.length > 0 ? (
                  <Stack gap="xs">
                    {outstanding.slice(0, 5).map(o => (
                      <Group key={o.id} justify="space-between" wrap="nowrap">
                        <Stack gap={1} style={{ minWidth: 0 }}>
                          <Text size="xs" fw={600} style={{ color: '#374151' }} truncate>{o.name}</Text>
                          <Text size="xs" c="dimmed">₣{Number(o.amount).toLocaleString('fr-CM')}</Text>
                        </Stack>
                        <Group gap="xs" wrap="nowrap">
                          <Badge size="xs" color={o.days_overdue > 7 ? 'red' : 'yellow'} variant="light">
                            {o.days_overdue}d overdue
                          </Badge>
                          <Anchor component={Link} href="/payments" size="xs" fw={700} c="red">
                            Collect
                          </Anchor>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed">No outstanding payments.</Text>
                )}
              </Paper>

              {/* 3. Quick actions */}
              <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                <PanelHeader label="Quick actions" />
                <Stack gap="xs">
                  {QUICK_ACTIONS.map(a => {
                    const Icon = a.icon
                    return (
                      <Button
                        key={a.label}
                        component={Link} href={a.href}
                        variant="default" size="sm" fullWidth justify="flex-start"
                        leftSection={<Icon size={14} style={{ color: '#6b7280' }} />}
                        styles={{ label: { color: '#374151', fontWeight: 600 } }}
                      >
                        {a.label}
                      </Button>
                    )
                  })}
                </Stack>
              </Paper>

              {/* 4. Today's schedule — only when classes exist */}
              {todaySchedule.length > 0 && (
                <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                  <PanelHeader label="Today's schedule" action="All classes" href="/classes" />
                  <Stack gap="xs">
                    {todaySchedule.map((s, i) => (
                      <Group key={i} justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                          <Text size="xs" fw={700} style={{ color: '#9ca3af', width: 48, flexShrink: 0 }}>{s.time}</Text>
                          <Stack gap={0} style={{ minWidth: 0 }}>
                            <Text size="xs" fw={600} style={{ color: '#374151' }} truncate>{s.name}</Text>
                            <Text size="xs" c="dimmed" truncate>{s.instructor}</Text>
                          </Stack>
                        </Group>
                        <Badge size="xs" color={s.capacity >= s.max ? 'red' : 'gray'} variant="light">
                          {s.capacity >= s.max ? 'Full' : `${s.capacity}/${s.max}`}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              )}

              {/* 5. Get started */}
              {!allDone && (
                <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                  <Group justify="space-between" mb={6}>
                    <Label>Get started</Label>
                    <Text size="xs" fw={700} style={{ color: '#9ca3af' }}>
                      {doneCount}/{QUICKSTART_ITEMS.length}
                    </Text>
                  </Group>
                  <Progress
                    value={(doneCount / QUICKSTART_ITEMS.length) * 100}
                    size={3} radius="xl" color="indigo" mb="md"
                  />
                  <Stack gap={0}>
                    {QUICKSTART_ITEMS.map((item, i) => {
                      const isDone = done.has(item.step)
                      return (
                        <Box
                          key={item.step}
                          component="button"
                          onClick={() => toggleStep(item.step)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 0', cursor: 'pointer', width: '100%',
                            textAlign: 'left' as const, background: 'transparent', outline: 'none',
                            borderTop: i > 0 ? '1px solid #f4f5f9' : 'none',
                          }}
                        >
                          <Box style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                            border: `2px solid ${isDone ? '#10b981' : '#d1d5db'}`,
                            background: isDone ? '#10b981' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {isDone && <CheckmarkCircle01Icon size={11} style={{ color: '#fff' }} />}
                          </Box>
                          <Text size="xs" fw={isDone ? 500 : 600} style={{
                            flex: 1, color: isDone ? '#9ca3af' : '#374151',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}>
                            {item.title}
                          </Text>
                          {!isDone && <ArrowRight01Icon size={12} style={{ color: '#d1d5db', flexShrink: 0 }} />}
                        </Box>
                      )
                    })}
                  </Stack>
                  <Divider my="md" />
                  <Group gap="xs">
                    <FlashIcon size={12} style={{ color: '#6366f1' }} />
                    <Text size="xs" fw={500} style={{ color: '#6366f1' }}>14-day free trial active</Text>
                  </Group>
                </Paper>
              )}

              {/* 6. Member milestones */}
              {milestones.length > 0 && (
                <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                  <PanelHeader label="Milestones this week" />
                  <Stack gap="xs">
                    {milestones.map(m => (
                      <Group key={m.id} gap="sm" wrap="nowrap">
                        <Box style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: '#ecfdf5',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Medal01Icon size={13} style={{ color: '#059669' }} />
                        </Box>
                        <Stack gap={0} style={{ minWidth: 0 }}>
                          <Text size="xs" fw={600} style={{ color: '#374151' }} truncate>{m.name}</Text>
                          <Text size="xs" c="dimmed">{m.detail}</Text>
                        </Stack>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              )}

              {/* 7. Activity feed */}
              <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                <PanelHeader label="Live activity" action="See all" href="/checkins" />
                {activity.length > 0 ? (
                  <Stack gap={0}>
                    {activity.slice(0, 8).map((event, i) => (
                      <Box key={event.id} style={{ position: 'relative' }}>
                        {i < Math.min(activity.length, 8) - 1 && (
                          <Box style={{
                            position: 'absolute', left: 3, top: 14, bottom: -4,
                            width: 1, background: '#f0f1f5',
                          }} />
                        )}
                        <Group gap="sm" wrap="nowrap" align="flex-start"
                          py={i === 0 ? 0 : 'xs'}
                          pb={i === Math.min(activity.length, 8) - 1 ? 0 : 'xs'}
                        >
                          <Box style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: event.dot, flexShrink: 0, marginTop: 5,
                          }} />
                          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs" fw={600} style={{ color: '#374151' }}>{event.label}</Text>
                            <Text size="xs" c="dimmed" truncate>{event.sub}</Text>
                          </Stack>
                          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {formatDistanceToNow(event.time, { addSuffix: true })}
                          </Text>
                        </Group>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed">Check-ins and events appear here live.</Text>
                )}
                <Divider mt="md" mb="sm" />
                <Text size="xs" c="dimmed">Refreshes every 30 seconds.</Text>
              </Paper>

            </Stack>
          </motion.div>
        </Grid.Col>

      </Grid>

      <Box h={32} />
    </Stack>
  )
}
