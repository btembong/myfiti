'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Text, Group, Stack, Badge, Avatar, Box,
  TextInput, ActionIcon, Textarea,
  Tooltip, UnstyledButton, Flex, Loader,
  ScrollArea, Modal, Select,
} from '@mantine/core'
import {
  Search01Icon,
  MailSend01Icon,
  Mail01Icon,
  Notification01Icon,
  CheckmarkCircle01Icon,
  UserGroupIcon,
  PencilEdit01Icon,
  Notebook01Icon,
  MessageNotification01Icon,
  Alert01Icon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'in_app' | 'email'

interface ApiConversation {
  member_id: string
  member_name: string
  member_email: string
  member_status: string
  plan_name: string | null
  last_message: string | null
  last_message_at: string | null
  last_channel: string | null
  unread: number
}

interface ApiMessage {
  id: string
  subject: string
  body: string
  channel: string
  created_at: string
  read_at: string | null
}

interface ApiMemberDetail {
  id: string
  name: string
  email: string
  status: string
  plan_name: string | null
  expires_at: string | null
  joined_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHANNEL_META: Record<Channel, { icon: React.ElementType; color: string; label: string; bg: string }> = {
  in_app: { icon: Notification01Icon, color: '#6366f1', label: 'In-app', bg: '#eef2ff' },
  email:  { icon: Mail01Icon,         color: '#0d9488', label: 'Email',  bg: '#f0fdfa' },
}

const MEMBER_STATUS_COLOR: Record<string, string> = {
  active: 'green', expired: 'red', expiring_soon: 'yellow', grace_period: 'orange', inactive: 'gray',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function ChannelBadge({ channel }: { channel: Channel }) {
  const m = CHANNEL_META[channel] ?? CHANNEL_META.in_app
  const Icon = m.icon
  return (
    <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: m.bg, borderRadius: 6, padding: '2px 7px' }}>
      <Icon size={11} style={{ color: m.color }} />
      <Text size="xs" fw={600} style={{ color: m.color, lineHeight: 1 }}>{m.label}</Text>
    </Box>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagingPage() {
  const [conversations, setConversations]   = useState<ApiConversation[]>([])
  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [member, setMember]                 = useState<ApiMemberDetail | null>(null)
  const [messages, setMessages]             = useState<ApiMessage[]>([])
  const [filter, setFilter]                 = useState<'all' | 'unread'>('all')
  const [search, setSearch]                 = useState('')
  const [reply, setReply]                   = useState('')
  const [replySubject, setReplySubject]     = useState('')
  const [replyChannel, setReplyChannel]     = useState<Channel>('in_app')
  const [showNotes, setShowNotes]           = useState(false)
  const [note, setNote]                     = useState('')
  const [sending, setSending]               = useState(false)
  const [loadingThread, setLoadingThread]   = useState(false)
  const [composeOpen, setComposeOpen]       = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  // ── Fetch conversation list ──────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.get<{ conversations: ApiConversation[] }>('/api/settings/messages')
      setConversations(data.conversations ?? [])
    } catch {
      // silently fail on poll
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    const interval = setInterval(fetchConversations, 15_000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  // ── Fetch thread when member selected ───────────────────────────────────

  useEffect(() => {
    if (!selectedId) return
    setLoadingThread(true)
    api.get<{ member: ApiMemberDetail; messages: ApiMessage[] }>(`/api/settings/messages/${selectedId}`)
      .then(data => {
        setMember(data.member)
        setMessages(data.messages ?? [])
        // Mark unread cleared locally
        setConversations(cs => cs.map(c => c.member_id === selectedId ? { ...c, unread: 0 } : c))
      })
      .catch(() => {})
      .finally(() => setLoadingThread(false))
  }, [selectedId])

  // ── Scroll thread to bottom ──────────────────────────────────────────────

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, selectedId])

  // ── Send message ─────────────────────────────────────────────────────────

  async function sendReply() {
    if (!reply.trim() || !selectedId) return
    setSending(true)
    try {
      await api.post(`/api/settings/messages/${selectedId}`, {
        subject: replySubject.trim() || 'Message from staff',
        body: reply.trim(),
        channel: replyChannel,
      })
      setReply('')
      setReplySubject('')
      // Refresh thread
      const data = await api.get<{ member: ApiMemberDetail; messages: ApiMessage[] }>(`/api/settings/messages/${selectedId}`)
      setMessages(data.messages ?? [])
      // Refresh conversation list to update last message preview
      fetchConversations()
    } catch {
      notifications.show({ color: 'red', message: 'Failed to send message.' })
    } finally {
      setSending(false)
    }
  }

  // ── Filtered list ────────────────────────────────────────────────────────

  const filtered = conversations.filter(c => {
    const matchFilter = filter === 'all' || c.unread > 0
    const matchSearch = !search ||
      c.member_name.toLowerCase().includes(search.toLowerCase()) ||
      c.member_email.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const totalUnread = conversations.reduce((a, c) => a + (c.unread ?? 0), 0)
  const selected = conversations.find(c => c.member_id === selectedId) ?? null

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* ── LEFT: Conversation list ── */}
      <Box style={{ width: 280, flexShrink: 0, borderRight: '1px solid #edeef4', display: 'flex', flexDirection: 'column', background: '#fafbfc' }}>

        <Box px="md" pt="md" pb="sm" style={{ borderBottom: '1px solid #edeef4' }}>
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <Text size="sm" fw={800} style={{ color: '#111827' }}>Inbox</Text>
              {totalUnread > 0 && (
                <Badge size="xs" color="red" variant="filled" circle>{totalUnread}</Badge>
              )}
            </Group>
            <Tooltip label="New message" fz="xs" withArrow>
              <ActionIcon size="sm" variant="light" color="indigo" radius="md" onClick={() => setComposeOpen(true)}>
                <PencilEdit01Icon size={13} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <TextInput
            size="xs" radius="md" placeholder="Search members…"
            value={search} onChange={e => setSearch(e.target.value)}
            leftSection={<Search01Icon size={12} style={{ color: '#9ca3af' }} />}
            styles={{ input: { background: '#f4f5f9', border: '1px solid #edeef4' } }}
          />

          <Group gap={4} mt="sm">
            {(['all', 'unread'] as const).map(f => (
              <UnstyledButton
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: filter === f ? '#eef2ff' : 'transparent',
                  color: filter === f ? '#4f46e5' : '#6b7280',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </UnstyledButton>
            ))}
          </Group>
        </Box>

        <ScrollArea style={{ flex: 1 }} scrollbarSize={4}>
          <Stack gap={0}>
            {filtered.length === 0 && (
              <Flex direction="column" align="center" gap="xs" py="xl">
                <MessageNotification01Icon size={24} style={{ color: '#e5e7eb' }} />
                <Text size="xs" c="dimmed">No conversations</Text>
              </Flex>
            )}
            {filtered.map(conv => {
              const isActive = conv.member_id === selectedId
              const ch = (conv.last_channel ?? 'in_app') as Channel
              const cm = CHANNEL_META[ch] ?? CHANNEL_META.in_app
              const ChIcon = cm.icon
              return (
                <UnstyledButton
                  key={conv.member_id}
                  onClick={() => setSelectedId(conv.member_id)}
                  style={{
                    padding: '10px 14px',
                    background: isActive ? '#eef2ff' : 'transparent',
                    borderLeft: `3px solid ${isActive ? '#6366f1' : 'transparent'}`,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f4f5f9' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <Avatar size={32} radius="xl" color="indigo" variant={isActive ? 'filled' : 'light'} fz={10} fw={700} style={{ flexShrink: 0 }}>
                      {initials(conv.member_name)}
                    </Avatar>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" gap={4} mb={2}>
                        <Text size="xs" fw={conv.unread > 0 ? 800 : 600}
                          style={{ color: '#111827', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {conv.member_name}
                        </Text>
                        <Group gap={4} style={{ flexShrink: 0 }}>
                          {conv.unread > 0 && (
                            <Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                          )}
                          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{formatDate(conv.last_message_at)}</Text>
                        </Group>
                      </Group>
                      {conv.last_channel && (
                        <Group gap={4} mb={2}>
                          <ChIcon size={10} style={{ color: cm.color, flexShrink: 0 }} />
                          <Text size="xs" style={{ color: '#374151', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
                            {conv.last_channel === 'email' ? 'Email' : 'In-app'}
                          </Text>
                        </Group>
                      )}
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {conv.last_message ?? 'No messages yet'}
                      </Text>
                    </Box>
                  </Group>
                </UnstyledButton>
              )
            })}
          </Stack>
        </ScrollArea>
      </Box>

      {/* ── CENTER: Thread ── */}
      {selected ? (
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid #edeef4' }}>

          {/* Thread header */}
          <Box px="lg" style={{ height: 56, display: 'flex', alignItems: 'center', borderBottom: '1px solid #edeef4', flexShrink: 0 }}>
            <Group justify="space-between" style={{ width: '100%' }}>
              <Group gap="sm">
                <Avatar size={28} radius="xl" color="indigo" variant="filled" fz={9} fw={700}>
                  {initials(selected.member_name)}
                </Avatar>
                <Stack gap={0}>
                  <Group gap="xs">
                    <Text size="xs" fw={800} style={{ color: '#111827' }}>{selected.member_name}</Text>
                    <Badge size="xs" color={MEMBER_STATUS_COLOR[selected.member_status] ?? 'gray'} variant="light">
                      {selected.member_status}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{selected.member_email}</Text>
                </Stack>
              </Group>
              <Group gap="xs">
                <Tooltip label={showNotes ? 'Hide notes' : 'Internal notes'} fz="xs" withArrow>
                  <ActionIcon size="sm" variant={showNotes ? 'filled' : 'light'} color="indigo" radius="md"
                    onClick={() => setShowNotes(n => !n)}>
                    <Notebook01Icon size={13} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Box>

          {/* Messages thread */}
          <Box ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {loadingThread ? (
              <Flex justify="center" pt="xl">
                <Loader size="sm" color="indigo" />
              </Flex>
            ) : messages.length === 0 ? (
              <Flex direction="column" align="center" gap="xs" pt="xl">
                <MessageNotification01Icon size={32} style={{ color: '#e5e7eb' }} />
                <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>No messages yet</Text>
                <Text size="xs" c="dimmed">Send a message below to start the conversation</Text>
              </Flex>
            ) : (
              <Stack gap="sm">
                {messages.map(msg => (
                  <Box key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Box style={{ maxWidth: '70%' }}>
                      <Text size="xs" c="dimmed" mb={4} style={{ textAlign: 'right' }} mr={4}>You</Text>
                      <Box style={{
                        padding: '10px 14px',
                        borderRadius: '16px 16px 4px 16px',
                        background: '#6366f1',
                      }}>
                        {msg.subject && (
                          <Text size="xs" fw={700} style={{ color: '#c7d2fe', marginBottom: 4 }}>{msg.subject}</Text>
                        )}
                        <Text size="sm" style={{ color: '#fff', lineHeight: 1.5 }}>{msg.body}</Text>
                      </Box>
                      <Group justify="flex-end" gap={6} mt={4} mr={4}>
                        <ChannelBadge channel={(msg.channel as Channel) ?? 'in_app'} />
                        <Text size="xs" style={{ color: '#9ca3af' }}>{formatTime(msg.created_at)}</Text>
                      </Group>
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          {/* Internal notes panel */}
          {showNotes && (
            <Box style={{ borderTop: '1px solid #fef9c3', background: '#fefce8', padding: '12px 24px', flexShrink: 0 }}>
              <Group gap="xs" mb="xs">
                <Notebook01Icon size={12} style={{ color: '#d97706' }} />
                <Text size="xs" fw={700} style={{ color: '#92400e' }}>Internal note — only visible to staff</Text>
              </Group>
              <Textarea
                placeholder="Add a note about this member or conversation…"
                value={note}
                onChange={e => setNote(e.target.value)}
                size="xs" radius="md" autosize minRows={2} maxRows={4}
                styles={{ input: { background: '#fffbeb', border: '1px solid #fde68a' } }}
              />
            </Box>
          )}

          {/* Composer */}
          <Box style={{ borderTop: '1px solid #edeef4', padding: '12px 24px', flexShrink: 0 }}>
            <Box style={{ background: '#f4f5f9', borderRadius: 14, border: '1.5px solid #edeef4', overflow: 'hidden' }}>
              <TextInput
                placeholder="Subject (optional)"
                value={replySubject}
                onChange={e => setReplySubject(e.target.value)}
                size="xs"
                styles={{
                  input: { background: 'transparent', border: 'none', borderBottom: '1px solid #edeef4', borderRadius: 0, padding: '10px 16px' },
                  wrapper: { background: 'transparent' },
                }}
              />
              <Textarea
                placeholder={`Message to ${selected.member_name}…`}
                value={reply}
                onChange={e => setReply(e.target.value)}
                size="sm" autosize minRows={2} maxRows={6}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    sendReply()
                  }
                }}
                styles={{
                  input: { background: 'transparent', border: 'none', padding: '12px 16px', resize: 'none' },
                  wrapper: { background: 'transparent' },
                }}
              />
              <Group justify="space-between" px="sm" pb="sm">
                <Group gap="xs">
                  <Select
                    size="xs"
                    value={replyChannel}
                    onChange={v => setReplyChannel((v as Channel) ?? 'in_app')}
                    data={[
                      { value: 'in_app', label: 'In-app' },
                      { value: 'email',  label: 'Email' },
                    ]}
                    styles={{ input: { background: '#eef2ff', border: 'none', color: '#4f46e5', fontWeight: 600 } }}
                    w={100}
                  />
                  <Text size="xs" c="dimmed">⌘↵ to send</Text>
                </Group>
                <ActionIcon
                  size="md" radius="md" color="indigo"
                  variant={reply.trim() ? 'filled' : 'light'}
                  onClick={sendReply}
                  loading={sending}
                  disabled={!reply.trim()}
                >
                  <MailSend01Icon size={14} />
                </ActionIcon>
              </Group>
            </Box>
          </Box>

        </Box>
      ) : (
        <Flex style={{ flex: 1 }} direction="column" align="center" justify="center" gap="sm">
          <MessageNotification01Icon size={40} style={{ color: '#e5e7eb' }} />
          <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>Select a conversation</Text>
          <Text size="xs" c="dimmed">Choose from the inbox on the left</Text>
        </Flex>
      )}

      {/* ── RIGHT: Member context ── */}
      {selected && member && (
        <Box style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

          <Box p="lg" style={{ borderBottom: '1px solid #edeef4' }}>
            <Flex direction="column" align="center" gap="xs" mb="md">
              <Avatar size={56} radius="xl" color="indigo" variant="filled" fz={16} fw={700}>
                {initials(member.name)}
              </Avatar>
              <Stack gap={4} align="center">
                <Text size="sm" fw={800} style={{ color: '#111827' }}>{member.name}</Text>
                <Text size="xs" c="dimmed">{member.email}</Text>
                <Badge size="xs" color={MEMBER_STATUS_COLOR[member.status] ?? 'gray'} variant="light">
                  {member.status}
                </Badge>
              </Stack>
            </Flex>

            <Box style={{ background: '#f4f5f9', borderRadius: 12, padding: '10px 12px' }}>
              <Stack gap="xs">
                {[
                  { label: 'Plan',         value: member.plan_name ?? '—' },
                  { label: 'Member since', value: member.joined_at ? new Date(member.joined_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—' },
                  { label: 'Expiry',       value: member.expires_at ? new Date(member.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                  { label: 'Messages',     value: `${messages.length} sent` },
                ].map(row => (
                  <Group key={row.label} justify="space-between">
                    <Text size="xs" c="dimmed">{row.label}</Text>
                    <Text size="xs" fw={600} style={{ color: '#111827' }}>{row.value}</Text>
                  </Group>
                ))}
              </Stack>
            </Box>
          </Box>

          <Box p="lg">
            <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.08em', color: '#b0b7c3', marginBottom: 10 }}>
              Quick actions
            </Text>
            <Stack gap="xs">
              {[
                { label: 'View member profile', icon: UserGroupIcon },
                { label: 'Renew subscription',  icon: CheckmarkCircle01Icon },
                { label: 'Flag account',         icon: Alert01Icon },
              ].map(action => {
                const Icon = action.icon
                return (
                  <UnstyledButton
                    key={action.label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 8,
                      background: '#f4f5f9',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f4f5f9' }}
                  >
                    <Icon size={13} style={{ color: '#6b7280', flexShrink: 0 }} />
                    <Text size="xs" fw={600} style={{ color: '#374151' }}>{action.label}</Text>
                  </UnstyledButton>
                )
              })}
            </Stack>
          </Box>
        </Box>
      )}

      {/* ── New Message Modal ── */}
      <Modal
        opened={composeOpen}
        onClose={() => setComposeOpen(false)}
        title={<Text fw={700} size="sm">New message</Text>}
        radius="lg"
        size="md"
      >
        <Stack gap="sm">
          <Select
            label="Member"
            placeholder="Search members…"
            searchable
            data={conversations.map(c => ({ value: c.member_id, label: `${c.member_name} — ${c.member_email}` }))}
            onChange={v => { if (v) { setSelectedId(v); setComposeOpen(false) } }}
            size="sm"
          />
        </Stack>
      </Modal>

    </Box>
  )
}
