import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../src/components/ui/Screen'
import { AppHeader } from '../src/components/ui/AppHeader'
import { useTheme } from '../src/context/ThemeContext'
import { useAuth } from '../src/context/AuthContext'
import { useTenant } from '../src/context/TenantContext'
import { ChevronRight, Moon, Sun, Monitor, Globe, Bell, Trash2, Fingerprint } from 'lucide-react-native'
import { F } from '../src/theme'
import type { ThemeMode } from '../src/context/ThemeContext'

function SettingsRow({
  icon: Icon, label, sub, onPress, color, danger = false, right,
}: {
  icon: any; label: string; sub?: string; onPress?: () => void
  color?: string; danger?: boolean; right?: React.ReactNode
}) {
  const { theme } = useTheme()
  const iconColor = danger ? '#EF4444' : (color ?? theme.textSub)
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.borderSub }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconColor + '14' }]}>
        <Icon size={17} color={iconColor} strokeWidth={1.8} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: danger ? '#EF4444' : theme.text }]}>{label}</Text>
        {sub && <Text style={[styles.rowSub, { color: theme.textMuted }]}>{sub}</Text>}
      </View>
      <View style={styles.rowRight}>
        {right ?? (onPress && <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />)}
      </View>
    </TouchableOpacity>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme()
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  )
}

const THEME_OPTIONS: { label: string; mode: ThemeMode; Icon: any }[] = [
  { label: 'Dark',   mode: 'dark',   Icon: Moon },
  { label: 'Light',  mode: 'light',  Icon: Sun },
  { label: 'System', mode: 'system', Icon: Monitor },
]

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme()
  const { biometricEnabled, disableBiometrics } = useAuth()
  const { branding } = useTenant()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const router = useRouter()

  async function handleBiometricToggle(value: boolean) {
    if (value) {
      router.push('/biometrics')
    } else {
      Alert.alert(
        'Disable Biometrics',
        'You will need to use OTP to log in next time.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disable', style: 'destructive', onPress: () => disableBiometrics() },
        ],
      )
    }
  }

  return (
    <Screen>
      <AppHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Theme */}
        <Section title="APPEARANCE">
          <View style={[styles.themeRow, { borderBottomColor: theme.borderSub }]}>
            <Text style={[styles.themeLabel, { color: theme.text }]}>Theme</Text>
            <View style={styles.themePicker}>
              {THEME_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: themeMode === opt.mode
                        ? (opt.mode === 'light' ? accent + '18' : accent)
                        : 'transparent',
                      borderColor: themeMode === opt.mode ? accent : theme.border,
                    },
                  ]}
                  onPress={() => setThemeMode(opt.mode)}
                  activeOpacity={0.75}
                >
                  <opt.Icon
                    size={14}
                    color={themeMode === opt.mode
                      ? opt.mode === 'light' ? accent : '#fff'
                      : theme.textMuted}
                    strokeWidth={1.8}
                  />
                  <Text style={[
                    styles.themeOptionText,
                    { color: themeMode === opt.mode
                      ? opt.mode === 'light' ? accent : '#fff'
                      : theme.textMuted },
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Section>

        {/* Preferences */}
        <Section title="PREFERENCES">
          <SettingsRow
            icon={Globe}
            label="Language"
            sub="English"
            onPress={() => Alert.alert('Language', 'Language settings coming soon.')}
          />
          <SettingsRow
            icon={Bell}
            label="Notifications"
            sub="Push notifications enabled"
            onPress={() => Alert.alert('Notifications', 'Manage notification preferences in your device settings.')}
          />
        </Section>

        {/* Security */}
        <Section title="SECURITY">
          <SettingsRow
            icon={Fingerprint}
            label="Biometric Login"
            sub={biometricEnabled ? 'Face ID / Fingerprint enabled' : 'Log in with Face ID or fingerprint'}
            onPress={() => handleBiometricToggle(!biometricEnabled)}
            right={
              <View style={[
                styles.bioChip,
                { backgroundColor: biometricEnabled ? accent + '18' : theme.surfaceHigh, borderColor: biometricEnabled ? accent : theme.border },
              ]}>
                <Text style={[styles.bioChipText, { color: biometricEnabled ? accent : theme.textMuted }]}>
                  {biometricEnabled ? 'On' : 'Off'}
                </Text>
              </View>
            }
          />
        </Section>

        {/* Danger zone */}
        <Section title="DANGER ZONE">
          <SettingsRow
            icon={Trash2}
            label="Delete account"
            sub="Permanently remove all your data"
            onPress={() => router.push('/delete-account')}
            danger
          />
        </Section>

        <Text style={[styles.version, { color: theme.textMuted }]}>myfiti Member App · v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 4 },
  section: { gap: 8, marginBottom: 16 },
  sectionTitle: {
    fontSize: 11, fontFamily: F.bold, letterSpacing: 0.9,
    textTransform: 'uppercase', marginLeft: 4, marginBottom: 4,
  },
  sectionCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  rowIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody:  { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontFamily: F.medium },
  rowSub:   { fontSize: 12, fontFamily: F.regular },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  themeRow: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  themeLabel: { fontSize: 15, fontFamily: F.medium, marginBottom: 8 },
  themePicker: { flexDirection: 'row', gap: 8 },
  themeOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  themeOptionText: { fontSize: 13, fontFamily: F.semibold },

  version: { fontSize: 12, fontFamily: F.regular, textAlign: 'center', marginTop: 8 },

  bioChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  bioChipText: { fontSize: 12, fontFamily: F.semibold },
})
