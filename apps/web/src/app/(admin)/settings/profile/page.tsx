'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, TextInput, Textarea, Button, Text, Title,
  Group, Stack, ThemeIcon, Divider, SimpleGrid, Select, Avatar, Box, Loader,
} from '@mantine/core'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import {
  Building01Icon,
  Location01Icon,
  SmartPhone01Icon,
  GlobeIcon,
  InstagramIcon,
  Facebook01Icon,
  Camera01Icon,
  FloppyDiskIcon,
  CheckmarkCircle01Icon,
  Clock01Icon,
} from 'hugeicons-react'

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const } }),
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const TIME_OPTIONS = [
  { value: 'closed', label: 'Closed' },
  ...Array.from({ length: 24 * 2 }, (_, i) => {
    const h = Math.floor(i / 2)
    const m = i % 2 === 0 ? '00' : '30'
    const label = `${String(h).padStart(2, '0')}:${m}`
    return { value: label, label }
  }),
]

type DayHours = { open: string; close: string }

const DEFAULT_HOURS: Record<string, DayHours> = {
  Monday:    { open: '06:00', close: '22:00' },
  Tuesday:   { open: '06:00', close: '22:00' },
  Wednesday: { open: '06:00', close: '22:00' },
  Thursday:  { open: '06:00', close: '22:00' },
  Friday:    { open: '06:00', close: '21:00' },
  Saturday:  { open: '08:00', close: '18:00' },
  Sunday:    { open: 'closed', close: 'closed' },
}

export default function GymProfilePage() {
  const [form, setForm] = useState({
    name: '', address: '', city: '', phone: '',
    email: '', website: '', instagram: '', facebook: '', bio: '',
  })
  const [hours, setHours] = useState<Record<string, DayHours>>(DEFAULT_HOURS)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ profile: Record<string, unknown> }>('/api/settings/profile')
      .then(data => {
        const p = data.profile ?? {}
        setForm({
          name:      (p.gym_name as string)  ?? '',
          address:   (p.address as string)   ?? '',
          city:      (p.city as string)      ?? '',
          phone:     (p.phone as string)     ?? '',
          email:     (p.email as string)     ?? '',
          website:   (p.website as string)   ?? '',
          instagram: (p.instagram as string) ?? '',
          facebook:  (p.facebook as string)  ?? '',
          bio:       (p.bio as string)       ?? '',
        })
        if (p.opening_hours) {
          setHours(p.opening_hours as Record<string, DayHours>)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch('/api/settings/profile', {
        gym_name: form.name, address: form.address, city: form.city,
        phone: form.phone, email: form.email, website: form.website,
        instagram: form.instagram, facebook: form.facebook, bio: form.bio,
        opening_hours: hours,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      notifications.show({ color: 'red', message: 'Failed to save profile.' })
    } finally {
      setSaving(false)
    }
  }

  function setDay(day: string, field: 'open' | 'close', value: string) {
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }))
  }

  if (loading) return <Loader size="sm" color="indigo" m="xl" />

  return (
    <Stack gap="xl" p="xl" maw={720}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Gym profile
            </Title>
            <Text size="sm" c="dimmed">Public-facing information about your gym.</Text>
          </Stack>
          <Button
            onClick={handleSave}
            variant={saved ? 'light' : 'filled'}
            color={saved ? 'green' : 'indigo'}
            size="sm"
            loading={saving}
            leftSection={saved ? <CheckmarkCircle01Icon size={15} /> : <FloppyDiskIcon size={15} />}
          >
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </Group>
      </motion.div>

      {/* Logo */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="gray" variant="light">
              <Camera01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Gym logo</Text>
              <Text size="xs" c="dimmed">PNG or JPG, max 2 MB</Text>
            </Stack>
          </Group>
          <Group gap="lg">
            <Avatar size={80} radius="xl" color="indigo" variant="light">
              <Building01Icon size={32} />
            </Avatar>
            <Stack gap="xs">
              <Button size="xs" variant="default">Upload logo</Button>
              <Text size="xs" c="dimmed">Recommended: 256 × 256 px</Text>
            </Stack>
          </Group>
        </Paper>
      </motion.div>

      {/* Identity */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="indigo" variant="light">
              <Building01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Business info</Text>
              <Text size="xs" c="dimmed">Name, contact, and description</Text>
            </Stack>
          </Group>
          <Stack gap="md">
            <TextInput
              label="Gym name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              radius="md" size="sm"
            />
            <Textarea
              label="About / bio"
              placeholder="Tell members what makes your gym special…"
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              radius="md" size="sm" rows={3} autosize minRows={3} maxRows={6}
            />
            <SimpleGrid cols={2} spacing="md">
              <TextInput
                label="Email"
                placeholder="contact@yourgym.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                radius="md" size="sm"
              />
              <TextInput
                label="Phone"
                placeholder="+237 6XX XXX XXX"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                leftSection={<SmartPhone01Icon size={14} style={{ color: '#9ca3af' }} />}
                radius="md" size="sm"
              />
            </SimpleGrid>
            <TextInput
              label="Website"
              placeholder="https://yourgym.com"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              leftSection={<GlobeIcon size={14} style={{ color: '#9ca3af' }} />}
              radius="md" size="sm"
            />
          </Stack>
        </Paper>
      </motion.div>

      {/* Location */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="gray" variant="light">
              <Location01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Address</Text>
              <Text size="xs" c="dimmed">Physical location of your gym</Text>
            </Stack>
          </Group>
          <Stack gap="md">
            <TextInput
              label="Street address"
              placeholder="123 Fitness Avenue"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              radius="md" size="sm"
            />
            <TextInput
              label="City / Town"
              placeholder="Douala"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              radius="md" size="sm"
            />
          </Stack>
        </Paper>
      </motion.div>

      {/* Opening hours */}
      <motion.div variants={fade} custom={4} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="gray" variant="light">
              <Clock01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Opening hours</Text>
              <Text size="xs" c="dimmed">Set &quot;Closed&quot; to mark a day off</Text>
            </Stack>
          </Group>
          <Stack gap="xs">
            {DAYS.map(day => {
              const h = hours[day]
              const isClosed = h.open === 'closed'
              return (
                <Group key={day} gap="md" align="center">
                  <Text size="xs" fw={600} style={{ color: '#374151', width: 90, flexShrink: 0 }}>{day}</Text>
                  <Select
                    size="xs" radius="md"
                    style={{ flex: 1 }}
                    value={h.open}
                    onChange={v => setDay(day, 'open', v ?? 'closed')}
                    data={TIME_OPTIONS}
                    placeholder="Open"
                    comboboxProps={{ withinPortal: false }}
                  />
                  {!isClosed && (
                    <>
                      <Text size="xs" c="dimmed">to</Text>
                      <Select
                        size="xs" radius="md"
                        style={{ flex: 1 }}
                        value={h.close}
                        onChange={v => setDay(day, 'close', v ?? 'closed')}
                        data={TIME_OPTIONS.filter(t => t.value !== 'closed')}
                        placeholder="Close"
                        comboboxProps={{ withinPortal: false }}
                      />
                    </>
                  )}
                  {isClosed && (
                    <Box style={{ flex: 2 }}>
                      <Text size="xs" c="dimmed" style={{ color: '#ef4444' }}>Closed</Text>
                    </Box>
                  )}
                </Group>
              )
            })}
          </Stack>
        </Paper>
      </motion.div>

      {/* Social */}
      <motion.div variants={fade} custom={5} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="gray" variant="light">
              <InstagramIcon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Social media</Text>
              <Text size="xs" c="dimmed">Link your social pages</Text>
            </Stack>
          </Group>
          <Stack gap="md">
            <TextInput
              label="Instagram"
              placeholder="@yourgym"
              value={form.instagram}
              onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
              leftSection={<InstagramIcon size={14} style={{ color: '#9ca3af' }} />}
              radius="md" size="sm"
            />
            <TextInput
              label="Facebook"
              placeholder="facebook.com/yourgym"
              value={form.facebook}
              onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))}
              leftSection={<Facebook01Icon size={14} style={{ color: '#9ca3af' }} />}
              radius="md" size="sm"
            />
          </Stack>
        </Paper>
      </motion.div>

      {/* Bottom save */}
      <motion.div variants={fade} custom={6} initial="hidden" animate="show">
        <Divider mb="md" />
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            variant={saved ? 'light' : 'filled'}
            color={saved ? 'green' : 'indigo'}
            size="sm"
            loading={saving}
            leftSection={saved ? <CheckmarkCircle01Icon size={15} /> : <FloppyDiskIcon size={15} />}
          >
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </Group>
      </motion.div>

    </Stack>
  )
}
