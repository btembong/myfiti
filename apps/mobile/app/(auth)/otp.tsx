import { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import * as Device from 'expo-device'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { MotiView } from 'moti'
import { ChevronLeft } from 'lucide-react-native'
import { authApi } from '../../src/lib/api'
import { useAuth } from '../../src/context/AuthContext'
import { useTenant } from '../../src/context/TenantContext'
import { memberApi } from '../../src/lib/api'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'

const OTP_LENGTH = 6

export default function OtpScreen() {
  const router = useRouter()
  const { signIn } = useAuth()
  const { setTenant } = useTenant()
  const { theme } = useTheme()
  const { tenantSlug, identifier } = useLocalSearchParams<{ tenantSlug: string; identifier: string }>()

  const [otp, setOtp]               = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [resendSecs, setResendSecs] = useState(60)

  const inputs = useRef<Array<TextInput | null>>([])

  useEffect(() => {
    if (resendSecs <= 0) return
    const t = setTimeout(() => setResendSecs(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendSecs])

  function handleChange(val: string, index: number) {
    const char = val.slice(-1)
    const next = [...otp]; next[index] = char; setOtp(next)
    setError('')
    if (char && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus()
    if (next.every(c => c !== '')) verify(next.join(''))
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus()
      const next = [...otp]; next[index - 1] = ''; setOtp(next)
    }
  }

  async function verify(code: string) {
    setLoading(true); setError('')
    try {
      const deviceName = Device.modelName ?? 'Unknown Device'
      const deviceType =
        Device.deviceType === Device.DeviceType.TABLET  ? 'tablet'  :
        Device.deviceType === Device.DeviceType.DESKTOP ? 'desktop' : 'mobile'
      const result = await authApi.verifyOtp(tenantSlug, identifier, code, deviceName, deviceType)
      await signIn(result.token, result.memberId, result.refreshToken)
      const fallbackTenant = {
        id: tenantSlug, slug: tenantSlug,
        name: tenantSlug,
        logo_url: '',
        primary_color: '#5B8EF4',
        secondary_color: '#5B8EF4',
        splash_bg_color: '#5B8EF4',
        font: 'default' as const,
        timezone: 'UTC',
        currency: 'USD',
        features: {
          show_announcements: true, allow_self_renewal: true,
          referral_system: false, guest_passes: false,
          show_leaderboard: false, show_body_metrics: false,
          show_trainer_ratings: false, wod_leaderboard: false,
        },
      }
      try {
        const profile = await memberApi.getProfile(tenantSlug)
        if (profile.gym) {
          setTenant({
            ...fallbackTenant,
            name: profile.gym.name,
            logo_url: profile.gym.logo_url ?? '',
            primary_color: profile.gym.primary_color,
            secondary_color: profile.gym.primary_color,
            splash_bg_color: profile.gym.primary_color,
            currency: profile.gym.currency,
          })
        } else {
          setTenant(fallbackTenant)
        }
      } catch {
        // Profile fetch failed — still persist the slug so screens can query
        setTenant(fallbackTenant)
      }
      router.replace('/(tabs)/home')
    } catch (err: any) {
      setError(err.message ?? 'Invalid code')
      setOtp(Array(OTP_LENGTH).fill(''))
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    try {
      await authApi.resendOtp(tenantSlug, identifier)
      setResendSecs(60)
      setOtp(Array(OTP_LENGTH).fill(''))
      inputs.current[0]?.focus()
    } catch (err: any) {
      setError(err.message ?? 'Failed to resend')
    }
  }

  const maskedId = identifier.includes('@')
    ? identifier.replace(/(.{2}).+(@.+)/, '$1***$2')
    : identifier.replace(/(\+?\d{3})\d+(\d{3})/, '$1***$2')

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
          style={styles.inner}
        >
          <TouchableOpacity
            style={[styles.back, { backgroundColor: theme.surfaceHigh, borderColor: theme.border }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={theme.text} strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={styles.headerWrap}>
            <Text style={[styles.title, { color: theme.text }]}>Check your{'\n'}messages</Text>
            <Text style={[styles.subtitle, { color: theme.textSub }]}>
              We sent a 6-digit code to{'\n'}
              <Text style={{ color: theme.text, fontFamily: F.semibold }}>{maskedId}</Text>
            </Text>
          </View>

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {otp.map((char, i) => (
              <TextInput
                key={i}
                ref={r => { inputs.current[i] = r }}
                style={[
                  styles.otpBox,
                  { borderColor: theme.inputBorder, backgroundColor: theme.input, color: theme.text },
                  char && { borderColor: theme.text + '50', backgroundColor: theme.surfaceHigh },
                  error ? { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.06)' } : null,
                ]}
                value={char}
                onChangeText={v => handleChange(v, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={i === 0}
              />
            ))}
          </View>

          {error ? (
            <View style={styles.errorWrap}>
              <View style={styles.errorBar} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.cta,
              { backgroundColor: '#5B8EF4' },
              (loading || otp.some(c => !c)) && styles.ctaDisabled,
            ]}
            onPress={() => verify(otp.join(''))}
            activeOpacity={0.82}
            disabled={loading || otp.some(c => !c)}
          >
            <Text style={styles.ctaText}>{loading ? 'Verifying…' : 'Verify Code'}</Text>
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={[styles.resendText, { color: theme.textSub }]}>Didn't receive it? </Text>
            {resendSecs > 0 ? (
              <Text style={[styles.resendTimer, { color: theme.textMuted }]}>Resend in {resendSecs}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResend}>
                <Text style={[styles.resendLink, { color: theme.text }]}>Resend code</Text>
              </TouchableOpacity>
            )}
          </View>
        </MotiView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  kav:   { flex: 1 },
  inner: { flex: 1, padding: 28, justifyContent: 'center', gap: 32 },

  back: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  headerWrap: { gap: 10 },
  title: { fontSize: 32, lineHeight: 40, fontFamily: F.extrabold },
  subtitle: { fontSize: 15, lineHeight: 22, fontFamily: F.regular },

  otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  otpBox: {
    width: 48, height: 56, borderRadius: 13,
    borderWidth: 1.5,
    fontSize: 22, textAlign: 'center', fontFamily: F.bold,
    // Web: remove browser-default <input> inner box
    outlineStyle: 'none',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  } as any,

  errorWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  errorBar:  { width: 3, borderRadius: 2, backgroundColor: '#EF4444', alignSelf: 'stretch' },
  errorText: { fontSize: 13, color: '#EF4444', flex: 1, fontFamily: F.regular },

  cta: {
    height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: F.bold },

  resendRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendText:  { fontSize: 14, fontFamily: F.regular },
  resendTimer: { fontSize: 14, fontFamily: F.regular },
  resendLink:  { fontSize: 14, fontFamily: F.semibold },
})
