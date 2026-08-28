'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, Badge, Avatar,
  Button, Box, Flex, SimpleGrid, Overlay, ThemeIcon,
} from '@mantine/core'
import {
  UserCheck01Icon,
  UserAdd01Icon,
  StarsIcon,
  ArrowUpRight01Icon,
  CrownIcon,
  Mail01Icon,
  SmartPhone01Icon,
  Calendar01Icon,
  UserGroupIcon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { catchToast } from '@/lib/notifications'
import { PageSkeleton } from '../_components/Skeletons'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trainer {
  id: string; name: string; email: string; phone: string
  specializations: string[]; classesThisWeek: number; members: number; bio: string
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

// ─── Lock overlay ─────────────────────────────────────────────────────────────

function GrowthPlusLock() {
  return (
    <Box style={{ position: 'absolute', inset: 0, zIndex: 10, borderRadius: 24 }}>
      <Overlay blur={6} opacity={0.6} color="#fff" radius="xl" />
      <Flex direction="column" align="center" justify="center" gap="md"
        style={{ position: 'absolute', inset: 0 }}>
        <ThemeIcon size={56} radius="xl" color="indigo" variant="light">
          <CrownIcon size={26} />
        </ThemeIcon>
        <Stack gap={4} align="center">
          <Text fw={800} size="md" style={{ color: '#111827' }}>Growth+ required</Text>
          <Text size="sm" c="dimmed" ta="center" maw={320}>
            Trainer management is available on the Growth+ plan.
            Upgrade to manage trainers, assign classes, and track performance.
          </Text>
        </Stack>
        <Button component={Link} href="/settings/billing" color="indigo" size="sm" radius="md"
          leftSection={<StarsIcon size={14} />} rightSection={<ArrowUpRight01Icon size={14} />}>
          Upgrade to Growth+
        </Button>
      </Flex>
    </Box>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [isGrowthPlus, setIsGrowthPlus] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ settings: { plan: string } }>('/api/settings')
        .then(r => setIsGrowthPlus(r.settings?.plan === 'growth_plus')).catch(catchToast('Failed to load settings')),
      api.get<{ staff: Record<string, unknown>[] }>('/api/settings/staff')
        .then(r => {
          const t = (r.staff ?? []).filter((s: Record<string, unknown>) => s.role === 'trainer')
          setTrainers(t.map((s: Record<string, unknown>) => ({
            id: s.id as string,
            name: s.name as string,
            email: (s.email as string) ?? '',
            phone: (s.phone as string) ?? '',
            specializations: [],
            classesThisWeek: parseInt(String(s.classes_this_week ?? '0'), 10) || 0,
            members: parseInt(String(s.members_coached ?? '0'), 10) || 0,
            bio: (s.bio as string) ?? '',
          })))
        }).catch(catchToast('Failed to load trainers')),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSkeleton statCount={3} tableRows={3} tableCols={3} />

  return (
    <Stack gap="lg" p="xl" maw={1400}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Group gap="xs">
              <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Trainers
              </Title>
              <Badge size="xs" color="indigo" variant="light" leftSection={<CrownIcon size={10} />}>
                Growth+
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">Manage your coaching staff, specializations, and class assignments.</Text>
          </Stack>
          <Button size="sm" color="indigo" leftSection={<UserAdd01Icon size={14} />}
            disabled={!isGrowthPlus}>
            Add trainer
          </Button>
        </Group>
      </motion.div>

      {/* Locked content */}
      <Box style={{ position: 'relative' }}>
        {!isGrowthPlus && <GrowthPlusLock />}

        <Stack gap="md" style={{ opacity: isGrowthPlus ? 1 : 0.4, pointerEvents: isGrowthPlus ? 'auto' : 'none' }}>

          {/* Stats */}
          <SimpleGrid cols={{ base: 3 }} spacing="md">
            {[
              { label: 'Total trainers', value: trainers.length, icon: UserCheck01Icon },
              { label: 'Classes this week', value: trainers.reduce((a, t) => a + t.classesThisWeek, 0), icon: Calendar01Icon },
              { label: 'Total members coached', value: trainers.reduce((a, t) => a + t.members, 0), icon: UserGroupIcon },
            ].map((s, i) => {
              const Icon = s.icon
              return (
                <Paper key={i} radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                  <Icon size={17} style={{ color: '#9ca3af' }} />
                  <Text style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1, color: '#111827', letterSpacing: '-0.02em', marginTop: 12 }}>
                    {s.value}
                  </Text>
                  <Text size="xs" fw={600} mt={4} style={{ color: '#374151' }}>{s.label}</Text>
                </Paper>
              )
            })}
          </SimpleGrid>

          {/* Trainer cards */}
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
            {trainers.map((t, i) => (
              <motion.div key={t.id} variants={fade} custom={i + 2} initial="hidden" animate="show">
                <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                  <Group gap="md" mb="md" align="flex-start">
                    <Avatar size={48} radius="xl" color="indigo" variant="filled" fw={700}>
                      {initials(t.name)}
                    </Avatar>
                    <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={800} size="sm" style={{ color: '#111827' }} truncate>{t.name}</Text>
                      <Group gap={4} wrap="wrap">
                        {t.specializations.map(s => (
                          <Badge key={s} size="xs" color="indigo" variant="light">{s}</Badge>
                        ))}
                      </Group>
                    </Stack>
                  </Group>

                  <Text size="xs" c="dimmed" mb="md" lineClamp={2}>{t.bio}</Text>

                  <Stack gap="xs" mb="md">
                    <Group gap="xs">
                      <Mail01Icon size={12} style={{ color: '#9ca3af' }} />
                      <Text size="xs" c="dimmed" truncate>{t.email}</Text>
                    </Group>
                    <Group gap="xs">
                      <SmartPhone01Icon size={12} style={{ color: '#9ca3af' }} />
                      <Text size="xs" c="dimmed">{t.phone}</Text>
                    </Group>
                  </Stack>

                  <Group gap="md" pt="sm" style={{ borderTop: '1px solid #f4f5f9' }}>
                    <Stack gap={0} align="center">
                      <Text size="sm" fw={800} style={{ color: '#111827' }}>{t.classesThisWeek}</Text>
                      <Text size="xs" c="dimmed">Classes/wk</Text>
                    </Stack>
                    <Stack gap={0} align="center">
                      <Text size="sm" fw={800} style={{ color: '#111827' }}>{t.members}</Text>
                      <Text size="xs" c="dimmed">Members</Text>
                    </Stack>
                    <Box style={{ flex: 1 }} />
                    <Button size="xs" variant="default">View schedule</Button>
                  </Group>
                </Paper>
              </motion.div>
            ))}
          </SimpleGrid>

        </Stack>
      </Box>

    </Stack>
  )
}
