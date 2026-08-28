import { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView, Dimensions,
} from 'react-native'
import { SvgXml } from 'react-native-svg'

const CHECKIN_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M9.94358 1.25L10 1.25C10.4142 1.25 10.75 1.58579 10.75 2C10.75 2.41421 10.4142 2.75 10 2.75C8.09318 2.75 6.73851 2.75159 5.71085 2.88976C4.70476 3.02502 4.12511 3.27869 3.7019 3.7019C3.27869 4.12511 3.02502 4.70476 2.88976 5.71085C2.75159 6.73851 2.75 8.09318 2.75 10C2.75 10.4142 2.41421 10.75 2 10.75C1.58579 10.75 1.25 10.4142 1.25 10L1.25 9.94358C1.24998 8.10582 1.24997 6.65019 1.40314 5.51098C1.56076 4.33856 1.89288 3.38961 2.64124 2.64124C3.38961 1.89288 4.33856 1.56076 5.51098 1.40314C6.65019 1.24997 8.10582 1.24998 9.94358 1.25ZM18.2892 2.88976C17.2615 2.75159 15.9068 2.75 14 2.75C13.5858 2.75 13.25 2.41421 13.25 2C13.25 1.58579 13.5858 1.25 14 1.25L14.0564 1.25C15.8942 1.24998 17.3498 1.24997 18.489 1.40314C19.6614 1.56076 20.6104 1.89288 21.3588 2.64124C22.1071 3.38961 22.4392 4.33856 22.5969 5.51098C22.75 6.65019 22.75 8.10583 22.75 9.94359V10C22.75 10.4142 22.4142 10.75 22 10.75C21.5858 10.75 21.25 10.4142 21.25 10C21.25 8.09318 21.2484 6.73851 21.1102 5.71085C20.975 4.70476 20.7213 4.12511 20.2981 3.7019C19.8749 3.27869 19.2952 3.02502 18.2892 2.88976ZM2 13.25C2.41421 13.25 2.75 13.5858 2.75 14C2.75 15.9068 2.75159 17.2615 2.88976 18.2892C3.02502 19.2952 3.27869 19.8749 3.7019 20.2981C4.12511 20.7213 4.70476 20.975 5.71085 21.1102C6.73851 21.2484 8.09318 21.25 10 21.25C10.4142 21.25 10.75 21.5858 10.75 22C10.75 22.4142 10.4142 22.75 10 22.75H9.94359C8.10583 22.75 6.65019 22.75 5.51098 22.5969C4.33856 22.4392 3.38961 22.1071 2.64124 21.3588C1.89288 20.6104 1.56076 19.6614 1.40314 18.489C1.24997 17.3498 1.24998 15.8942 1.25 14.0564L1.25 14C1.25 13.5858 1.58579 13.25 2 13.25ZM22 13.25C22.4142 13.25 22.75 13.5858 22.75 14V14.0564C22.75 15.8942 22.75 17.3498 22.5969 18.489C22.4392 19.6614 22.1071 20.6104 21.3588 21.3588C20.6104 22.1071 19.6614 22.4392 18.489 22.5969C17.3498 22.75 15.8942 22.75 14.0564 22.75H14C13.5858 22.75 13.25 22.4142 13.25 22C13.25 21.5858 13.5858 21.25 14 21.25C15.9068 21.25 17.2615 21.2484 18.2892 21.1102C19.2952 20.975 19.8749 20.7213 20.2981 20.2981C20.7213 19.8749 20.975 19.2952 21.1102 18.2892C21.2484 17.2615 21.25 15.9068 21.25 14C21.25 13.5858 21.5858 13.25 22 13.25Z" fill="FILL_ACCENT"/>
<path d="M10 5.5H14C15.8856 5.5 16.8284 5.5 17.4142 6.08579C17.9642 6.63575 17.9978 7.5004 17.9999 9.16448L18 12.0167V14.5C18 16.3856 18 17.3284 17.4142 17.9142C16.8284 18.5 15.8856 18.5 14 18.5H10C8.11438 18.5 7.17157 18.5 6.58579 17.9142C6 17.3284 6 16.3856 6 14.5V12.0167L6.00013 9.16449C6.00219 7.5004 6.03582 6.63575 6.58579 6.08579C7.17157 5.5 8.11438 5.5 10 5.5Z" fill="FILL_DARK"/>
<path d="M18.3693 9.29994C18.2513 9.25455 18.1281 9.20929 17.9999 9.16445C16.1667 8.38595 11.2002 7.29605 6.00013 9.16446C5.87187 9.20929 5.74878 9.25456 5.63078 9.29994C4.9385 9.5662 4.42459 9.83556 4.07665 10.0443C3.90273 10.1487 3.77043 10.2378 3.67815 10.3037C3.63202 10.3367 3.59589 10.3638 3.56958 10.3842C3.55642 10.3943 3.54572 10.4028 3.53745 10.4094L3.52685 10.418L3.52291 10.4213L3.52128 10.4226L3.51988 10.4238C3.20167 10.689 3.15868 11.1619 3.42385 11.4801C3.68807 11.7971 4.15855 11.841 4.47672 11.579L4.4871 11.5708C4.49868 11.5619 4.51958 11.546 4.55001 11.5243C4.61086 11.4808 4.7098 11.4137 4.84839 11.3306C5.12545 11.1643 5.56153 10.9337 6.16925 10.7C7.38288 10.2332 9.29159 9.74995 12 9.74995C14.7085 9.74995 16.6172 10.2332 17.8308 10.7C18.4385 10.9337 18.8746 11.1643 19.1516 11.3306C19.2902 11.4137 19.3892 11.4808 19.45 11.5243C19.4805 11.546 19.5014 11.5619 19.5129 11.5708L19.5233 11.579C19.8415 11.841 20.312 11.7971 20.5762 11.4801C20.8414 11.1619 20.7984 10.689 20.4802 10.4238L20 10.9999C20.4802 10.4238 20.4788 10.4226 20.4788 10.4226L20.4771 10.4213L20.4732 10.418L20.4626 10.4094C20.4543 10.4028 20.4436 10.3943 20.4305 10.3842C20.4041 10.3638 20.368 10.3367 20.3219 10.3037C20.2296 10.2378 20.0973 10.1487 19.9234 10.0443C19.5755 9.83556 19.0615 9.5662 18.3693 9.29994Z" fill="FILL_ACCENT"/>
</svg>`

function CheckinIcon({ size = 80 }: { size?: number; color?: string }) {
  const { branding } = useTenant()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const xml = useMemo(
    () => CHECKIN_ICON_SVG.replace(/FILL_DARK/g, '#1C274C').replace(/FILL_ACCENT/g, accent),
    [accent],
  )
  return <SvgXml xml={xml} width={size} height={size} />
}
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { FlashList } from '@shopify/flash-list'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MotiView } from 'moti'
import { Clock, Users, MapPin, User, Calendar, ChevronRight } from 'lucide-react-native'
import { Badge } from '../../src/components/ui/Badge'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'
import Toast from 'react-native-toast-message'

const { width, height } = Dimensions.get('window')

type ClassItem = {
  class_id: string; scheduled_at: string; ends_at: string
  class_name: string; duration_minutes: number
  trainer_name: string | null; room: string | null
  capacity: number; booked_count: string
  my_booking_id: string | null; my_booking_status: string | null
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtDayLabel(iso: string) {
  const d = new Date(iso)
  const today    = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString())    return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtDayShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short' })
}
function fmtDayNum(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric' })
}
function isSameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear()
      && da.getMonth()    === db.getMonth()
      && da.getDate()     === db.getDate()
}
function getDayTabs(classes: ClassItem[]) {
  const seen = new Set<string>(); const days: string[] = []
  for (const c of classes) {
    const key = new Date(c.scheduled_at).toDateString()
    if (!seen.has(key)) { seen.add(key); days.push(c.scheduled_at) }
  }
  return days
}
function mixColor(hex: string, withWhite: boolean, amount: number): string {
  const h    = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n    = parseInt(full, 16)
  const r0 = (n >> 16) & 0xff; const g0 = (n >> 8) & 0xff; const b0 = n & 0xff
  const t  = withWhite ? 255 : 0
  const r  = Math.round(r0 + (t - r0) * amount)
  const g  = Math.round(g0 + (t - g0) * amount)
  const b  = Math.round(b0 + (t - b0) * amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export default function ScheduleScreen() {
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme, isDark } = useTheme()
  const qc     = useQueryClient()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['member-classes', slug],
    queryFn:  () => memberApi.getClasses(slug, 14),
    enabled:  !!slug && !!accessToken,
  })

  const allClasses = data?.classes ?? []
  if (!selectedDay && allClasses.length > 0) setSelectedDay(allClasses[0].scheduled_at)

  const bookMutation = useMutation({
    mutationFn: (classId: string) => memberApi.bookClass(slug, classId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['member-classes', slug] })
      Toast.show({ type: 'success', text1: res.status === 'waitlisted' ? 'Added to waitlist' : 'Booked!' })
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Booking failed', text2: err.message }),
  })

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => memberApi.cancelBooking(slug, bookingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-classes', slug] })
      Toast.show({ type: 'success', text1: 'Booking cancelled' })
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Cancel failed', text2: err.message }),
  })

  const dayTabs   = getDayTabs(allClasses)
  const activeDay = selectedDay ?? dayTabs[0]
  const filtered  = activeDay ? allClasses.filter(c => isSameDay(c.scheduled_at, activeDay)) : allClasses

  const gradTop    = isDark ? mixColor(accent, false, 0.82) : mixColor(accent, true, 0.88)
  const gradMid    = isDark ? '#0B0B12' : '#FFFFFF'
  const gradBottom = isDark ? mixColor(accent, false, 0.78) : mixColor(accent, true, 0.92)
  const blobColor  = accent + (isDark ? '14' : '10')

  return (
    <LinearGradient
      colors={[gradTop, gradMid, gradBottom]}
      locations={[0, 0.45, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      {/* Decorative blobs */}
      <View style={[styles.blob1, { backgroundColor: blobColor }]} />
      <View style={[styles.blob2, { backgroundColor: blobColor }]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#0D0D18' }]}>
              Schedule
            </Text>
            <Text style={[styles.headerSub, { color: isDark ? 'rgba(255,255,255,0.45)' : accent }]}>
              {activeDay ? fmtDayLabel(activeDay) : 'Next 14 days'}
            </Text>
          </View>
        </View>

        {/* Day tab strip */}
        {dayTabs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayScroll}
            contentContainerStyle={styles.dayContent}
          >
            {dayTabs.map(day => {
              const active = isSameDay(day, activeDay ?? '')
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayTab,
                    active
                      ? { backgroundColor: accent, borderColor: accent }
                      : {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : accent + '28',
                        },
                  ]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.dayTabWeekday,
                    { color: active ? 'rgba(255,255,255,0.75)' : (isDark ? 'rgba(255,255,255,0.4)' : '#8C8CA8') },
                  ]}>
                    {fmtDayShort(day)}
                  </Text>
                  <Text style={[
                    styles.dayTabNum,
                    { color: active ? '#fff' : (isDark ? '#fff' : '#0D0D18') },
                  ]}>
                    {fmtDayNum(day)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}

        {/* Content */}
        {isError ? (
          <EmptyState
            icon={CheckinIcon}
            title="Could not load classes"
            subtitle="Check your connection and try again."
            action={{ label: 'Try again', onPress: refetch }}
            iconColor="#EF4444"
          />
        ) : isLoading ? (
          <View style={styles.loadingWrap}>
            {[1, 2, 3].map(i => (
              <MotiView key={i}
                from={{ opacity: 0.3 }} animate={{ opacity: 1 }}
                transition={{ loop: true, type: 'timing', duration: 800, delay: i * 100 }}
                style={[styles.skeleton, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)',
                }]}
              />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckinIcon}
            title="No classes today"
            subtitle="Check another day or contact your gym to see the schedule."
          />
        ) : (
          <FlashList<ClassItem>
            data={filtered}
            keyExtractor={item => item.class_id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />
            }
            renderItem={({ item, index }) => {
              const spotsLeft = item.capacity - parseInt(item.booked_count, 10)
              const isBooked  = !!item.my_booking_id && item.my_booking_status === 'confirmed'
              const isWait    = !!item.my_booking_id && item.my_booking_status === 'waitlisted'
              const isFull    = spotsLeft <= 0 && !isBooked

              return (
                <MotiView
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 320, delay: index * 55 }}
                  style={styles.cardWrap}
                >
                  <View style={[
                    styles.card,
                    {
                      backgroundColor: isDark ? '#16161F' : '#FFFFFF',
                      borderColor: isBooked
                        ? accent + '40'
                        : isDark ? 'rgba(255,255,255,0.06)' : accent + '18',
                      shadowColor: isDark ? '#000' : accent,
                    },
                  ]}>
                    {/* Left accent bar — thicker when booked */}
                    <View style={[
                      styles.accentBar,
                      { backgroundColor: isBooked ? accent : isFull ? theme.textMuted : accent + '60' },
                    ]} />

                    <View style={styles.cardBody}>
                      {/* Time + badges row */}
                      <View style={styles.topRow}>
                        <View style={[styles.timePill, { backgroundColor: accent + '14', borderColor: accent + '28' }]}>
                          <Clock size={11} color={accent} strokeWidth={2} />
                          <Text style={[styles.timeText, { color: accent }]}>
                            {fmtTime(item.scheduled_at)}
                          </Text>
                          <Text style={[styles.durationText, { color: accent + '80' }]}>
                            · {item.duration_minutes}min
                          </Text>
                        </View>
                        <View style={styles.badgeRow}>
                          {isBooked && <Badge label="Booked" variant="success" size="sm" />}
                          {isWait   && <Badge label="Waitlist" variant="warning" size="sm" />}
                          {isFull && !isBooked && !isWait &&
                            <Badge label="Full" variant="neutral" size="sm" />
                          }
                        </View>
                      </View>

                      {/* Class name */}
                      <Text style={[styles.className, { color: isDark ? '#fff' : '#0D0D18' }]}>
                        {item.class_name}
                      </Text>

                      {/* Meta info */}
                      <View style={styles.metaRow}>
                        {item.trainer_name && (
                          <View style={styles.metaItem}>
                            <User size={11} color={isDark ? 'rgba(255,255,255,0.35)' : '#8C8CA8'} strokeWidth={1.8} />
                            <Text style={[styles.metaText, { color: isDark ? 'rgba(255,255,255,0.45)' : '#8C8CA8' }]}>
                              {item.trainer_name}
                            </Text>
                          </View>
                        )}
                        {item.room && (
                          <View style={styles.metaItem}>
                            <MapPin size={11} color={isDark ? 'rgba(255,255,255,0.35)' : '#8C8CA8'} strokeWidth={1.8} />
                            <Text style={[styles.metaText, { color: isDark ? 'rgba(255,255,255,0.45)' : '#8C8CA8' }]}>
                              {item.room}
                            </Text>
                          </View>
                        )}
                        <View style={styles.metaItem}>
                          <Users size={11} color={isFull ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.35)' : '#8C8CA8')} strokeWidth={1.8} />
                          <Text style={[styles.metaText, {
                            color: isFull ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.45)' : '#8C8CA8'),
                          }]}>
                            {isFull ? 'Class full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                          </Text>
                        </View>
                      </View>

                      {/* Action button */}
                      {isBooked ? (
                        <TouchableOpacity
                          style={[styles.cancelBtn, { borderColor: '#EF444430', backgroundColor: '#EF444408' }]}
                          onPress={() => cancelMutation.mutate(item.my_booking_id!)}
                          disabled={cancelMutation.isPending}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.cancelText}>Cancel booking</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.bookBtn,
                            {
                              backgroundColor: isFull
                                ? (isDark ? 'rgba(255,255,255,0.06)' : '#F4F5F8')
                                : accent,
                            },
                          ]}
                          onPress={() => bookMutation.mutate(item.class_id)}
                          disabled={bookMutation.isPending}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.bookText, {
                            color: isFull ? (isDark ? 'rgba(255,255,255,0.3)' : '#8C8CA8') : '#fff',
                          }]}>
                            {isFull ? 'Join waitlist' : 'Book class'}
                          </Text>
                          {!isFull && (
                            <ChevronRight size={15} color="#fff" strokeWidth={2.2} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </MotiView>
              )
            }}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  blob1: {
    position: 'absolute',
    width: height * 0.65, height: height * 0.65,
    borderRadius: height * 0.325,
    top: -height * 0.22, left: -width * 0.32,
  },
  blob2: {
    position: 'absolute',
    width: height * 0.45, height: height * 0.45,
    borderRadius: height * 0.225,
    bottom: -height * 0.14, right: -width * 0.28,
  },

  safe: { flex: 1 },

  header: {
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontFamily: F.extrabold },
  headerSub:   { fontSize: 13, fontFamily: F.medium, marginTop: 2 },

  dayScroll:  { flexGrow: 0 },
  dayContent: {
    paddingHorizontal: 20, paddingVertical: 12,
    gap: 10, flexDirection: 'row',
  },
  dayTab: {
    alignItems: 'center', borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 52,
  },
  dayTabWeekday: { fontSize: 10, fontFamily: F.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayTabNum:     { fontSize: 18, fontFamily: F.extrabold, marginTop: 1 },

  loadingWrap: { padding: 20, gap: 12 },
  skeleton:    { height: 130, borderRadius: 22 },

  list: { padding: 16, paddingBottom: 120 },

  cardWrap: { marginBottom: 12 },
  card: {
    flexDirection: 'row', borderRadius: 22, borderWidth: 1, overflow: 'hidden',
    shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  accentBar: { width: 5 },
  cardBody:  { flex: 1, padding: 14, gap: 10 },

  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 99, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  timeText:     { fontSize: 12, fontFamily: F.extrabold },
  durationText: { fontSize: 11, fontFamily: F.regular },
  badgeRow:     { flexDirection: 'row', gap: 6 },

  className: { fontSize: 17, fontFamily: F.extrabold, lineHeight: 22 },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontFamily: F.regular },

  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 11, borderRadius: 14,
  },
  bookText: { fontSize: 14, fontFamily: F.bold },

  cancelBtn: {
    paddingVertical: 10, borderRadius: 14, borderWidth: 1,
    alignItems: 'center',
  },
})
 