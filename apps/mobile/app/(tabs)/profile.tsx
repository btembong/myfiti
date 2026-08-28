import { useState, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Alert } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { MotiView } from 'moti'
import {
  ChevronRight, Palette, Globe, Bell,
  Fingerprint, Smartphone, Link2,
  FileText, Shield, X, Heart, KeyRound,
} from 'lucide-react-native'
import { SvgXml } from 'react-native-svg'
import { PROFILE_HERO_BG_RAW } from '../../src/assets/profileHeroBg'
import { Screen } from '../../src/components/ui/Screen'
import { DiceBearAvatar } from '../../src/components/ui/DiceBearAvatar'
import { LogoutModal } from '../../src/components/ui/LogoutModal'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'

// ─── Appearance bottom sheet ──────────────────────────────────────────────────
const sheet = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  container:  {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 40,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle:   { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  title:  { fontSize: 18, fontFamily: F.bold },
  desc:   { fontSize: 13, fontFamily: F.regular, lineHeight: 20, marginBottom: 24 },
  options:    { flexDirection: 'row', gap: 12 },
  optionWrap: { flex: 1, alignItems: 'center', gap: 10 },
  card:       { width: '100%', borderRadius: 16, borderWidth: 1, overflow: 'hidden', aspectRatio: 0.72 },
  mockup:     { flex: 1, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 12, gap: 4 },
  mockupHalf: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', gap: 5, paddingHorizontal: 6 },
  mockupAa:   { fontSize: 16, fontFamily: F.bold },
  mockupBar:  { height: 6, borderRadius: 3, marginTop: 2 },
  radioRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  radio:      { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  optionLabel:{ fontSize: 12, fontFamily: F.medium },
})
type ThemeOption = { mode: 'system' | 'light' | 'dark'; label: string }
const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light',  label: 'Light Mode' },
  { mode: 'dark',   label: 'Dark Mode' },
]

function PhoneMockup({ colorScheme }: { colorScheme: 'light' | 'dark' | 'system' }) {
  if (colorScheme === 'system') {
    return (
      <View style={sheet.mockup}>
        {/* left half light */}
        <View style={[sheet.mockupHalf, { backgroundColor: '#F2F3F7' }]}>
          <Text style={[sheet.mockupAa, { color: '#0D0D18' }]}>Aa</Text>
          <View style={[sheet.mockupBar, { backgroundColor: '#D1D5DB', width: '80%' }]} />
          <View style={[sheet.mockupBar, { backgroundColor: '#E5E7EB', width: '60%' }]} />
        </View>
        {/* right half dark */}
        <View style={[sheet.mockupHalf, { backgroundColor: '#1C274C' }]}>
          <Text style={[sheet.mockupAa, { color: '#fff' }]}>Aa</Text>
          <View style={[sheet.mockupBar, { backgroundColor: '#374151', width: '80%' }]} />
          <View style={[sheet.mockupBar, { backgroundColor: '#4B5563', width: '60%' }]} />
        </View>
      </View>
    )
  }
  const isDk = colorScheme === 'dark'
  return (
    <View style={[sheet.mockup, { backgroundColor: isDk ? '#1C274C' : '#F2F3F7' }]}>
      <Text style={[sheet.mockupAa, { color: isDk ? '#fff' : '#0D0D18' }]}>Aa</Text>
      <View style={[sheet.mockupBar, { backgroundColor: isDk ? '#374151' : '#D1D5DB', width: '80%' }]} />
      <View style={[sheet.mockupBar, { backgroundColor: isDk ? '#4B5563' : '#E5E7EB', width: '60%' }]} />
    </View>
  )
}

function AppearanceSheet({ visible, onClose, accent }: { visible: boolean; onClose: () => void; accent: string }) {
  const { theme, themeMode, setThemeMode } = useTheme()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={sheet.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[sheet.container, { backgroundColor: theme.surface }]}>
        <View style={[sheet.handle, { backgroundColor: theme.border }]} />

        {/* Header */}
        <View style={sheet.header}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={sheet.closeBtn}>
            <X size={18} color={theme.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[sheet.title, { color: theme.text }]}>Appearance</Text>
        </View>

        <Text style={[sheet.desc, { color: theme.textMuted }]}>
          Customize how the app looks on this device. Choose a specific theme or let it adapt automatically.
        </Text>

        {/* Options */}
        <View style={sheet.options}>
          {THEME_OPTIONS.map(opt => {
            const active = themeMode === opt.mode
            return (
              <TouchableOpacity
                key={opt.mode}
                style={sheet.optionWrap}
                onPress={() => { setThemeMode(opt.mode); onClose() }}
                activeOpacity={0.8}
              >
                <View style={[
                  sheet.card,
                  { borderColor: active ? accent : theme.border },
                  active && { borderWidth: 2 },
                ]}>
                  <PhoneMockup colorScheme={opt.mode} />
                </View>
                <View style={sheet.radioRow}>
                  <View style={[
                    sheet.radio,
                    { borderColor: active ? accent : theme.border },
                    active && { backgroundColor: accent },
                  ]}>
                    {active && <View style={sheet.radioDot} />}
                  </View>
                  <Text style={[sheet.optionLabel, { color: theme.text }]}>{opt.label}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </Modal>
  )
}

// ─── Row card ─────────────────────────────────────────────────────────────────

function RowCard({
  icon: Icon, iconColor, label, right, onPress, danger = false,
}: {
  icon: any; iconColor: string; label: string
  right?: React.ReactNode; onPress?: () => void; danger?: boolean
}) {
  const { theme } = useTheme()
  return (
    <TouchableOpacity
      style={[styles.rowCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconColor + '18' }]}>
        <Icon size={18} color={iconColor} strokeWidth={1.8} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? '#EF4444' : theme.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {right ?? (onPress
          ? <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
          : null
        )}
      </View>
    </TouchableOpacity>
  )
}


function SectionLabel({ label }: { label: string }) {
  const { theme } = useTheme()
  return <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{label}</Text>
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { branding } = useTenant()
  const { accessToken, signOut, biometricEnabled, disableBiometrics } = useAuth()
  const { theme, isDark, themeMode } = useTheme()
  const router = useRouter()
  const qc = useQueryClient()
  const accent = branding?.primary_color ?? '#22C55E'
  const slug   = branding?.slug ?? ''

  const [logoutVisible, setLogoutVisible]         = useState(false)
  const [appearanceVisible, setAppearanceVisible] = useState(false)

  function handleBiometricToggle() {
    if (biometricEnabled) {
      Alert.alert(
        'Disable Biometrics',
        'You will need to use OTP to log in next time.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disable', style: 'destructive', onPress: () => disableBiometrics() },
        ],
      )
    } else {
      router.push('/biometrics')
    }
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn:  () => memberApi.getProfile(slug),
    enabled:  !!slug && !!accessToken,
  })

  const { data: notifData } = useQuery({
    queryKey: ['member-notifications', slug],
    queryFn:  () => memberApi.getNotifications(slug),
    enabled:  !!slug && !!accessToken,
  })

  const profile  = data?.member
  const sub      = data?.subscription
  const unread   = notifData?.unreadCount ?? 0
  const avatarSeed = String(profile?.name ?? profile?.id ?? 'member')
  const daysLeft = sub
    ? Math.max(0, Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86_400_000))
    : 0

  function doSignOut() { qc.clear(); signOut() }

  // ── Loading / error state ──────────────────────────────────────────────────
  if (isLoading || !profile) {
    return (
      <Screen>
        {isError || (!isLoading && !profile) ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
            <Text style={{ color: theme.textMuted, fontFamily: F.medium, fontSize: 14, textAlign: 'center' }}>
              {!slug || !accessToken ? 'Session expired. Please sign in again.' : 'Could not load profile.'}
            </Text>
            {slug && accessToken && (
              <TouchableOpacity
                onPress={() => refetch()}
                style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: accent, borderRadius: 99 }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 14 }}>Retry</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setLogoutVisible(true)} activeOpacity={0.7}>
              <Text style={{ color: '#EF4444', fontFamily: F.medium, fontSize: 14 }}>Sign out</Text>
            </TouchableOpacity>
            <LogoutModal
              visible={logoutVisible}
              onCancel={() => setLogoutVisible(false)}
              onConfirm={doSignOut}
            />
          </View>
        ) : (
          [140, 80, 80, 80].map((h, i) => (
            <MotiView key={i}
              from={{ opacity: 0.4 }} animate={{ opacity: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900, delay: i * 80 }}
              style={{ height: h, borderRadius: 18, backgroundColor: theme.skeleton, margin: 16, marginBottom: i === 0 ? 16 : 8 }}
            />
          ))
        )}
      </Screen>
    )
  }

  // ── Accent dark shade for banner ───────────────────────────────────────────
  const accentDark = accent + 'DD'

  // ── Decorative hero SVG — replace placeholder with semi-transparent white ──
  const heroBgSvg = useMemo(
    () => PROFILE_HERO_BG_RAW.replace('FILL_COLOR', 'rgba(255,255,255,0.14)'),
    [],
  )

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} bounces contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[accent, accentDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative background texture */}
          <SvgXml
            xml={heroBgSvg}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.heroInner}>
            <View style={[styles.avatarRing, { borderColor: 'rgba(255,255,255,0.4)' }]}>
              <DiceBearAvatar seed={avatarSeed} size={56} photoUrl={profile.avatar_url} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroName}>{profile.name}</Text>
              <Text style={styles.heroPhone}>{profile.phone ?? profile.email}</Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.82}
            >
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

        </LinearGradient>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <View style={[styles.body, { backgroundColor: theme.bg }]}>

          {/* Upgrade / plan banner */}
          <TouchableOpacity
            onPress={() => router.push('/plans')}
            activeOpacity={0.85}
            style={[styles.upgradeBannerWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.upgradeBannerAccent, { backgroundColor: accent }]} />
            <View style={styles.upgradeBannerBody}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.upgradeBannerLabel, { color: accent }]}>MEMBERSHIP</Text>
                <Text style={[styles.upgradeBannerPlan, { color: theme.text }]}>
                  {sub ? `${sub.plan_name} Plan` : 'No Active Plan'}
                </Text>
                <Text style={[styles.upgradeBannerExp, { color: theme.textSub }]}>
                  {sub
                    ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
                    : 'Contact your gym to get started.'
                  }
                </Text>
              </View>
              <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
            </View>
          </TouchableOpacity>

          {/* Personal Info */}
          <SectionLabel label="Personal Info" />
          <RowCard
            icon={Heart} iconColor="#F43F5E" label="Emergency Contact"
            right={
              profile?.emergency_contact
                ? <Text style={[styles.rowValue, { color: theme.textMuted }]}>{profile.emergency_contact.name}</Text>
                : <Text style={[styles.rowValue, { color: theme.textMuted }]}>Not set</Text>
            }
            onPress={() => router.push('/emergency-contact')}
          />

          {/* Preferences */}
          <SectionLabel label="Preferences" />
          <RowCard
            icon={Palette} iconColor="#8B5CF6" label="Appearance"
            right={<Text style={[styles.rowValue, { color: theme.textMuted }]}>{themeMode === 'system' ? 'System' : isDark ? 'Dark Mode' : 'Light Mode'}</Text>}
            onPress={() => setAppearanceVisible(true)}
          />
          <RowCard
            icon={Globe} iconColor="#3B82F6" label="Language"
            right={<Text style={[styles.rowValue, { color: theme.textMuted }]}>English</Text>}
            onPress={() => {}}
          />
          <RowCard
            icon={Bell} iconColor="#F97316" label="Notifications"
            right={unread > 0
              ? <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View>
              : undefined
            }
            onPress={() => router.push('/(tabs)/notifications')}
          />

          {/* Security */}
          <SectionLabel label="Security" />
          <RowCard
            icon={Fingerprint} iconColor="#10B981" label="Biometric Login"
            onPress={handleBiometricToggle}
            right={
              <Switch
                value={biometricEnabled}
                onValueChange={() => handleBiometricToggle()}
                trackColor={{ false: theme.border, true: accent }}
                thumbColor="#fff"
                ios_backgroundColor={theme.border}
              />
            }
          />
          <RowCard
            icon={KeyRound} iconColor="#F59E0B" label="Setup PIN"
            right={
              <Text style={[styles.rowValue, { color: theme.textMuted }]}>
                {profile?.has_pin ? 'Enabled' : 'Not set'}
              </Text>
            }
            onPress={() => router.push('/setup-pin')}
          />
          <RowCard
            icon={Smartphone} iconColor="#EF4444" label="Manage Devices"
            right={<Text style={[styles.rowValue, { color: theme.textMuted }]}>1 Active</Text>}
            onPress={() => router.push('/manage-devices')}
          />
          <RowCard
            icon={Link2} iconColor="#6366F1" label="Linked Apps"
            onPress={() => {}}
          />

          {/* Legal */}
          <SectionLabel label="Legal Information" />
          <RowCard
            icon={FileText} iconColor="#10B981" label="Terms & Conditions"
            onPress={() => {}}
          />
          <RowCard
            icon={Shield} iconColor="#F59E0B" label="Privacy Policy"
            onPress={() => {}}
          />

          {/* Actions */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setLogoutVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteLink}
            onPress={() => router.push('/delete-account')}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteLinkText}>Delete Account</Text>
          </TouchableOpacity>

          <Text style={[styles.version, { color: theme.textMuted }]}>
            myfiti · {data?.gym?.name ?? branding?.name} · v1.0.0
          </Text>
          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      <LogoutModal
        visible={logoutVisible}
        onCancel={() => setLogoutVisible(false)}
        onConfirm={doSignOut}
      />

      <AppearanceSheet
        visible={appearanceVisible}
        onClose={() => setAppearanceVisible(false)}
        accent={accent}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  /* Hero */
  hero: { paddingTop: 56, paddingBottom: 48, paddingHorizontal: 20 },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: { borderWidth: 2.5, borderRadius: 36, padding: 2 },
  heroText:  { flex: 1 },
  heroName:  { fontSize: 16, fontFamily: F.semibold, color: '#fff' },
  heroPhone: { fontSize: 13, fontFamily: F.regular, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  editBtn: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8,
  },
  editBtnText: { fontSize: 13, fontFamily: F.semibold, color: '#fff' },

  /* Upgrade banner */
  upgradeBannerWrap: {
    marginTop: -48, marginHorizontal: 16,
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  upgradeBannerAccent: { width: 5 },
  upgradeBannerBody: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  upgradeBannerLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 1, textTransform: 'uppercase' },
  upgradeBannerPlan:  { fontSize: 17, fontFamily: F.extrabold },
  upgradeBannerExp:   { fontSize: 13, fontFamily: F.regular },

  /* Body */
  body: { paddingTop: 36, paddingHorizontal: 16, gap: 8 },

  sectionLabel: {
    fontSize: 12, fontFamily: F.bold, letterSpacing: 0.7,
    textTransform: 'uppercase', marginTop: 12, marginBottom: 4, marginLeft: 4,
  },

  /* Row card */
  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowIcon:  { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: F.medium },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, fontFamily: F.regular },

  badge:     { backgroundColor: '#EF4444', minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: F.extrabold },

  /* Actions */
  logoutBtn: {
    marginTop: 16, height: 56, borderRadius: 99,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  logoutBtnText: { fontSize: 16, fontFamily: F.bold, color: '#fff' },

  deleteLink: { alignItems: 'center', paddingVertical: 14 },
  deleteLinkText: { fontSize: 14, fontFamily: F.semibold, color: '#EF4444' },

  version: { fontSize: 12, fontFamily: F.regular, textAlign: 'center', marginTop: 4 },
})

