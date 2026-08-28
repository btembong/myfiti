'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, ThemeIcon, Badge,
  Button, Box, SimpleGrid, Divider, Switch,
} from '@mantine/core'
import {
  Plug01Icon,
  CheckmarkCircle01Icon,
  ArrowUpRight01Icon,
  SmartPhone01Icon,
  Wallet01Icon,
  Calendar01Icon,
  Link01Icon,
  Mail01Icon,
  CrownIcon,
  StarsIcon,
} from 'hugeicons-react'
import { api } from '@/lib/api'

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const } }),
}

interface Integration {
  id: string
  name: string
  desc: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  connected: boolean
  enabled: boolean
  plan?: string
  badge?: string
}

const INTEGRATION_DEFS: Omit<Integration, 'connected' | 'enabled'>[] = [
  { id: 'whatsapp',       name: 'WhatsApp Business', desc: 'Send automated reminders, receipts, and announcements via WhatsApp.', icon: SmartPhone01Icon, iconColor: '#25d366', iconBg: '#dcfce7', plan: 'Growth+' },
  { id: 'paystack',       name: 'Paystack',          desc: 'Accept card and mobile money payments directly from members.',          icon: Wallet01Icon,     iconColor: '#0ba4db', iconBg: '#e0f2fe' },
  { id: 'mtn_momo',       name: 'MTN Mobile Money',  desc: 'Enable members to pay via MTN MoMo — popular in Cameroon.',             icon: SmartPhone01Icon, iconColor: '#f59e0b', iconBg: '#fef3c7' },
  { id: 'google_calendar',name: 'Google Calendar',   desc: 'Sync gym class schedules directly to your Google Calendar.',            icon: Calendar01Icon,   iconColor: '#4285f4', iconBg: '#eff6ff', plan: 'Growth' },
  { id: 'zapier',         name: 'Zapier',            desc: 'Connect Gymflow to 5,000+ apps — automate any workflow.',               icon: Link01Icon,       iconColor: '#ff4a00', iconBg: '#fff1f2', plan: 'Growth+' },
  { id: 'mailchimp',      name: 'Mailchimp',         desc: 'Sync member list and send marketing emails via Mailchimp.',             icon: Mail01Icon,       iconColor: '#ffe01b', iconBg: '#fefce8', plan: 'Growth' },
]

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(
    INTEGRATION_DEFS.map(d => ({ ...d, connected: false, enabled: false }))
  )

  useEffect(() => {
    api.get<{ integrations: Record<string, { connected: boolean; enabled: boolean }> }>('/api/settings/integrations')
      .then(data => {
        if (!data.integrations) return
        setIntegrations(prev => prev.map(i => {
          const s = data.integrations[i.id]
          return s ? { ...i, connected: s.connected, enabled: s.enabled } : i
        }))
      })
      .catch(() => {})
  }, [])

  async function saveState(updated: Integration[]) {
    const payload: Record<string, { connected: boolean; enabled: boolean }> = {}
    updated.forEach(i => { payload[i.id] = { connected: i.connected, enabled: i.enabled } })
    await api.patch('/api/settings/integrations', payload).catch(() => {})
  }

  function toggleEnabled(id: string) {
    setIntegrations(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i)
      saveState(updated)
      return updated
    })
  }

  function toggleConnected(id: string) {
    setIntegrations(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, connected: !i.connected, enabled: !i.connected ? false : i.enabled } : i)
      saveState(updated)
      return updated
    })
  }

  return (
    <Stack gap="xl" p="xl" maw={800}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Integrations
            </Title>
            <Text size="sm" c="dimmed">Connect Gymflow with third-party services.</Text>
          </Stack>
        </Group>
      </motion.div>

      {/* Integrations grid */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {integrations.map(intg => {
            const Icon = intg.icon
            const locked = !!intg.plan

            return (
              <Paper key={intg.id} radius="xl" p="lg" withBorder
                style={{ borderColor: intg.connected ? '#bbf7d0' : '#edeef4', position: 'relative' }}>

                <Group justify="space-between" mb="md" align="flex-start">
                  <Group gap="sm">
                    <Box style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: intg.iconBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={20} style={{ color: intg.iconColor }} />
                    </Box>
                    <Stack gap={2}>
                      <Group gap={6}>
                        <Text size="sm" fw={700} style={{ color: '#111827' }}>{intg.name}</Text>
                        {intg.plan && (
                          <Badge size="xs" color="indigo" variant="light"
                            leftSection={<CrownIcon size={9} />}>
                            {intg.plan}
                          </Badge>
                        )}
                      </Group>
                      {intg.connected && (
                        <Group gap={4}>
                          <CheckmarkCircle01Icon size={11} style={{ color: '#10b981' }} />
                          <Text size="xs" style={{ color: '#10b981' }} fw={600}>Connected</Text>
                        </Group>
                      )}
                    </Stack>
                  </Group>
                  {intg.connected && (
                    <Switch
                      size="sm"
                      checked={intg.enabled}
                      onChange={() => toggleEnabled(intg.id)}
                      color="green"
                    />
                  )}
                </Group>

                <Text size="xs" c="dimmed" mb="md" lineClamp={2}>{intg.desc}</Text>

                <Divider mb="md" />

                <Group gap="xs">
                  {locked ? (
                    <Button
                      size="xs" variant="light" color="indigo" fullWidth
                      leftSection={<StarsIcon size={12} />}
                      rightSection={<ArrowUpRight01Icon size={12} />}
                      component="a" href="/settings/billing"
                    >
                      Upgrade to {intg.plan}
                    </Button>
                  ) : intg.connected ? (
                    <Button
                      size="xs" variant="default" fullWidth
                      onClick={() => toggleConnected(intg.id)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="xs" color="indigo" fullWidth
                      leftSection={<Plug01Icon size={12} />}
                      onClick={() => toggleConnected(intg.id)}
                    >
                      Connect
                    </Button>
                  )}
                </Group>
              </Paper>
            )
          })}
        </SimpleGrid>
      </motion.div>

      {/* Custom webhook */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="md">
            <ThemeIcon size={36} radius="xl" color="gray" variant="light">
              <Link01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Custom webhooks</Text>
              <Text size="xs" c="dimmed">Send real-time events to your own endpoints</Text>
            </Stack>
            <Badge size="xs" color="indigo" variant="light" ml="auto"
              leftSection={<CrownIcon size={9} />}>
              Growth+
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            Receive POST events for member joins, check-ins, payments, and more.
            Useful for custom dashboards and internal tools.
          </Text>
          <Button size="xs" variant="light" color="indigo"
            leftSection={<StarsIcon size={12} />}
            rightSection={<ArrowUpRight01Icon size={12} />}
            component="a" href="/settings/billing"
          >
            Upgrade to Growth+
          </Button>
        </Paper>
      </motion.div>

    </Stack>
  )
}
