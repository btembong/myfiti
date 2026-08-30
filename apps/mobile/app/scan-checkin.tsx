import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { MotiView } from 'moti'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, HelpCircle, Zap, ZapOff,
  QrCode, KeyRound, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react-native'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useAuth } from '../src/context/AuthContext'
import { F } from '../src/theme'

const { width } = Dimensions.get('window')
const FRAME = width * 0.68

// ─── Corner bracket ───────────────────────────────────────────────────────────
function Corner({ top, left, color }: { top: boolean; left: boolean; color: string }) {
  const SIZE = 28
  const THICK = 3.5
  return (
    <View style={[
      { position: 'absolute', width: SIZE, height: SIZE },
      top  ? { top: 0 }    : { bottom: 0 },
      left ? { left: 0 }   : { right: 0 },
    ]}>
      {/* horizontal */}
      <View style={{
        position: 'absolute',
        width: SIZE, height: THICK,
        backgroundColor: color, borderRadius: 2,
        top:    top  ? 0 : undefined,
        bottom: !top ? 0 : undefined,
        left:   left ? 0 : undefined,
        right:  !left? 0 : undefined,
      }} />
      {/* vertical (already uses color prop) */}
      <View style={{
        position: 'absolute',
        width: THICK, height: SIZE,
        backgroundColor: color, borderRadius: 2,
        top:    top  ? 0 : undefined,
        bottom: !top ? 0 : undefined,
        left:   left ? 0 : undefined,
        right:  !left? 0 : undefined,
      }} />
    </View>
  )
}

// ─── Result overlay ───────────────────────────────────────────────────────────
type ResultState = {
  ok: boolean
  title: string
  sub: string
  type: 'success' | 'warn' | 'error'
} | null

function ResultOverlay({ result, accent, onDismiss }: {
  result: ResultState
  accent: string
  onDismiss: () => void
}) {
  if (!result) return null
  const Icon = result.type === 'success' ? CheckCircle2
    : result.type === 'warn' ? AlertTriangle
    : XCircle
  const color = result.type === 'success' ? '#22C55E'
    : result.type === 'warn' ? '#F59E0B'
    : '#EF4444'
  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <TouchableOpacity
        style={styles.overlayBg}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          style={[styles.overlayCard, { borderColor: color + '40' }]}
        >
          <View style={[styles.overlayIconWrap, { backgroundColor: color + '20' }]}>
            <Icon size={44} color={color} strokeWidth={1.8} />
          </View>
          <Text style={[styles.overlayTitle, { color }]}>{result.title}</Text>
          <Text style={styles.overlaySub}>{result.sub}</Text>
          <TouchableOpacity
            style={[styles.overlayBtn, { backgroundColor: color }]}
            onPress={onDismiss}
            activeOpacity={0.82}
          >
            <Text style={styles.overlayBtnText}>Done</Text>
          </TouchableOpacity>
        </MotiView>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ScanCheckInScreen() {
  const router = useRouter()
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const accent = branding?.primary_color ?? '#22C55E'
  const slug   = branding?.slug ?? ''

  const [permission, requestPermission] = useCameraPermissions()
  const [torch, setTorch]       = useState(false)
  const [result, setResult]     = useState<ResultState>(null)
  const lastScan = useRef<string>('')

  const mutation = useMutation({
    mutationFn: (token: string) => memberApi.scanCheckIn(slug, token),
    onSuccess: (data) => {
      if (data.ok) {
        setResult({
          ok: true,
          title: data.status === 'grace_period'
            ? 'Grace period — entry allowed'
            : `Welcome, ${data.member_name}!`,
          sub: data.plan_name
            ? `${data.plan_name} · ${data.message}`
            : data.message,
          type: data.status === 'grace_period' ? 'warn' : 'success',
        })
      } else {
        setResult({
          ok: false,
          title: data.status === 'expired'    ? 'Membership expired'
            : data.status === 'suspended' ? 'Account suspended'
            : 'Access denied',
          sub: data.message,
          type: 'error',
        })
      }
    },
    onError: () => {
      setResult({ ok: false, title: 'Scan failed', sub: 'Could not process QR. Try again.', type: 'error' })
    },
  })

  function handleScan({ data }: { data: string }) {
    if (!data || data === lastScan.current || mutation.isPending || result) return
    lastScan.current = data

    // The gym QR encodes a URL like https://app.myfiti.com/kiosk?t=<JWT>
    // Extract just the JWT if the scan is a URL with ?t= param
    let token = data
    try {
      const url = new URL(data)
      const t = url.searchParams.get('t')
      if (t) token = t
    } catch {
      // Not a URL — use raw data as token
    }

    mutation.mutate(token)
  }

  function handleDismiss() {
    setResult(null)
    lastScan.current = ''
  }

  // ── Permission gate ────────────────────────────────────────────────────────
  if (!permission) return <View style={styles.root} />

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.permCenter]}>
        <QrCode size={48} color="#fff" strokeWidth={1.5} style={{ marginBottom: 20 }} />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permSub}>Allow camera to scan gym QR codes for check-in.</Text>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: accent }]}
          onPress={requestPermission}
          activeOpacity={0.85}
        >
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.root}>

      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />


<SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Scan to Check In</Text>
            <Text style={styles.headerSub}>Scan QR at gym entrance</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/help')} activeOpacity={0.7}>
            <HelpCircle size={20} color="#fff" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* ── Viewfinder ── */}
        <View style={styles.viewfinder}>
          {/* semi-transparent shade around frame */}
          <View style={[styles.shadeH, { top: 0 }]} />
          <View style={styles.frameRow}>
            <View style={styles.shadeV} />

            {/* scan frame */}
            <View style={styles.frame}>
              <Corner top left color={accent} />
              <Corner top={false} left color={accent} />
              <Corner top left={false} color={accent} />
              <Corner top={false} left={false} color={accent} />

              {/* animated scan line */}
              <MotiView
                from={{ translateY: 0 }}
                animate={{ translateY: FRAME - 4 }}
                transition={{
                  loop: true, repeatReverse: true,
                  type: 'timing', duration: 1800,
                }}
                style={[styles.scanLine, { backgroundColor: accent }]}
              />
            </View>

            <View style={styles.shadeV} />
          </View>
          <View style={[styles.shadeH, { bottom: 0 }]} />
        </View>

        <Text style={styles.hint}>Align QR code within frame</Text>

        {/* ── Controls ── */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.ctrlBtn}
            onPress={() => setTorch(v => !v)}
            activeOpacity={0.75}
          >
            {torch
              ? <Zap size={22} color="#fff" strokeWidth={2} fill="#fff" />
              : <ZapOff size={22} color="#fff" strokeWidth={2} />
            }
          </TouchableOpacity>
        </View>

        {/* ── Bottom sheet ── */}
        <View style={styles.sheet}>
          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => router.push('/(tabs)/checkin')}
            activeOpacity={0.75}
          >
            <View style={[styles.sheetIcon, { backgroundColor: accent + '18' }]}>
              <QrCode size={22} color={accent} strokeWidth={1.8} />
            </View>
            <Text style={styles.sheetLabel}>Show My QR</Text>
          </TouchableOpacity>

          <View style={styles.sheetDivider} />

          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => router.push('/(auth)/pin-login')}
            activeOpacity={0.75}
          >
            <View style={[styles.sheetIcon, { backgroundColor: accent + '18' }]}>
              <KeyRound size={22} color={accent} strokeWidth={1.8} />
            </View>
            <Text style={styles.sheetLabel}>PIN Check-in</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      <ResultOverlay result={result} accent={accent} onDismiss={handleDismiss} />
    </View>
  )
}

const SHADE = 'rgba(0,0,0,0.62)'

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontFamily: F.bold, color: '#fff' },
  headerSub:   { fontSize: 12, fontFamily: F.regular, color: 'rgba(255,255,255,0.55)', marginTop: 1 },

  /* Viewfinder */
  viewfinder: { flex: 1 },
  shadeH: { position: 'absolute', left: 0, right: 0, backgroundColor: SHADE, height: '100%' },
  frameRow: { flex: 1, flexDirection: 'row' },
  shadeV:   { flex: 1, backgroundColor: SHADE },
  frame: {
    width: FRAME, height: FRAME,
    position: 'relative', overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0,
    height: 2.5, borderRadius: 2,
    shadowColor: '#fff', shadowOpacity: 0.6, shadowRadius: 6,
  },

  hint: {
    textAlign: 'center',
    fontSize: 13, fontFamily: F.regular, color: 'rgba(255,255,255,0.6)',
    marginTop: 20, marginBottom: 8,
  },

  /* Controls */
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 16 },
  ctrlBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Bottom sheet */
  sheet: {
    flexDirection: 'row',
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingVertical: 24, paddingHorizontal: 16,
  },
  sheetOption: { flex: 1, alignItems: 'center', gap: 10 },
  sheetIcon:   { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetLabel:  { fontSize: 14, fontFamily: F.semibold, color: '#0D0D18' },
  sheetDivider: { width: 1, backgroundColor: '#F0F0F5', marginVertical: 8 },

  /* Permission */
  permCenter: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle:  { fontSize: 20, fontFamily: F.bold, color: '#fff', marginBottom: 8 },
  permSub:    { fontSize: 14, fontFamily: F.regular, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 },
  permBtn:    { marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 99 },
  permBtnText:{ fontSize: 15, fontFamily: F.bold, color: '#fff' },

  /* Result overlay */
  overlayBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  overlayCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 28,
    padding: 32, alignItems: 'center', gap: 12,
    borderWidth: 1.5,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  overlayIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  overlayTitle:   { fontSize: 20, fontFamily: F.extrabold, textAlign: 'center' },
  overlaySub:     { fontSize: 14, fontFamily: F.regular, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  overlayBtn:     { marginTop: 8, width: '100%', height: 52, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  overlayBtnText: { fontSize: 16, fontFamily: F.bold, color: '#fff' },
})
