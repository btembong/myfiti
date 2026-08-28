'use client'

import { useState, useEffect } from 'react'
import { Group, Text, Button, ActionIcon, Box } from '@mantine/core'
import { Cancel01Icon } from 'hugeicons-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed in this session
    if (sessionStorage.getItem('pwa-banner-dismissed')) {
      setDismissed(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDismissed(true)
    }
  }

  function dismiss() {
    sessionStorage.setItem('pwa-banner-dismissed', '1')
    setDismissed(true)
  }

  return (
    <Box style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, width: 'calc(100% - 40px)', maxWidth: 480,
      background: '#1e1b4b',
      border: '1px solid rgba(99,102,241,0.4)',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(79,70,229,0.25)',
      padding: '14px 16px',
    }}>
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Box style={{
            width: 36, height: 36, borderRadius: 10, background: '#4f46e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>m</span>
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text size="sm" fw={700} style={{ color: '#fff', lineHeight: 1.3 }}>
              Install myfiti
            </Text>
            <Text size="xs" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>
              Add to your home screen for faster access
            </Text>
          </Box>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Button
            size="xs" radius="md"
            style={{ background: '#4f46e5', color: '#fff', fontWeight: 700, flexShrink: 0 }}
            onClick={install}
          >
            Install
          </Button>
          <ActionIcon
            size="sm" variant="subtle"
            style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}
            onClick={dismiss}
          >
            <Cancel01Icon size={14} />
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  )
}
