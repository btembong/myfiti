'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, Badge, Button,
  Box, Flex, SimpleGrid, Overlay, ThemeIcon,
} from '@mantine/core'
import {
  Calendar01Icon,
  UserCheck01Icon,
  StarsIcon,
  ArrowUpRight01Icon,
  CrownIcon,
  Clock01Icon,
  UserGroupIcon,
  Dumbbell01Icon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { catchToast } from '@/lib/notifications'
import { PageSkeleton } from '../_components/Skeletons'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GymClass {
  id: string; name: string; instructor: string; time: string
  day: string; capacity: number; max: number; type: string; color: string
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
      <Flex
        direction="column" align="center" justify="center" gap="md"
        style={{ position: 'absolute', inset: 0 }}
      >
        <ThemeIcon size={56} radius="xl" color="indigo" variant="light">
          <CrownIcon size={26} />
        </ThemeIcon>
        <Stack gap={4} align="center">
          <Text fw={800} size="md" style={{ color: '#111827' }}>Growth+ required</Text>
          <Text size="sm" c="dimmed" ta="center" maw={320}>
            Classes and scheduling are available on the Growth+ plan.
            Upgrade to unlock class management, trainer assignments, and capacity tracking.
          </Text>
        </Stack>
        <Button
          component={Link} href="/settings/billing"
          color="indigo" size="sm" radius="md"
          leftSection={<StarsIcon size={14} />}
          rightSection={<ArrowUpRight01Icon size={14} />}
        >
          Upgrade to Growth+
        </Button>
      </Flex>
    </Box>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassesPage() {
  const [classes, setClasses] = useState<GymClass[]>([])
  const [isGrowthPlus, setIsGrowthPlus] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ plan: string }>('/api/settings')
        .then(d => setIsGrowthPlus(d.plan === 'growth_plus' || d.plan === 'enterprise'))
        .catch(catchToast('Failed to load settings')),

      api.get<{ classes: Array<{ id: string; name: string; trainer_name: string; starts_at: string; recurrence: string; booked_count: string; capacity: number; description: string }> }>('/api/classes')
        .then(d => setClasses((d.classes ?? []).map(c => ({
          id: c.id, name: c.name,
          instructor: c.trainer_name ?? 'Unassigned',
          time: c.starts_at ? new Date(c.starts_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—',
          day: c.recurrence ?? new Date(c.starts_at).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
          capacity: parseInt(c.booked_count ?? '0'),
          max: c.capacity ?? 20,
          type: c.description?.split(' ')[0] ?? 'Class',
          color: '#6366f1',
        }))))
        .catch(catchToast('Failed to load classes')),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSkeleton statCount={3} tableRows={4} tableCols={3} />

  return (
    <Stack gap="lg" p="xl" maw={1400}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Group gap="xs">
              <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Classes
              </Title>
              <Badge size="xs" color="indigo" variant="light" leftSection={<CrownIcon size={10} />}>
                Growth+
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">Schedule and manage gym classes, capacity, and instructors.</Text>
          </Stack>
          <Group gap="sm">
            <Button
              size="sm" color="indigo"
              leftSection={<Calendar01Icon size={14} />}
              disabled={!isGrowthPlus}
            >
              Create class
            </Button>
          </Group>
        </Group>
      </motion.div>

      {/* Locked content */}
      <Box style={{ position: 'relative' }}>
        {!isGrowthPlus && <GrowthPlusLock />}

        <Stack gap="md" style={{ opacity: isGrowthPlus ? 1 : 0.4, pointerEvents: isGrowthPlus ? 'auto' : 'none' }}>

          {/* Stats */}
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
            {[
              { label: 'Total classes', value: classes.length, icon: Calendar01Icon },
              { label: 'Classes today', value: 2, icon: Clock01Icon },
              { label: 'Avg capacity', value: '73%', icon: UserGroupIcon },
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

          {/* Class cards */}
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
            {classes.map((cls, i) => (
              <motion.div key={cls.id} variants={fade} custom={i + 2} initial="hidden" animate="show">
                <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                  <Group justify="space-between" mb="md">
                    <Badge size="xs" variant="light"
                      style={{ background: cls.color + '20', color: cls.color }}>
                      {cls.type}
                    </Badge>
                    <Text size="xs" c="dimmed">{cls.day}</Text>
                  </Group>

                  <Text fw={800} size="sm" style={{ color: '#111827' }} mb={2}>{cls.name}</Text>

                  <Group gap="xs" mb="md">
                    <UserCheck01Icon size={13} style={{ color: '#9ca3af' }} />
                    <Text size="xs" c="dimmed">{cls.instructor}</Text>
                    <Text size="xs" c="dimmed">·</Text>
                    <Clock01Icon size={13} style={{ color: '#9ca3af' }} />
                    <Text size="xs" c="dimmed">{cls.time}</Text>
                  </Group>

                  {/* Capacity bar */}
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Capacity</Text>
                      <Text size="xs" fw={600}
                        style={{ color: cls.capacity >= cls.max ? '#ef4444' : '#374151' }}>
                        {cls.capacity}/{cls.max}
                        {cls.capacity >= cls.max && ' · Full'}
                      </Text>
                    </Group>
                    <Box style={{ height: 4, borderRadius: 4, background: '#f4f5f9', overflow: 'hidden' }}>
                      <Box style={{
                        height: '100%',
                        width: `${Math.round((cls.capacity / cls.max) * 100)}%`,
                        background: cls.capacity >= cls.max ? '#ef4444' : cls.color,
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }} />
                    </Box>
                  </Stack>
                </Paper>
              </motion.div>
            ))}
          </SimpleGrid>

        </Stack>
      </Box>

    </Stack>
  )
}
