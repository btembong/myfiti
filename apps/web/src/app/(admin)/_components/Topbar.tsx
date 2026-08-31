'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSidebar } from './SidebarContext'
import { spotlight } from './AdminShell'
import {
  Breadcrumbs, ActionIcon, Indicator, Menu,
  Avatar, Text, Group, Stack, Badge, ScrollArea,
  Divider, Box, Anchor, UnstyledButton, Tooltip,
} from '@mantine/core'
import {
  Search01Icon,
  Notification01Icon,
  Download01Icon,
  File01Icon,
  GoogleDocIcon,
  PrinterIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  InformationCircleIcon,
  Time01Icon,
  HelpCircleIcon,
} from 'hugeicons-react'

// ─── Route → breadcrumb map ───────────────────────────────────────────────────

const CRUMBS: Record<string, string[]> = {
  '/dashboard':                  ['Dashboard'],
  '/analytics':                  ['Analytics'],
  '/members':                    ['Members'],
  '/subscriptions':              ['Members', 'Subscriptions'],
  '/checkins':                   ['Members', 'Check-ins'],
  '/payments':                   ['Business', 'Payments'],
  '/classes':                    ['Business', 'Classes'],
  '/trainers':                   ['Business', 'Trainers'],
  '/communication':              ['Business', 'Communication'],
  '/settings':                   ['Settings', 'General'],
  '/settings/profile':           ['Settings', 'Gym Profile'],
  '/settings/brand':             ['Settings', 'Brand'],
  '/settings/billing':           ['Settings', 'Billing & Plan'],
  '/settings/notifications':     ['Settings', 'Notifications'],
  '/settings/staff':             ['Settings', 'Staff & Access'],
  '/settings/integrations':      ['Settings', 'Integrations'],
  '/settings/danger':            ['Settings', 'Danger zone'],
  '/help':                       ['Help & Docs'],
}

// ─── Notification data (replace with API) ────────────────────────────────────

const INIT_NOTIFICATIONS = [
  { id: '1', type: 'warn' as const, title: '3 subscriptions expiring',  desc: 'Action required before Friday',        time: '2h ago', read: false },
  { id: '2', type: 'info' as const, title: 'Daily summary ready',        desc: 'July 2 — 0 check-ins, 0 new members', time: '6h ago', read: false },
  { id: '3', type: 'ok'   as const, title: 'Database backup completed',  desc: 'All data backed up successfully',      time: '1d ago', read: true  },
]

const NOTIF_STYLE = {
  warn: { icon: Alert01Icon,           color: '#d97706', bg: '#fffbeb' },
  info: { icon: InformationCircleIcon, color: '#4f46e5', bg: '#eef2ff' },
  ok:   { icon: CheckmarkCircle01Icon, color: '#059669', bg: '#ecfdf5' },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  ownerName?: string
  ownerInitial?: string
  gymName?: string
}

export function Topbar({ ownerName = 'Owner', ownerInitial = 'O', gymName = 'Gym' }: Props) {
  const { collapsed } = useSidebar()
  const path = usePathname()
  const [notifications, setNotifications] = useState(INIT_NOTIFICATIONS)

  const crumbs = CRUMBS[path] ?? ['Dashboard']
  const unread = notifications.filter(n => !n.read).length

  return (
    <motion.header
      animate={{ left: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed top-0 right-0 z-40 h-14"
      style={{
        background: 'rgba(250,251,253,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #edeef4',
      }}
    >
      <Group h="100%" px="xl" justify="space-between" wrap="nowrap" gap="lg">

        {/* ── [1] LEFT — Brand anchor + breadcrumb ── */}
        <Breadcrumbs
          separator={<Text size="xs" c="dimmed" lh={1}>/</Text>}
          separatorMargin={6}
          style={{ flexShrink: 0 }}
        >
          {/* Brand root — always present, grounds the user */}
          <Text size="sm" fw={600} style={{ color: '#c0c5d0' }}>
            {gymName}
          </Text>
          {crumbs.map((c, i) => (
            <Text
              key={c}
              size="sm"
              fw={i === crumbs.length - 1 ? 700 : 500}
              style={{ color: i === crumbs.length - 1 ? '#1e1b4b' : '#a0a8ba' }}
            >
              {c}
            </Text>
          ))}
        </Breadcrumbs>

        {/* ── [2] CENTER — Search (the hero element) ── */}
        <UnstyledButton
          onClick={() => spotlight.open()}
          visibleFrom="sm"
          style={{ flex: '0 1 300px' }}
        >
          <Group
            gap="xs"
            px="md"
            style={{
              height: 36,
              background: '#f4f5f9',
              border: '1.5px solid #edeef4',
              borderRadius: 10,
              cursor: 'text',
              transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#c7d2fe'
              el.style.background = '#f5f6ff'
              el.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.06)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#edeef4'
              el.style.background = '#f4f5f9'
              el.style.boxShadow = 'none'
            }}
          >
            <Search01Icon size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <Text size="sm" style={{ color: '#b0b7c3', flex: 1 }}>Search anything…</Text>
            <Box
              component="kbd"
              style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 6px', borderRadius: 4,
                background: '#edeef4', color: '#9ca3af',
                border: '1px solid #e2e4eb',
                fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              ⌘K
            </Box>
          </Group>
        </UnstyledButton>

        {/* ── [3] RIGHT — Icon-only actions + divider + profile ── */}
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>

          {/* [2] Reports — icon only, tooltip explains it */}
          <Menu shadow="lg" radius="lg" width={240} position="bottom-end">
            <Menu.Target>
              <Tooltip label="Export & Reports" position="bottom" withArrow fz="xs" openDelay={400}>
                <ActionIcon variant="subtle" size="lg" color="gray" radius="xl">
                  <Download01Icon size={18} style={{ color: '#6b7280' }} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px="sm" pt="sm" pb="xs">
                <Text size="sm" fw={700} c="dark">Generate report</Text>
                <Text size="xs" c="dimmed">Export current view as:</Text>
              </Box>
              <Divider mb={4} />
              {[
                { label: 'PDF Report',  icon: File01Icon,    desc: 'Full summary with charts' },
                { label: 'CSV / Excel', icon: GoogleDocIcon, desc: 'Raw data for spreadsheets' },
                { label: 'Print view',  icon: PrinterIcon,   desc: 'Printer-optimised layout' },
              ].map(({ label, icon: Icon, desc }) => (
                <Menu.Item
                  key={label}
                  leftSection={
                    <Box style={{
                      width: 30, height: 30, borderRadius: 8, background: '#eef2ff', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={14} style={{ color: '#4f46e5' }} />
                    </Box>
                  }
                >
                  <Stack gap={1}>
                    <Text size="xs" fw={700} c="dark">{label}</Text>
                    <Text size="xs" c="dimmed">{desc}</Text>
                  </Stack>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          {/* Help — icon only, tooltip, links to /help */}
          <Tooltip label="Help & docs" position="bottom" withArrow fz="xs" openDelay={400}>
            <ActionIcon
              variant="subtle"
              size="lg"
              color="gray"
              radius="xl"
              component={Link}
              href="/help"
            >
              <HelpCircleIcon size={18} style={{ color: '#6b7280' }} />
            </ActionIcon>
          </Tooltip>

          {/* Notifications — icon with processing pulse badge */}
          <Menu shadow="lg" radius="lg" width={320} position="bottom-end" closeOnItemClick={false}>
            <Menu.Target>
              <Tooltip label="Notifications" position="bottom" withArrow fz="xs" openDelay={400}>
                <Indicator
                  size={8}
                  color="red"
                  disabled={unread === 0}
                  offset={5}
                  withBorder
                  processing={unread > 0}
                >
                  <ActionIcon variant="subtle" size="lg" color="gray" radius="xl">
                    <Notification01Icon size={18} style={{ color: '#6b7280' }} />
                  </ActionIcon>
                </Indicator>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Group px="sm" py="xs" justify="space-between">
                <Group gap="xs">
                  <Text size="sm" fw={700} c="dark">Notifications</Text>
                  {unread > 0 && (
                    <Badge size="xs" color="red" variant="light">{unread} new</Badge>
                  )}
                </Group>
                {unread > 0 && (
                  <Anchor
                    size="xs"
                    c="indigo"
                    fw={600}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setNotifications(ns => ns.map(n => ({ ...n, read: true })))}
                  >
                    Mark all read
                  </Anchor>
                )}
              </Group>
              <Divider />
              <ScrollArea.Autosize mah={264}>
                {notifications.map(n => {
                  const s = NOTIF_STYLE[n.type]
                  const NIcon = s.icon
                  return (
                    <Menu.Item
                      key={n.id}
                      style={{ opacity: n.read ? 0.5 : 1 }}
                      leftSection={
                        <Box style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: s.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <NIcon size={14} style={{ color: s.color }} />
                        </Box>
                      }
                    >
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                          <Text size="xs" fw={700} c="dark" lineClamp={1}>{n.title}</Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>{n.desc}</Text>
                        </Stack>
                        <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
                          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{n.time}</Text>
                          {!n.read && (
                            <Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                          )}
                        </Stack>
                      </Group>
                    </Menu.Item>
                  )
                })}
              </ScrollArea.Autosize>
              <Divider />
              <Menu.Item leftSection={<Time01Icon size={13} style={{ color: '#6366f1' }} />}>
                <Text size="xs" fw={700} c="indigo">View all activity</Text>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {/* [3] Vertical divider — visual section break before profile */}
          <Divider
            orientation="vertical"
            style={{ height: 22, alignSelf: 'center', margin: '0 6px' }}
          />

          {/* [4] Profile — avatar anchor, rightmost, two-line label */}
          <Menu shadow="lg" radius="lg" width={220} position="bottom-end">
            <Menu.Target>
              <UnstyledButton>
                <Group
                  gap="xs"
                  px="xs"
                  py={5}
                  style={{
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f1f7' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <Avatar size={30} color="indigo" variant="filled" radius="xl" fz="xs" fw={700}>
                    {ownerInitial}
                  </Avatar>
                  {/* Two-line label: name + role */}
                  <Stack gap={0} visibleFrom="sm">
                    <Text size="xs" fw={700} c="dark" lh={1.3}>{ownerName}</Text>
                    <Text size="xs" c="dimmed" lh={1.3}>Admin</Text>
                  </Stack>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px="sm" py="sm">
                <Text size="sm" fw={700} c="dark">{ownerName}</Text>
                <Text size="xs" c="dimmed">Owner · Admin</Text>
                <Badge size="xs" color="indigo" variant="light" mt={6}>Starter plan</Badge>
              </Box>
              <Divider />
              <Menu.Item component={Link} href="/settings">
                <Text size="sm" c="dark">Account settings</Text>
              </Menu.Item>
              <Menu.Item component={Link} href="/settings/billing">
                <Text size="sm" c="dark">Billing &amp; plan</Text>
              </Menu.Item>
              <Menu.Item component={Link} href="/help">
                <Text size="sm" c="dark">Help &amp; docs</Text>
              </Menu.Item>
              <Divider />
              <Menu.Item
                leftSection={<Cancel01Icon size={13} />}
                c="red"
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' })
                  window.location.href = '/login'
                }}
              >
                <Text size="sm" c="red">Sign out</Text>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

        </Group>
      </Group>
    </motion.header>
  )
}
