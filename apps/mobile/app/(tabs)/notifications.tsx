import { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView, ImageBackground, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Bell, CreditCard, Calendar, AlertTriangle,
  CheckCircle2, Megaphone, Gift, Info, AlertCircle, Search, X,
} from 'lucide-react-native'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'

// ─── Promo carousel ───────────────────────────────────────────────────────────

type PhotoSlide    = { type: 'photo'; src: number; badge: string; headline: string; sub: string }
type ReferralSlide = { type: 'referral' }
type Slide = PhotoSlide | ReferralSlide

const SLIDES: Slide[] = [
  { type: 'photo', src: require('../../assets/images/gym-fitness.png'),  badge: 'Stay Motivated',  headline: 'Push your\nlimits today.',  sub: 'Every session gets you closer to your goal'       },
  { type: 'photo', src: require('../../assets/images/pushup.png'),        badge: 'Daily Challenge', headline: 'Show up.\nEarn it.',        sub: 'Consistency beats perfection — every single time' },
  { type: 'photo', src: require('../../assets/images/gym-models.png'),    badge: 'Community',       headline: 'Better\ntogether.',         sub: 'Bring a friend and make every workout count'      },
  { type: 'referral' },
]

function ReferralCard() {
  return (
    <LinearGradient
      colors={['#4f8ef7', '#1d4ed8']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={promoS.card}
    >
      <View style={[promoS.orb, { width: 90, height: 90, top: -24, right: -24, opacity: 0.12 }]} />
      <View style={[promoS.orb, { width: 56, height: 56, bottom: 12, left: 8, opacity: 0.1 }]} />
      <View style={promoS.cardText}>
        <View style={promoS.badge}>
          <View style={promoS.badgeDot} />
          <Text style={promoS.badgeLabel}>Member Offer</Text>
        </View>
        <Text style={promoS.headline}>{'Refer a friend,\nget rewarded.'}</Text>
        <Text style={promoS.sub}>Share your code and earn wallet credits</Text>
      </View>
    </LinearGradient>
  )
}

function PhotoCard({ slide }: { slide: PhotoSlide }) {
  return (
    <ImageBackground source={slide.src} style={promoS.card} imageStyle={{ borderRadius: 18 }}>
      <LinearGradient colors={['rgba(0,0,0,0.18)', 'transparent']} style={promoS.topFade} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={promoS.bottomFade} />
      <View style={promoS.cardText}>
        <View style={promoS.badge}>
          <View style={promoS.badgeDot} />
          <Text style={promoS.badgeLabel}>{slide.badge}</Text>
        </View>
        <Text style={promoS.headline}>{slide.headline}</Text>
        <Text style={promoS.sub}>{slide.sub}</Text>
      </View>
    </ImageBackground>
  )
}

function PromoCarousel({ accent }: { accent: string }) {
  const [idx, setIdx] = useState(0)
  const slide = SLIDES[idx]
  return (
    <View style={promoS.wrap}>
      <MotiView
        key={idx}
        from={{ opacity: 0, translateY: 6 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 360 }}
      >
        {slide.type === 'referral' ? <ReferralCard /> : <PhotoCard slide={slide} />}
      </MotiView>
      <View style={promoS.dots}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => setIdx(i)} activeOpacity={0.7}>
            <MotiView
              animate={{ width: i === idx ? 18 : 6, opacity: i === idx ? 1 : 0.35 }}
              transition={{ type: 'timing', duration: 220 }}
              style={[promoS.dot, { backgroundColor: i === idx ? accent : '#ccc' }]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const promoS = StyleSheet.create({
  wrap:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  card:       { height: 160, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  topFade:    { position: 'absolute', top: 0, left: 0, right: 0, height: 60 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 110 },
  cardText:   { padding: 16, gap: 4 },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  badgeDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: '#facc15' },
  badgeLabel: { fontSize: 10, fontFamily: F.bold, color: 'white', letterSpacing: 1.2, textTransform: 'uppercase' },
  headline:   { fontSize: 20, fontFamily: F.extrabold, color: 'white', letterSpacing: -0.5, lineHeight: 25 },
  sub:        { fontSize: 12, fontFamily: F.regular, color: 'rgba(255,255,255,0.65)', lineHeight: 17 },
  dots:       { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot:        { height: 6, borderRadius: 99 },
  orb:        { position: 'absolute', borderRadius: 999, backgroundColor: 'white' },
})

// ─── Notification config ──────────────────────────────────────────────────────

type NotifItem = {
  id: string; type: string; title: string; body: string
  read_at: string | null; created_at: string
}

type FilterKey = 'all' | 'payments' | 'classes' | 'membership' | 'announcements'

const FILTERS: { key: FilterKey; label: string; types: string[] }[] = [
  { key: 'all',          label: 'All',          types: [] },
  { key: 'payments',     label: 'Payments',     types: ['payment_success', 'payment_failed'] },
  { key: 'classes',      label: 'Classes',      types: ['class_reminder', 'class_cancelled', 'booking_confirmed', 'waitlist_promoted'] },
  { key: 'membership',   label: 'Membership',   types: ['subscription_expiring', 'subscription_expired', 'grace_period'] },
  { key: 'announcements',label: 'Announcements',types: ['announcement', 'referral_converted'] },
]

const TYPE_DESTINATIONS: Record<string, string> = {
  payment_success:       '/(tabs)/payments',
  payment_failed:        '/(tabs)/payments',
  subscription_expiring: '/(tabs)/subscription',
  subscription_expired:  '/(tabs)/subscription',
  grace_period:          '/(tabs)/subscription',
  class_reminder:        '/(tabs)/schedule',
  class_cancelled:       '/(tabs)/schedule',
  booking_confirmed:     '/(tabs)/schedule',
  waitlist_promoted:     '/(tabs)/schedule',
}

const TYPE_ACTIONS: Record<string, string> = {
  subscription_expiring: 'Renew now',
  subscription_expired:  'Renew now',
  grace_period:          'Renew now',
  payment_failed:        'View payments',
  class_reminder:        'View schedule',
  class_cancelled:       'View schedule',
  booking_confirmed:     'View booking',
  waitlist_promoted:     'View booking',
}

const TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  payment_success:       { icon: CheckCircle2,  color: '#22C55E' },
  payment_failed:        { icon: AlertTriangle, color: '#EF4444' },
  subscription_expiring: { icon: CreditCard,    color: '#F59E0B' },
  subscription_expired:  { icon: CreditCard,    color: '#EF4444' },
  grace_period:          { icon: AlertTriangle, color: '#F59E0B' },
  class_reminder:        { icon: Calendar,      color: '#3B82F6' },
  class_cancelled:       { icon: Calendar,      color: '#EF4444' },
  booking_confirmed:     { icon: CheckCircle2,  color: '#22C55E' },
  waitlist_promoted:     { icon: CheckCircle2,  color: '#22C55E' },
  announcement:          { icon: Megaphone,     color: '#8B5CF6' },
  referral_converted:    { icon: Gift,          color: '#06B6D4' },
}

function getCfg(type: string) {
  return TYPE_CONFIG[type] ?? { icon: Info, color: '#6B7280' }
}

function fmtRelative(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 60)  return mins <= 1 ? 'Just now' : `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function getDateBucket(iso: string): string {
  const d         = new Date(iso)
  const now       = new Date()
  const todayMs   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const itemMs    = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays  = Math.round((todayMs - itemMs) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)   return 'This Week'
  return 'Earlier'
}

const BUCKET_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier']

// ─── Notification card ────────────────────────────────────────────────────────

function NotifCard({
  item, index, accent, theme, onPress, onAction,
}: {
  item: NotifItem; index: number
  accent: string; theme: any
  onPress: () => void; onAction: () => void
}) {
  const cfg      = getCfg(item.type)
  const isUnread = !item.read_at
  const action   = TYPE_ACTIONS[item.type]

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: index * 35 }}
    >
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
        onPress={onPress}
        activeOpacity={0.72}
      >
        {/* Icon */}
        <View style={[styles.cardIcon, { backgroundColor: cfg.color + '18' }]}>
          <cfg.icon size={20} color={cfg.color} strokeWidth={1.8} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          {/* Top row: title + time + unread dot */}
          <View style={styles.cardTopRow}>
            <Text
              style={[styles.cardTitle, { color: isUnread ? theme.text : theme.textSub }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View style={styles.cardTimestampRow}>
              <Text style={[styles.cardTime, { color: theme.textMuted }]}>
                {fmtRelative(item.created_at)}
              </Text>
              {isUnread && (
                <View style={[styles.unreadDot, { backgroundColor: '#22C55E' }]} />
              )}
            </View>
          </View>

          {/* Body */}
          <Text style={[styles.cardBody, { color: theme.textSub }]} numberOfLines={2}>
            {item.body}
          </Text>

          {/* Action button */}
          {action && (
            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.surfaceHigh ?? '#F3F4F6', borderColor: theme.border }]}
                onPress={onAction}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.actionBtnText, { color: theme.textSub }]}>{action}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </MotiView>
  )
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard({ theme, index }: { theme: any; index: number }) {
  return (
    <MotiView
      from={{ opacity: 0.3 }} animate={{ opacity: 0.8 }}
      transition={{ loop: true, type: 'timing', duration: 900, delay: index * 120 }}
      style={[styles.skeletonCard, { backgroundColor: theme.skeleton ?? '#E5E7EB' }]}
    />
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { branding }      = useTenant()
  const { accessToken }   = useAuth()
  const { theme }         = useTheme()
  const insets            = useSafeAreaInsets()
  const qc                = useQueryClient()
  const router            = useRouter()
  const accent            = branding?.primary_color ?? '#5B8EF4'
  const slug              = branding?.slug ?? ''

  const [filter,        setFilter]        = useState<FilterKey>('all')
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchText,    setSearchText]    = useState('')

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['member-notifications', slug],
    queryFn:  () => memberApi.getNotifications(slug),
    enabled:  !!slug && !!accessToken,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => memberApi.markNotificationRead(slug, id),
    onSuccess: (_, id) => {
      qc.setQueryData(['member-notifications', slug], (old: any) => {
        if (!old) return old
        return {
          ...old,
          notifications: old.notifications.map((n: NotifItem) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n),
          unreadCount: Math.max(0, old.unreadCount - 1),
        }
      })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => memberApi.markAllNotificationsRead(slug),
    onSuccess: () => {
      qc.setQueryData(['member-notifications', slug], (old: any) => {
        if (!old) return old
        const now = new Date().toISOString()
        return {
          ...old,
          notifications: old.notifications.map((n: NotifItem) => ({ ...n, read_at: n.read_at ?? now })),
          unreadCount: 0,
        }
      })
    },
  })

  function handlePress(item: NotifItem) {
    if (!item.read_at) markRead.mutate(item.id)
    const dest = TYPE_DESTINATIONS[item.type]
    if (dest) router.push(dest as any)
  }

  const notifications = data?.notifications ?? []
  const unreadCount   = data?.unreadCount   ?? 0

  // ── Filter + search ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = notifications
    if (filter !== 'all') {
      const types = FILTERS.find(f => f.key === filter)?.types ?? []
      list = list.filter(n => types.includes(n.type))
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
      )
    }
    return list
  }, [notifications, filter, searchText])

  // ── Date grouping ──────────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const map: Record<string, NotifItem[]> = {}
    filtered.forEach(item => {
      const bucket = getDateBucket(item.created_at)
      if (!map[bucket]) map[bucket] = []
      map[bucket].push(item)
    })
    return BUCKET_ORDER.filter(b => map[b]?.length).map(b => ({ label: b, items: map[b] }))
  }, [filtered])

  let globalIndex = 0

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {searchVisible ? (
          <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Search size={15} color={theme.textMuted} strokeWidth={1.8} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search notifications…"
              placeholderTextColor={theme.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setSearchVisible(false); setSearchText('') }} activeOpacity={0.7}>
              <X size={16} color={theme.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {'Inbox'}
                {unreadCount > 0 && (
                  <Text style={[styles.headerCount, { color: accent }]}>{` (${unreadCount})`}</Text>
                )}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={[styles.markAllBtn, { borderColor: accent + '40', backgroundColor: accent + '10' }]}
                  onPress={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  activeOpacity={0.75}
                >
                  <CheckCircle2 size={13} color={accent} strokeWidth={2} />
                  <Text style={[styles.markAllText, { color: accent }]}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.searchBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setSearchVisible(true)}
                activeOpacity={0.75}
              >
                <Search size={16} color={theme.textMuted} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
      >
        {/* ── Promo carousel ── */}
        <PromoCarousel accent={accent} />

        {/* ── Filter tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(f => {
            const active = filter === f.key
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterTab,
                  active
                    ? { backgroundColor: accent, borderColor: accent }
                    : { backgroundColor: 'transparent', borderColor: theme.border },
                ]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={[
                  styles.filterTabText,
                  { color: active ? '#fff' : theme.textMuted },
                ]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* ── Content ── */}
        {isError ? (
          <View style={styles.emptyWrap}>
            <AlertCircle size={44} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: theme.textSub }]}>Could not load</Text>
            <TouchableOpacity onPress={() => refetch()} activeOpacity={0.75}>
              <Text style={[styles.retryText, { color: accent }]}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <View style={styles.cardList}>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} theme={theme} index={i} />)}
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Bell size={44} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: theme.textSub }]}>
              {searchText ? 'No results' : filter === 'all' ? 'All caught up' : `No ${FILTERS.find(f => f.key === filter)?.label.toLowerCase()} notifications`}
            </Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              {searchText
                ? 'Try a different search term'
                : `You'll be notified about classes, payments, and membership updates.`}
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {grouped.map(group => (
              <View key={group.label}>
                <Text style={[styles.dateBucket, { color: theme.textMuted }]}>
                  {group.label}
                </Text>
                {group.items.map(item => {
                  const idx = globalIndex++
                  return (
                    <NotifCard
                      key={item.id}
                      item={item}
                      index={idx}
                      accent={accent}
                      theme={theme}
                      onPress={() => handlePress(item)}
                      onAction={() => {
                        if (!item.read_at) markRead.mutate(item.id)
                        const dest = TYPE_DESTINATIONS[item.type]
                        if (dest) router.push(dest as any)
                      }}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontFamily: F.extrabold },
  headerCount: { fontSize: 22, fontFamily: F.extrabold },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 99, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  markAllText: { fontSize: 11, fontFamily: F.semibold },
  searchBtn: {
    width: 36, height: 36, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // Search bar
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: F.regular },

  // Filter tabs
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 99, borderWidth: 1,
  },
  filterTabText: { fontSize: 13, fontFamily: F.semibold },

  // List
  cardList: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },

  // Date bucket label
  dateBucket: {
    fontSize: 12, fontFamily: F.bold,
    textTransform: 'uppercase', letterSpacing: 0.7,
    marginTop: 8, marginBottom: 4, paddingHorizontal: 2,
  },

  // Notification card
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 18, borderWidth: 1,
    padding: 14, marginBottom: 2,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 4 },
  cardTopRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle:   { flex: 1, fontSize: 14, fontFamily: F.bold, lineHeight: 19 },
  cardTimestampRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  cardTime:    { fontSize: 11, fontFamily: F.regular },
  unreadDot:   { width: 7, height: 7, borderRadius: 4 },
  cardBody:    { fontSize: 13, fontFamily: F.regular, lineHeight: 18 },
  cardFooter:  { alignItems: 'flex-end', marginTop: 6 },
  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontFamily: F.semibold },

  // Skeleton
  skeletonCard: { height: 88, borderRadius: 18, marginBottom: 2 },

  // Empty
  emptyWrap:  { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: F.bold },
  emptySub:   { fontSize: 13, fontFamily: F.regular, textAlign: 'center', lineHeight: 19 },
  retryText:  { fontSize: 14, fontFamily: F.semibold },
})
