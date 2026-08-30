import { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MotiView } from 'moti'
import {
  Clock, Users, MapPin, User, Calendar,
  ChevronRight, CheckCircle2, BookOpen,
} from 'lucide-react-native'
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

type ViewMode = 'classes' | 'bookings'

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
  const insets = useSafeAreaInsets()
  const qc     = useQueryClient()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>('classes')

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
      Toast.show({ type: 'success', text1: res.status === 'waitlisted' ? 'Added to waitlist' : 'Class booked!' })
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

  const myBookings = useMemo(
    () => allClasses.filter(c => !!c.my_booking_id),
    [allClasses],
  )
  const filtered = mode === 'bookings'
    ? myBookings
    : (activeDay ? allClasses.filter(c => isSameDay(c.scheduled_at, activeDay)) : allClasses)

  const gradTop    = isDark ? mixColor(accent, false, 0.82) : mixColor(accent, true, 0.88)
  const gradMid    = isDark ? '#0B0B12' : '#FFFFFF'
  const gradBottom = isDark ? mixColor(accent, false, 0.78) : mixColor(accent, true, 0.92)
  const blobColor  = accent + (isDark ? '14' : '10')

  function ClassCard({ item, index }: { item: ClassItem; index: number }) {
    const spotsLeft = item.capacity - parseInt(item.booked_count, 10)
    const isBooked  = !!item.my_booking_id && item.my_booking_status === 'confirmed'
    const isWait    = !!item.my_booking_id && item.my_booking_status === 'waitlisted'
    const isFull    = spotsLeft <= 0 && !isBooked

    return (
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: index * 50 }}
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
          <View style={[
            styles.accentBar,
            { backgroundColor: isBooked ? accent : isFull ? theme.textMuted : accent + '60' },
          ]} />

          <View style={styles.cardBody}>
            {/* Time + badges */}
            <View style={styles.topRow}>
              <View style={[styles.timePill, { backgroundColor: accent + '14', borderColor: accent + '28' }]}>
                <Clock size={11} color={accent} strokeWidth={2} />
                <Text style={[styles.timeText, { color: accent }]}>{fmtTime(item.scheduled_at)}</Text>
                <Text style={[styles.durationText, { color: accent + '80' }]}>· {item.duration_minutes}min</Text>
              </View>
              <View style={styles.badgeRow}>
                {isBooked && (
                  <View style={[styles.badge, { backgroundColor: '#22C55E18', borderColor: '#22C55E40' }]}>
                    <CheckCircle2 size={10} color="#22C55E" strokeWidth={2} />
                    <Text style={[styles.badgeText, { color: '#22C55E' }]}>Booked</Text>
                  </View>
                )}
                {isWait && (
                  <View style={[styles.badge, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B40' }]}>
                    <Text style={[styles.badgeText, { color: '#F59E0B' }]}>Waitlist</Text>
                  </View>
                )}
                {isFull && !isBooked && !isWait && (
                  <View style={[styles.badge, { backgroundColor: '#6B728018', borderColor: '#6B728040' }]}>
                    <Text style={[styles.badgeText, { color: '#6B7280' }]}>Full</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Class name */}
            <Text style={[styles.className, { color: isDark ? '#fff' : '#0D0D18' }]}>
              {item.class_name}
            </Text>

            {/* Meta */}
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
              {mode === 'bookings' && (
                <View style={styles.metaItem}>
                  <Calendar size={11} color={isDark ? 'rgba(255,255,255,0.35)' : '#8C8CA8'} strokeWidth={1.8} />
                  <Text style={[styles.metaText, { color: isDark ? 'rgba(255,255,255,0.45)' : '#8C8CA8' }]}>
                    {fmtDayLabel(item.scheduled_at)}
                  </Text>
                </View>
              )}
            </View>

            {/* Action */}
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
                style={[styles.bookBtn, {
                  backgroundColor: isFull
                    ? (isDark ? 'rgba(255,255,255,0.06)' : '#F4F5F8')
                    : accent,
                }]}
                onPress={() => bookMutation.mutate(item.class_id)}
                disabled={bookMutation.isPending}
                activeOpacity={0.8}
              >
                <Text style={[styles.bookText, {
                  color: isFull ? (isDark ? 'rgba(255,255,255,0.3)' : '#8C8CA8') : '#fff',
                }]}>
                  {isFull ? 'Join waitlist' : 'Book class'}
                </Text>
                {!isFull && <ChevronRight size={15} color="#fff" strokeWidth={2.2} />}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </MotiView>
    )
  }

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

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#0D0D18' }]}>Schedule</Text>
          <Text style={[styles.headerSub, { color: isDark ? 'rgba(255,255,255,0.45)' : accent }]}>
            {mode === 'bookings'
              ? `${myBookings.length} booking${myBookings.length !== 1 ? 's' : ''}`
              : activeDay ? fmtDayLabel(activeDay) : 'Next 14 days'}
          </Text>
        </View>

        {/* Mode toggle */}
        <View style={[styles.modePill, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }]}>
          {(['classes', 'bookings'] as ViewMode[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && { backgroundColor: accent }]}
              onPress={() => setMode(m)}
              activeOpacity={0.75}
            >
              {m === 'bookings'
                ? <BookOpen size={13} color={mode === m ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : '#8C8CA8')} strokeWidth={1.8} />
                : <Calendar  size={13} color={mode === m ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : '#8C8CA8')} strokeWidth={1.8} />
              }
              <Text style={[styles.modeBtnText, {
                color: mode === m ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : '#8C8CA8'),
              }]}>
                {m === 'classes' ? 'Classes' : 'My Bookings'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Day tab strip — only in classes mode */}
      {mode === 'classes' && dayTabs.length > 0 && (
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
                <Text style={[styles.dayTabWeekday, {
                  color: active ? 'rgba(255,255,255,0.75)' : (isDark ? 'rgba(255,255,255,0.4)' : '#8C8CA8'),
                }]}>
                  {fmtDayShort(day)}
                </Text>
                <Text style={[styles.dayTabNum, { color: active ? '#fff' : (isDark ? '#fff' : '#0D0D18') }]}>
                  {fmtDayNum(day)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Content */}
      {isError ? (
        <View style={styles.emptyWrap}>
          <Calendar size={44} color={isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280' }]}>
            Could not load classes
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: accent }]} onPress={refetch} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
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
        <View style={styles.emptyWrap}>
          <Calendar size={44} color={isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280' }]}>
            {mode === 'bookings' ? 'No bookings yet' : 'No classes today'}
          </Text>
          <Text style={[styles.emptySub, { color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF' }]}>
            {mode === 'bookings'
              ? 'Switch to Classes and book a session'
              : 'Check another day or contact your gym'}
          </Text>
          {mode === 'bookings' && (
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: accent }]}
              onPress={() => setMode('classes')}
              activeOpacity={0.85}
            >
              <Text style={styles.retryBtnText}>Browse classes</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
        >
          {filtered.map((item, index) => (
            <ClassCard key={item.class_id} item={item} index={index} />
          ))}
        </ScrollView>
      )}
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

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingBottom: 8, gap: 12,
  },
  headerTitle: { fontSize: 26, fontFamily: F.extrabold },
  headerSub:   { fontSize: 13, fontFamily: F.medium, marginTop: 2 },

  modePill: {
    flexDirection: 'row', borderRadius: 99, borderWidth: 1,
    padding: 3, gap: 2, alignSelf: 'center',
  },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99,
  },
  modeBtnText: { fontSize: 12, fontFamily: F.semibold },

  dayScroll:  { flexGrow: 0 },
  dayContent: { paddingHorizontal: 20, paddingVertical: 10, gap: 10, flexDirection: 'row' },
  dayTab: {
    alignItems: 'center', borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 52,
  },
  dayTabWeekday: { fontSize: 10, fontFamily: F.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayTabNum:     { fontSize: 18, fontFamily: F.extrabold, marginTop: 1 },

  loadingWrap: { padding: 20, gap: 12 },
  skeleton:    { height: 130, borderRadius: 22 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontFamily: F.semibold, textAlign: 'center' },
  emptySub:   { fontSize: 13, fontFamily: F.regular, textAlign: 'center', lineHeight: 19 },
  retryBtn:   { marginTop: 8, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { fontSize: 14, fontFamily: F.bold, color: '#fff' },

  list:    { padding: 16 },
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
    borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
  },
  timeText:     { fontSize: 12, fontFamily: F.extrabold },
  durationText: { fontSize: 11, fontFamily: F.regular },
  badgeRow:     { flexDirection: 'row', gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontFamily: F.semibold },

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
    paddingVertical: 10, borderRadius: 14, borderWidth: 1, alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontFamily: F.semibold, color: '#EF4444' },
})
