import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, UserRound, Phone, Heart, CheckCircle } from 'lucide-react-native'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

const RELATIONS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other']

export default function EmergencyContactScreen() {
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const qc       = useQueryClient()
  const { theme }    = useTheme()
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const accent = branding?.primary_color ?? '#14B946'
  const slug   = branding?.slug ?? ''

  const { data, isLoading } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn:  () => memberApi.getProfile(slug),
    enabled:  !!slug && !!accessToken,
  })

  const existing = data?.member?.emergency_contact

  const [name,     setName]     = useState(existing?.name     ?? '')
  const [phone,    setPhone]    = useState(existing?.phone    ?? '')
  const [relation, setRelation] = useState(existing?.relation ?? '')
  const [saved,    setSaved]    = useState(false)

  // Pre-fill once data loads
  useState(() => {
    if (existing) {
      setName(existing.name ?? '')
      setPhone(existing.phone ?? '')
      setRelation(existing.relation ?? '')
    }
  })

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => memberApi.updateEmergencyContact(slug,
      name.trim() ? { name: name.trim(), phone: phone.trim(), relation: relation.trim() } : null,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-profile', slug] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const canSave = name.trim().length > 0 && phone.trim().length > 0

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Emergency Contact</Text>
      </View>

      {isLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={accent} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        >
          {/* Info banner */}
          <View style={[s.infoBanner, { backgroundColor: accent + '14', borderColor: accent + '30' }]}>
            <Heart size={16} color={accent} strokeWidth={2} />
            <Text style={[s.infoText, { color: accent }]}>
              This contact is shown to gym staff in case of an emergency.
            </Text>
          </View>

          {/* Form card */}
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>

            {/* Name */}
            <View style={s.field}>
              <Text style={[s.label, { color: theme.textSub }]}>FULL NAME</Text>
              <View style={[s.inputRow, { backgroundColor: theme.input, borderColor: theme.inputBorder }]}>
                <UserRound size={16} color={theme.textMuted} />
                <TextInput
                  style={[s.input, { color: theme.text }]}
                  placeholder="e.g. Jane Doe"
                  placeholderTextColor={theme.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Phone */}
            <View style={s.field}>
              <Text style={[s.label, { color: theme.textSub }]}>PHONE NUMBER</Text>
              <View style={[s.inputRow, { backgroundColor: theme.input, borderColor: theme.inputBorder }]}>
                <Phone size={16} color={theme.textMuted} />
                <TextInput
                  style={[s.input, { color: theme.text }]}
                  placeholder="+237 6XX XXX XXX"
                  placeholderTextColor={theme.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Relationship */}
            <View style={s.field}>
              <Text style={[s.label, { color: theme.textSub }]}>RELATIONSHIP</Text>
              <View style={s.chips}>
                {RELATIONS.map(r => {
                  const active = relation === r
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRelation(r)}
                      activeOpacity={0.75}
                      style={[
                        s.chip,
                        {
                          backgroundColor: active ? accent : theme.input,
                          borderColor: active ? accent : theme.border,
                        },
                      ]}
                    >
                      <Text style={[s.chipText, { color: active ? '#FFF' : theme.textSub }]}>{r}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {/* Custom relation input if "Other" selected or no chip matches */}
              {(relation === 'Other' || (relation && !RELATIONS.includes(relation))) && (
                <TextInput
                  style={[s.inputRow, s.input, { backgroundColor: theme.input, borderColor: theme.inputBorder, marginTop: 10, paddingHorizontal: 14, color: theme.text }]}
                  placeholder="Describe relationship"
                  placeholderTextColor={theme.textMuted}
                  value={RELATIONS.includes(relation) ? '' : relation}
                  onChangeText={setRelation}
                  autoCapitalize="words"
                />
              )}
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: saved ? '#22C55E' : accent }, (!canSave || isPending) && { opacity: 0.5 }]}
            onPress={() => save()}
            disabled={!canSave || isPending}
            activeOpacity={0.82}
          >
            {isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : saved ? (
              <>
                <CheckCircle size={18} color="#FFF" strokeWidth={2.5} />
                <Text style={s.saveBtnText}>Saved</Text>
              </>
            ) : (
              <Text style={s.saveBtnText}>Save Contact</Text>
            )}
          </TouchableOpacity>

          {/* Remove */}
          {existing && (
            <TouchableOpacity
              style={s.removeBtn}
              onPress={() => {
                setName(''); setPhone(''); setRelation('')
                memberApi.updateEmergencyContact(slug, null).then(() => {
                  qc.invalidateQueries({ queryKey: ['member-profile', slug] })
                })
              }}
              activeOpacity={0.7}
            >
              <Text style={[s.removeBtnText, { color: theme.textMuted }]}>Remove emergency contact</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: F.bold },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16, gap: 16 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: F.medium, lineHeight: 19 },

  card: {
    borderRadius: 18, borderWidth: 1,
    padding: 16, gap: 20,
  },

  field: { gap: 8 },
  label: { fontSize: 11, fontFamily: F.bold, letterSpacing: 0.8 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 13,
    paddingHorizontal: 14, height: 52,
  },
  input: {
    flex: 1, fontSize: 15, fontFamily: F.regular,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontFamily: F.medium },

  saveBtn: {
    height: 56, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  saveBtnText: { fontSize: 16, fontFamily: F.semibold, color: '#FFF' },

  removeBtn: { alignItems: 'center', paddingVertical: 8 },
  removeBtnText: { fontSize: 13, fontFamily: F.medium },
})
