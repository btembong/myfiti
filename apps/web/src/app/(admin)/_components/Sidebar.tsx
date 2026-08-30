'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useSidebar } from './SidebarContext'
import {
  Tooltip, Avatar, Menu, Text, Badge, Button,
  Stack, Group, Box, Divider, UnstyledButton, Paper,
} from '@mantine/core'
import {
  DashboardSquare01Icon,
  UserGroupIcon,
  CreditCardIcon,
  QrCode01Icon,
  Wallet01Icon,
  BarChartIcon,
  Calendar01Icon,
  UserCheck01Icon,
  Settings01Icon,
  HelpCircleIcon,
  Logout01Icon,
  Dumbbell01Icon,
  ArrowUpRight01Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  StarsIcon,
  MessageNotification01Icon,
  ArrowDown01Icon,
  CheckmarkCircle01Icon,
  Add01Icon,
  Building01Icon,
  Ticket01Icon,
} from 'hugeicons-react'

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard',  icon: DashboardSquare01Icon },
      { label: 'Analytics', href: '/analytics',  icon: BarChartIcon },
    ],
  },
  {
    group: 'Members',
    items: [
      { label: 'Members',       href: '/members',       icon: UserGroupIcon },
      { label: 'Subscriptions', href: '/subscriptions', icon: CreditCardIcon },
      { label: 'Check-ins',     href: '/checkins',      icon: QrCode01Icon },
    ],
  },
  {
    group: 'Business',
    items: [
      { label: 'Payments',      href: '/payments',      icon: Wallet01Icon },
      { label: 'Day Passes',    href: '/day-passes',    icon: Ticket01Icon },
      { label: 'Classes',       href: '/classes',       icon: Calendar01Icon,          plan: 'Growth+' },
      { label: 'Trainers',      href: '/trainers',      icon: UserCheck01Icon,         plan: 'Growth+' },
      { label: 'Communication', href: '/communication', icon: MessageNotification01Icon },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Settings',    href: '/settings', icon: Settings01Icon },
      { label: 'Help & Docs', href: '/help',     icon: HelpCircleIcon },
    ],
  },
]

// ─── Workspace switcher ───────────────────────────────────────────────────────

const WORKSPACES = [
  { id: '1', name: 'My Gym', plan: 'Starter', initial: 'M', color: '#6366f1' },
]

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter', growth: 'Growth', growth_plus: 'Growth+', enterprise: 'Enterprise',
}
const PLAN_BADGE: Record<string, string> = {
  starter: 'Free', growth: 'Growth', growth_plus: 'Growth+', enterprise: 'Enterprise',
}
const PLAN_BADGE_COLOR: Record<string, string> = {
  starter: 'gray', growth: 'indigo', growth_plus: 'yellow', enterprise: 'violet',
}

interface Props {
  gymName?: string
  ownerName?: string
  ownerInitial?: string
  plan?: string
}

export function Sidebar({ gymName = 'My Gym', ownerName = 'Owner', ownerInitial = 'O', plan = 'starter' }: Props) {
  const { collapsed, toggle } = useSidebar()
  const path = usePathname()
  const router = useRouter()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); toggle() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const gymInitial = gymName.charAt(0).toUpperCase()

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 left-0 z-50 flex flex-col select-none overflow-hidden shrink-0"
      style={{ background: '#ffffff', borderRight: '1px solid #edeef4' }}
    >

      {/* ── Header / Workspace switcher ── */}
      <div className="flex items-center h-14 shrink-0 px-2 gap-1.5"
        style={{ borderBottom: '1px solid #f0f1f5' }}>

        {/* Workspace switcher trigger */}
        <Menu shadow="lg" radius="lg" width={220} position="bottom-start" offset={8}>
          <Menu.Target>
            {collapsed ? (
              <Tooltip label={`${gymName} · ${PLAN_LABEL[plan] ?? 'Starter'}`} position="right" withArrow fz="xs">
                <UnstyledButton
                  style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    boxShadow: '0 0 14px rgba(99,102,241,0.3)',
                    transition: 'box-shadow 0.15s, transform 0.1s',
                    margin: '0 auto',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.boxShadow = '0 0 20px rgba(99,102,241,0.45)'
                    el.style.transform = 'scale(1.05)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.boxShadow = '0 0 14px rgba(99,102,241,0.3)'
                    el.style.transform = 'scale(1)'
                  }}
                >
                  <Dumbbell01Icon size={14} color="white" />
                </UnstyledButton>
              </Tooltip>
            ) : (
              <UnstyledButton
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
                  gap: 8, padding: '5px 6px', borderRadius: 10,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f4f5f9' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {/* Gym logo box */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                  boxShadow: '0 0 12px rgba(99,102,241,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Dumbbell01Icon size={13} color="white" />
                </div>

                {/* Name + plan */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" fw={800} truncate style={{ color: '#111827', lineHeight: 1.2 }}>
                    {gymName}
                  </Text>
                  <Text size="xs" style={{ color: '#9ca3af', lineHeight: 1.2 }}>{PLAN_LABEL[plan] ?? 'Starter'} plan</Text>
                </div>

                {/* Chevron */}
                <ArrowDown01Icon size={12} style={{ color: '#c0c5d0', flexShrink: 0 }} />
              </UnstyledButton>
            )}
          </Menu.Target>

          <Menu.Dropdown>
            {/* Workspace list header */}
            <Box px="sm" pt="sm" pb="xs">
              <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
                Workspaces
              </Text>
            </Box>

            {/* Current workspace */}
            {WORKSPACES.map(ws => (
              <Menu.Item key={ws.id}
                leftSection={
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Dumbbell01Icon size={13} color="white" />
                  </div>
                }
                rightSection={<CheckmarkCircle01Icon size={14} style={{ color: '#6366f1' }} />}
              >
                <Stack gap={1}>
                  <Text size="xs" fw={700} style={{ color: '#111827' }}>{gymName}</Text>
                  <Group gap={4}>
                    <Badge size="xs" color={PLAN_BADGE_COLOR[plan] ?? 'gray'} variant="light" style={{ fontSize: 9 }}>
                      {PLAN_BADGE[plan] ?? 'Free'}
                    </Badge>
                    <Text size="xs" c="dimmed">{PLAN_LABEL[plan] ?? 'Starter'}</Text>
                  </Group>
                </Stack>
              </Menu.Item>
            ))}

            <Divider my={4} />

            {/* Upgrade */}
            <Menu.Item
              component={Link}
              href="/settings/billing"
              leftSection={
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: '#eef2ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <StarsIcon size={13} style={{ color: '#6366f1' }} />
                </div>
              }
            >
              <Stack gap={1}>
                <Text size="xs" fw={700} style={{ color: '#4f46e5' }}>Upgrade plan</Text>
                <Text size="xs" c="dimmed">Unlock Growth+ features</Text>
              </Stack>
            </Menu.Item>

            <Menu.Item
              leftSection={
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: '#f4f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Add01Icon size={13} style={{ color: '#6b7280' }} />
                </div>
              }
            >
              <Stack gap={1}>
                <Text size="xs" fw={600} style={{ color: '#374151' }}>Add workspace</Text>
                <Text size="xs" c="dimmed">Manage another gym</Text>
              </Stack>
            </Menu.Item>

            <Divider my={4} />

            <Menu.Item
              component={Link}
              href="/settings/profile"
              leftSection={
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: '#f4f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building01Icon size={13} style={{ color: '#6b7280' }} />
                </div>
              }
            >
              <Text size="xs" fw={600} style={{ color: '#374151' }}>Workspace settings</Text>
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* Collapse toggle — always visible */}
        <Tooltip label={collapsed ? 'Expand (⌘B)' : 'Collapse (⌘B)'} position="right" withArrow fz="xs">
          <UnstyledButton
            onClick={toggle}
            style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', transition: 'background 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f4f5f9' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {collapsed
              ? <SidebarRight01Icon size={13} style={{ color: '#9ca3af' }} />
              : <SidebarLeft01Icon  size={13} style={{ color: '#9ca3af' }} />}
          </UnstyledButton>
        </Tooltip>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <Stack gap={0}>
          {NAV_GROUPS.map((group, gi) => (
            <Box key={group.group} mb={4}>

              {/* Group label */}
              <Box mx="xs" mb={2}>
                {collapsed
                  ? gi > 0 && <Divider my="xs" />
                  : <Text size="xs" fw={700} tt="uppercase" px="xs" pt="sm" pb={4}
                      style={{ letterSpacing: '0.14em', color: '#c0c5d0' }}>
                      {group.group}
                    </Text>}
              </Box>

              {/* Nav items */}
              <Stack gap={2} px="xs">
                {group.items.map((item) => {
                  const active = path === item.href ||
                    (item.href !== '/dashboard' && path.startsWith(item.href))
                  const Icon = item.icon

                  return (
                    <Tooltip
                      key={item.href}
                      label={
                        <Group gap="xs">
                          <Text size="xs" fw={600}>{item.label}</Text>
                          {'plan' in item && item.plan && (
                            <Badge size="xs" color="indigo" variant="light">{item.plan}</Badge>
                          )}
                        </Group>
                      }
                      position="right"
                      withArrow
                      disabled={!collapsed}
                      fz="xs"
                    >
                      <UnstyledButton
                        component={Link}
                        href={item.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          gap: collapsed ? 0 : 9,
                          padding: collapsed ? '9px 0' : '8px 10px',
                          borderRadius: 10,
                          fontWeight: active ? 600 : 500,
                          fontSize: 13,
                          background: active ? '#eef2ff' : 'transparent',
                          color: active ? '#4f46e5' : '#6b7280',
                          transition: 'background 0.1s, color 0.1s',
                          position: 'relative',
                          overflow: 'hidden',
                          width: '100%',
                        }}
                        onMouseEnter={e => {
                          if (!active) {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = '#f4f5f9'
                            el.style.color = '#374151'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!active) {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'transparent'
                            el.style.color = '#6b7280'
                          }
                        }}
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-active"
                            style={{
                              position: 'absolute', left: 0, top: 6, bottom: 6,
                              width: 3, borderRadius: '0 3px 3px 0', background: '#6366f1',
                            }}
                            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                          />
                        )}

                        <Icon size={18} style={{ flexShrink: 0 }} />

                        <AnimatePresence>
                          {!collapsed && (
                            <motion.span
                              key="label"
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.1 }}
                              style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1 }}
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>

                        {'plan' in item && item.plan && !collapsed && (
                          <Badge size="xs" color="indigo" variant="light" style={{ flexShrink: 0 }}>
                            {item.plan}
                          </Badge>
                        )}
                      </UnstyledButton>
                    </Tooltip>
                  )
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </nav>

      {/* ── Plan / upgrade card ── */}
      <Box px="xs" pb="xs" style={{ flexShrink: 0 }}>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Paper radius="lg" p="sm" withBorder style={{ borderColor: '#edeef4', background: '#fafafa' }}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" fw={700} style={{ color: '#374151' }}>{PLAN_LABEL[plan] ?? 'Starter'} plan</Text>
                  <Badge size="xs" color={PLAN_BADGE_COLOR[plan] ?? 'gray'} variant="light">{PLAN_BADGE[plan] ?? 'Free'}</Badge>
                </Group>
                <Text size="xs" c="dimmed" mb="sm">
                  {plan === 'starter' ? 'Unlock classes, SMS & more' : plan === 'enterprise' ? 'Enterprise plan active' : 'Plan active'}
                </Text>
                {plan === 'starter' && (
                <Button
                  component={Link}
                  href="/settings/billing"
                  variant="light"
                  color="indigo"
                  size="xs"
                  fullWidth
                  leftSection={<StarsIcon size={11} />}
                  rightSection={<ArrowUpRight01Icon size={11} />}
                >
                  Upgrade plan
                </Button>
                )}
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && (
          <Tooltip label="Upgrade plan" position="right" withArrow fz="xs">
            <UnstyledButton
              component={Link}
              href="/settings/billing"
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '8px 0', borderRadius: 10,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <StarsIcon size={14} style={{ color: '#6366f1' }} />
            </UnstyledButton>
          </Tooltip>
        )}
      </Box>

      {/* ── User footer ── */}
      <Box px="xs" pb="sm" pt="xs" style={{ borderTop: '1px solid #f0f1f5', flexShrink: 0 }}>
        <Menu shadow="lg" radius="lg" width={200} position="right-end">
          <Menu.Target>
            <UnstyledButton style={{ width: '100%' }}>
              <Group
                gap="sm" px="xs" py={6}
                style={{
                  borderRadius: 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  transition: 'background 0.12s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f4f5f9' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Avatar size={28} color="indigo" variant="filled" radius="xl" fz={11} fw={700}>
                  {ownerInitial}
                </Avatar>

                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      key="user-info"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
                    >
                      <Text size="xs" fw={700} truncate style={{ color: '#111827', lineHeight: 1.3 }}>
                        {ownerName}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ lineHeight: 1.3 }}>Owner · Admin</Text>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Group>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Box px="sm" py="xs">
              <Text size="sm" fw={700} c="dark">{ownerName}</Text>
              <Text size="xs" c="dimmed">Owner · Admin</Text>
            </Box>
            <Divider />
            <Menu.Item component={Link} href="/settings">
              <Text size="sm" c="dark">Account settings</Text>
            </Menu.Item>
            <Menu.Item component={Link} href="/settings/billing">
              <Text size="sm" c="dark">Billing &amp; plan</Text>
            </Menu.Item>
            <Divider />
            <Menu.Item
              leftSection={<Logout01Icon size={13} />}
              c="red"
              onClick={handleSignOut}
            >
              <Text size="sm" c="red">Sign out</Text>
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Box>
    </motion.aside>
  )
}
