'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, ThemeIcon, Badge,
  Button, Avatar, Modal, TextInput, PasswordInput, Select, ActionIcon, Menu,
  Box, Flex, Divider,
} from '@mantine/core'
import {
  UserGroupIcon,
  UserAdd01Icon,
  Mail01Icon,
  More01Icon,
  CheckmarkCircle01Icon,
  Delete01Icon,
  PencilEdit01Icon,
  ShieldUserIcon,
  QrCode01Icon,
} from 'hugeicons-react'
import { modals } from '@mantine/modals'
import { api } from '@/lib/api'
import { catchToast, showError, showSuccess } from '@/lib/notifications'

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const } }),
}

const ROLE_COLOR: Record<string, string> = {
  owner: 'indigo', admin: 'indigo', trainer: 'gray', receptionist: 'gray',
  Owner: 'indigo', Admin: 'indigo', Trainer: 'gray', Receptionist: 'gray',
}

const ROLE_OPTIONS = [
  { value: 'admin',        label: 'Admin — full access except billing' },
  { value: 'trainer',      label: 'Trainer — members, classes, check-ins' },
  { value: 'receptionist', label: 'Receptionist — check-ins & member view' },
]

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'invited'
  joinedAt: string
  has_pin: boolean
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState({ name: '', email: '', role: 'admin' })
  const [sending, setSending] = useState(false)

  // Edit role modal
  const [editMember, setEditMember] = useState<StaffMember | null>(null)
  const [editRole, setEditRole] = useState('admin')
  const [editSaving, setEditSaving] = useState(false)

  // Resend invite
  const [resendingId, setResendingId] = useState<string | null>(null)

  // Set kiosk PIN
  const [pinMember, setPinMember] = useState<StaffMember | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinInput2, setPinInput2] = useState('')
  const [pinSaving, setPinSaving] = useState(false)

  useEffect(() => {
    api.get<{ staff: StaffMember[] }>('/api/settings/staff')
      .then(r => setStaff(r.staff ?? [])).catch(catchToast('Failed to load staff'))
  }, [])

  async function sendInvite() {
    if (!invite.email) return
    setSending(true)
    try {
      const r = await api.post<StaffMember>('/api/settings/staff', {
        name: invite.name,
        email: invite.email,
        role: invite.role,
        password: Math.random().toString(36).slice(2, 12), // temp password
      })
      setStaff(s => [...s, r])
      showSuccess(`Invite sent to ${invite.email}`)
      setInvite({ name: '', email: '', role: 'admin' })
      setInviteOpen(false)
    } catch (err) { showError(err instanceof Error ? err.message : 'Failed to invite staff') }
    finally { setSending(false) }
  }

  async function saveRole() {
    if (!editMember) return
    setEditSaving(true)
    try {
      await api.patch(`/api/settings/staff/${editMember.id}`, { role: editRole })
      setStaff(s => s.map(m => m.id === editMember.id ? { ...m, role: editRole } : m))
      showSuccess(`Role updated to ${editRole}`)
      setEditMember(null)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setEditSaving(false)
    }
  }

  async function resendInvite(member: StaffMember) {
    setResendingId(member.id)
    try {
      await api.post(`/api/settings/staff/${member.id}/resend-invite`, {})
      showSuccess(`Invitation resent to ${member.email}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to resend invite')
    } finally {
      setResendingId(null)
    }
  }

  async function savePin() {
    if (!pinMember) return
    if (!/^\d{4}$/.test(pinInput)) { showError('PIN must be exactly 4 digits.'); return }
    if (pinInput !== pinInput2) { showError('PINs do not match.'); return }
    setPinSaving(true)
    try {
      await api.patch(`/api/settings/staff/${pinMember.id}/pin`, { pin: pinInput })
      showSuccess(`Kiosk PIN set for ${pinMember.name}`)
      setStaff(s => s.map(m => m.id === pinMember.id ? { ...m, has_pin: true } : m))
      setPinMember(null); setPinInput(''); setPinInput2('')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to set PIN')
    } finally { setPinSaving(false) }
  }

  async function clearPin(member: StaffMember) {
    try {
      await api.patch(`/api/settings/staff/${member.id}/pin`, { pin: null })
      showSuccess(`Kiosk PIN removed for ${member.name}`)
      setStaff(s => s.map(m => m.id === member.id ? { ...m, has_pin: false } : m))
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to clear PIN')
    }
  }

  function removeStaff(id: string) {
    const member = staff.find(s => s.id === id)
    modals.openConfirmModal({
      title: 'Remove staff member',
      children: `Are you sure you want to remove ${member?.name ?? 'this staff member'}? They will lose access to the dashboard immediately.`,
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setStaff(s => s.filter(m => m.id !== id))
        await api.delete(`/api/settings/staff/${id}`).catch(catchToast('Failed to remove staff member'))
        showSuccess(`${member?.name ?? 'Staff member'} removed`)
      },
    })
  }

  const isOwner = (member: StaffMember) =>
    member.role === 'owner' || member.role === 'Owner'

  return (
    <Stack gap="xl" p="xl" maw={720}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Staff &amp; access
            </Title>
            <Text size="sm" c="dimmed">Manage who has access to your gym dashboard.</Text>
          </Stack>
          <Button
            size="sm" color="indigo"
            leftSection={<UserAdd01Icon size={14} />}
            onClick={() => setInviteOpen(true)}
          >
            Invite staff
          </Button>
        </Group>
      </motion.div>

      {/* Role overview */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="indigo" variant="light">
              <ShieldUserIcon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Access roles</Text>
              <Text size="xs" c="dimmed">What each role can do</Text>
            </Stack>
          </Group>
          <Stack gap="xs">
            {[
              { role: 'Owner',        desc: 'Full access to everything including billing and deletion' },
              { role: 'Admin',        desc: 'Everything except billing and account deletion' },
              { role: 'Trainer',      desc: 'Members, classes, check-ins — no financial data' },
              { role: 'Receptionist', desc: 'View members, manage check-ins only' },
            ].map(r => (
              <Group key={r.role} justify="space-between" py="xs" style={{ borderBottom: '1px solid #f9fafb' }}>
                <Badge size="sm" color={ROLE_COLOR[r.role] ?? 'gray'} variant="light">{r.role}</Badge>
                <Text size="xs" c="dimmed" style={{ flex: 1, textAlign: 'right' }}>{r.desc}</Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      </motion.div>

      {/* Staff table */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
          <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid #f4f5f9' }}>
            <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
              Team members ({staff.length})
            </Text>
          </Group>

          <Group px="lg" py={8} style={{ borderBottom: '1px solid #f9fafb' }}>
            <Box style={{ flex: 1 }}><Text size="xs" fw={600} c="dimmed">Member</Text></Box>
            <Box style={{ width: 120 }}><Text size="xs" fw={600} c="dimmed">Role</Text></Box>
            <Box style={{ width: 100 }}><Text size="xs" fw={600} c="dimmed">Status</Text></Box>
            <Box style={{ width: 100 }}><Text size="xs" fw={600} c="dimmed">Joined</Text></Box>
            <Box style={{ width: 32 }} />
          </Group>

          {staff.length === 0 ? (
            <Flex direction="column" align="center" gap="sm" py="xl">
              <UserGroupIcon size={28} style={{ color: '#e5e7eb' }} />
              <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>No staff members yet</Text>
              <Text size="xs" c="dimmed">Invite your first staff member above.</Text>
            </Flex>
          ) : (
            <Stack gap={0}>
              {staff.map(member => (
                <Group key={member.id} px="lg" py="sm" style={{ borderBottom: '1px solid #f9fafb' }}>
                  <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                    <Avatar size={28} radius="xl" color="indigo" variant="filled" fz={10} fw={700}>
                      {initials(member.name)}
                    </Avatar>
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="xs" fw={600} style={{ color: '#111827' }} truncate>{member.name}</Text>
                      <Text size="xs" c="dimmed" truncate>{member.email}</Text>
                    </Stack>
                  </Group>
                  <Box style={{ width: 120 }}>
                    <Badge size="xs" color={ROLE_COLOR[member.role] ?? 'gray'} variant="light">
                      {member.role}
                    </Badge>
                  </Box>
                  <Box style={{ width: 100 }}>
                    <Group gap={4}>
                      <Badge
                        size="xs" radius="xl" variant="dot"
                        color={member.status === 'active' ? 'green' : 'yellow'}
                      >
                        {member.status === 'active' ? 'Active' : 'Invited'}
                      </Badge>
                      {member.has_pin && (
                        <Badge size="xs" radius="xl" variant="light" color="indigo">PIN</Badge>
                      )}
                    </Group>
                  </Box>
                  <Box style={{ width: 100 }}>
                    <Text size="xs" c="dimmed">{member.joinedAt}</Text>
                  </Box>
                  <Box style={{ width: 32 }}>
                    {!isOwner(member) && (
                      <Menu shadow="lg" radius="lg" width={180} position="bottom-end">
                        <Menu.Target>
                          <ActionIcon size="sm" variant="subtle" color="gray" loading={resendingId === member.id}>
                            <More01Icon size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<PencilEdit01Icon size={13} />}
                            onClick={() => { setEditMember(member); setEditRole(member.role) }}
                          >
                            Edit role
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<Mail01Icon size={13} />}
                            onClick={() => resendInvite(member)}
                          >
                            Resend invite
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<QrCode01Icon size={13} />}
                            onClick={() => { setPinMember(member); setPinInput(''); setPinInput2('') }}
                          >
                            Set kiosk PIN
                          </Menu.Item>
                          {member.has_pin && (
                            <Menu.Item
                              leftSection={<Delete01Icon size={13} />}
                              onClick={() => clearPin(member)}
                            >
                              Clear kiosk PIN
                            </Menu.Item>
                          )}
                          <Divider />
                          <Menu.Item
                            leftSection={<Delete01Icon size={13} />}
                            color="red"
                            onClick={() => removeStaff(member.id)}
                          >
                            Remove
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Box>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>
      </motion.div>

      {/* Invite modal */}
      <Modal
        opened={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={<Text fw={700} size="sm">Invite staff member</Text>}
        radius="xl" size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Full name"
            placeholder="Kwame Asante"
            value={invite.name}
            onChange={e => setInvite(i => ({ ...i, name: e.target.value }))}
            radius="md" size="sm"
          />
          <TextInput
            label="Email address"
            placeholder="staff@yourgym.com"
            value={invite.email}
            onChange={e => setInvite(i => ({ ...i, email: e.target.value }))}
            leftSection={<Mail01Icon size={14} style={{ color: '#9ca3af' }} />}
            radius="md" size="sm"
          />
          <Select
            label="Role"
            value={invite.role}
            onChange={v => setInvite(i => ({ ...i, role: v ?? 'admin' }))}
            data={ROLE_OPTIONS}
            radius="md" size="sm"
          />
          <Text size="xs" c="dimmed">
            An invitation email will be sent. The staff member can sign in using their email address.
          </Text>
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm" color="indigo"
              leftSection={<CheckmarkCircle01Icon size={14} />}
              loading={sending}
              onClick={sendInvite}
              disabled={!invite.email || !invite.name}
            >
              Send invite
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Set kiosk PIN modal */}
      <Modal
        opened={pinMember !== null}
        onClose={() => { setPinMember(null); setPinInput(''); setPinInput2('') }}
        title={<Text fw={700} size="sm">Set kiosk PIN — {pinMember?.name}</Text>}
        radius="xl" size="sm"
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            This 4-digit PIN lets the staff member access the kiosk staff dashboard without logging in on that device.
          </Text>
          <PasswordInput
            label="New PIN"
            placeholder="4 digits"
            maxLength={4}
            value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            radius="md" size="sm"
          />
          <PasswordInput
            label="Confirm PIN"
            placeholder="Repeat the 4 digits"
            maxLength={4}
            value={pinInput2}
            onChange={e => setPinInput2(e.target.value.replace(/\D/g, '').slice(0, 4))}
            radius="md" size="sm"
            error={pinInput2.length === 4 && pinInput !== pinInput2 ? 'PINs do not match' : undefined}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={() => { setPinMember(null); setPinInput(''); setPinInput2('') }}>
              Cancel
            </Button>
            <Button
              size="sm" color="indigo"
              leftSection={<CheckmarkCircle01Icon size={14} />}
              loading={pinSaving}
              onClick={savePin}
              disabled={pinInput.length !== 4 || pinInput !== pinInput2}
            >
              Save PIN
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit role modal */}
      <Modal
        opened={editMember !== null}
        onClose={() => setEditMember(null)}
        title={<Text fw={700} size="sm">Edit role — {editMember?.name}</Text>}
        radius="xl" size="sm"
      >
        <Stack gap="md">
          <Select
            label="Role"
            value={editRole}
            onChange={v => setEditRole(v ?? 'admin')}
            data={ROLE_OPTIONS}
            radius="md" size="sm"
          />
          <Text size="xs" c="dimmed">
            This change takes effect immediately. The staff member will have the new permissions on their next action.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button
              size="sm" color="indigo" loading={editSaving}
              onClick={saveRole}
            >
              Save role
            </Button>
          </Group>
        </Stack>
      </Modal>

    </Stack>
  )
}
