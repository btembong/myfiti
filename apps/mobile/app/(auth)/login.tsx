'use client'
import { useState } from 'react'
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, TextInput, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { MotiView } from 'moti'
import { Building2, Phone, Fingerprint } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { authApi } from '../../src/lib/api'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'

export default function LoginScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const { biometricEnabled, biometricLogin } = useAuth()
  const [gymSlug, setGymSlug]       = useState('')
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading]       = useState(false)
  const [bioLoading, setBioLoading] = useState(false)
  const [error, setError]           = useState('')
  const [focused, setFocused]       = useState<'slug' | 'id' | null>(null)

  async function handleBiometricLogin() {
    setBioLoading(true)
    setError('')
    try {
      const ok = await biometricLogin()
      if (!ok) setError('Biometric verification failed.')
    } catch {
      setError('Biometric login failed. Please log in with OTP.')
    } finally {
      setBioLoading(false)
    }
  }

  async function handleContinue() {
    const slug = gymSlug.trim().toLowerCase().replace(/\s+/g, '-')
    const id   = identifier.trim()
    if (!slug) { setError('Enter your gym code'); return }
    if (!id)   { setError('Enter your phone or email'); return }
    setError(''); setLoading(true)
    try {
      await authApi.requestOtp(slug, id)
      router.push({ pathname: '/(auth)/otp', params: { tenantSlug: slug, identifier: id } })
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const borderFocused = (field: 'slug' | 'id') =>
    focused === field ? theme.text : theme.inputBorder

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, translateY: 24 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 480 }}
            style={styles.inner}
          >
            {/* Logo mark */}
            <View style={styles.logoRow}>
              <LinearGradient
                colors={['#5B8EF4', '#7C6FF7']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.logoMark}
              >
                <Text style={styles.logoText}>M</Text>
              </LinearGradient>
              <Text style={[styles.appName, { color: theme.text }]}>myfiti</Text>
              <View style={[styles.memberChip, { backgroundColor: theme.surfaceHigh, borderColor: theme.border }]}>
                <Text style={[styles.memberChipText, { color: theme.textSub }]}>Member</Text>
              </View>
            </View>

            {/* Headline */}
            <View style={styles.headlineWrap}>
              <Text style={[styles.headline, { color: theme.text }]}>
                Your gym,{'\n'}in your pocket.
              </Text>
              <Text style={[styles.headlineSub, { color: theme.textSub }]}>
                Sign in to access your membership, QR check-in code, and class schedule.
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Gym code */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, { color: theme.textSub }]}>GYM CODE</Text>
                <View style={[styles.inputRow, { backgroundColor: theme.input, borderColor: borderFocused('slug') }]}>
                  <Building2 size={16} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="e.g. crossfit-lagos"
                    placeholderTextColor={theme.textMuted}
                    value={gymSlug}
                    onChangeText={t => { setGymSlug(t); setError('') }}
                    autoCapitalize="none"
                    returnKeyType="next"
                    onFocus={() => setFocused('slug')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
                <Text style={[styles.hint, { color: theme.textMuted }]}>Ask your gym for their code</Text>
              </View>

              {/* Phone / email */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, { color: theme.textSub }]}>PHONE OR EMAIL</Text>
                <View style={[styles.inputRow, { backgroundColor: theme.input, borderColor: borderFocused('id') }]}>
                  <Phone size={16} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="+237 6XX XXX XXX"
                    placeholderTextColor={theme.textMuted}
                    value={identifier}
                    onChangeText={t => { setIdentifier(t); setError('') }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleContinue}
                    onFocus={() => setFocused('id')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              </View>

              {error ? (
                <View style={styles.errorWrap}>
                  <View style={styles.errorBar} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.cta, { backgroundColor: '#5B8EF4' }, loading && styles.ctaDisabled]}
                onPress={handleContinue}
                activeOpacity={0.82}
                disabled={loading}
              >
                <Text style={styles.ctaText}>{loading ? 'Sending code…' : 'Send Verification Code'}</Text>
              </TouchableOpacity>

              {biometricEnabled && (
                <TouchableOpacity
                  style={[styles.biometricBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  onPress={handleBiometricLogin}
                  activeOpacity={0.8}
                  disabled={bioLoading}
                >
                  <Fingerprint size={20} color={theme.textSub} strokeWidth={1.8} />
                  <Text style={[styles.biometricText, { color: theme.textSub }]}>
                    {bioLoading ? 'Verifying…' : 'Use Biometrics'}
                  </Text>
                </TouchableOpacity>
              )}

              {gymSlug.trim() && identifier.trim() && (
                <TouchableOpacity
                  style={[styles.biometricBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  onPress={() => router.push({
                    pathname: '/(auth)/pin-login',
                    params: { tenantSlug: gymSlug.trim().toLowerCase().replace(/\s+/g, '-'), identifier: identifier.trim() },
                  })}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.biometricText, { color: theme.textSub }]}>Use PIN instead</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.footer, { color: theme.textMuted }]}>
              No account?{' '}
              <Text style={{ color: theme.textSub, fontFamily: F.semibold }}>
                Contact your gym to get added.
              </Text>
            </Text>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  kav:    { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingVertical: 56 },
  inner:  { gap: 32 },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 18, fontWeight: '800', fontFamily: F.extrabold },
  appName:  { fontSize: 17, fontWeight: '700', fontFamily: F.bold },
  memberChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  memberChipText: { fontSize: 11, fontWeight: '600', fontFamily: F.semibold },

  headlineWrap: { gap: 12 },
  headline: {
    fontSize: 34, lineHeight: 42, fontFamily: F.extrabold,
  },
  headlineSub: {
    fontSize: 15, lineHeight: 23, fontFamily: F.regular, maxWidth: 320,
  },

  form:      { gap: 18 },
  fieldWrap: { gap: 7 },
  label: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.9, fontFamily: F.bold,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 13,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, fontSize: 15, fontFamily: F.regular,
    // Web: remove browser-default <input> box appearance
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  } as any,
  hint: { fontSize: 12, fontFamily: F.regular },

  errorWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  errorBar:  { width: 3, borderRadius: 2, backgroundColor: '#EF4444', alignSelf: 'stretch' },
  errorText: { fontSize: 13, color: '#EF4444', flex: 1, fontFamily: F.regular },

  cta: {
    height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: F.bold },

  footer:       { fontSize: 13, textAlign: 'center', fontFamily: F.regular },

  biometricBtn: {
    height: 52, borderRadius: 14, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  biometricText: { fontSize: 15, fontFamily: F.medium },
})
