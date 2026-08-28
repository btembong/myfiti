import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, Modal,
  TouchableWithoutFeedback,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Camera, ChevronDown, Check } from 'lucide-react-native'
import { DiceBearAvatar } from '../src/components/ui/DiceBearAvatar'
import { AvatarPicker } from '../src/components/ui/AvatarPicker'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']

// ─── Gender picker bottom sheet ───────────────────────────────────────────────

function GenderPicker({
  visible, value, onSelect, onClose, accent,
}: {
  visible: boolean; value: string
  onSelect: (g: string) => void; onClose: () => void; accent: string
}) {
  const { theme } = useTheme()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={picker.backdrop} />
      </TouchableWithoutFeedback>
      <View style={[picker.sheet, { backgroundColor: theme.surface }]}>
        <View style={[picker.handle, { backgroundColor: theme.border }]} />
        <Text style={[picker.title, { color: theme.text }]}>Select Gender</Text>
        {GENDERS.map(g => (
          <TouchableOpacity
            key={g}
            style={[picker.option, { borderBottomColor: theme.borderSub }]}
            onPress={() => { onSelect(g); onClose() }}
            activeOpacity={0.7}
          >
            <Text style={[picker.optionText, { color: theme.text }]}>{g}</Text>
            {value === g && <Check size={18} color={accent} strokeWidth={2.5} />}
          </TouchableOpacity>
        ))}
        <View style={{ height: 20 }} />
      </View>
    </Modal>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router = useRouter()
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme } = useTheme()
  const qc = useQueryClient()
  const accent = branding?.primary_color ?? '#22C55E'
  const slug   = branding?.slug ?? ''

  const { data } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn:  () => memberApi.getProfile(slug),
    enabled:  !!slug && !!accessToken,
  })

  const profile = data?.member

  const [phone,  setPhone]  = useState('')
  const [gender, setGender] = useState(GENDERS[0])
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false)
  const [genderPickerVisible, setGenderPickerVisible] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) setPhone(profile.phone ?? '')
  }, [profile])

  const avatarSeed = String(profile?.name ?? profile?.id ?? 'member')

  const mutation = useMutation({
    mutationFn: () => memberApi.updateProfile(slug, { phone: phone.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-profile', slug] })
      if (Platform.OS === 'web') {
        alert('Profile updated.')
      } else {
        Alert.alert('Saved', 'Your profile has been updated.')
      }
      router.back()
    },
    onError: (err: any) => setError(err.message ?? 'Update failed'),
  })

  function handleSave() {
    setError('')
    if (!phone.trim()) { setError('Phone number is required'); return }
    mutation.mutate()
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Drag handle */}
        <View style={styles.dragHandleWrap}>
          <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: theme.surfaceHigh }]}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <X size={18} color={theme.text} strokeWidth={2.2} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
            </View>

            <Text style={[styles.subtitle, { color: theme.textSub }]}>
              Keep your personal details up to date.
            </Text>

            {/* Avatar */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarWrap}
                onPress={() => setAvatarPickerVisible(true)}
                activeOpacity={0.85}
              >
                <DiceBearAvatar seed={avatarSeed} size={96} photoUrl={profile?.avatar_url} />
                <View style={[styles.cameraBtn, { backgroundColor: accent }]}>
                  <Camera size={16} color="#fff" strokeWidth={2} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAvatarPickerVisible(true)} activeOpacity={0.7}>
                <Text style={[styles.changePhotoText, { color: accent }]}>Change profile photo</Text>
              </TouchableOpacity>
            </View>

            <AvatarPicker
              visible={avatarPickerVisible}
              onClose={() => setAvatarPickerVisible(false)}
              seed={avatarSeed}
              accent={accent}
            />

            {/* Form */}
            <View style={styles.form}>

              {/* Full Name — read-only */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
                <View style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.surfaceHigh }]}>
                  <Text style={[styles.readonlyText, { color: theme.textSub }]}>
                    {profile?.name || '—'}
                  </Text>
                </View>
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  Contact your gym to change your name
                </Text>
              </View>

              {/* Phone */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, { color: theme.text }]}>Phone Number</Text>
                <View style={[styles.inputBox, { borderColor: theme.inputBorder, backgroundColor: theme.input }]}>
                  <TextInput
                    style={[styles.textInput, { color: theme.text }]}
                    value={phone}
                    onChangeText={t => { setPhone(t); setError('') }}
                    keyboardType="phone-pad"
                    placeholder="+237 6XX XXX XXX"
                    placeholderTextColor={theme.textMuted}
                    returnKeyType="done"
                  />
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>

              {/* Email — read-only */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
                <View style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.surfaceHigh }]}>
                  <Text style={[styles.readonlyText, { color: theme.textSub }]}>
                    {profile?.email || '—'}
                  </Text>
                </View>
              </View>

              {/* Gender + DOB */}
              <View style={styles.halfRow}>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={[styles.label, { color: theme.text }]}>Gender</Text>
                  <TouchableOpacity
                    style={[styles.inputBox, styles.selectBox, { borderColor: theme.inputBorder, backgroundColor: theme.input }]}
                    onPress={() => setGenderPickerVisible(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.selectText, { color: theme.text }]}>{gender}</Text>
                    <ChevronDown size={16} color={theme.textMuted} strokeWidth={1.8} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={[styles.label, { color: theme.text }]}>Date of Birth</Text>
                  <View style={[styles.inputBox, styles.selectBox, { borderColor: theme.border, backgroundColor: theme.surfaceHigh }]}>
                    <Text style={[styles.readonlyText, { color: theme.textSub, flex: 1 }]}>—</Text>
                    <ChevronDown size={16} color={theme.textMuted} strokeWidth={1.8} />
                  </View>
                </View>
              </View>

            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: accent }, mutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={mutation.isPending}
            >
              <Text style={styles.saveBtnText}>
                {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 16 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <GenderPicker
        visible={genderPickerVisible}
        value={gender}
        onSelect={setGender}
        onClose={() => setGenderPickerVisible(false)}
        accent={accent}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  dragHandleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  dragHandle:     { width: 40, height: 4, borderRadius: 2 },

  scroll: { padding: 24, gap: 20 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontFamily: F.extrabold },
  subtitle:    { fontSize: 14, fontFamily: F.regular, lineHeight: 20, marginTop: -8 },

  avatarSection:   { alignItems: 'center', gap: 10 },
  avatarWrap:      { position: 'relative' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
  },
  changePhotoText: { fontSize: 14, fontFamily: F.semibold },

  form:      { gap: 16 },
  fieldWrap: { gap: 8 },
  label:     { fontSize: 14, fontFamily: F.medium },

  inputBox: {
    height: 56, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  selectBox: { flexDirection: 'row', alignItems: 'center' },

  readonlyText: { fontSize: 15, fontFamily: F.regular },
  selectText:   { fontSize: 15, fontFamily: F.regular, flex: 1 },
  textInput: {
    flex: 1, fontSize: 15, fontFamily: F.regular,
    outlineStyle: 'none' as any,
    borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0,
  },
  hint:      { fontSize: 12, fontFamily: F.regular },
  errorText: { fontSize: 12, color: '#EF4444', fontFamily: F.regular },
  halfRow:   { flexDirection: 'row', gap: 12 },

  saveBtn: {
    height: 56, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { fontSize: 16, fontFamily: F.bold, color: '#fff' },
})

const picker = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 24,
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowRadius: 20, elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:  { fontSize: 17, fontFamily: F.bold, marginBottom: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { fontSize: 16, fontFamily: F.regular },
})
