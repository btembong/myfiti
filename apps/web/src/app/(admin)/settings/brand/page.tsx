'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Paper, TextInput, Button, Text, Title,
  Group, Stack, ThemeIcon, Divider, Box, SimpleGrid,
  Tooltip, Badge, Image,
} from '@mantine/core'
import {
  Medal01Icon,
  Camera01Icon,
  Dumbbell01Icon,
  FloppyDiskIcon,
  CheckmarkCircle01Icon,
  QrCode01Icon,
  SmartPhone01Icon,
  Building01Icon,
  Delete01Icon,
} from 'hugeicons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const } }),
}

const BRAND_COLORS = [
  { hex: '#6366f1', name: 'Indigo'   },
  { hex: '#8b5cf6', name: 'Violet'   },
  { hex: '#ec4899', name: 'Pink'     },
  { hex: '#ef4444', name: 'Red'      },
  { hex: '#f59e0b', name: 'Amber'    },
  { hex: '#10b981', name: 'Emerald'  },
  { hex: '#3b82f6', name: 'Blue'     },
  { hex: '#0d9488', name: 'Teal'     },
  { hex: '#111827', name: 'Charcoal' },
]

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function BrandPage() {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  const [brand, setBrand] = useState({
    displayName: '',
    tagline: '',
    primaryColor: '#6366f1',
    customColor: '',
    logoUrl: null as string | null,
  })

  const activeColor = brand.customColor || brand.primaryColor

  useEffect(() => {
    api.get<{ gym_name?: string; tagline?: string; primary_color?: string; logo_url?: string | null }>('/api/settings/profile')
      .then(data => {
        setBrand(b => ({
          ...b,
          displayName: data.gym_name ?? b.displayName,
          tagline: (data as Record<string, unknown>).tagline as string ?? b.tagline,
          primaryColor: data.primary_color ?? b.primaryColor,
          logoUrl: data.logo_url ?? null,
        }))
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch('/api/settings/profile', {
        gym_name: brand.displayName,
        tagline: brand.tagline,
        primary_color: brand.customColor || brand.primaryColor,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      notifications.show({ color: 'red', message: 'Failed to save brand settings.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(file: File, type: 'logo' | 'favicon') {
    if (!file) return
    const maxBytes = type === 'favicon' ? 100_000 : 500_000
    if (file.size > maxBytes) {
      notifications.show({ color: 'red', message: `File too large. Max ${maxBytes / 1000}KB.` })
      return
    }
    setUploadingLogo(true)
    try {
      const reader = new FileReader()
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await api.patch('/api/settings/profile', { logo_url: dataUrl })
      setBrand(b => ({ ...b, logoUrl: dataUrl }))
      notifications.show({ color: 'green', message: `${type === 'favicon' ? 'Favicon' : 'Logo'} uploaded.` })
    } catch {
      notifications.show({ color: 'red', message: 'Upload failed.' })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function removeLogo() {
    try {
      await api.patch('/api/settings/profile', { logo_url: null })
      setBrand(b => ({ ...b, logoUrl: null }))
      notifications.show({ color: 'green', message: 'Logo removed.' })
    } catch {
      notifications.show({ color: 'red', message: 'Failed to remove logo.' })
    }
  }

  // ── Kiosk preview ──────────────────────────────────────────────────────────

  function KioskPreview() {
    return (
      <Box style={{
        width: '100%', aspectRatio: '9/16', maxWidth: 200,
        borderRadius: 20, overflow: 'hidden',
        background: '#f9fafb', border: '6px solid #1f2937',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Kiosk header */}
        <Box style={{ background: activeColor, padding: '20px 16px 16px', textAlign: 'center' }}>
          <Box style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 8px',
          }}>
            <Dumbbell01Icon size={18} color="white" />
          </Box>
          <Text size="xs" fw={800} style={{ color: '#fff', lineHeight: 1.2, fontSize: 11 }}>
            {brand.displayName || 'My Gym'}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 8, lineHeight: 1.4 }}>
            {brand.tagline || 'Welcome'}
          </Text>
        </Box>

        {/* Kiosk body */}
        <Box style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Check-in button */}
          <Box style={{
            borderRadius: 10, padding: '12px 8px',
            background: activeColor,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            boxShadow: `0 4px 12px ${hexToRgba(activeColor, 0.3)}`,
          }}>
            <QrCode01Icon size={20} color="white" />
            <Text style={{ color: '#fff', fontWeight: 800, fontSize: 9 }}>TAP TO CHECK IN</Text>
          </Box>

          {/* Member lookup */}
          <Box style={{
            borderRadius: 10, padding: '10px 8px',
            background: '#fff', border: `1.5px solid ${hexToRgba(activeColor, 0.2)}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <SmartPhone01Icon size={14} style={{ color: activeColor }} />
            <Text style={{ color: '#374151', fontWeight: 600, fontSize: 8 }}>Member lookup</Text>
          </Box>

          {/* Footer */}
          <Box style={{ marginTop: 'auto', textAlign: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 7 }}>Powered by Gymflow</Text>
          </Box>
        </Box>
      </Box>
    )
  }

  // ── Email preview ──────────────────────────────────────────────────────────

  function EmailPreview() {
    return (
      <Box style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid #edeef4', background: '#fff',
      }}>
        {/* Email header */}
        <Box style={{ background: activeColor, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Box style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Dumbbell01Icon size={13} color="white" />
          </Box>
          <Text size="xs" fw={800} style={{ color: '#fff' }}>
            {brand.displayName || 'My Gym'}
          </Text>
        </Box>
        {/* Email body */}
        <Box p="md">
          <Text size="xs" fw={700} style={{ color: '#111827' }} mb={6}>Hi Member,</Text>
          <Box style={{ height: 6, borderRadius: 3, background: '#f4f5f9', marginBottom: 4 }} />
          <Box style={{ height: 6, borderRadius: 3, background: '#f4f5f9', width: '80%', marginBottom: 12 }} />
          <Box style={{
            borderRadius: 8, padding: '8px 14px',
            background: activeColor, display: 'inline-block',
          }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>View receipt →</Text>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Stack gap="xl" p="xl" maw={760}>

      {/* Header */}
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
          <Stack gap={4}>
            <Title order={2} style={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Brand management
            </Title>
            <Text size="sm" c="dimmed">Customize how your gym looks on the kiosk, app, and emails.</Text>
          </Stack>
          <Button
            onClick={handleSave}
            variant={saved ? 'light' : 'filled'}
            color={saved ? 'green' : 'indigo'}
            size="sm"
            loading={saving}
            leftSection={saved ? <CheckmarkCircle01Icon size={15} /> : <FloppyDiskIcon size={15} />}
          >
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </Group>
      </motion.div>

      {/* Identity */}
      <motion.div variants={fade} custom={1} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="indigo" variant="light">
              <Building01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Brand identity</Text>
              <Text size="xs" c="dimmed">Name and tagline shown on kiosk and member app</Text>
            </Stack>
          </Group>
          <Stack gap="md">
            <TextInput
              label="Display name"
              description="Shown on kiosk home screen, emails, and invoices"
              value={brand.displayName}
              onChange={e => setBrand(b => ({ ...b, displayName: e.target.value }))}
              radius="md" size="sm"
            />
            <TextInput
              label="Tagline"
              description="Short motivational phrase shown under your gym name"
              placeholder="Train harder. Live better."
              value={brand.tagline}
              onChange={e => setBrand(b => ({ ...b, tagline: e.target.value }))}
              radius="md" size="sm"
            />
          </Stack>
        </Paper>
      </motion.div>

      {/* Logo */}
      <motion.div variants={fade} custom={2} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="gray" variant="light">
              <Camera01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Logo</Text>
              <Text size="xs" c="dimmed">PNG or SVG, square format — shown on kiosk, emails, and invoices</Text>
            </Stack>
          </Group>

          {/* Hidden file inputs */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, 'logo'); e.target.value = '' }}
          />
          <input
            ref={faviconInputRef}
            type="file"
            accept="image/png,image/x-icon,image/vnd.microsoft.icon"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, 'favicon'); e.target.value = '' }}
          />

          <Group gap="xl">
            {/* Logo preview */}
            <Box style={{
              width: 80, height: 80, borderRadius: 20,
              background: brand.logoUrl ? '#f4f5f9' : activeColor,
              boxShadow: `0 8px 24px ${hexToRgba(activeColor, 0.3)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden',
            }}>
              {brand.logoUrl
                ? <Image src={brand.logoUrl} alt="Logo" w={80} h={80} fit="contain" />
                : <Dumbbell01Icon size={32} color="white" />
              }
            </Box>
            <Stack gap="xs">
              <Button
                size="xs" variant="default" leftSection={<Camera01Icon size={12} />}
                loading={uploadingLogo}
                onClick={() => logoInputRef.current?.click()}
              >
                {brand.logoUrl ? 'Replace logo' : 'Upload logo'}
              </Button>
              <Button
                size="xs" variant="default" leftSection={<Camera01Icon size={12} />}
                loading={uploadingLogo}
                onClick={() => faviconInputRef.current?.click()}
              >
                Upload favicon
              </Button>
              {brand.logoUrl && (
                <Button
                  size="xs" variant="subtle" color="red" leftSection={<Delete01Icon size={12} />}
                  onClick={removeLogo}
                >
                  Remove logo
                </Button>
              )}
              <Text size="xs" c="dimmed">Max 500KB. Favicon: 32×32 px PNG or ICO</Text>
            </Stack>
          </Group>
        </Paper>
      </motion.div>

      {/* Color */}
      <motion.div variants={fade} custom={3} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="lg">
            <ThemeIcon size={36} radius="xl" color="gray" variant="light">
              <Medal01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Brand color</Text>
              <Text size="xs" c="dimmed">Used on the kiosk, member app, email headers, and invoices</Text>
            </Stack>
          </Group>

          {/* Color presets */}
          <Stack gap="md">
            <Stack gap="xs">
              <Text size="xs" fw={600} style={{ color: '#374151' }}>Choose a preset</Text>
              <Group gap="xs">
                {BRAND_COLORS.map(c => (
                  <Tooltip key={c.hex} label={c.name} fz="xs" withArrow>
                    <Box
                      onClick={() => setBrand(b => ({ ...b, primaryColor: c.hex, customColor: '' }))}
                      style={{
                        width: 32, height: 32, borderRadius: 8, background: c.hex, cursor: 'pointer',
                        border: brand.primaryColor === c.hex && !brand.customColor
                          ? '3px solid #111827' : '3px solid transparent',
                        transition: 'transform 0.1s, border 0.1s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                    >
                      {brand.primaryColor === c.hex && !brand.customColor && (
                        <CheckmarkCircle01Icon size={14} color="white" />
                      )}
                    </Box>
                  </Tooltip>
                ))}
              </Group>
            </Stack>

            <Stack gap="xs">
              <Text size="xs" fw={600} style={{ color: '#374151' }}>Or enter a custom hex color</Text>
              <Group gap="sm">
                <Box style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: activeColor, border: '1px solid #edeef4',
                }} />
                <TextInput
                  placeholder="#6366f1"
                  value={brand.customColor}
                  onChange={e => setBrand(b => ({ ...b, customColor: e.target.value }))}
                  radius="md" size="sm"
                  style={{ flex: 1 }}
                  leftSection={<Text size="xs" c="dimmed">#</Text>}
                />
              </Group>
            </Stack>

            {/* Active color preview bar */}
            <Box style={{
              height: 8, borderRadius: 8,
              background: `linear-gradient(90deg, ${activeColor}, ${hexToRgba(activeColor, 0.4)})`,
            }} />
          </Stack>
        </Paper>
      </motion.div>

      {/* Live preview */}
      <motion.div variants={fade} custom={4} initial="hidden" animate="show">
        <Paper radius="xl" p="xl" withBorder style={{ borderColor: '#edeef4' }}>
          <Group gap="sm" mb="xl">
            <ThemeIcon size={36} radius="xl" color="gray" variant="light">
              <QrCode01Icon size={18} />
            </ThemeIcon>
            <Stack gap={1}>
              <Group gap="xs">
                <Text size="sm" fw={700} style={{ color: '#111827' }}>Live preview</Text>
                <Badge size="xs" color="gray" variant="light">Real-time</Badge>
              </Group>
              <Text size="xs" c="dimmed">How your brand appears on kiosk and emails</Text>
            </Stack>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
            {/* Kiosk preview */}
            <Stack gap="sm" align="center">
              <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.08em', color: '#b0b7c3' }}>
                Kiosk screen
              </Text>
              <KioskPreview />
            </Stack>

            {/* Email preview */}
            <Stack gap="sm">
              <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.08em', color: '#b0b7c3' }}>
                Email header
              </Text>
              <EmailPreview />
              {/* Invoice color strip */}
              <Stack gap="xs">
                <Text size="xs" fw={600} style={{ color: '#374151' }}>Invoice accent</Text>
                <Box style={{
                  borderRadius: 10, padding: '12px 16px',
                  border: '1px solid #edeef4', background: '#fafbfc',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <Box style={{ width: 4, height: 40, borderRadius: 2, background: activeColor, flexShrink: 0 }} />
                  <Stack gap={2}>
                    <Text size="xs" fw={800} style={{ color: '#111827' }}>Invoice #0001</Text>
                    <Text size="xs" c="dimmed">₣15,000 · Monthly Plan · Jul 3, 2026</Text>
                  </Stack>
                  <Box style={{
                    marginLeft: 'auto', padding: '4px 10px', borderRadius: 6,
                    background: hexToRgba(activeColor, 0.1),
                  }}>
                    <Text size="xs" fw={700} style={{ color: activeColor }}>PAID</Text>
                  </Box>
                </Box>
              </Stack>
            </Stack>
          </SimpleGrid>
        </Paper>
      </motion.div>

      {/* Bottom save */}
      <motion.div variants={fade} custom={5} initial="hidden" animate="show">
        <Divider mb="md" />
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            variant={saved ? 'light' : 'filled'}
            color={saved ? 'green' : 'indigo'}
            size="sm"
            loading={saving}
            leftSection={saved ? <CheckmarkCircle01Icon size={15} /> : <FloppyDiskIcon size={15} />}
          >
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </Group>
      </motion.div>

    </Stack>
  )
}
