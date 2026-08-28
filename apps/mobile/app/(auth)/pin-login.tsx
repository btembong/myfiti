import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Delete } from 'lucide-react-native'
import * as Device from 'expo-device'
import { authApi } from '../../src/lib/api'
import { memberApi } from '../../src/lib/api'
import { useAuth } from '../../src/context/AuthContext'
import { useTenant } from '../../src/context/TenantContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'

const PIN_LEN = 4

function PinDots({ value, error }: { value: string; error: boolean }) {
  return (
    <View style={pd.row}>
      {Array.from({ length: PIN_LEN }).map((_, i) => (
        <View
          key={i}
          style={[
            pd.dot,
            i < value.length
              ? { backgroundColor: error ? '#EF4444' : '#14B946', borderColor: error ? '#EF4444' : '#14B946' }
              : { backgroundColor: 'transparent' },
          ]}
        />
      ))}
    </View>
  )
}

const pd = StyleSheet.create({
  row: { flexDirection: 'row', gap: 18, justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#C0C0C0' },
})

function NumPad({ onPress, onDelete, theme }: { onPress: (d: string) => void; onDelete: () => void; theme: any }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']
  return (
    <View style={np.grid}>
      {keys.map((k, i) => {
        if (k === '') return <View key={`empty-${i}`} style={np.cell} />
        const isDel = k === 'del'
        return (
          <TouchableOpacity
            key={`key-${k}`}
            style={[np.cell, np.btn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => isDel ? onDelete() : onPress(k)}
            activeOpacity={0.65}
          >
            {isDel
              ? <Delete size={20} color={theme.text} strokeWidth={1.8} />
              : <Text style={[np.digit, { color: theme.text }]}>{k}</Text>
            }
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const np = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  cell: { width: 88, height: 72 },
  btn: {
    borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  digit: { fontSize: 26, fontFamily: F.semibold },
})

export default function PinLoginScreen() {
  const router    = useRouter()
  const insets    = useSafeAreaInsets()
  const { theme } = useTheme()
  const { signIn }    = useAuth()
  const { setTenant } = useTenant()
  const { tenantSlug, identifier } = useLocalSearchParams<{
    tenantSlug: string; identifier: string
  }>()

  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const shakeAnim = useRef(new Animated.Value(0)).current

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start()
  }

  async function handlePress(digit: string) {
    if (pin.length >= PIN_LEN || loading) return
    setError('')
    const next = pin + digit
    setPin(next)

    if (next.length === PIN_LEN) {
      setLoading(true)
      try {
        const deviceName = Device.modelName ?? 'Unknown Device'
        const deviceType =
          Device.deviceType === Device.DeviceType.TABLET  ? 'tablet'  :
          Device.deviceType === Device.DeviceType.DESKTOP ? 'desktop' : 'mobile'

        const result = await authApi.loginWithPin(tenantSlug, identifier, next, deviceName, deviceType)
        await signIn(result.token, result.memberId, result.refreshToken)

        const fallbackTenant = {
          id: tenantSlug, slug: tenantSlug, name: tenantSlug,
          logo_url: '', primary_color: '#5B8EF4', secondary_color: '#5B8EF4',
          splash_bg_color: '#5B8EF4', font: 'default' as const,
          timezone: 'UTC', currency: 'USD',
          features: {
            show_announcements: true, allow_self_renewal: true,
            referral_system: false, guest_passes: false,
            show_leaderboard: false, show_body_metrics: false,
            show_trainer_ratings: false, wod_leaderboard: false,
          },
        }
        try {
          const profileData = await memberApi.getProfile(tenantSlug)
          if (profileData.gym) {
            setTenant({
              ...fallbackTenant,
              name: profileData.gym.name,
              logo_url: profileData.gym.logo_url ?? '',
              primary_color: profileData.gym.primary_color,
            })
          } else {
            setTenant(fallbackTenant)
          }
        } catch {
          setTenant(fallbackTenant)
        }
        router.replace('/(tabs)')
      } catch (err: any) {
        shake()
        setError(err.message ?? 'Incorrect PIN')
        setPin('')
      } finally {
        setLoading(false)
      }
    }
  }

  function handleDelete() {
    setError('')
    setPin(v => v.slice(0, -1))
  }

  // Mask identifier for display
  const displayId = identifier?.includes('@')
    ? identifier.replace(/(.{2})(.*)(@.*)/, (_, a, _b, c) => `${a}···${c}`)
    : identifier?.replace(/(.{3})(.*)(.{2})$/, (_, a, _b, c) => `${a}···${c}`)

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Enter PIN</Text>
      </View>

      <View style={s.body}>
        <View style={s.topSection}>
          <Text style={[s.title, { color: theme.text }]}>Welcome back</Text>
          <Text style={[s.sub, { color: theme.textSub }]}>
            Sign in as{' '}
            <Text style={{ fontFamily: F.semibold }}>{displayId}</Text>
          </Text>

          <Animated.View style={{ transform: [{ translateX: shakeAnim }], marginTop: 36 }}>
            <PinDots value={pin} error={!!error} />
          </Animated.View>

          {error ? (
            <Text style={s.errorText}>{error}</Text>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color="#14B946" size="large" />
        ) : (
          <NumPad onPress={handlePress} onDelete={handleDelete} theme={theme} />
        )}

        {/* Fallback to OTP */}
        <TouchableOpacity
          style={s.otpLink}
          onPress={() => {
            authApi.requestOtp(tenantSlug, identifier).then(() =>
              router.replace({ pathname: '/(auth)/otp', params: { tenantSlug, identifier } })
            ).catch(() =>
              router.replace({ pathname: '/(auth)/otp', params: { tenantSlug, identifier } })
            )
          }}
          activeOpacity={0.7}
        >
          <Text style={[s.otpLinkText, { color: theme.textMuted }]}>
            Forgot PIN?{' '}
            <Text style={{ color: theme.textSub, fontFamily: F.semibold }}>Use email OTP instead</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: F.bold },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'space-evenly',
    paddingHorizontal: 24, paddingVertical: 32,
  },

  topSection: { alignItems: 'center', gap: 8 },
  title:      { fontSize: 24, fontFamily: F.bold },
  sub:        { fontSize: 14, fontFamily: F.regular, color: '#6B7280' },

  errorText: { fontSize: 13, fontFamily: F.medium, color: '#EF4444', marginTop: 14 },

  otpLink:     { alignItems: 'center' },
  otpLinkText: { fontSize: 13, fontFamily: F.regular, textAlign: 'center' },
})
