import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ChevronLeft, AlertTriangle,
  UserX, Package, Heart, Unlink,
} from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../src/context/AuthContext'
import { useTenant } from '../src/context/TenantContext'
import { useTheme } from '../src/context/ThemeContext'
import { memberApi } from '../src/lib/api'
import { F } from '../src/theme'

// ─── Data ─────────────────────────────────────────────────────────────────────

const CONSEQUENCES = [
  { Icon: UserX,   text: 'Your account will be permanently deleted' },
  { Icon: Package, text: 'Your active membership will be cancelled' },
  { Icon: Heart,   text: 'All check-in history will be erased' },
  { Icon: Unlink,  text: 'Linked notifications and auto-renewals disconnected' },
]

const REASONS = [
  'Security Concern',
  'Too many notifications',
  'Difficult to use',
  'No longer needed',
  'Others',
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DeleteAccountScreen() {
  const router   = useRouter()
  const { theme } = useTheme()
  const { signOut } = useAuth()
  const { branding, clearTenant } = useTenant()
  const qc = useQueryClient()

  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const slug = branding?.slug ?? ''

  async function handleDelete() {
    if (!selectedReason) {
      Alert.alert('Select a reason', 'Please select a reason before proceeding.')
      return
    }

    const confirm = () => {
      setLoading(true)
      memberApi.deleteAccount(slug, selectedReason)
        .catch(() => {/* best-effort */})
        .finally(async () => {
          qc.clear()
          clearTenant()
          await signOut()
          setLoading(false)
        })
    }

    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-restricted-globals
      if (window.confirm('Are you sure? This cannot be undone.')) confirm()
      return
    }

    Alert.alert(
      'Delete account',
      'This cannot be undone. All your data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, delete', style: 'destructive', onPress: confirm },
      ],
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color={theme.text} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Delete Account</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Warning banner */}
          <View style={[styles.warnBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <View style={styles.warnIconWrap}>
              <AlertTriangle size={22} color="#EF4444" strokeWidth={2} />
            </View>
            <View style={styles.warnText}>
              <Text style={styles.warnTitle}>You're about to permanently delete your account</Text>
              <Text style={styles.warnSub}>
                This action cannot be undone. Your membership, check-in history, and all data will be permanently removed.
              </Text>
            </View>
          </View>

          {/* Active membership banner */}
          <LinearGradient
            colors={['#22C55E', '#16A34A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.memberBanner}
          >
            <View style={styles.memberBannerInner}>
              <Text style={styles.memberBannerLabel}>Your active membership</Text>
              <Text style={styles.memberBannerValue}>{branding?.name ?? 'Gym Membership'}</Text>
            </View>
            <View style={styles.forfeitedBadge}>
              <Text style={styles.forfeitedText}>Forfeited</Text>
            </View>
          </LinearGradient>

          {/* Consequences */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            What will happen after deletion:
          </Text>
          <View style={[styles.consequenceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {CONSEQUENCES.map(({ Icon, text }, i) => (
              <View
                key={i}
                style={[
                  styles.consequenceRow,
                  { borderBottomColor: theme.borderSub },
                  i === CONSEQUENCES.length - 1 && styles.lastRow,
                ]}
              >
                <Icon size={18} color={theme.textMuted} strokeWidth={1.6} />
                <Text style={[styles.consequenceText, { color: theme.text }]}>{text}</Text>
              </View>
            ))}
          </View>

          {/* Reason chips */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Before you go, what's the main reason?
          </Text>
          <View style={styles.chipWrap}>
            {REASONS.map(r => {
              const active = selectedReason === r
              return (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.chip,
                    { borderColor: active ? '#22C55E' : theme.border },
                    active && styles.chipActive,
                  ]}
                  onPress={() => setSelectedReason(r)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.chipText,
                    { color: active ? '#16A34A' : theme.textSub },
                    active && styles.chipTextActive,
                  ]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.deleteBtn, loading && { opacity: 0.6 }]}
              onPress={handleDelete}
              activeOpacity={0.82}
              disabled={loading}
            >
              <Text style={styles.deleteBtnText}>
                {loading ? 'Deleting…' : 'Delete My Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keepBtn, { borderColor: '#EF4444' }]}
              onPress={() => router.back()}
              activeOpacity={0.82}
            >
              <Text style={styles.keepBtnText}>Keep My Account</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { width: 36, alignItems: 'flex-start' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: F.bold },

  scroll: { padding: 20, gap: 20 },

  /* Warning */
  warnBanner: {
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
    borderWidth: 1, borderRadius: 18, padding: 16,
  },
  warnIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  warnText:  { flex: 1, gap: 6 },
  warnTitle: { fontSize: 15, fontFamily: F.bold, color: '#111827', lineHeight: 21 },
  warnSub:   { fontSize: 13, fontFamily: F.regular, color: '#6B7280', lineHeight: 19 },

  /* Member banner */
  memberBanner: {
    borderRadius: 18, padding: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  memberBannerInner: { flex: 1, gap: 4 },
  memberBannerLabel: { fontSize: 12, fontFamily: F.regular, color: 'rgba(255,255,255,0.8)' },
  memberBannerValue: { fontSize: 22, fontFamily: F.extrabold, color: '#fff' },
  forfeitedBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8,
  },
  forfeitedText: { fontSize: 14, fontFamily: F.bold, color: '#fff' },

  /* Consequences */
  sectionTitle: { fontSize: 16, fontFamily: F.bold },
  consequenceCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  consequenceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow:         { borderBottomWidth: 0 },
  consequenceText: { flex: 1, fontSize: 14, fontFamily: F.regular, lineHeight: 20 },

  /* Reason chips */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderWidth: 1.5, borderRadius: 99,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  chipActive:     { backgroundColor: '#F0FDF4' },
  chipText:       { fontSize: 14, fontFamily: F.medium },
  chipTextActive: { fontFamily: F.semibold },

  /* Buttons */
  actions: { gap: 12, marginTop: 4 },
  deleteBtn: {
    backgroundColor: '#EF4444', borderRadius: 99,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 16, fontFamily: F.bold, color: '#fff' },
  keepBtn: {
    borderWidth: 1.5, borderRadius: 99,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  keepBtnText: { fontSize: 16, fontFamily: F.semibold, color: '#EF4444' },
})
