import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { MotiView } from 'moti'
import Svg, {
  Path, Rect, Polyline,
  Defs, LinearGradient as SvgGrad, Stop,
} from 'react-native-svg'
import { Bell, Plus, Flame, Zap, Target, Award } from 'lucide-react-native'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { DiceBearAvatar } from '../../src/components/ui/DiceBearAvatar'
import { F } from '../../src/theme'

const { width: W } = Dimensions.get('window')
const HERO_W   = W - 48       // card width in carousel
const HERO_GAP = 12
const COL_W    = (W - 20 * 2 - 12) / 2   // 2-col grid, 20px side padding, 12px gap

// ── Mock health data ──────────────────────────────────────────────────────────
// Swap these out for expo-health calls once on a dev build
function useHealthData() {
  return {
    steps:        8_240,
    calories:     412,
    heartRate:    72,
    stepsHistory: [4_200, 6_800, 9_100, 5_300, 7_600, 8_900, 8_240],
    calHistory:   [280, 450, 380, 510, 290, 620, 412],
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekBars(checkins: Array<{ checked_in_at: string }>) {
  const days: Record<string, number> = {}
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    days[d.toDateString()] = 0
  }
  for (const c of checkins) {
    const key = new Date(c.checked_in_at).toDateString()
    if (key in days) days[key]++
  }
  return Object.entries(days).map(([date, count]) => ({
    label: new Date(date).toLocaleDateString('en-GB', { weekday: 'narrow' }),
    count,
    isToday: date === new Date().toDateString(),
  }))
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

// ── SVG chart components ──────────────────────────────────────────────────────

function AreaChart({
  data, color, w, h,
}: { data: number[]; color: string; w: number; h: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / max) * (h - 6) - 2,
  }))
  // Smooth cubic bezier
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1)
    line += ` C ${cpx} ${pts[i - 1].y.toFixed(1)} ${cpx} ${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
  }
  const area = `${line} L ${w} ${h} L 0 ${h} Z`

  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgGrad id={`ag-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.4" />
          <Stop offset="1" stopColor={color} stopOpacity="0.02" />
        </SvgGrad>
      </Defs>
      <Path d={area} fill={`url(#ag-${color.replace('#', '')})`} />
      <Path d={line} fill="none" stroke={color} strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function BarChart({
  data, color, w, h,
}: { data: number[]; color: string; w: number; h: number }) {
  const max = Math.max(...data, 1)
  const gap = 4
  const bw  = (w - gap * (data.length - 1)) / data.length
  return (
    <Svg width={w} height={h}>
      {data.map((v, i) => {
        const bh = Math.max(6, (v / max) * (h - 4))
        return (
          <Rect key={i}
            x={i * (bw + gap)} y={h - bh}
            width={bw} height={bh} rx={4}
            fill={color}
            opacity={i === data.length - 1 ? 1 : 0.5}
          />
        )
      })}
    </Svg>
  )
}

function ECGLine({ color, w, h }: { color: string; w: number; h: number }) {
  const mid = (h / 2).toFixed(1)
  // Two heartbeat spikes across the width
  const spike = (ox: number) => {
    const m = h / 2
    const peak = (m - h * 0.52).toFixed(1)
    const trough = (m + h * 0.52).toFixed(1)
    return `${ox},${mid} ${ox + 16},${mid} ${ox + 20},${peak} ${ox + 24},${trough} ${ox + 28},${mid} ${ox + 44},${mid}`
  }
  const half = w / 2
  const pts = `0,${mid} ${spike(10)} ${spike(half + 6)} ${w},${mid}`
  return (
    <Svg width={w} height={h}>
      <Polyline points={pts} fill="none" stroke={color}
        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

// ── Hero carousel cards ───────────────────────────────────────────────────────

function HeroCard({
  bg, chip, chipColor, headline, sub, ctaLabel, ctaColor, onPress, children,
}: {
  bg: string; chip: string; chipColor: string
  headline: string; sub?: string
  ctaLabel: string; ctaColor: string
  onPress?: () => void
  children?: React.ReactNode
}) {
  return (
    <View style={[hc.card, { backgroundColor: bg }]}>
      {/* decorative blobs */}
      <View style={[hc.blob1, { backgroundColor: ctaColor + '20' }]} />
      <View style={[hc.blob2, { backgroundColor: ctaColor + '14' }]} />

      <View style={hc.content}>
        <View style={[hc.chip, { backgroundColor: ctaColor + '22' }]}>
          <Text style={[hc.chipText, { color: chipColor }]}>{chip}</Text>
        </View>
        <Text style={hc.headline} numberOfLines={2}>{headline}</Text>
        {!!sub && <Text style={hc.sub}>{sub}</Text>}
        {children}
        <TouchableOpacity
          style={[hc.cta, { backgroundColor: ctaColor }]}
          onPress={onPress} activeOpacity={0.82}
        >
          <Text style={hc.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const hc = StyleSheet.create({
  card: {
    width: HERO_W, borderRadius: 24,
    minHeight: 196, overflow: 'hidden', padding: 20,
  },
  blob1: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    right: -30, bottom: -40,
  },
  blob2: {
    position: 'absolute', width: 90, height: 90, borderRadius: 45,
    right: 70, top: -24,
  },
  content: { gap: 8, zIndex: 2 },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  chipText:  { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.8 },
  headline:  { fontSize: 20, fontFamily: F.extrabold, color: '#0D0D18', lineHeight: 28, marginTop: 2 },
  sub:       { fontSize: 13, fontFamily: F.medium, color: '#6B7280' },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 99, marginTop: 6,
  },
  ctaText: { fontSize: 13, fontFamily: F.semibold, color: '#FFF' },
})

// ── Category pills ────────────────────────────────────────────────────────────
const CATS = ['All', 'Health', 'Visits', 'Classes']

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const router              = useRouter()
  const insets              = useSafeAreaInsets()
  const { branding }        = useTenant()
  const { accessToken }     = useAuth()
  const { theme, isDark }   = useTheme()
  const accent  = branding?.primary_color ?? '#5B8EF4'
  const slug    = branding?.slug ?? ''
  const health  = useHealthData()

  const [cat,       setCat]       = useState('All')
  const [heroIndex, setHeroIndex] = useState(0)

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data, isRefetching, refetch } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn:  () => memberApi.getProfile(slug),
    enabled:  !!slug && !!accessToken,
  })
  const { data: schedData } = useQuery({
    queryKey: ['member-schedule', slug],
    queryFn:  () => memberApi.getSchedule(slug),
    enabled:  !!slug && !!accessToken,
  })

  const profile  = data?.member
  const sub      = data?.subscription
  const checkins = (data as any)?.recentCheckins ?? []
  const bars     = getWeekBars(checkins)
  const maxBar   = Math.max(1, ...bars.map(b => b.count))

  const nextClass = schedData?.bookings?.find(
    b => b.booking_status === 'confirmed' && new Date(b.scheduled_at) > new Date(),
  )

  // Streak calculation
  const streak = (() => {
    if (!checkins.length) return 0
    let s = 0
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const unique = [
      ...new Set(
        [...checkins]
          .map(c => { const d = new Date(c.checked_in_at); d.setHours(0,0,0,0); return d.getTime() })
          .sort((a, b) => b - a),
      ),
    ]
    let prev = today.getTime()
    for (const ts of unique) {
      if (prev - ts <= 86_400_000) { s++; prev = ts } else break
    }
    return s
  })()

  const totalVisits = (data?.stats as any)?.totalVisits ?? 0

  const achievements = [
    { icon: Flame,  label: 'First visit',  done: totalVisits >= 1,  sub: 'Show up once'      },
    { icon: Zap,    label: '5-day streak', done: streak >= 5,       sub: '5 days in a row'   },
    { icon: Target, label: '10 visits',    done: totalVisits >= 10, sub: 'Ten check-ins'      },
    { icon: Award,  label: '30 visits',    done: totalVisits >= 30, sub: 'Thirty check-ins'   },
  ]

  const show = (c: string) => cat === 'All' || cat === c

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={s.headerLeft}>
            <DiceBearAvatar seed={profile?.email ?? 'member'} size={46} />
            <View>
              <Text style={[s.helloText, { color: theme.textSub }]}>Hello 👋,</Text>
              <Text style={[s.nameText,  { color: theme.text }]}>
                {profile?.name?.split(' ')[0] ?? 'Member'}!
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.bellBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/(tabs)/notifications')}
            activeOpacity={0.75}
          >
            <Bell size={20} color={theme.text} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* ── Hero carousel ────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={HERO_W + HERO_GAP}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 20, gap: HERO_GAP }}
          onScroll={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (HERO_W + HERO_GAP))
            setHeroIndex(Math.max(0, Math.min(idx, 2)))
          }}
          scrollEventThrottle={16}
        >
          {/* Card 1 — Membership */}
          <HeroCard
            bg={isDark ? '#1A1F2E' : '#EEF6FF'}
            chip="MEMBERSHIP"
            chipColor={accent}
            headline={sub ? `${sub.plan_name} Plan` : 'No active plan yet'}
            sub={sub ? `${daysLeft(sub.expires_at)} days remaining` : 'Contact your gym to get started'}
            ctaLabel={sub ? 'View details' : 'Browse plans'}
            ctaColor={accent}
            onPress={() => router.push('/plans')}
          />

          {/* Card 2 — Next class */}
          <HeroCard
            bg={isDark ? '#111827' : '#F5F7FF'}
            chip="NEXT CLASS"
            chipColor={accent}
            headline={nextClass ? nextClass.class_name : 'No upcoming classes'}
            sub={nextClass
              ? `${fmtTime(nextClass.scheduled_at)}${nextClass.trainer_name ? ` · ${nextClass.trainer_name}` : ''}`
              : 'Browse the schedule and book a spot'}
            ctaLabel={nextClass ? 'View class' : 'Browse schedule'}
            ctaColor={accent}
            onPress={() => router.push('/(tabs)/schedule')}
          />

          {/* Card 3 — Today's activity */}
          <HeroCard
            bg={isDark ? '#131920' : '#F0F9FF'}
            chip="TODAY'S ACTIVITY"
            chipColor={accent}
            headline="Stay active, stay healthy!"
            ctaLabel="See full stats"
            ctaColor={accent}
            onPress={() => setCat('Health')}
          >
            <View style={s.healthRow}>
              {[
                { val: health.steps.toLocaleString(), unit: 'steps'    },
                { val: health.calories.toString(),    unit: 'kcal'     },
                { val: `${health.heartRate}`,         unit: 'bpm ❤️'  },
              ].map(item => (
                <View key={item.unit} style={s.healthItem}>
                  <Text style={[s.healthVal, { color: isDark ? '#FFFFFF' : '#0D1117' }]}>{item.val}</Text>
                  <Text style={[s.healthUnit, { color: isDark ? accent + 'CC' : accent }]}>{item.unit}</Text>
                </View>
              ))}
            </View>
          </HeroCard>
        </ScrollView>

        {/* Pagination dots */}
        <View style={s.dotsRow}>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={[
                s.dot,
                i === heroIndex
                  ? { backgroundColor: accent, width: 20 }
                  : { backgroundColor: theme.border, width: 8 },
              ]}
            />
          ))}
        </View>

        {/* ── Category pills ────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillsRow}
        >
          {CATS.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setCat(c)}
              activeOpacity={0.75}
              style={[
                s.pill,
                c === cat
                  ? { backgroundColor: accent }
                  : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
              ]}
            >
              <Text style={[s.pillText, { color: c === cat ? '#FFF' : theme.textSub }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Stat cards grid ───────────────────────────────────────────── */}
        <View style={s.grid}>

          {/* Left column */}
          <View style={[s.col, { width: COL_W }]}>

            {/* Steps */}
            {show('Health') && (
              <MotiView
                from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 380, delay: 60 }}
              >
                <View style={[s.statCard, { backgroundColor: isDark ? '#0F2115' : '#F0FDF4' }]}>
                  <View style={s.statTop}>
                    <Text style={s.emoji}>🚶</Text>
                    <Text style={[s.statLabel, { color: '#16A34A' }]}>Steps</Text>
                  </View>
                  <AreaChart data={health.stepsHistory} color="#22C55E" w={COL_W - 24} h={60} />
                  <Text style={[s.bigNum, { color: isDark ? '#4ADE80' : '#15803D' }]}>
                    {health.steps.toLocaleString()}
                  </Text>
                  <Text style={[s.unit, { color: isDark ? '#166534' : '#86EFAC' }]}>steps today</Text>
                </View>
              </MotiView>
            )}

            {/* Streak / ECG */}
            {show('Visits') && (
              <MotiView
                from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 380, delay: 160 }}
              >
                <View style={[s.statCard, s.statCardTall, { backgroundColor: isDark ? '#200D14' : '#FFF1F2' }]}>
                  <View style={s.statTop}>
                    <Text style={s.emoji}>❤️</Text>
                    <Text style={[s.statLabel, { color: '#E11D48' }]}>Streak</Text>
                  </View>
                  <ECGLine color="#F43F5E" w={COL_W - 24} h={70} />
                  <Text style={[s.bigNum, { color: isDark ? '#FB7185' : '#BE123C' }]}>{streak}</Text>
                  <Text style={[s.unit, { color: isDark ? '#9F1239' : '#FDA4AF' }]}>day streak</Text>
                </View>
              </MotiView>
            )}

          </View>

          {/* Right column */}
          <View style={[s.col, { width: COL_W }]}>

            {/* Calories */}
            {show('Health') && (
              <MotiView
                from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 380, delay: 110 }}
              >
                <View style={[s.statCard, { backgroundColor: isDark ? '#0C1829' : '#EFF6FF' }]}>
                  <View style={s.statTop}>
                    <Text style={s.emoji}>🔥</Text>
                    <Text style={[s.statLabel, { color: '#2563EB' }]}>Calories</Text>
                  </View>
                  <BarChart data={health.calHistory} color="#60A5FA" w={COL_W - 24} h={60} />
                  <Text style={[s.bigNum, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>{health.calories}</Text>
                  <Text style={[s.unit, { color: isDark ? '#1E3A8A' : '#BFDBFE' }]}>kcal burned</Text>
                </View>
              </MotiView>
            )}

            {/* Book a class */}
            {show('Classes') && (
              <MotiView
                from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 380, delay: 200 }}
              >
                <TouchableOpacity
                  style={[s.statCard, s.statCardTall, s.addCard, {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  }]}
                  onPress={() => router.push('/(tabs)/schedule')}
                  activeOpacity={0.8}
                >
                  <View style={[s.plusCircle, { backgroundColor: accent + '18' }]}>
                    <Plus size={22} color={accent} strokeWidth={2.2} />
                  </View>
                  <Text style={[s.addTitle, { color: theme.text }]}>Book a class</Text>
                  <Text style={[s.addSub,   { color: theme.textMuted }]}>Browse schedule</Text>
                </TouchableOpacity>
              </MotiView>
            )}

          </View>
        </View>

        {/* ── This week bar chart ───────────────────────────────────────── */}
        {show('Visits') && (
          <MotiView
            from={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 380, delay: 220 }}
            style={s.sectionPad}
          >
            <Text style={[s.sectionTitle, { color: theme.textSub }]}>THIS WEEK</Text>
            <View style={[s.weekCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={s.weekBars}>
                {bars.map((b, i) => (
                  <View key={i} style={s.weekBarCol}>
                    <View style={s.weekBarTrack}>
                      <MotiView
                        from={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                        transition={{ type: 'spring', damping: 14, delay: i * 55 }}
                        style={[
                          s.weekBarFill,
                          {
                            height: `${Math.max(8, (b.count / maxBar) * 100)}%` as any,
                            backgroundColor: b.isToday
                              ? accent
                              : b.count > 0 ? accent + '55' : theme.border,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[s.weekBarLabel, { color: b.isToday ? accent : theme.textMuted }]}>
                      {b.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </MotiView>
        )}

        {/* ── Achievements (horizontal scroll) ─────────────────────────── */}
        <View style={s.sectionPad}>
          <Text style={[s.sectionTitle, { color: theme.textSub }]}>ACHIEVEMENTS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {achievements.map((a, i) => (
              <MotiView
                key={i}
                from={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 15, delay: 300 + i * 60 }}
              >
                <View style={[
                  s.achCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: a.done ? accent + '55' : theme.border,
                  },
                  !a.done && { opacity: 0.55 },
                ]}>
                  <View style={[
                    s.achIcon,
                    { backgroundColor: a.done ? accent + '18' : theme.surfaceHigh },
                  ]}>
                    <a.icon size={22} color={a.done ? accent : theme.textMuted} strokeWidth={1.8} />
                  </View>
                  <Text style={[s.achName, { color: theme.text }]}>{a.label}</Text>
                  <Text style={[s.achSub,  { color: theme.textMuted }]}>{a.sub}</Text>
                  {a.done && (
                    <View style={[s.donePill, { backgroundColor: accent + '18' }]}>
                      <Text style={[s.doneText, { color: accent }]}>Done ✓</Text>
                    </View>
                  )}
                </View>
              </MotiView>
            ))}
          </ScrollView>
        </View>

      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  helloText:  { fontSize: 13, fontFamily: F.regular },
  nameText:   { fontSize: 20, fontFamily: F.extrabold },
  bellBtn: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero inline health data row (inside card 3)
  healthRow:  { flexDirection: 'row', gap: 20, marginTop: 4 },
  healthItem: { gap: 1 },
  healthVal:  { fontSize: 18, fontFamily: F.extrabold },
  healthUnit: { fontSize: 11, fontFamily: F.medium },

  // Pagination dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 4 },
  dot: { height: 8, borderRadius: 4 },

  // Category pills
  pillsRow: { paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
  pill: {
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 99,
  },
  pillText: { fontSize: 13, fontFamily: F.semibold },

  // Stat card grid
  grid: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 8 },
  col:  { gap: 12 },

  statCard: {
    borderRadius: 20, padding: 12, gap: 8,
    overflow: 'hidden',
  },
  statCardTall: { minHeight: 180 },
  statTop:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emoji:    { fontSize: 16 },
  statLabel:{ fontSize: 13, fontFamily: F.bold },
  bigNum:   { fontSize: 24, fontFamily: F.extrabold, lineHeight: 28 },
  unit:     { fontSize: 11, fontFamily: F.medium },

  // Add activity card
  addCard: {
    borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  plusCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  addTitle:   { fontSize: 14, fontFamily: F.bold },
  addSub:     { fontSize: 12, fontFamily: F.regular },

  // This week
  sectionPad:   { paddingHorizontal: 20, marginTop: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontFamily: F.bold, letterSpacing: 1, marginBottom: 10 },
  weekCard: {
    borderRadius: 20, borderWidth: 1,
    paddingVertical: 16, paddingHorizontal: 12,
  },
  weekBars:     { flexDirection: 'row', height: 96, alignItems: 'flex-end', gap: 6 },
  weekBarCol:   { flex: 1, alignItems: 'center', gap: 6 },
  weekBarTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  weekBarFill:  { width: '100%', borderRadius: 6 },
  weekBarLabel: { fontSize: 11, fontFamily: F.medium },

  // Achievements
  achCard: {
    width: 140, borderRadius: 20, borderWidth: 1,
    padding: 14, gap: 8,
  },
  achIcon:  { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  achName:  { fontSize: 13, fontFamily: F.bold },
  achSub:   { fontSize: 11, fontFamily: F.regular, lineHeight: 16 },
  donePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  doneText: { fontSize: 11, fontFamily: F.bold },
})
