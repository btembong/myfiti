'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, ThemeIcon,
  Button, TextInput, Modal, Box,
} from '@mantine/core'
import {
  Alert01Icon,
  Delete01Icon,
  Download01Icon,
  DatabaseIcon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { getToken, getTenantSlug } from '@/lib/auth'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const } }),
}

export default function DangerPage() {
  const [deleteOpen, setDeleteOpen]   = useState(false)
  const [resetOpen, setResetOpen]     = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [gymName, setGymName]         = useState('My Gym')
  const [exporting, setExporting]     = useState(false)
  const [resetting, setResetting]     = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const router = useRouter()

  useEffect(() => {
    api.get<{ gym_name?: string }>('/api/settings/profile')
      .then(data => { if (data.gym_name) setGymName(data.gym_name) })
      .catch(() => {})
  }, [])

  async function handleExport() {
    setExporting(true)
    try {
      const token = getToken()
      const slug = getTenantSlug()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (slug) headers['X-Tenant-Slug'] = slug
      const res = await fetch('/api/settings/export', { method: 'POST', headers })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'gym-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      notifications.show({ color: 'red', message: 'Export failed.' })
    } finally {
      setExporting(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      await api.delete('/api/settings/data')
      setResetOpen(false)
      setConfirmText('')
      notifications.show({ color: 'green', message: 'All gym data has been reset.' })
    } catch {
      notifications.show({ color: 'red', message: 'Reset failed. Please try again.' })
    } finally {
      setResetting(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await api.delete('/api/settings/account')
      router.push('/login')
    } catch {
      notifications.show({ color: 'red', message: 'Account deletion failed. Please contact support.' })
      setDeleting(false)
    }
  }

  return (
    <Stack gap="xl" p="xl" maw={640}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group pb="lg" align="flex-end" style={{ borderBottom: '1px solid #fecaca' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#991b1b', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Danger zone
            </Title>
            <Text size="sm" style={{ color: '#b91c1c' }}>
              Irreversible actions — proceed with caution.
            </Text>
          </Stack>
        </Group>
      </motion.div>

      {/* Export data */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="md">
            <ThemeIcon size={36} radius="xl" color="gray" variant="light">
              <Download01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Export all data</Text>
              <Text size="xs" c="dimmed">Download everything — members, payments, check-ins</Text>
            </Stack>
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            We&apos;ll generate a ZIP file containing all your gym data in CSV format.
            This may take a few seconds.
          </Text>
          <Button size="sm" variant="default" leftSection={<Download01Icon size={14} />} loading={exporting} onClick={handleExport}>
            Export all data
          </Button>
        </Paper>
      </motion.div>

      {/* Reset data */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#fecaca', background: '#fff9f9' }}>
          <Group gap="sm" mb="md">
            <ThemeIcon size={36} radius="xl" color="orange" variant="light">
              <DatabaseIcon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Reset gym data</Text>
              <Text size="xs" style={{ color: '#b91c1c' }}>Deletes all members, payments, and check-ins</Text>
            </Stack>
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            This will permanently delete all member records, payment history, subscription plans,
            and check-in logs. Your account and settings will remain.
            <strong style={{ color: '#dc2626' }}> This cannot be undone.</strong>
          </Text>
          <Button
            size="sm" color="orange" variant="light"
            leftSection={<DatabaseIcon size={14} />}
            onClick={() => setResetOpen(true)}
          >
            Reset all data
          </Button>
        </Paper>
      </motion.div>

      {/* Delete account */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#fca5a5', background: '#fff5f5' }}>
          <Group gap="sm" mb="md">
            <ThemeIcon size={36} radius="xl" color="red" variant="light">
              <Delete01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Delete gym account</Text>
              <Text size="xs" style={{ color: '#b91c1c' }}>Permanently deletes your gym and all data</Text>
            </Stack>
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            Your entire gym account will be permanently removed — all members, payments, classes,
            settings, and staff access. Your Gymflow account itself will be removed.
            <strong style={{ color: '#dc2626' }}> There is no going back.</strong>
          </Text>
          <Button
            size="sm" color="red"
            leftSection={<Delete01Icon size={14} />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete gym account
          </Button>
        </Paper>
      </motion.div>

      {/* Reset confirmation modal */}
      <Modal
        opened={resetOpen}
        onClose={() => { setResetOpen(false); setConfirmText('') }}
        title={
          <Group gap="xs">
            <Alert01Icon size={16} style={{ color: '#f97316' }} />
            <Text fw={700} size="sm" style={{ color: '#111827' }}>Reset gym data?</Text>
          </Group>
        }
        radius="xl" size="sm"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This will permanently delete all member records, payment history,
            subscriptions, and check-ins. Type <strong>RESET</strong> to confirm.
          </Text>
          <TextInput
            placeholder="Type RESET to confirm"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            radius="md" size="sm"
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => { setResetOpen(false); setConfirmText('') }}>
              Cancel
            </Button>
            <Button
              size="sm" color="orange"
              disabled={confirmText !== 'RESET'}
              loading={resetting}
              onClick={handleReset}
              leftSection={<DatabaseIcon size={14} />}
            >
              Reset all data
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        opened={deleteOpen}
        onClose={() => { setDeleteOpen(false); setConfirmText('') }}
        title={
          <Group gap="xs">
            <Alert01Icon size={16} style={{ color: '#ef4444' }} />
            <Text fw={700} size="sm" style={{ color: '#111827' }}>Delete &quot;{gymName}&quot;?</Text>
          </Group>
        }
        radius="xl" size="sm"
      >
        <Stack gap="md">
          <Box p="sm" style={{ background: '#fff5f5', borderRadius: 10, border: '1px solid #fca5a5' }}>
            <Text size="xs" style={{ color: '#dc2626' }}>
              This action is permanent and cannot be undone. All data will be erased and your
              subscription will be cancelled immediately.
            </Text>
          </Box>
          <Text size="sm" c="dimmed">
            Type the gym name <strong>{gymName}</strong> to confirm deletion.
          </Text>
          <TextInput
            placeholder={`Type "${gymName}" to confirm`}
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            radius="md" size="sm"
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => { setDeleteOpen(false); setConfirmText('') }}>
              Cancel
            </Button>
            <Button
              size="sm" color="red"
              disabled={confirmText !== gymName}
              loading={deleting}
              onClick={handleDeleteAccount}
              leftSection={<Delete01Icon size={14} />}
            >
              Permanently delete
            </Button>
          </Group>
        </Stack>
      </Modal>

    </Stack>
  )
}
