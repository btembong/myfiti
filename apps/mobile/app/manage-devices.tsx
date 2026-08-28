import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ArrowLeft, Smartphone, Monitor, Tablet, MapPin, Clock,
  ShieldAlert, ShieldCheck, LogOut, ChevronRight, AlertTriangle, X,
} from 'lucide-react-native'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

// ── Types ─────────────────────────────────────────────────────────────────────
type DeviceType = 'mobile' | 'tablet' | 'desktop'

interface Session {
  id: string
  device_name: string
  device_type: DeviceType
  location: string
  last_active_at: string
  is_current: boolean
  biometric_secured?: boolean
}

interface Alert {
  id: string
  message: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2)  return 'Active now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(diff / 3_600_000)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function DeviceIcon({ type, accent, current }: { type: DeviceType; accent: string; current?: boolean }) {
  const Icon = type === 'desktop' ? Monitor : type === 'tablet' ? Tablet : Smartphone
  const bg   = current ? accent + '18' : '#E8E8F0'
  const color = current ? accent : '#8A94A6'
  return (
    <View style={[s.iconWrap, { backgroundColor: bg }]}>
      <Icon size={22} color={color} strokeWidth={1.6} />
    </View>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  const { theme } = useTheme()
  return (
    <View style={s.emptyWrap}>
      {/* Layered device illustration */}
      <View style={s.emptyIllustration}>
        <View style={[s.emptyIconBg, { left: 0, top: 16 }]}>
          <Tablet size={38} color="#C7D2E0" strokeWidth={1.4} />
        </View>
        <View style={[s.emptyIconBg, { left: 22, top: 0, zIndex: 1 }]}>
          <Monitor size={52} color="#B8C4D4" strokeWidth={1.4} />
        </View>
        <View style={[s.emptyIconBg, { right: 0, top: 20, zIndex: 2 }]}>
          <Smartphone size={34} color="#C7D2E0" strokeWidth={1.4} />
        </View>
      </View>
      <Text style={[s.emptyTitle, { color: theme.text }]}>No other active devices</Text>
      <Text style={[s.emptySub,   { color: theme.textSub }]}>
        Your account is only active on this device
      </Text>
    </View>
  )
}

// ── Single device logout modal ─────────────────────────────────────────────────
function LogoutDeviceModal({
  session,
  accent,
  onConfirm,
  onClose,
  loading,
}: {
  session: Session
  accent: string
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}) {
  const { theme } = useTheme()
  return (
    <View style={[s.sheet, { backgroundColor: theme.surface }]}>
      <TouchableOpacity onPress={onClose} style={s.sheetClose}>
        <X size={20} color={theme.text} strokeWidth={2} />
      </TouchableOpacity>

      <Text style={[s.sheetTitle, { color: theme.text }]}>Log out this device?</Text>
      <Text style={[s.sheetSub,   { color: theme.textSub }]}>
        This device will no longer have access to your account and files.
      </Text>

      {/* Device preview */}
      <View style={[s.previewCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <DeviceIcon type={session.device_type} accent={accent} />
        <View style={{ flex: 1 }}>
          <Text style={[s.deviceName, { color: theme.text }]}>{session.device_name}</Text>
          <View style={s.metaRow}>
            <MapPin size={12} color={theme.textMuted} strokeWidth={1.8} />
            <Text style={[s.metaText, { color: theme.textMuted }]}>{session.location}</Text>
          </View>
        </View>
        <View style={s.metaRow}>
          <Clock size={12} color={theme.textMuted} strokeWidth={1.8} />
          <Text style={[s.metaText, { color: theme.textMuted }]}>{fmtRelative(session.last_active_at)}</Text>
        </View>
      </View>

      <View style={s.sheetBtns}>
        <TouchableOpacity
          style={[s.sheetBtnOutline, { borderColor: '#EF4444', flex: 1 }]}
          onPress={onClose} activeOpacity={0.75}
        >
          <Text style={[s.sheetBtnText, { color: '#EF4444' }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.sheetBtnFilled, { backgroundColor: '#EF4444', flex: 1 }]}
          onPress={onConfirm} activeOpacity={0.82} disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <>
                <Text style={[s.sheetBtnText, { color: '#FFF' }]}>Logout</Text>
                <LogOut size={16} color="#FFF" strokeWidth={2} />
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Logout all modal ───────────────────────────────────────────────────────────
function LogoutAllModal({
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}) {
  const { theme } = useTheme()
  return (
    <View style={[s.sheet, { backgroundColor: theme.surface }]}>
      <TouchableOpacity onPress={onClose} style={s.sheetClose}>
        <X size={20} color={theme.text} strokeWidth={2} />
      </TouchableOpacity>

      <Text style={[s.sheetTitle, { color: theme.text }]}>Log out from all devices?</Text>
      <Text style={[s.sheetSub,   { color: theme.textSub }]}>
        You'll be logged out from every device except this one. This includes tablets and computers.
      </Text>

      {/* Warning box */}
      <View style={s.warningBox}>
        <AlertTriangle size={15} color="#D97706" strokeWidth={2} />
        <Text style={s.warningText}>
          CRITICAL: This will terminate all active sessions immediately.
        </Text>
      </View>

      <View style={s.sheetBtns}>
        <TouchableOpacity
          style={[s.sheetBtnOutline, { borderColor: '#EF4444', flex: 1 }]}
          onPress={onClose} activeOpacity={0.75}
        >
          <Text style={[s.sheetBtnText, { color: '#EF4444' }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.sheetBtnFilled, { backgroundColor: '#EF4444', flex: 1 }]}
          onPress={onConfirm} activeOpacity={0.82} disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <>
                <Text style={[s.sheetBtnText, { color: '#FFF' }]}>Logout All</Text>
                <LogOut size={16} color="#FFF" strokeWidth={2} />
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ManageDevicesScreen() {
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const qc       = useQueryClient()
  const { theme }    = useTheme()
  const { branding } = useTenant()
  const { accessToken, biometricEnabled } = useAuth()
  const accent = branding?.primary_color ?? '#14B946'
  const slug   = branding?.slug ?? ''

  const [logoutTarget, setLogoutTarget] = useState<Session | null>(null)
  const [showLogoutAll, setShowLogoutAll] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['device-sessions', slug],
    queryFn:  () => memberApi.getDeviceSessions(slug),
    enabled:  !!slug && !!accessToken,
    retry: false,
  })

  const sessions: Session[] = data?.sessions ?? []
  const alerts: Alert[]     = data?.alerts   ?? []
  const currentDevice = sessions.find(s => s.is_current)
  const otherDevices  = sessions.filter(s => !s.is_current)

  const { mutate: revokeOne, isPending: revokingOne } = useMutation({
    mutationFn: (id: string) => memberApi.revokeSession(slug, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['device-sessions', slug] }); setLogoutTarget(null) },
  })

  const { mutate: revokeAll, isPending: revokingAll } = useMutation({
    mutationFn: () => memberApi.revokeAllSessions(slug),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['device-sessions', slug] }); setShowLogoutAll(false) },
  })

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Manage Devices</Text>
      </View>

      {isLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={accent} />
        </View>
      ) : otherDevices.length === 0 && !currentDevice ? (
        <EmptyState />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        >
          {/* Security alerts */}
          {alerts.map(alert => (
            <TouchableOpacity key={alert.id} style={[s.alertCard, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]} activeOpacity={0.8}>
              <View style={s.alertIcon}>
                <ShieldAlert size={20} color="#EF4444" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.alertTitle}>Security Alert</Text>
                <Text style={s.alertMsg}>{alert.message}</Text>
              </View>
              <ChevronRight size={16} color="#EF4444" strokeWidth={2} />
            </TouchableOpacity>
          ))}

          {/* This device */}
          {currentDevice && (
            <>
              <Text style={[s.sectionLabel, { color: theme.text }]}>This Device</Text>
              <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={s.deviceRow}>
                  <DeviceIcon type={currentDevice.device_type} accent={accent} current />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={s.nameRow}>
                      <Text style={[s.deviceName, { color: theme.text }]}>{currentDevice.device_name}</Text>
                      <View style={[s.currentBadge, { backgroundColor: accent + '18' }]}>
                        <Text style={[s.currentBadgeText, { color: accent }]}>Current</Text>
                      </View>
                    </View>
                    <View style={s.metaRow}>
                      <MapPin size={12} color={theme.textMuted} strokeWidth={1.8} />
                      <Text style={[s.metaText, { color: theme.textMuted }]}>{currentDevice.location}</Text>
                    </View>
                  </View>
                  <View style={s.metaRow}>
                    <Clock size={12} color={theme.textMuted} strokeWidth={1.8} />
                    <Text style={[s.metaText, { color: theme.textMuted }]}>Active now</Text>
                  </View>
                </View>

                {/* Biometric badge */}
                {(currentDevice.biometric_secured || biometricEnabled) && (
                  <>
                    <View style={[s.divider, { backgroundColor: theme.border }]} />
                    <View style={s.biometricRow}>
                      <ShieldCheck size={16} color="#22C55E" strokeWidth={2} />
                      <Text style={s.biometricText}>Device is secured with biometric lock</Text>
                    </View>
                  </>
                )}
              </View>
            </>
          )}

          {/* Other devices */}
          {otherDevices.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: theme.text }]}>Other Devices</Text>
              {otherDevices.map(session => (
                <View key={session.id} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={s.deviceRow}>
                    <DeviceIcon type={session.device_type} accent={accent} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[s.deviceName, { color: theme.text }]}>{session.device_name}</Text>
                      <View style={s.metaRow}>
                        <MapPin size={12} color={theme.textMuted} strokeWidth={1.8} />
                        <Text style={[s.metaText, { color: theme.textMuted }]}>{session.location}</Text>
                      </View>
                    </View>
                    <View style={s.metaRow}>
                      <Clock size={12} color={theme.textMuted} strokeWidth={1.8} />
                      <Text style={[s.metaText, { color: theme.textMuted }]}>{fmtRelative(session.last_active_at)}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.revokeBtn}
                      onPress={() => setLogoutTarget(session)}
                      activeOpacity={0.7}
                    >
                      <View style={s.revokeBadge}>
                        <LogOut size={15} color="#EF4444" strokeWidth={2.2} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Log out all */}
              <TouchableOpacity
                style={[s.logoutAllBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => setShowLogoutAll(true)}
                activeOpacity={0.82}
              >
                <Text style={s.logoutAllText}>Log out from all other devices</Text>
                <View style={s.logoutAllBadge}>
                  <LogOut size={16} color="#EF4444" strokeWidth={2.2} />
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Empty: only current device, no others */}
          {otherDevices.length === 0 && currentDevice && (
            <View style={[s.emptyWrap, { marginTop: 32 }]}>
              <View style={s.emptyIllustration}>
                <View style={[s.emptyIconBg, { left: 0, top: 16 }]}>
                  <Tablet size={38} color="#C7D2E0" strokeWidth={1.4} />
                </View>
                <View style={[s.emptyIconBg, { left: 22, top: 0, zIndex: 1 }]}>
                  <Monitor size={52} color="#B8C4D4" strokeWidth={1.4} />
                </View>
                <View style={[s.emptyIconBg, { right: 0, top: 20, zIndex: 2 }]}>
                  <Smartphone size={34} color="#C7D2E0" strokeWidth={1.4} />
                </View>
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>No other active devices</Text>
              <Text style={[s.emptySub, { color: theme.textSub }]}>Your account is only active on this device</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Single device logout modal */}
      <Modal visible={!!logoutTarget} transparent animationType="slide" onRequestClose={() => setLogoutTarget(null)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setLogoutTarget(null)} />
        {logoutTarget && (
          <LogoutDeviceModal
            session={logoutTarget}
            accent={accent}
            onConfirm={() => revokeOne(logoutTarget.id)}
            onClose={() => setLogoutTarget(null)}
            loading={revokingOne}
          />
        )}
      </Modal>

      {/* Log out all modal */}
      <Modal visible={showLogoutAll} transparent animationType="slide" onRequestClose={() => setShowLogoutAll(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowLogoutAll(false)} />
        <LogoutAllModal
          onConfirm={() => revokeAll()}
          onClose={() => setShowLogoutAll(false)}
          loading={revokingAll}
        />
      </Modal>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 16,
    paddingBottom:  14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: F.bold },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16, gap: 12 },

  // Alert card
  alertCard: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    padding:        14,
    borderRadius:   16,
    borderWidth:    1,
    backgroundColor: '#FFF5F5',
    borderColor:    '#FECDD3',
  },
  alertIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  alertTitle: { fontSize: 15, fontFamily: F.bold, color: '#1A1A2E' },
  alertMsg:   { fontSize: 13, fontFamily: F.regular, color: '#6B7280' },

  // Section
  sectionLabel: { fontSize: 15, fontFamily: F.bold, marginTop: 4 },

  // Device card
  card: {
    borderRadius: 16,
    borderWidth:  1,
    overflow:     'hidden',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    padding:       14,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  deviceName: { fontSize: 15, fontFamily: F.semibold },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  currentBadgeText: { fontSize: 11, fontFamily: F.semibold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontFamily: F.regular },

  divider: { height: 1, marginHorizontal: 14 },
  biometricRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, paddingHorizontal: 14,
  },
  biometricText: { fontSize: 13, fontFamily: F.medium, color: '#22C55E' },

  revokeBtn: { padding: 4 },
  revokeBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center',
  },

  // Log out all button
  logoutAllBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    height:         56,
    borderRadius:   100,
    marginTop:      8,
    paddingHorizontal: 20,
  },
  logoutAllText: { fontSize: 16, fontFamily: F.semibold, color: '#FFF', flex: 1, textAlign: 'center' },
  logoutAllBadge: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty state
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingHorizontal: 40,
  },
  emptyIllustration: {
    width: 120, height: 80, position: 'relative',
    marginBottom: 8,
  },
  emptyIconBg: { position: 'absolute' },
  emptyTitle:  { fontSize: 18, fontFamily: F.bold, textAlign: 'center' },
  emptySub:    { fontSize: 14, fontFamily: F.regular, textAlign: 'center', lineHeight: 21 },

  // Bottom sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position:     'absolute',
    bottom:       0, left: 0, right: 0,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    padding:      24,
    paddingBottom: 40,
    gap:          16,
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation:    20,
  },
  sheetClose: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  sheetTitle: { fontSize: 20, fontFamily: F.bold },
  sheetSub:   { fontSize: 14, fontFamily: F.regular, lineHeight: 21, marginTop: -4 },

  // Device preview in modal
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },

  // Warning box
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
  },
  warningText: {
    flex: 1, fontSize: 12, fontFamily: F.medium,
    color: '#92400E', lineHeight: 18,
  },

  // Sheet buttons
  sheetBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  sheetBtnOutline: {
    height: 54, borderRadius: 100, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
  },
  sheetBtnFilled: {
    height: 54, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
  },
  sheetBtnText: { fontSize: 16, fontFamily: F.semibold },
})
