'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Paper, Text, Title, Group, Stack, ThemeIcon,
  TextInput, Box, SimpleGrid, Flex, Anchor, Divider,
} from '@mantine/core'
import {
  HelpCircleIcon,
  Search01Icon,
  UserGroupIcon,
  CreditCardIcon,
  QrCode01Icon,
  Wallet01Icon,
  Calendar01Icon,
  Settings01Icon,
  ArrowRight01Icon,
  MessageQuestionIcon,
  Mail01Icon,
  BookOpen01Icon,
  PlayIcon,
} from 'hugeicons-react'

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const } }),
}

const CATEGORIES = [
  {
    icon: UserGroupIcon, color: 'indigo', title: 'Members', href: '/members',
    articles: [
      { label: 'Adding members manually',      href: '/members' },
      { label: 'Importing members from CSV',   href: '/members' },
      { label: 'Member statuses explained',    href: '/members' },
      { label: 'Deleting a member',            href: '/members' },
    ],
  },
  {
    icon: CreditCardIcon, color: 'gray', title: 'Subscriptions & Plans', href: '/subscriptions',
    articles: [
      { label: 'Creating a membership plan',        href: '/subscriptions' },
      { label: 'Assigning a plan to a member',      href: '/subscriptions' },
      { label: 'Renewing a subscription',           href: '/subscriptions' },
      { label: 'Handling expired subscriptions',    href: '/subscriptions' },
    ],
  },
  {
    icon: QrCode01Icon, color: 'gray', title: 'Check-ins', href: '/checkins',
    articles: [
      { label: 'Setting up the QR code',       href: '/checkins' },
      { label: 'Manual check-in guide',        href: '/checkins' },
      { label: 'Exporting check-in logs',      href: '/checkins' },
      { label: 'Understanding check-in stats', href: '/analytics' },
    ],
  },
  {
    icon: Wallet01Icon, color: 'gray', title: 'Payments', href: '/payments',
    articles: [
      { label: 'Recording a payment',        href: '/payments' },
      { label: 'Supported payment methods',  href: '/payments' },
      { label: 'Refunding a payment',        href: '/payments' },
      { label: 'Exporting payment history',  href: '/payments' },
    ],
  },
  {
    icon: Calendar01Icon, color: 'gray', title: 'Classes (Growth+)', href: '/classes',
    articles: [
      { label: 'Creating a class',                 href: '/classes' },
      { label: 'Assigning a trainer to a class',   href: '/classes' },
      { label: 'Managing class capacity',          href: '/classes' },
      { label: 'Viewing the class schedule',       href: '/classes' },
    ],
  },
  {
    icon: Settings01Icon, color: 'gray', title: 'Settings & Account', href: '/settings/profile',
    articles: [
      { label: 'Changing your gym name',    href: '/settings/profile' },
      { label: 'Updating opening hours',    href: '/settings/profile' },
      { label: 'Inviting staff members',    href: '/settings/staff' },
      { label: 'Upgrading your plan',       href: '/settings/billing' },
    ],
  },
]

const FAQS = [
  {
    q: 'How do I add a new member?',
    a: 'Go to Members → click "Add member" in the top right. Fill in name, email, phone, and optionally assign a plan. The member will appear in your list immediately.',
  },
  {
    q: 'What is the QR code used for?',
    a: 'The QR code allows members to check in by scanning with their phone camera. Display it at your gym entrance. Each scan is logged in real time in the Check-ins section.',
  },
  {
    q: 'Can I record payments in cash or mobile money?',
    a: 'Yes. On the Payments page, click "Record payment", enter the member and amount, then select the payment method: Cash, Mobile Money, or Card.',
  },
  {
    q: 'What is Growth+ and what does it unlock?',
    a: 'Growth+ is our premium plan. It unlocks Class & Schedule management, Trainer profiles, SMS messaging, unlimited members, custom integrations, and priority support.',
  },
  {
    q: 'How do I invite a staff member?',
    a: 'Go to Settings → Staff & Access → click "Invite staff". Enter their email and choose a role. They\'ll receive an invitation to join your gym dashboard.',
  },
  {
    q: 'How do I export my data?',
    a: 'You can export data from each page using the "Export" button. For a full export, go to Settings → Danger zone → Export all data.',
  },
]

export default function HelpPage() {
  const [search, setSearch] = useState('')

  const filteredFaqs = FAQS.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Stack gap="lg" p="xl" maw={1000}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Help &amp; Docs
            </Title>
            <Text size="sm" c="dimmed">Guides, FAQs, and support resources.</Text>
          </Stack>
        </Group>
      </motion.div>

      {/* Search */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <TextInput
          size="md"
          radius="xl"
          placeholder="Search articles and FAQs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftSection={<Search01Icon size={16} style={{ color: '#9ca3af' }} />}
          styles={{
            input: { background: '#f4f5f9', border: '1.5px solid #edeef4', paddingLeft: 44 },
          }}
        />
      </motion.div>

      {!search && (
        <>
          {/* Quick links */}
          <motion.div variants={fade} custom={2} initial="hidden" animate="show">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              {[
                { icon: BookOpen01Icon,      color: 'indigo', title: 'Getting started',   desc: 'Set up your gym in 5 minutes',     href: '/dashboard' },
                { icon: PlayIcon,            color: 'gray',   title: 'Video tutorials',   desc: 'Watch step-by-step guides',         href: '/analytics' },
                { icon: MessageQuestionIcon, color: 'gray', title: 'Live chat support', desc: 'Talk to our team — 9am–6pm',       href: 'mailto:support@myfiti.app' },
              ].map((item, i) => {
                const Icon = item.icon
                const isExternal = item.href.startsWith('mailto:')
                return (
                  <Link key={i} href={item.href} style={{ textDecoration: 'none' }} {...(isExternal ? { target: '_blank' } : {})}>
                    <Paper radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4', cursor: 'pointer', height: '100%' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c7d2fe' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#edeef4' }}
                    >
                      <ThemeIcon size={40} radius="xl" color={item.color} variant="light" mb="md">
                        <Icon size={20} />
                      </ThemeIcon>
                      <Text fw={700} size="sm" style={{ color: '#111827' }} mb={4}>{item.title}</Text>
                      <Text size="xs" c="dimmed">{item.desc}</Text>
                    </Paper>
                  </Link>
                )
              })}
            </SimpleGrid>
          </motion.div>

          {/* Help categories */}
          <motion.div variants={fade} custom={3} initial="hidden" animate="show">
            <Stack gap="sm">
              <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
                Browse by topic
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {CATEGORIES.map((cat, i) => {
                  const Icon = cat.icon
                  return (
                    <Paper key={i} radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
                      <Group gap="sm" mb="md">
                        <ThemeIcon size={32} radius="lg" color={cat.color} variant="light">
                          <Icon size={16} />
                        </ThemeIcon>
                        <Text size="sm" fw={700} style={{ color: '#111827' }}>{cat.title}</Text>
                      </Group>
                      <Stack gap={4}>
                        {cat.articles.map(article => (
                          <Link key={article.label} href={article.href} style={{ textDecoration: 'none' }}>
                            <Group gap="xs"
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4f46e5' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'inherit' }}
                            >
                              <ArrowRight01Icon size={11} style={{ color: '#9ca3af', flexShrink: 0 }} />
                              <Text size="xs" style={{ color: '#4b5563' }}>{article.label}</Text>
                            </Group>
                          </Link>
                        ))}
                      </Stack>
                    </Paper>
                  )
                })}
              </SimpleGrid>
            </Stack>
          </motion.div>
        </>
      )}

      {/* FAQ section */}
      <motion.div variants={fade} custom={4} initial="hidden" animate="show">
        <Stack gap="sm">
          <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#b0b7c3' }}>
            {search ? `Results for "${search}"` : 'Frequently asked questions'}
          </Text>

          {filteredFaqs.length > 0 ? (
            <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
              {filteredFaqs.map((faq, i) => (
                <Box key={i}>
                  {i > 0 && <Divider />}
                  <Box p="lg">
                    <Group gap="sm" mb="xs" align="flex-start">
                      <ThemeIcon size={22} radius="lg" color="indigo" variant="light" style={{ flexShrink: 0, marginTop: 1 }}>
                        <HelpCircleIcon size={12} />
                      </ThemeIcon>
                      <Text size="sm" fw={700} style={{ color: '#111827', flex: 1 }}>{faq.q}</Text>
                    </Group>
                    <Text size="sm" c="dimmed" style={{ paddingLeft: 30, lineHeight: 1.6 }}>{faq.a}</Text>
                  </Box>
                </Box>
              ))}
            </Paper>
          ) : (
            <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
              <Flex direction="column" align="center" gap="sm">
                <HelpCircleIcon size={28} style={{ color: '#e5e7eb' }} />
                <Text size="sm" fw={500} style={{ color: '#9ca3af' }}>No results found</Text>
                <Text size="xs" c="dimmed">Try different keywords or contact support below.</Text>
              </Flex>
            </Paper>
          )}
        </Stack>
      </motion.div>

      {/* Contact support */}
      <motion.div variants={fade} custom={5} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4', background: '#fafbff' }}>
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={48} radius="xl" color="indigo" variant="light" style={{ flexShrink: 0 }}>
              <Mail01Icon size={22} />
            </ThemeIcon>
            <Stack gap={4}>
              <Text fw={700} size="sm" style={{ color: '#111827' }}>Still need help?</Text>
              <Text size="xs" c="dimmed">
                Our support team is available Monday–Friday, 9am–6pm WAT.
                Email us at{' '}
                <Anchor size="xs" href="mailto:support@myfiti.app" c="indigo" fw={600}>
                  support@myfiti.app
                </Anchor>{' '}
                and we&apos;ll respond within 24 hours.
              </Text>
            </Stack>
          </Group>
        </Paper>
      </motion.div>

    </Stack>
  )
}
