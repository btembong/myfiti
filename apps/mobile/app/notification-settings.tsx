import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Linking, Alert,
} from 'react-native'
import { useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { MotiView } from 'moti'
import {
  Bell, BellOff, Megaphone, Zap, Calendar,
  Wallet, ChevronRight, ExternalLink, ArrowLeft,
} from 'lucide-react-native'
import { Screen } from '../src/components/ui/Screen'
import { useTenant } from '../src/context/TenantContext'
import { useTheme } from '../src/context/ThemeContext'
import { registerPushToken, deregisterPushToken } from '../src/lib/notifications'
import { F } from '../src/theme'

// ─── Storage keys ─────────────────────────────────────────────────────────────
const KEY_PUSH    = 'push_notifications_enabled'
const KEY_CAT     = (cat: string) => `notif_cat_${cat}`

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'announcements',
    icon: Megaphone,
    color: '#3B82F6',
    label: 'Gym announcements',
    sub: 'News, events, and updates from your gym',
  },
  {
    key: 'motivation',
    icon: Zap,
    color: '#F59E0B',
    label: 'Daily motivation',
    sub: 'Morning tip to keep you on track',
  },
  {
    key: 'membership',
    icon: Calendar,
    color: '#10B981',
    label: 'Membership reminders',
    sub: 'Expiry warnings and renewal confirmations',
  },
  {
    key: 'wallet',
    icon: Wallet,
    color: '#8B5CF6',
    label: 'Wallet events',
    sub: 'Top-ups, auto-renewals, and balance alerts',
  },
  {
    key: 'classes',
    icon: Bell,
    color: '#EC4899',
    label: 'Class & booking reminders',
    sub: 'Alerts before your booked classes start',
  },
]

// ─── Row component ────────────────────────────────────────────────────────────
function PrefRow({
  icon: Icon, color, label, sub, value, onToggle, disabled = false,
}: {
  icon: any; color: string; label: string; sub: string
  value: boolean; onToggle: (v: boolean) => void; disabled?: boolean
}) {
  const { theme } = useTheme()
  return (
    <View style={[styles.row, { borderBottomColor: theme.borderSub, opacity: disabled ? 0.45 : 1 }]}>
      <View style={[styles.rowIcon, { backgroundColor: color + '18' }]}>
        <Icon size={17} color={color} strokeWidth={1.8} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: theme.textMuted }]} numberOfLines={1}>{sub}</Text>
      </View>
      <Switch
        value={value && !disabled}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: theme.border, true: color + '60' }}
        thumbColor={value && !disabled ? color : theme.textMuted}
      />
    </View>
  )
}

function LinkRow({
  icon: Icon, color, label, sub, onPress,
}: {
  icon: any; color: string; label: string; sub: string; onPress: () => void
}) {
  const { theme } = useTheme()
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.borderSub }]}
      onPress={onPress} activeOpacity={0.65}
    >
      <View style={[styles.rowIcon, { backgroundColor: color + '18' }]}>
        <Icon size={17} color={color} strokeWidth={1.8} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: theme.textMuted }]} numberOfLines={1}>{sub}</Text>
      </View>
      <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
    </TouchableOpacity>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme()
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NotificationSettingsScreen() {
  const { branding } = useTenant()
  const { theme } = useTheme()
  const router = useRouter()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''

  const [pushEnabled, setPushEnabled] = useState(true)
  const [cats, setCats] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map(c => [c.key, true])),
  )
  const [loaded, setLoaded] = useState(false)

  // Load persisted prefs
  useEffect(() => {
    async function load() {
      const keys = [KEY_PUSH, ...CATEGORIES.map(c => KEY_CAT(c.key))]
      const pairs = await AsyncStorage.multiGet(keys)
      const map = Object.fromEntries(pairs.map(([k, v]) => [k, v]))

      if (map[KEY_PUSH] !== null) setPushEnabled(map[KEY_PUSH] === 'true')

      const newCats: Record<string, boolean> = {}
      for (const c of CATEGORIES) {
        const stored = map[KEY_CAT(c.key)]
        newCats[c.key] = stored === null ? true : stored === 'true'
      }
      setCats(newCats)
      setLoaded(true)
    }
    load()
  }, [])

  async function togglePush(value: boolean) {
    setPushEnabled(value)
    await AsyncStorage.setItem(KEY_PUSH, String(value))
    if (value) {
      await registerPushToken(slug).catch(() => {})
    } else {
      await deregisterPushToken(slug).catch(() => {})
    }
  }

  async function toggleCat(key: string, value: boolean) {
    setCats(prev => ({ ...prev, [key]: value }))
    await AsyncStorage.setItem(KEY_CAT(key), String(value))
  }

  if (!loaded) return <Screen />

  return (
    <Screen>
      {/* Custom header */}
      <View style={[styles.header, { borderBottomColor: theme.borderSub }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={theme.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>Manage what you receive</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Master toggle */}
        <MotiView
          from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320 }}
        >
          <View style={[
            styles.masterCard,
            {
              backgroundColor: pushEnabled ? accent + '0D' : theme.surface,
              borderColor: pushEnabled ? accent + '40' : theme.border,
            },
          ]}>
            <View style={[styles.masterIcon, { backgroundColor: pushEnabled ? accent + '18' : theme.surfaceHigh }]}>
              {pushEnabled
                ? <Bell size={22} color={accent} strokeWidth={1.8} />
                : <BellOff size={22} color={theme.textMuted} strokeWidth={1.8} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.masterLabel, { color: theme.text }]}>
                {pushEnabled ? 'Push notifications on' : 'Push notifications off'}
              </Text>
              <Text style={[styles.masterSub, { color: theme.textMuted }]}>
                {pushEnabled
                  ? 'You\'ll receive updates from your gym'
                  : 'Turn on to receive gym updates and reminders'}
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={togglePush}
              trackColor={{ false: theme.border, true: accent + '60' }}
              thumbColor={pushEnabled ? accent : theme.textMuted}
            />
          </View>
        </MotiView>

        {/* Per-category toggles */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 340, delay: 60 }}
        >
          <SectionCard title="NOTIFICATION TYPES">
            {CATEGORIES.map((cat, i) => (
              <PrefRow
                key={cat.key}
                icon={cat.icon}
                color={cat.color}
                label={cat.label}
                sub={cat.sub}
                value={cats[cat.key]}
                onToggle={v => toggleCat(cat.key, v)}
                disabled={!pushEnabled}
              />
            ))}
          </SectionCard>
        </MotiView>

        {/* OS-level access */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 340, delay: 120 }}
        >
          <SectionCard title="SYSTEM">
            <LinkRow
              icon={ExternalLink}
              color="#6B7280"
              label="System permissions"
              sub="Open phone settings to manage notification access"
              onPress={() => Linking.openSettings()}
            />
          </SectionCard>
        </MotiView>

        {/* Info note */}
        <Text style={[styles.note, { color: theme.textMuted }]}>
          Category preferences control which notifications are shown on this device. Your gym can still send messages — category settings filter what appears here.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: F.extrabold },
  headerSub:   { fontSize: 12, fontFamily: F.regular, marginTop: 1 },

  content: { padding: 16, gap: 12 },

  masterCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 18, borderWidth: 1.5,
  },
  masterIcon:  { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  masterLabel: { fontSize: 15, fontFamily: F.bold },
  masterSub:   { fontSize: 12, fontFamily: F.regular, marginTop: 2, lineHeight: 17 },

  section:      { gap: 6 },
  sectionTitle: { fontSize: 11, fontFamily: F.bold, letterSpacing: 0.9, textTransform: 'uppercase', paddingHorizontal: 4 },
  card:         { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowBody:  { flex: 1 },
  rowLabel: { fontSize: 14, fontFamily: F.semibold },
  rowSub:   { fontSize: 12, fontFamily: F.regular, marginTop: 1 },

  note: { fontSize: 12, fontFamily: F.regular, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8, marginTop: 4 },
})
