'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, ThemeIcon, Divider,
  Button, Switch, Badge, Box,
} from '@mantine/core'
import { api } from '@/lib/api'
import { notifications as notif } from '@mantine/notifications'
import {
  Notification01Icon,
  Mail01Icon,
  SmartPhone01Icon,
  Activity01Icon,
  UserAdd01Icon,
  CreditCardIcon,
  Alert01Icon,
  FloppyDiskIcon,
  CheckmarkCircle01Icon,
  CrownIcon,
} from 'hugeicons-react'

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const } }),
}

interface NotifSetting {
  id: string
  label: string
  desc: string
  email: boolean
  inApp: boolean
  sms: boolean
  smsLocked?: boolean
}

const DEFAULT_SETTINGS: NotifSetting[] = [
  { id: 'new_member',           label: 'New member joins',       desc: 'When a new member registers or is added manually',      email: true,  inApp: true,  sms: false, smsLocked: true },
  { id: 'checkin',              label: 'Member check-in',        desc: 'Each time a member scans the QR or is checked in',      email: false, inApp: true,  sms: false, smsLocked: true },
  { id: 'subscription_expiring',label: 'Subscription expiring',  desc: '3 days before a member\'s plan expires',                email: true,  inApp: true,  sms: false, smsLocked: true },
  { id: 'subscription_expired', label: 'Subscription expired',   desc: 'When a member\'s subscription lapses',                  email: true,  inApp: true,  sms: false, smsLocked: true },
  { id: 'payment_received',     label: 'Payment received',       desc: 'When a payment is recorded or auto-renewed',            email: true,  inApp: true,  sms: false, smsLocked: true },
  { id: 'payment_failed',       label: 'Payment failed',         desc: 'When a recurring payment attempt fails',                email: true,  inApp: true,  sms: false, smsLocked: true },
  { id: 'daily_summary',        label: 'Daily summary',          desc: 'End-of-day digest: check-ins, new members, revenue',    email: true,  inApp: false, sms: false, smsLocked: true },
  { id: 'weekly_report',        label: 'Weekly report',          desc: 'Monday morning: last week\'s performance overview',     email: true,  inApp: false, sms: false, smsLocked: true },
]

export default function NotificationsPage() {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<NotifSetting[]>(DEFAULT_SETTINGS)

  useEffect(() => {
    api.get<{ notifications: Record<string, { email: boolean; inApp: boolean; sms: boolean }> }>('/api/settings/notifications')
      .then(data => {
        if (!data.notifications) return
        setSettings(prev => prev.map(s => {
          const override = data.notifications[s.id]
          return override ? { ...s, ...override } : s
        }))
      })
      .catch(() => {})
  }, [])

  function toggle(id: string, channel: 'email' | 'inApp' | 'sms') {
    setSettings(s => s.map(n => n.id === id ? { ...n, [channel]: !n[channel] } : n))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Record<string, { email: boolean; inApp: boolean; sms: boolean }> = {}
      settings.forEach(s => { payload[s.id] = { email: s.email, inApp: s.inApp, sms: s.sms } })
      await api.patch('/api/settings/notifications', payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      notif.show({ color: 'red', message: 'Failed to save notification settings.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="xl" p="xl" maw={680}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Notifications
            </Title>
            <Text size="sm" c="dimmed">Control how and when you receive alerts.</Text>
          </Stack>
          <Button
            onClick={handleSave}
            loading={saving}
            variant={saved ? 'light' : 'filled'}
            color={saved ? 'green' : 'indigo'}
            size="sm"
            leftSection={saved ? <CheckmarkCircle01Icon size={15} /> : <FloppyDiskIcon size={15} />}
          >
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </Group>
      </motion.div>

      {/* Channel legend */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <Group gap="lg" px="xs">
          <Group gap="xs">
            <Mail01Icon size={14} style={{ color: '#6366f1' }} />
            <Text size="xs" fw={600} style={{ color: '#374151' }}>Email</Text>
          </Group>
          <Group gap="xs">
            <Notification01Icon size={14} style={{ color: '#10b981' }} />
            <Text size="xs" fw={600} style={{ color: '#374151' }}>In-app</Text>
          </Group>
          <Group gap="xs">
            <SmartPhone01Icon size={14} style={{ color: '#9ca3af' }} />
            <Text size="xs" fw={600} c="dimmed">SMS</Text>
            <Badge size="xs" color="indigo" variant="light" leftSection={<CrownIcon size={9} />}>
              Growth+
            </Badge>
          </Group>
        </Group>
      </motion.div>

      {/* Notification rows */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
          {[
            { section: 'Members',       icon: UserAdd01Icon,   color: 'indigo', ids: ['new_member', 'checkin'] },
            { section: 'Subscriptions', icon: CreditCardIcon,  color: 'gray',   ids: ['subscription_expiring', 'subscription_expired'] },
            { section: 'Payments',      icon: Activity01Icon,  color: 'gray',   ids: ['payment_received', 'payment_failed'] },
            { section: 'Reports',       icon: Alert01Icon,     color: 'gray',   ids: ['daily_summary', 'weekly_report'] },
          ].map((group, gi) => {
            const GIcon = group.icon
            return (
              <Box key={group.section}>
                {gi > 0 && <Divider />}
                <Group gap="sm" px="lg" py="md" style={{ background: '#fafbfc' }}>
                  <ThemeIcon size={28} radius="lg" color={group.color} variant="light">
                    <GIcon size={14} />
                  </ThemeIcon>
                  <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.08em', color: '#6b7280' }}>
                    {group.section}
                  </Text>
                </Group>
                {settings.filter(n => group.ids.includes(n.id)).map((n, ni) => (
                  <Box key={n.id}>
                    {ni > 0 && <Divider style={{ borderColor: '#f9fafb' }} />}
                    <Group justify="space-between" px="lg" py="md" wrap="nowrap">
                      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={600} style={{ color: '#111827' }}>{n.label}</Text>
                        <Text size="xs" c="dimmed">{n.desc}</Text>
                      </Stack>
                      <Group gap="xl" style={{ flexShrink: 0 }}>
                        <Switch size="sm" checked={n.email} onChange={() => toggle(n.id, 'email')} color="indigo" />
                        <Switch size="sm" checked={n.inApp} onChange={() => toggle(n.id, 'inApp')} color="green" />
                        <Switch size="sm" checked={n.sms}   onChange={() => toggle(n.id, 'sms')}   color="indigo" disabled={n.smsLocked} />
                      </Group>
                    </Group>
                  </Box>
                ))}
              </Box>
            )
          })}
        </Paper>
      </motion.div>

      {/* Bottom save */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <Divider mb="md" />
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={saving}
            variant={saved ? 'light' : 'filled'}
            color={saved ? 'green' : 'indigo'}
            size="sm"
            leftSection={saved ? <CheckmarkCircle01Icon size={15} /> : <FloppyDiskIcon size={15} />}
          >
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </Group>
      </motion.div>

    </Stack>
  )
}
