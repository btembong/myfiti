import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import { ScanFace, Fingerprint, ShieldCheck } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { useTenant } from '../src/context/TenantContext'
import { F } from '../src/theme'

// ── Dimensions ────────────────────────────────────────────────────────────────
const RING_R    = 100
const RING_SW   = 12
const RING_SVG  = (RING_R + RING_SW) * 2 + 8   // 232 — SVG canvas
const RING_C    = 2 * Math.PI * RING_R           // ~628
const SCAN_FRAME  = 138   // inner scan frame inside ring
const INTRO_FRAME = 220   // larger frame on intro screen
const CORNER_L  = 28      // bracket arm length
const CORNER_T  = 3       // bracket thickness
const CORNER_R  = 7       // outer corner radius

type Screen = 'intro' | 'scanning' | 'success'

// Animated SVG circle — lets us animate strokeDashoffset on the JS thread
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// ── Scan beam: horizontal line that sweeps top → bottom ──────────────────────
function ScanBeam({ frameSize, accent }: { frameSize: number; accent: string }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  const translateY = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [-4, frameSize + 4],
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      <Animated.View style={{ transform: [{ translateY }] }}>
        <View style={{ height: 2, backgroundColor: accent, opacity: 0.9 }} />
        <LinearGradient
          colors={[accent + '32', 'transparent']}
          style={{ height: 70 }}
          pointerEvents="none"
        />
      </Animated.View>
    </Animated.View>
  )
}

// ── Four corner brackets ───────────────────────────────────────────────────────
function CornerBrackets({ color = '#6B7280' }: { color?: string }) {
  return (
    <>
      <View style={[s.corner, { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0,
        borderTopLeftRadius: CORNER_R, borderColor: color }]} />
      <View style={[s.corner, { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0,
        borderTopRightRadius: CORNER_R, borderColor: color }]} />
      <View style={[s.corner, { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0,
        borderBottomLeftRadius: CORNER_R, borderColor: color }]} />
      <View style={[s.corner, { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0,
        borderBottomRightRadius: CORNER_R, borderColor: color }]} />
    </>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BiometricsScreen() {
  const router       = useRouter()
  const insets       = useSafeAreaInsets()
  const { theme, isDark } = useTheme()
  const { branding } = useTenant()
  const { enableBiometrics } = useAuth()
  const accent = branding?.primary_color ?? '#22C55E'

  const [screen, setScreen]   = useState<Screen>('intro')
  const [pct, setPct]         = useState(0)
  const [error, setError]     = useState('')
  const [authTypes, setAuthTypes] = useState<LocalAuthentication.AuthenticationType[]>([])

  const progressAnim = useRef(new Animated.Value(0)).current
  const abortedRef   = useRef(false)
  const animRef      = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    LocalAuthentication.supportedAuthenticationTypesAsync().then(setAuthTypes)
  }, [])

  const hasFace = authTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  const biometricLabel = hasFace ? 'Face ID' : 'Fingerprint'
  const BiometricIcon  = hasFace ? ScanFace : Fingerprint

  // strokeDashoffset: RING_C → 0 as progress 0 → 1
  const strokeDashoffset = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [RING_C, 0],
  })

  async function handleEnable() {
    setError('')
    abortedRef.current = false
    progressAnim.setValue(0)
    setPct(0)
    setScreen('scanning')

    const listener = progressAnim.addListener(({ value }) =>
      setPct(Math.round(value * 100))
    )

    const animPromise = new Promise<void>(resolve => {
      const a = Animated.timing(progressAnim, {
        toValue:  1,
        duration: 3200,
        easing:   Easing.out(Easing.quad),
        useNativeDriver: false,   // must be false to animate SVG prop
      })
      animRef.current = a
      a.start(() => resolve())
    })

    try {
      const [, ok] = await Promise.all([animPromise, enableBiometrics()])
      progressAnim.removeListener(listener)
      if (!abortedRef.current) {
        if (ok) setScreen('success')
        else { setError('Biometric verification failed. Please try again.'); setScreen('intro') }
      }
    } catch {
      progressAnim.removeListener(listener)
      if (!abortedRef.current) { setError('Something went wrong.'); setScreen('intro') }
    }
  }

  function handleAbort() {
    abortedRef.current = true
    animRef.current?.stop()
    progressAnim.setValue(0)
    setPct(0)
    setScreen('intro')
  }

  function handleDone() {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/home')
  }

  // Subtle brand-tinted gradient in light mode; flat in dark
  const bgColors: [string, string, string] = isDark
    ? [theme.bg, theme.bg, theme.bg]
    : [accent + '1C', accent + '0C', '#FFFFFF']

  const pt = insets.top + 20
  const pb = insets.bottom + 32
  const cx = RING_SVG / 2
  const cy = RING_SVG / 2

  // ── Success ──────────────────────────────────────────────────────────────────
  if (screen === 'success') {
    return (
      <LinearGradient colors={bgColors} locations={[0, 0.4, 1]}
        style={[s.root, { paddingTop: pt, paddingBottom: pb }]}>
        <View style={s.centerWrap}>
          <LinearGradient colors={[accent + '33', accent + '11']} style={s.successRing}>
            <LinearGradient colors={[accent, accent + 'CC']} style={s.successIcon}>
              <ShieldCheck size={40} color="#FFF" strokeWidth={1.8} />
            </LinearGradient>
          </LinearGradient>

          <Text style={[s.title, { color: theme.text }]}>{biometricLabel} enabled</Text>
          <Text style={[s.sub, { color: theme.textSub }]}>
            Next time you open the app, log in with {biometricLabel} — no OTP needed.
          </Text>

          <TouchableOpacity style={[s.btnPrimary, { backgroundColor: accent }]}
            onPress={handleDone} activeOpacity={0.82}>
            <Text style={s.btnPrimaryText}>All done</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    )
  }

  // ── Scanning ─────────────────────────────────────────────────────────────────
  if (screen === 'scanning') {
    return (
      <LinearGradient colors={bgColors} locations={[0, 0.4, 1]}
        style={[s.root, { paddingTop: pt, paddingBottom: pb }]}>
        <View style={s.scanWrap}>

          {/* Top section */}
          <View style={s.scanTop}>
            {/* Badge */}
            <View style={[s.badge, { backgroundColor: accent + '22' }]}>
              <Text style={[s.badgeText, { color: accent }]}>System Scanning</Text>
            </View>

            <Text style={[s.scanTitle, { color: theme.text }]}>Analysis in Progress</Text>

            {/* Progress ring + inner scan frame */}
            <View style={{ width: RING_SVG, height: RING_SVG, alignItems: 'center', justifyContent: 'center' }}>
              {/* SVG ring — rotated so arc starts at 12 o'clock */}
              <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
                <Svg width={RING_SVG} height={RING_SVG}>
                  {/* Track circle */}
                  <Circle
                    cx={cx} cy={cy} r={RING_R}
                    stroke={accent + '25'}
                    strokeWidth={RING_SW}
                    fill="none"
                  />
                  {/* Animated progress arc */}
                  <AnimatedCircle
                    cx={cx} cy={cy} r={RING_R}
                    stroke={accent}
                    strokeWidth={RING_SW}
                    fill="none"
                    strokeDasharray={RING_C}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>

              {/* Inner scan frame */}
              <View style={[s.scanFrame, { overflow: 'hidden' }]}>
                <CornerBrackets color={isDark ? theme.textMuted : '#6B7280'} />
                <BiometricIcon size={64} color={isDark ? theme.textSub : '#374151'} strokeWidth={1.3} />
                <ScanBeam frameSize={SCAN_FRAME} accent={accent} />
              </View>
            </View>

            {/* Percentage */}
            <Text style={[s.pctText, { color: theme.text }]}>{pct}%</Text>
            <Text style={[s.pctLabel, { color: theme.textSub }]}>Neural Mapping</Text>
          </View>

          {/* Spacer pushes Abort to bottom */}
          <View style={{ flex: 1 }} />

          <TouchableOpacity style={[s.btnOutline, { borderColor: accent }]}
            onPress={handleAbort} activeOpacity={0.7}>
            <Text style={[s.btnOutlineText, { color: accent }]}>Abort Process</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    )
  }

  // ── Intro ─────────────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={bgColors} locations={[0, 0.4, 1]}
      style={[s.root, { paddingTop: pt, paddingBottom: pb }]}>
      <View style={s.introWrap}>

        {/* Scanner frame */}
        <View style={[s.introFrame, { overflow: 'hidden' }]}>
          <CornerBrackets color={isDark ? theme.textMuted : '#6B7280'} />
          <BiometricIcon size={80} color={isDark ? theme.textSub : '#374151'} strokeWidth={1.3} />
          <ScanBeam frameSize={INTRO_FRAME} accent={accent} />
        </View>

        <Text style={[s.title, { color: theme.text }]}>{biometricLabel}</Text>
        <Text style={[s.sub, { color: theme.textSub }]}>
          Our advanced neural engine creates a unique map of your{' '}
          {hasFace ? 'facial features' : 'fingerprint'} for instant access.
        </Text>

        {error ? (
          <View style={s.errorWrap}>
            <View style={s.errorBar} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={s.btnGroup}>
          <TouchableOpacity style={[s.btnPrimary, { backgroundColor: accent }]}
            onPress={handleEnable} activeOpacity={0.82}>
            <Text style={s.btnPrimaryText}>Initialize Setup</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btnOutline, { borderColor: accent }]}
            onPress={handleDone} activeOpacity={0.7}>
            <Text style={[s.btnOutlineText, { color: accent }]}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Intro ──────────────────────────────────────────────────────────────────
  introWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 22,
  },
  introFrame: {
    width: INTRO_FRAME, height: INTRO_FRAME,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Scanning ───────────────────────────────────────────────────────────────
  scanWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 0,
  },
  scanTop: {
    alignItems: 'center',
    gap: 18,
  },
  badge: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { fontSize: 13, fontFamily: F.semibold },
  scanTitle: { fontSize: 24, fontFamily: F.extrabold, textAlign: 'center' },
  scanFrame: {
    width: SCAN_FRAME, height: SCAN_FRAME,
    alignItems: 'center', justifyContent: 'center',
  },
  pctText:  { fontSize: 42, fontFamily: F.extrabold },
  pctLabel: { fontSize: 15, fontFamily: F.regular, marginTop: -8 },

  // ── Corner brackets ────────────────────────────────────────────────────────
  corner: {
    position: 'absolute',
    width: CORNER_L, height: CORNER_L,
    borderWidth: CORNER_T,
  },

  // ── Shared ─────────────────────────────────────────────────────────────────
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  title: { fontSize: 26, fontFamily: F.extrabold, textAlign: 'center' },
  sub:   { fontSize: 15, fontFamily: F.regular,   textAlign: 'center', lineHeight: 23 },

  // ── Buttons ────────────────────────────────────────────────────────────────
  btnGroup: { gap: 12, alignSelf: 'stretch', marginTop: 8 },
  btnPrimary: {
    height: 56, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'stretch',
  },
  btnPrimaryText:  { fontSize: 16, fontFamily: F.semibold, color: '#FFF' },
  btnOutline: {
    height: 56, borderRadius: 100, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'stretch',
  },
  btnOutlineText: { fontSize: 16, fontFamily: F.semibold },

  // ── Error ──────────────────────────────────────────────────────────────────
  errorWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, alignSelf: 'stretch' },
  errorBar:  { width: 3, borderRadius: 2, backgroundColor: '#EF4444', alignSelf: 'stretch' },
  errorText: { fontSize: 13, color: '#EF4444', flex: 1, fontFamily: F.regular },

  // ── Success ────────────────────────────────────────────────────────────────
  successRing: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
  },
  successIcon: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
  },
})
