'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, Badge,
  Box, SimpleGrid, SegmentedControl, ThemeIcon, Progress, Flex,
} from '@mantine/core'
import {
  BarChartIcon,
  UserGroupIcon,
  Wallet01Icon,
  Activity01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  AnalyticsUpIcon,
  UserAdd01Icon,
  QrCode01Icon,
  CreditCardIcon,
  Target01Icon,
  Ticket01Icon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { catchToast } from '@/lib/notifications'
import { PageSkeleton } from '../_components/Skeletons'

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

const PERIOD_LABELS: Record<string, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '1y': 'This year',
}

// ─── Helper components ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
      {children}
    </Text>
  )
}

function KpiCard({
  label, value, delta, icon: Icon, format = 'number',
}: {
  label: string; value: number; delta: number
  icon: React.ElementType; format?: 'number' | 'currency' | 'percent'
}) {
  const positive = delta >= 0
  const display = format === 'currency'
    ? `₣${value.toLocaleString('fr-CM')}`
    : format === 'percent'
    ? `${value}%`
    : value.toLocaleString()

  return (
    <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
      <Icon size={17} style={{ color: '#9ca3af' }} />
      <Text style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1, color: '#111827', letterSpacing: '-0.02em', marginTop: 12 }}>
        {value === 0 ? '—' : display}
      </Text>
      <Group justify="space-between" mt={6} align="center">
        <Text size="xs" fw={600} style={{ color: '#374151' }}>{label}</Text>
        {delta !== 0 && (
          <Group gap={2}>
            {positive
              ? <ArrowUp01Icon size={10} style={{ color: '#10b981' }} />
              : <ArrowDown01Icon size={10} style={{ color: '#ef4444' }} />}
            <Text size="xs" fw={700} style={{ color: positive ? '#10b981' : '#ef4444' }}>
              {Math.abs(delta)}%
            </Text>
          </Group>
        )}
      </Group>
    </Paper>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <Flex direction="column" align="center" justify="center" gap="sm" py="xl">
      <BarChartIcon size={28} style={{ color: '#e5e7eb' }} />
      <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>No data yet</Text>
      <Text size="xs" c="dimmed" ta="center" maw={260}>{label}</Text>
    </Flex>
  )
}

// ─── Spark bar (pure CSS, no Recharts) ───────────────────────────────────────

function SparkBar({ data, max, color }: { data: { label: string; value: number }[]; max: number; color: string }) {
  if (data.length === 0) return null
  return (
    <Group gap={4} align="flex-end" style={{ height: 80 }}>
      {data.map((d, i) => (
        <Box key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Box style={{
            width: '100%', borderRadius: '3px 3px 0 0',
            height: max > 0 ? `${Math.max(4, Math.round((d.value / max) * 72))}px` : 4,
            background: color,
            transition: 'height 0.3s ease',
          }} />
          <Text size="xs" c="dimmed" style={{ fontSize: 9 }}>{d.label}</Text>
        </Box>
      ))}
    </Group>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface DashStats {
  totalMembers: number; activeMembers: number; checkinsToday: number
  newMembersLast30: number; mrr: number; revenueThisMonth: number
  deltaRevenue: number; deltaNewMembers: number; deltaCheckins: number
}
interface MemberGrowthRow { month: string; new_members: string }
interface CheckinRow { day: string; count: string }
interface PlanRow { plan: string; count: string }
interface RevenueRow { date: string; total: string; count: string }
interface CohortRow { month: string; total: number; active: number; pct: number }
interface ReferralStats {
  total: number; converted: number; pending: number
  total_rewards: number; conversion_rate: number
  monthly: Array<{ month: string; count: string }>
}
interface WalletStats {
  totalFloat: number; accounts: number
  byType: Array<{ type: string; total: number; count: number }>
  topBalances: Array<{ memberId: string; name: string; balance: number; currency: string }>
  dailyTopups: Array<{ day: string; total: number }>
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const [dash, setDash] = useState<DashStats | null>(null)
  const [memberGrowth, setMemberGrowth] = useState<MemberGrowthRow[]>([])
  const [dailyCheckins, setDailyCheckins] = useState<CheckinRow[]>([])
  const [planDist, setPlanDist] = useState<PlanRow[]>([])
  const [revenueDaily, setRevenueDaily] = useState<RevenueRow[]>([])
  const [churnRate, setChurnRate]       = useState(0)
  const [cohorts, setCohorts]           = useState<CohortRow[]>([])
  const [referrals, setReferrals]       = useState<ReferralStats | null>(null)
  const [wallet, setWallet]             = useState<WalletStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const q = `?period=${period}`
    Promise.all([
      api.get<DashStats>(`/api/analytics/dashboard${q}`).then(setDash).catch(catchToast('Failed to load dashboard stats')),
      api.get<{ growth: MemberGrowthRow[]; planDistribution: PlanRow[]; churnRate: number }>(`/api/analytics/members${q}`).then(d => {
        setMemberGrowth(d.growth ?? [])
        setPlanDist(d.planDistribution ?? [])
        setChurnRate(d.churnRate ?? 0)
      }).catch(catchToast('Failed to load member data')),
      api.get<{ daily: CheckinRow[] }>(`/api/analytics/checkins${q}`).then(d => setDailyCheckins(d.daily ?? [])).catch(catchToast('Failed to load check-in data')),
      api.get<{ daily: RevenueRow[] }>(`/api/analytics/revenue${q}`).then(d => setRevenueDaily(d.daily ?? [])).catch(catchToast('Failed to load revenue data')),
      api.get<{ cohorts: CohortRow[] }>('/api/analytics/retention').then(d => setCohorts(d.cohorts ?? [])).catch(() => {}),
      api.get<ReferralStats>('/api/analytics/referrals').then(d => setReferrals(d)).catch(() => {}),
      api.get<WalletStats>('/api/analytics/wallet').then(d => setWallet(d)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [period])

  const checkinData = dailyCheckins.map(d => ({ label: d.day, value: parseInt(d.count ?? '0') }))
  const growthData = memberGrowth.map(d => ({ label: d.month, value: parseInt(d.new_members ?? '0') }))
  const topPlans = planDist.map((p, _i, arr) => {
    const cnt = parseInt(p.count ?? '0')
    const maxCnt = Math.max(...arr.map(x => parseInt(x.count ?? '0')), 1)
    return { name: p.plan, members: cnt, revenue: 0, pct: Math.round((cnt / maxCnt) * 100) }
  })

  const kpi = {
    members:    { value: dash?.totalMembers ?? 0,    delta: 0,                         label: 'Total members' },
    revenue:    { value: dash?.revenueThisMonth ?? 0, delta: dash?.deltaRevenue ?? 0,  label: 'Revenue (XAF)' },
    checkins:   { value: dash?.checkinsToday ?? 0,   delta: dash?.deltaCheckins ?? 0,  label: 'Check-ins today' },
    churnRate:  { value: Math.round(churnRate),       delta: 0,                         label: 'Churn rate (%)' },
    newMembers: { value: dash?.newMembersLast30 ?? 0, delta: dash?.deltaNewMembers ?? 0,label: 'New members (30d)' },
    retention:  { value: dash && dash.totalMembers > 0 ? Math.round((dash.activeMembers / dash.totalMembers) * 100) : 0, delta: 0, label: 'Retention (%)' },
  }

  const revenueData = revenueDaily.map(d => ({ label: d.date?.slice(5) ?? '', value: parseFloat(d.total ?? '0') }))
  const checkinMax  = checkinData.length  ? Math.max(...checkinData.map(d => d.value))  : 0
  const growthMax   = growthData.length   ? Math.max(...growthData.map(d => d.value))   : 0
  const revenueMax  = revenueData.length  ? Math.max(...revenueData.map(d => d.value))  : 0

  if (loading) return <PageSkeleton statCount={6} tableRows={4} tableCols={3} />

  return (
    <Stack gap="lg" p="xl" maw={1200}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Analytics
            </Title>
            <Text size="sm" c="dimmed">Performance overview and growth metrics.</Text>
          </Stack>
          <SegmentedControl
            size="xs" radius="xl"
            value={period} onChange={setPeriod}
            data={[
              { label: '7d', value: '7d' },
              { label: '30d', value: '30d' },
              { label: '90d', value: '90d' },
              { label: '1y', value: '1y' },
            ]}
            styles={{ root: { background: '#f4f5f9' }, label: { fontWeight: 600 } }}
          />
        </Group>
      </motion.div>

      {/* KPI row */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <Stack gap="sm">
          <SectionLabel>{`Key metrics · ${PERIOD_LABELS[period]}`}</SectionLabel>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="md">
            <KpiCard label={kpi.members.label}    value={kpi.members.value}    delta={kpi.members.delta}    icon={UserGroupIcon} />
            <KpiCard label={kpi.revenue.label}    value={kpi.revenue.value}    delta={kpi.revenue.delta}    icon={Wallet01Icon}   format="currency" />
            <KpiCard label={kpi.checkins.label}   value={kpi.checkins.value}   delta={kpi.checkins.delta}   icon={QrCode01Icon} />
            <KpiCard label={kpi.newMembers.label} value={kpi.newMembers.value} delta={kpi.newMembers.delta} icon={UserAdd01Icon} />
            <KpiCard label={kpi.retention.label}  value={kpi.retention.value}  delta={kpi.retention.delta}  icon={Target01Icon}   format="percent" />
            <KpiCard label={kpi.churnRate.label}  value={kpi.churnRate.value}  delta={kpi.churnRate.delta}  icon={Activity01Icon} format="percent" />
          </SimpleGrid>
        </Stack>
      </motion.div>

      {/* Charts row */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">

          {/* Check-in frequency */}
          <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
            <Group justify="space-between" mb="lg">
              <Stack gap={1}>
                <Text size="sm" fw={700} style={{ color: '#111827' }}>Daily check-ins</Text>
                <Text size="xs" c="dimmed">{PERIOD_LABELS[period]}</Text>
              </Stack>
              <ThemeIcon size={32} radius="lg" color="indigo" variant="light">
                <QrCode01Icon size={16} />
              </ThemeIcon>
            </Group>
            {checkinData.length > 0 ? (
              <SparkBar data={checkinData} max={checkinMax} color="#6366f1" />
            ) : (
              <EmptyChart label="Check-in data will appear here once members start scanning." />
            )}
          </Paper>

          {/* Member growth */}
          <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
            <Group justify="space-between" mb="lg">
              <Stack gap={1}>
                <Text size="sm" fw={700} style={{ color: '#111827' }}>Member growth</Text>
                <Text size="xs" c="dimmed">Cumulative total over time</Text>
              </Stack>
              <ThemeIcon size={32} radius="lg" color="teal" variant="light">
                <AnalyticsUpIcon size={16} />
              </ThemeIcon>
            </Group>
            {growthData.length > 0 ? (
              <SparkBar data={growthData} max={growthMax} color="#10b981" />
            ) : (
              <EmptyChart label="Growth data will build as members join over time." />
            )}
          </Paper>

        </SimpleGrid>
      </motion.div>

      {/* Revenue breakdown + Plan distribution */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">

          {/* Revenue over time */}
          <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
            <Group justify="space-between" mb="lg">
              <Stack gap={1}>
                <Text size="sm" fw={700} style={{ color: '#111827' }}>Revenue</Text>
                <Text size="xs" c="dimmed">{PERIOD_LABELS[period]}</Text>
              </Stack>
              <ThemeIcon size={32} radius="lg" color="green" variant="light">
                <Wallet01Icon size={16} />
              </ThemeIcon>
            </Group>
            {revenueData.length > 0 ? (
              <SparkBar data={revenueData} max={revenueMax} color="#22c55e" />
            ) : (
              <EmptyChart label="Revenue data will appear once you start recording payments." />
            )}
          </Paper>

          {/* Plan distribution */}
          <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
            <Group justify="space-between" mb="lg">
              <Stack gap={1}>
                <Text size="sm" fw={700} style={{ color: '#111827' }}>Plan distribution</Text>
                <Text size="xs" c="dimmed">Members per plan</Text>
              </Stack>
              <ThemeIcon size={32} radius="lg" color="violet" variant="light">
                <CreditCardIcon size={16} />
              </ThemeIcon>
            </Group>
            {topPlans.length > 0 ? (
              <Stack gap="sm">
                {topPlans.map(plan => (
                  <Box key={plan.name}>
                    <Group justify="space-between" mb={4}>
                      <Text size="xs" fw={600} style={{ color: '#374151' }}>{plan.name}</Text>
                      <Group gap="xs">
                        <Text size="xs" fw={600} style={{ color: '#111827' }}>{plan.members}</Text>
                        <Text size="xs" c="dimmed">members</Text>
                      </Group>
                    </Group>
                    <Progress value={plan.pct} color="indigo" size="xs" radius="xl" />
                  </Box>
                ))}
              </Stack>
            ) : (
              <EmptyChart label="Plan data will show once members are assigned to plans." />
            )}
          </Paper>

        </SimpleGrid>
      </motion.div>

      {/* Retention cohort */}
      <motion.div variants={fade} custom={4} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group justify="space-between" mb="lg">
            <Stack gap={1}>
              <Group gap="xs">
                <Text size="sm" fw={700} style={{ color: '#111827' }}>Retention overview</Text>
                <Badge size="xs" color="indigo" variant="light">Beta</Badge>
              </Group>
              <Text size="xs" c="dimmed">How long members stay after joining</Text>
            </Stack>
            <ThemeIcon size={32} radius="lg" color="orange" variant="light">
              <Target01Icon size={16} />
            </ThemeIcon>
          </Group>
          {cohorts.length > 0 ? (
            <Box style={{ overflowX: 'auto' }}>
              <Box style={{ display: 'grid', gridTemplateColumns: '120px 80px 80px 80px', gap: 0, minWidth: 360 }}>
                {/* Header */}
                {['Cohort', 'Joined', 'Active', 'Retained'].map(h => (
                  <Text key={h} size="xs" fw={700} style={{ color: '#9ca3af', padding: '6px 8px', borderBottom: '1px solid #f4f5f9' }}>{h}</Text>
                ))}
                {/* Rows */}
                {cohorts.map(c => (
                  <React.Fragment key={c.month}>
                    <Text size="xs" fw={600} style={{ color: '#374151', padding: '8px 8px', borderBottom: '1px solid #f9fafb' }}>
                      {new Date(c.month + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </Text>
                    <Text size="xs" style={{ color: '#6b7280', padding: '8px 8px', borderBottom: '1px solid #f9fafb' }}>{c.total}</Text>
                    <Text size="xs" style={{ color: '#6b7280', padding: '8px 8px', borderBottom: '1px solid #f9fafb' }}>{c.active}</Text>
                    <Box style={{ padding: '8px 8px', borderBottom: '1px solid #f9fafb', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Box style={{ flex: 1, height: 6, borderRadius: 3, background: '#f4f5f9' }}>
                        <Box style={{ width: `${c.pct}%`, height: '100%', borderRadius: 3, background: c.pct >= 70 ? '#10b981' : c.pct >= 40 ? '#f59e0b' : '#ef4444' }} />
                      </Box>
                      <Text size="xs" fw={700} style={{ color: '#374151', width: 32, textAlign: 'right' }}>{c.pct}%</Text>
                    </Box>
                  </React.Fragment>
                ))}
              </Box>
            </Box>
          ) : (
            <EmptyChart label="Retention data builds as members renew their subscriptions over time." />
          )}
        </Paper>
      </motion.div>

      {/* Referral stats */}
      <motion.div variants={fade} custom={5} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group justify="space-between" mb="lg">
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Referrals</Text>
              <Text size="xs" c="dimmed">Member referral programme performance</Text>
            </Stack>
            <ThemeIcon size={32} radius="lg" color="pink" variant="light">
              <Ticket01Icon size={16} />
            </ThemeIcon>
          </Group>

          {referrals ? (
            <Stack gap="md">
              {/* KPI mini-row */}
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                {[
                  { label: 'Total referrals',   value: referrals.total,         color: '#6366f1' },
                  { label: 'Converted',          value: referrals.converted,     color: '#10b981' },
                  { label: 'Pending',            value: referrals.pending,       color: '#f59e0b' },
                  { label: 'Conversion rate',    value: `${referrals.conversion_rate}%`, color: '#3b82f6' },
                ].map(stat => (
                  <Box key={stat.label} style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 16px' }}>
                    <Text style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1, color: stat.color, letterSpacing: '-0.02em' }}>
                      {stat.value}
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>{stat.label}</Text>
                  </Box>
                ))}
              </SimpleGrid>

              {/* Conversion progress bar */}
              <Box>
                <Group justify="space-between" mb={6}>
                  <Text size="xs" fw={600} style={{ color: '#374151' }}>Conversion progress</Text>
                  <Text size="xs" c="dimmed">{referrals.converted} of {referrals.total} converted</Text>
                </Group>
                <Progress value={referrals.conversion_rate} color="indigo" size="sm" radius="xl" />
              </Box>

              {/* Rewards issued */}
              <Group gap="xs">
                <Wallet01Icon size={13} style={{ color: '#9ca3af' }} />
                <Text size="xs" c="dimmed">
                  Total rewards issued:{' '}
                  <Text span fw={700} style={{ color: '#111827' }}>
                    XAF {referrals.total_rewards.toLocaleString('fr-CM')}
                  </Text>
                </Text>
              </Group>

              {/* Monthly spark */}
              {referrals.monthly.length > 0 && (
                <Box>
                  <Text size="xs" fw={600} style={{ color: '#374151' }} mb="xs">Monthly referrals (6 months)</Text>
                  <SparkBar
                    data={referrals.monthly.map(r => ({ label: r.month, value: parseInt(r.count ?? '0') }))}
                    max={Math.max(...referrals.monthly.map(r => parseInt(r.count ?? '0')), 1)}
                    color="#ec4899"
                  />
                </Box>
              )}
            </Stack>
          ) : (
            <EmptyChart label="Referral data will appear once members start using referral codes." />
          )}
        </Paper>
      </motion.div>

      {/* Wallet stats */}
      <motion.div variants={fade} custom={6} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group justify="space-between" mb="lg">
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Member Wallets</Text>
              <Text size="xs" c="dimmed">Digital wallet float and transaction breakdown</Text>
            </Stack>
            <ThemeIcon size={32} radius="lg" color="violet" variant="light">
              <Wallet01Icon size={16} />
            </ThemeIcon>
          </Group>

          {wallet ? (
            <Stack gap="md">
              {/* Float KPIs */}
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                {[
                  { label: 'Total float', value: `₣${wallet.totalFloat.toLocaleString('fr-CM')}`, color: '#7c3aed' },
                  { label: 'Wallet accounts', value: wallet.accounts.toLocaleString(), color: '#6366f1' },
                  { label: 'Topup volume (30d)', value: `₣${wallet.dailyTopups.reduce((s, d) => s + d.total, 0).toLocaleString('fr-CM')}`, color: '#10b981' },
                ].map(stat => (
                  <Box key={stat.label} style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 16px' }}>
                    <Text style={{ fontSize: '1.4rem', fontWeight: 900, lineHeight: 1, color: stat.color, letterSpacing: '-0.02em' }}>
                      {stat.value}
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>{stat.label}</Text>
                  </Box>
                ))}
              </SimpleGrid>

              {/* Transaction type breakdown */}
              {wallet.byType.length > 0 && (
                <Box>
                  <Text size="xs" fw={600} style={{ color: '#374151' }} mb="xs">By transaction type</Text>
                  <Stack gap={6}>
                    {wallet.byType.map(t => {
                      const labels: Record<string, string> = {
                        topup: 'Top-ups', debit: 'Debits', credit: 'Credits',
                        referral_credit: 'Referral credits', cashout: 'Cashouts', transfer: 'Transfers',
                      }
                      const colors: Record<string, string> = {
                        topup: '#10b981', debit: '#ef4444', credit: '#6366f1',
                        referral_credit: '#ec4899', cashout: '#f59e0b', transfer: '#3b82f6',
                      }
                      const color = colors[t.type] ?? '#9ca3af'
                      return (
                        <Group key={t.type} justify="space-between" style={{ fontSize: '0.8rem' }}>
                          <Group gap={6}>
                            <Box style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                            <Text size="xs" fw={600} style={{ color: '#374151' }}>{labels[t.type] ?? t.type}</Text>
                            <Text size="xs" c="dimmed">{t.count}×</Text>
                          </Group>
                          <Text size="xs" fw={700} style={{ color }}>₣{t.total.toLocaleString('fr-CM')}</Text>
                        </Group>
                      )
                    })}
                  </Stack>
                </Box>
              )}

              {/* Top balances */}
              {wallet.topBalances.length > 0 && (
                <Box>
                  <Text size="xs" fw={600} style={{ color: '#374151' }} mb="xs">Top balances</Text>
                  <Stack gap={4}>
                    {wallet.topBalances.map((m, i) => (
                      <Group key={m.memberId} justify="space-between" style={{ padding: '6px 10px', background: i === 0 ? '#faf5ff' : '#f9fafb', borderRadius: 8 }}>
                        <Text size="xs" fw={600} style={{ color: '#374151' }}>{m.name}</Text>
                        <Text size="xs" fw={800} style={{ color: '#7c3aed' }}>{m.currency} {m.balance.toLocaleString('fr-CM')}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Daily topup sparkbar */}
              {wallet.dailyTopups.length > 0 && (
                <Box>
                  <Text size="xs" fw={600} style={{ color: '#374151' }} mb="xs">Daily top-ups (30 days)</Text>
                  <SparkBar
                    data={wallet.dailyTopups.map(d => ({ label: d.day.slice(5), value: d.total }))}
                    max={Math.max(...wallet.dailyTopups.map(d => d.total), 1)}
                    color="#7c3aed"
                  />
                </Box>
              )}
            </Stack>
          ) : (
            <EmptyChart label="Wallet data will appear once members start using the wallet feature." />
          )}
        </Paper>
      </motion.div>

    </Stack>
  )
}
