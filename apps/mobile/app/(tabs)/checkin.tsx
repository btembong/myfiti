import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Share, Image, ScrollView, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import { X, HelpCircle, Download, ScanLine, QrCode, History, CheckCircle2 } from 'lucide-react-native'
import Svg, { Rect } from 'react-native-svg'
import { MotiView } from 'moti'
import { StyledQRCode } from '../../src/components/ui/StyledQRCode'
import { DiceBearAvatar } from '../../src/components/ui/DiceBearAvatar'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { F } from '../../src/theme'
import { useRouter } from 'expo-router'

const { width } = Dimensions.get('window')
const CARD_W  = width - 66
const QR_SIZE = Math.min(CARD_W - 64, 220)
const BAR_W   = CARD_W - 48
const BAR_H   = 72

type Tab = 'qr' | 'history'

/** Mix hex toward 0 (black) or 255 (white) by `amount` 0–1 */
function mixHex(hex: string, target: 0 | 255, amount: number): string {
  const h    = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n    = parseInt(full, 16)
  const blend = (ch: number) => Math.round(ch + (target - ch) * amount)
  const r = blend((n >> 16) & 0xff)
  const g = blend((n >>  8) & 0xff)
  const b = blend((n >>  0) & 0xff)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Build bar rects for a simple barcode visual from a seed string */
function genBars(seed: string, w: number): Array<{ x: number; bw: number }> {
  const unit = w / 110
  const bars: Array<{ x: number; bw: number }> = []
  let x = 0, i = 0
  while (x < w) {
    const c  = seed.charCodeAt(i % Math.max(seed.length, 1)) || 65
    const bw = Math.max(unit * 0.8, ((c % 3) + 1) * unit)
    if (x + bw > w) break
    if (i % 2 === 0) bars.push({ x, bw })
    x += bw
    i++
  }
  return bars
}

function BarcodeView({ seed, width: w, height: h }: { seed: string; width: number; height: number }) {
  return (
    <Svg width={w} height={h}>
      {genBars(seed, w).map((b, i) => (
        <Rect key={i} x={b.x} y={0} width={b.bw} height={h} fill="#111111" />
      ))}
    </Svg>
  )
}

function fmtNumber(id?: string | number): string {
  if (!id) return '0000 0000 0000 0000'
  const s = String(id).replace(/\D/g, '').padStart(16, '0').slice(-16)
  return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8, 12)} ${s.slice(12, 16)}`
}

function fmtCheckinDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400_000)
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (itemDay.getTime() === today.getTime()) return `Today · ${time}`
  if (itemDay.getTime() === yesterday.getTime()) return `Yesterday · ${time}`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ` · ${time}`
}

function getWeekLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfThisWeek = new Date(now)
  startOfThisWeek.setDate(now.getDate() - now.getDay())
  startOfThisWeek.setHours(0, 0, 0, 0)
  const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 86400_000)

  if (d >= startOfThisWeek) return 'This week'
  if (d >= startOfLastWeek) return 'Last week'
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function methodLabel(method: string): string {
  if (method === 'member_qr_scan') return 'QR scan'
  if (method === 'staff_qr_scan')  return 'Staff scan'
  if (method === 'pin')            return 'PIN'
  if (method === 'manual')         return 'Manual'
  return method.replace(/_/g, ' ')
}

export default function CheckInScreen() {
  const { branding }    = useTenant()
  const { accessToken } = useAuth()
  const router          = useRouter()
  const insets          = useSafeAreaInsets()
  const accent          = branding?.primary_color ?? '#14B946'
  const slug            = branding?.slug ?? ''
  const gymName         = branding?.name ?? 'Gym'

  const [tab, setTab] = useState<Tab>('qr')

  const { data, isLoading } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn:  () => memberApi.getProfile(slug),
    enabled:  !!slug && !!accessToken,
    staleTime: 30_000,
  })

  const {
    data: histData, isLoading: histLoading, isRefetching: histRefetching, refetch: histRefetch,
  } = useQuery({
    queryKey: ['checkin-history', slug],
    queryFn:  () => memberApi.getCheckinHistory(slug, 60),
    enabled:  !!slug && !!accessToken && tab === 'history',
    staleTime: 60_000,
  })

  const profile     = data?.member
  const gym         = data?.gym
  const sub         = (data as any)?.subscription
  const qrValue     = profile?.qr_code ?? (profile ? `myfiti:member:${profile.id}` : 'myfiti')
  const barcodeNum  = fmtNumber(profile?.id)

  const subStatus   = sub?.status as string | undefined
  const chipLabel   = subStatus === 'active'        ? 'Active'
                    : subStatus === 'expiring_soon'  ? 'Expiring soon'
                    : subStatus === 'grace_period'   ? 'Grace period'
                    : subStatus === 'expired'        ? 'Expired'
                    : null
  const chipColor   = subStatus === 'active'        ? '#16A34A'
                    : subStatus === 'expiring_soon'  ? '#D97706'
                    : subStatus === 'grace_period'   ? '#D97706'
                    : subStatus === 'expired'        ? '#DC2626'
                    : null

  const avatarSeed = String(profile?.name ?? profile?.id ?? 'member')
  const btnLight   = mixHex(accent, 255, 0.22)
  const bg         = mixHex(accent, 0, 0.85)

  // Group check-ins by week label
  const checkins = histData?.checkins ?? []
  const grouped: Array<{ label: string; items: typeof checkins }> = []
  for (const ci of checkins) {
    const label = getWeekLabel(ci.checked_in_at)
    const last = grouped[grouped.length - 1]
    if (last && last.label === label) {
      last.items.push(ci)
    } else {
      grouped.push({ label, items: [ci] })
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.navigate('/(tabs)/home')}
          activeOpacity={0.7}
        >
          <X size={18} color="#FFFFFF" strokeWidth={2.2} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{tab === 'history' ? 'Check-in History' : 'My QR Code'}</Text>

        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/help')}
        >
          <HelpCircle size={18} color="#FFFFFF" strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {tab === 'qr' ? (
        /* ── QR View ── */
        <View style={styles.qrView}>
          {/* Card */}
          <View style={styles.card}>

            {/* Member row */}
            <View style={styles.memberRow}>
              <DiceBearAvatar seed={avatarSeed} size={44} photoUrl={profile?.avatar_url} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {profile?.name ?? 'Loading…'}
                </Text>
                <View style={styles.memberMeta}>
                  <Text style={styles.memberPhone} numberOfLines={1}>
                    {profile?.phone ?? ''}
                  </Text>
                  {chipLabel && chipColor && (
                    <View style={[styles.statusChip, { backgroundColor: chipColor + '18', borderColor: chipColor + '40' }]}>
                      <View style={[styles.statusDot, { backgroundColor: chipColor }]} />
                      <Text style={[styles.statusChipText, { color: chipColor }]}>{chipLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
              {gym?.logo_url ? (
                <Image source={{ uri: gym.logo_url }} style={styles.gymLogo} resizeMode="contain" />
              ) : (
                <View style={[styles.gymLogoFallback, { backgroundColor: accent + '18' }]}>
                  <Text style={[styles.gymLogoInitials, { color: accent }]}>
                    {gym?.name?.slice(0, 2).toUpperCase() ?? 'GY'}
                  </Text>
                </View>
              )}
            </View>

            {/* QR code */}
            <View style={styles.qrWrap}>
              {isLoading ? (
                <View style={[styles.qrPlaceholder, { backgroundColor: '#F0F2F5' }]} />
              ) : (
                <MotiView
                  from={{ scale: 1 }}
                  animate={{ scale: [1, 1.016, 1] }}
                  transition={{ loop: true, type: 'timing', duration: 2800, repeatReverse: false }}
                >
                  <View style={[styles.qrRing, { borderColor: accent + '30' }]}>
                    <StyledQRCode
                      value={qrValue}
                      size={QR_SIZE}
                      dotColor="#111111"
                      finderColor={accent}
                      backgroundColor="#FFFFFF"
                      logoUrl={gym?.logo_url ?? undefined}
                    />
                  </View>
                </MotiView>
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Barcode */}
            <View style={styles.barcodeWrap}>
              <BarcodeView seed={qrValue} width={BAR_W} height={BAR_H} />
              <Text style={styles.barcodeNum}>{barcodeNum}</Text>
            </View>

            {/* Download button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.downloadBtn}
              onPress={() => Share.share({ message: qrValue }).catch(() => {})}
            >
              <LinearGradient
                colors={[btnLight, accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.downloadGrad}
              >
                <Download size={18} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.downloadText}>Download QR</Text>
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </View>
      ) : (
        /* ── History View ── */
        <ScrollView
          style={styles.histScroll}
          contentContainerStyle={[styles.histContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={histRefetching} onRefresh={histRefetch} tintColor={accent} />
          }
        >
          {histLoading ? (
            <View style={styles.histEmpty}>
              <Text style={styles.histEmptyText}>Loading…</Text>
            </View>
          ) : grouped.length === 0 ? (
            <View style={styles.histEmpty}>
              <CheckCircle2 size={48} color="rgba(255,255,255,0.25)" strokeWidth={1.5} />
              <Text style={[styles.histEmptyText, { marginTop: 12 }]}>No check-ins yet</Text>
              <Text style={styles.histEmptySub}>
                Scan your QR code at the gym entrance to record a visit
              </Text>
            </View>
          ) : (
            grouped.map((group) => (
              <View key={group.label}>
                <Text style={styles.weekLabel}>{group.label}</Text>
                {group.items.map((ci, i) => (
                  <MotiView
                    key={ci.id}
                    from={{ opacity: 0, translateX: -6 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'timing', duration: 220, delay: i * 30 }}
                  >
                    <View style={styles.histRow}>
                      <View style={[styles.histIcon, { backgroundColor: accent + '20' }]}>
                        <CheckCircle2 size={18} color={accent} strokeWidth={1.8} />
                      </View>
                      <View style={styles.histInfo}>
                        <Text style={styles.histGym}>{gymName}</Text>
                        <Text style={styles.histMeta}>{fmtCheckinDate(ci.checked_in_at)}</Text>
                      </View>
                      <View style={styles.histBadge}>
                        <Text style={[styles.histBadgeText, { color: accent }]}>
                          {methodLabel(ci.method)}
                        </Text>
                      </View>
                    </View>
                  </MotiView>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Mode toggle pill ── */}
      <View style={[
        styles.togglePill,
        { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.16)' },
        { bottom: insets.bottom + 16 },
      ]}>
        {/* My QR */}
        <TouchableOpacity
          style={[styles.toggleOption, tab === 'qr' && [styles.toggleOptionActive, { backgroundColor: accent }]]}
          onPress={() => setTab('qr')}
          activeOpacity={0.7}
        >
          <QrCode size={15} color={tab === 'qr' ? '#FFF' : 'rgba(255,255,255,0.65)'} strokeWidth={tab === 'qr' ? 2 : 1.8} />
          <Text style={tab === 'qr' ? styles.toggleLabelActive : styles.toggleLabelInactive}>My QR Code</Text>
        </TouchableOpacity>

        {/* Scan to Enter */}
        <TouchableOpacity
          style={styles.toggleOption}
          onPress={() => router.push('/scan-checkin')}
          activeOpacity={0.7}
        >
          <ScanLine size={15} color="rgba(255,255,255,0.65)" strokeWidth={1.8} />
          <Text style={styles.toggleLabelInactive}>Scan to Enter</Text>
        </TouchableOpacity>

        {/* History */}
        <TouchableOpacity
          style={[styles.toggleOption, tab === 'history' && [styles.toggleOptionActive, { backgroundColor: accent }]]}
          onPress={() => setTab('history')}
          activeOpacity={0.7}
        >
          <History size={15} color={tab === 'history' ? '#FFF' : 'rgba(255,255,255,0.65)'} strokeWidth={tab === 'history' ? 2 : 1.8} />
          <Text style={tab === 'history' ? styles.toggleLabelActive : styles.toggleLabelInactive}>History</Text>
        </TouchableOpacity>
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Header */
  header: {
    width: '100%',
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18, fontFamily: F.bold, color: '#FFFFFF',
  },

  /* QR view */
  qrView: { flex: 1, alignItems: 'center', paddingTop: 40 },

  /* Card */
  card: {
    width:           CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius:    24,
    padding:         20,
    gap:             20,
    shadowColor:     '#000',
    shadowOpacity:   0.2,
    shadowRadius:    32,
    shadowOffset:    { width: 0, height: 8 },
    elevation:       14,
  },

  /* Member row */
  memberRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: '#F3F4F6',
    borderRadius:    14,
    padding:         12,
  },
  memberInfo:  { flex: 1 },
  memberName:  { fontSize: 15, fontFamily: F.bold,    color: '#0D0D18' },
  memberMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberPhone: { fontSize: 13, fontFamily: F.regular, color: '#8A94A6', marginTop: 2 },

  /* Status chip */
  statusChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 11, fontFamily: F.semibold },

  /* Gym logo badge */
  gymLogo:         { width: 36, height: 36, borderRadius: 10 },
  gymLogoFallback: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gymLogoInitials: { fontSize: 12, fontFamily: F.bold },

  /* QR */
  qrWrap:        { alignItems: 'center', justifyContent: 'center' },
  qrPlaceholder: { width: QR_SIZE, height: QR_SIZE, borderRadius: 8 },
  qrRing:        { borderRadius: 12, borderWidth: 2, overflow: 'hidden' },

  /* Divider */
  divider: { height: 1, backgroundColor: '#EBEBF0' },

  /* Barcode */
  barcodeWrap: { alignItems: 'center', gap: 10 },
  barcodeNum: {
    fontSize: 13, fontFamily: F.regular,
    color: '#8A94A6', letterSpacing: 2,
  },

  /* Download button */
  downloadBtn:  { borderRadius: 99, overflow: 'hidden' },
  downloadGrad: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    paddingVertical: 16,
  },
  downloadText: { fontSize: 16, fontFamily: F.bold, color: '#FFFFFF' },

  /* History */
  histScroll:  { flex: 1 },
  histContent: { paddingHorizontal: 20, paddingTop: 8 },
  histEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80,
  },
  histEmptyText: { fontSize: 16, fontFamily: F.semibold, color: 'rgba(255,255,255,0.55)' },
  histEmptySub:  { fontSize: 13, fontFamily: F.regular, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 8, lineHeight: 18, paddingHorizontal: 32 },
  weekLabel: {
    fontSize: 11, fontFamily: F.bold, letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
    marginTop: 20, marginBottom: 8,
  },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 14, marginBottom: 8,
  },
  histIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  histInfo: { flex: 1 },
  histGym:  { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
  histMeta: { fontSize: 12, fontFamily: F.regular, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  histBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8,
  },
  histBadgeText: { fontSize: 11, fontFamily: F.semibold },

  /* Mode toggle pill */
  togglePill: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', borderRadius: 99, borderWidth: 1,
    padding: 4, gap: 2,
  },
  toggleOption: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 99,
  },
  toggleOptionActive: {},
  toggleLabelActive:   { fontSize: 13, fontFamily: F.semibold, color: '#FFF' },
  toggleLabelInactive: { fontSize: 13, fontFamily: F.medium, color: 'rgba(255,255,255,0.65)' },
})
