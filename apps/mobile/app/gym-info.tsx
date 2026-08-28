import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, Image,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { MotiView } from 'moti'
import { Phone, Mail, MapPin, Clock, Globe, Instagram, Facebook, ExternalLink } from 'lucide-react-native'
import { Screen } from '../src/components/ui/Screen'
import { AppHeader } from '../src/components/ui/AppHeader'
import { Card } from '../src/components/ui/Card'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

function ContactRow({
  icon: Icon, label, value, onPress, color,
}: {
  icon: any; label: string; value: string; onPress?: () => void; color: string
}) {
  const { theme } = useTheme()
  return (
    <TouchableOpacity
      style={[styles.contactRow, { borderBottomColor: theme.borderSub }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={[styles.contactIcon, { backgroundColor: color + '14' }]}>
        <Icon size={17} color={color} strokeWidth={1.8} />
      </View>
      <View style={styles.contactBody}>
        <Text style={[styles.contactLabel, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[styles.contactValue, { color: onPress ? color : theme.text }]}>{value}</Text>
      </View>
      {onPress && <ExternalLink size={14} color={theme.textMuted} strokeWidth={1.8} />}
    </TouchableOpacity>
  )
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function GymInfoScreen() {
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme } = useTheme()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''

  const { data, isLoading } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn: () => memberApi.getProfile(slug),
    enabled: !!slug && !!accessToken,
  })

  const gym    = data?.gym
  const gymAny = gym as any

  // Parse opening hours — expected as an object or stringified JSON
  let hours: Record<string, string> = {}
  try {
    if (gymAny?.opening_hours) {
      hours = typeof gymAny.opening_hours === 'string'
        ? JSON.parse(gymAny.opening_hours)
        : gymAny.opening_hours
    }
  } catch {}

  const todayKey = DAYS[(new Date().getDay() + 6) % 7]

  function open(url: string) {
    Linking.openURL(url).catch(() => Alert.alert('Cannot open', 'Unable to open this link.'))
  }

  return (
    <Screen>
      <AppHeader title="Gym Info" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <MotiView
            from={{ opacity: 0.4 }} animate={{ opacity: 1 }}
            transition={{ loop: true, type: 'timing', duration: 900 }}
            style={[styles.skeleton, { backgroundColor: theme.skeleton }]}
          />
        ) : (
          <>
            {/* Gym hero */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 360 }}>
              <Card padding={20} style={styles.heroCard}>
                <View style={styles.heroRow}>
                  {gym?.logo_url ? (
                    <Image source={{ uri: gym.logo_url }} style={styles.logo} resizeMode="contain" />
                  ) : (
                    <View style={[styles.logoFallback, { backgroundColor: accent + '20' }]}>
                      <Text style={[styles.logoInitials, { color: accent }]}>
                        {(gym?.name ?? 'G').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.heroInfo}>
                    <Text style={[styles.gymName, { color: theme.text }]}>{gym?.name ?? branding?.name}</Text>
                    <Text style={[styles.gymTagline, { color: theme.textSub }]}>
                      {gymAny?.tagline ?? 'Your fitness community'}
                    </Text>
                  </View>
                </View>
              </Card>
            </MotiView>

            {/* Contact */}
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 360, delay: 80 }}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>CONTACT</Text>
              <Card padding={0}>
                {gymAny?.phone && (
                  <ContactRow
                    icon={Phone} label="Phone" value={gymAny.phone} color="#22C55E"
                    onPress={() => open(`tel:${gymAny.phone}`)}
                  />
                )}
                {gymAny?.email && (
                  <ContactRow
                    icon={Mail} label="Email" value={gymAny.email} color="#3B82F6"
                    onPress={() => open(`mailto:${gymAny.email}`)}
                  />
                )}
                {gymAny?.address && (
                  <ContactRow
                    icon={MapPin} label="Address" value={gymAny.address} color={accent}
                    onPress={() => open(`https://maps.google.com/?q=${encodeURIComponent(gymAny.address)}`)}
                  />
                )}
                {gymAny?.website && (
                  <ContactRow
                    icon={Globe} label="Website" value={gymAny.website} color="#8B5CF6"
                    onPress={() => open(gymAny.website.startsWith('http') ? gymAny.website : `https://${gymAny.website}`)}
                  />
                )}
                {!gymAny?.phone && !gymAny?.email && !gymAny?.address && (
                  <View style={styles.emptyContact}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                      Contact details not available
                    </Text>
                  </View>
                )}
              </Card>
            </MotiView>

            {/* Social */}
            {(gymAny?.instagram || gymAny?.facebook) && (
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 360, delay: 140 }}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>SOCIAL</Text>
                <Card padding={0}>
                  {gymAny?.instagram && (
                    <ContactRow
                      icon={Instagram} label="Instagram" value={`@${gymAny.instagram}`} color='#E1306C'
                      onPress={() => open(`https://instagram.com/${gymAny.instagram}`)}
                    />
                  )}
                  {gymAny?.facebook && (
                    <ContactRow
                      icon={Facebook} label="Facebook" value={gymAny.facebook} color='#1877F2'
                      onPress={() => open(`https://facebook.com/${gymAny.facebook}`)}
                    />
                  )}
                </Card>
              </MotiView>
            )}

            {/* Opening hours */}
            {Object.keys(hours).length > 0 && (
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 360, delay: 200 }}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>OPENING HOURS</Text>
                <Card padding={16} style={styles.hoursCard}>
                  {DAYS.map(day => {
                    const time = hours[day] ?? hours[day.toLowerCase()] ?? 'Closed'
                    const isToday = day === todayKey
                    return (
                      <View key={day} style={[styles.hourRow, isToday && { backgroundColor: accent + '0C' }]}>
                        <Text style={[
                          styles.dayText,
                          { color: isToday ? accent : theme.textSub },
                          isToday && { fontFamily: F.bold },
                        ]}>
                          {day}
                        </Text>
                        <Text style={[
                          styles.timeText,
                          { color: isToday ? accent : theme.text },
                          isToday && { fontFamily: F.bold },
                        ]}>
                          {time}
                        </Text>
                        {isToday && (
                          <View style={[styles.todayDot, { backgroundColor: accent }]} />
                        )}
                      </View>
                    )
                  })}
                </Card>
              </MotiView>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  skeleton:{ height: 160, borderRadius: 18 },

  heroCard: { gap: 12 },
  heroRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo:     { width: 60, height: 60, borderRadius: 16 },
  logoFallback: { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoInitials: { fontSize: 22, fontFamily: F.extrabold },
  heroInfo: { flex: 1, gap: 3 },
  gymName:  { fontSize: 20, fontFamily: F.extrabold },
  gymTagline:{ fontSize: 14, fontFamily: F.regular },

  sectionTitle: {
    fontSize: 11, fontFamily: F.bold, letterSpacing: 0.9,
    textTransform: 'uppercase', marginBottom: 8,
  },

  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  contactIcon:  { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  contactBody:  { flex: 1, gap: 2 },
  contactLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.6, textTransform: 'uppercase' },
  contactValue: { fontSize: 14, fontFamily: F.medium },

  emptyContact: { padding: 20, alignItems: 'center' },
  emptyText:    { fontSize: 14, fontFamily: F.regular },

  hoursCard: { gap: 2 },
  hourRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8,
    position: 'relative',
  },
  dayText:  { flex: 1, fontSize: 14, fontFamily: F.regular },
  timeText: { fontSize: 14, fontFamily: F.medium },
  todayDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 8 },
})
