import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Delete, CheckCircle, ShieldCheck } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

const PIN_LEN = 4

type Step = 'create' | 'confirm'

function PinDots({ value, accent }: { value: string; accent: string }) {
  return (
    <View style={pd.row}>
      {Array.from({ length: PIN_LEN }).map((_, i) => (
        <View
          key={i}
          style={[
            pd.dot,
            i < value.length
              ? { backgroundColor: accent, borderColor: accent }
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

function NumPad({ onPress, onDelete }: { onPress: (d: string) => void; onDelete: () => void }) {
  const { theme } = useTheme()
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

export default function SetupPinScreen() {
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const qc       = useQueryClient()
  const { theme }    = useTheme()
  const { branding } = useTenant()
  const accent = branding?.primary_color ?? '#14B946'
  const slug   = branding?.slug ?? ''

  const [step,    setStep]    = useState<Step>('create')
  const [pin,     setPin]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(false)

  const shakeAnim = useRef(new Animated.Value(0)).current

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start()
  }

  const active = step === 'create' ? pin : confirm
  const setActive = step === 'create' ? setPin : setConfirm

  function handlePress(digit: string) {
    if (active.length >= PIN_LEN) return
    setError('')
    const next = active + digit
    setActive(next)

    if (next.length === PIN_LEN) {
      if (step === 'create') {
        // move to confirm step
        setTimeout(() => setStep('confirm'), 200)
      } else {
        // compare
        if (next !== pin) {
          shake()
          setError("PINs don't match. Try again.")
          setConfirm('')
        } else {
          submitPin(pin)
        }
      }
    }
  }

  function handleDelete() {
    setError('')
    setActive(v => v.slice(0, -1))
  }

  const { mutate: submitPin, isPending } = useMutation({
    mutationFn: (p: string) => memberApi.setPin(slug, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-profile', slug] })
      setDone(true)
    },
    onError: (err: any) => {
      setError(err.message ?? 'Failed to set PIN')
      setStep('create'); setPin(''); setConfirm('')
    },
  })

  if (done) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        <View style={s.successWrap}>
          <View style={[s.successIcon, { backgroundColor: accent + '18' }]}>
            <ShieldCheck size={48} color={accent} strokeWidth={1.6} />
          </View>
          <Text style={[s.successTitle, { color: theme.text }]}>PIN Set Successfully</Text>
          <Text style={[s.successSub, { color: theme.textSub }]}>
            You can now sign in with your PIN and use it for kiosk check-in.
          </Text>
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: accent }]}
            onPress={() => router.back()}
            activeOpacity={0.82}
          >
            <CheckCircle size={18} color="#FFF" strokeWidth={2.5} />
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Set PIN</Text>
      </View>

      <View style={s.body}>
        {/* Step label */}
        <View style={s.topSection}>
          <Text style={[s.stepTitle, { color: theme.text }]}>
            {step === 'create' ? 'Create a 4-digit PIN' : 'Confirm your PIN'}
          </Text>
          <Text style={[s.stepSub, { color: theme.textSub }]}>
            {step === 'create'
              ? 'Used for quick sign-in and kiosk check-in.'
              : 'Enter the same PIN again to confirm.'}
          </Text>

          {/* Dots */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }], marginTop: 32 }}>
            <PinDots value={active} accent={accent} />
          </Animated.View>

          {error ? (
            <Text style={s.errorText}>{error}</Text>
          ) : null}
        </View>

        {/* Numpad */}
        {isPending ? (
          <ActivityIndicator color={accent} size="large" />
        ) : (
          <NumPad onPress={handlePress} onDelete={handleDelete} />
        )}

        {/* Back to step 1 */}
        {step === 'confirm' && (
          <TouchableOpacity
            onPress={() => { setStep('create'); setPin(''); setConfirm(''); setError('') }}
            activeOpacity={0.7}
            style={s.backToCreate}
          >
            <Text style={[s.backToCreateText, { color: theme.textMuted }]}>Start over</Text>
          </TouchableOpacity>
        )}
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
  stepTitle:  { fontSize: 22, fontFamily: F.bold, textAlign: 'center' },
  stepSub:    { fontSize: 14, fontFamily: F.regular, textAlign: 'center', lineHeight: 21 },

  errorText: { fontSize: 13, fontFamily: F.medium, color: '#EF4444', marginTop: 12 },

  backToCreate: { marginTop: 8 },
  backToCreateText: { fontSize: 13, fontFamily: F.medium },

  // Success state
  successWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 16,
  },
  successIcon: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: { fontSize: 24, fontFamily: F.bold, textAlign: 'center' },
  successSub:   { fontSize: 15, fontFamily: F.regular, textAlign: 'center', lineHeight: 23, color: '#6B7280' },

  doneBtn: {
    marginTop: 16, height: 56, borderRadius: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, alignSelf: 'stretch',
  },
  doneBtnText: { fontSize: 16, fontFamily: F.semibold, color: '#FFF' },
})
