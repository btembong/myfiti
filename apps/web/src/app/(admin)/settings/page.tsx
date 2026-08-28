'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, TextInput, Select, Button, Text, Title,
  Group, Stack, ThemeIcon, Divider,
} from '@mantine/core'
import {
  Dumbbell01Icon,
  Location01Icon,
  GlobeIcon,
  Clock01Icon,
  FloppyDiskIcon,
  CheckmarkCircle01Icon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { catchToast, showError, showSuccess } from '@/lib/notifications'

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const } }),
}

export default function SettingsGeneralPage() {
  const [form, setForm] = useState({
    gymName:  '',
    slug:     '',
    country:  'CM',
    timezone: 'Africa/Douala',
    website:  '',
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<{ gym_name: string; slug: string; country: string; timezone: string }>('/api/settings')
      .then(d => setForm(f => ({
        ...f,
        gymName: d.gym_name ?? f.gymName,
        slug: d.slug ?? f.slug,
        country: d.country ?? f.country,
        timezone: d.timezone ?? f.timezone,
      })))
      .catch(catchToast('Failed to load settings'))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch('/api/settings', { gym_name: form.gymName, country: form.country, timezone: form.timezone })
      showSuccess('Settings saved')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) { showError(err instanceof Error ? err.message : 'Failed to save settings') }
    finally { setSaving(false) }
  }

  return (
    <Stack gap="xl" p="xl" maw={680}>

      {/* ── Page header ── */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg"
          style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              General settings
            </Title>
            <Text size="sm" c="dimmed">Configure your gym&apos;s basic information.</Text>
          </Stack>
          <Button
            onClick={handleSave}
            loading={saving}
            variant={saved ? 'light' : 'filled'}
            color={saved ? 'green' : 'indigo'}
            size="sm"
            leftSection={saved
              ? <CheckmarkCircle01Icon size={15} />
              : <FloppyDiskIcon size={15} />}
          >
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </Group>
      </motion.div>

      {/* ── Gym identity ── */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="indigo" variant="light">
              <Dumbbell01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Gym identity</Text>
              <Text size="xs" c="dimmed">Name and public URL</Text>
            </Stack>
          </Group>

          <Stack gap="md">
            <TextInput
              label="Gym name"
              value={form.gymName}
              onChange={e => setForm(f => ({ ...f, gymName: e.target.value }))}
              radius="md"
              size="sm"
            />
            <TextInput
              label="Gym slug"
              description="Used in your Gymflow URL"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              leftSection={
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', paddingRight: 4 }}>
                  gymflow.app/
                </Text>
              }
              leftSectionWidth={96}
              radius="md"
              size="sm"
            />
            <TextInput
              label="Website"
              description="Optional"
              placeholder="https://yourgym.com"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              leftSection={<GlobeIcon size={14} style={{ color: '#9ca3af' }} />}
              radius="md"
              size="sm"
            />
          </Stack>
        </Paper>
      </motion.div>

      {/* ── Location & time ── */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="teal" variant="light">
              <Location01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Location &amp; time</Text>
              <Text size="xs" c="dimmed">Region and timezone settings</Text>
            </Stack>
          </Group>

          <Stack gap="md">
            <TextInput
              label="Country"
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              leftSection={<Location01Icon size={14} style={{ color: '#9ca3af' }} />}
              radius="md"
              size="sm"
            />
            <Select
              label="Timezone"
              value={form.timezone}
              onChange={v => setForm(f => ({ ...f, timezone: v ?? f.timezone }))}
              leftSection={<Clock01Icon size={14} style={{ color: '#9ca3af' }} />}
              radius="md"
              size="sm"
              data={[
                { value: 'Africa/Douala',   label: 'Africa/Douala (WAT, UTC+1)' },
                { value: 'Africa/Lagos',    label: 'Africa/Lagos (WAT, UTC+1)' },
                { value: 'Africa/Nairobi',  label: 'Africa/Nairobi (EAT, UTC+3)' },
                { value: 'Europe/London',   label: 'Europe/London (GMT/BST)' },
                { value: 'America/New_York',label: 'America/New_York (ET)' },
              ]}
            />
          </Stack>
        </Paper>
      </motion.div>

      {/* ── Bottom save ── */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <Divider mb="md" />
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={saving}
            variant={saved ? 'light' : 'filled'}
            color={saved ? 'green' : 'indigo'}
            size="sm"
            leftSection={saved
              ? <CheckmarkCircle01Icon size={15} />
              : <FloppyDiskIcon size={15} />}
          >
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </Group>
      </motion.div>

    </Stack>
  )
}
