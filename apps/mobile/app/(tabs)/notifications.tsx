import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { MotiView } from 'moti'
import {
  Bell, CreditCard, Calendar, AlertTriangle,
  CheckCircle2, Megaphone, Gift, Info, AlertCircle,
} from 'lucide-react-native'
import { Screen } from '../../src/components/ui/Screen'
import { AppHeader } from '../../src/components/ui/AppHeader'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'

type NotifItem = {
  id: string; type: string; title: string; body: string
  read_at: string | null; created_at: string
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

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

const TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  payment_success:        { icon: CheckCircle2,  color: '#22C55E' },
  payment_failed:         { icon: AlertTriangle, color: '#EF4444' },
  subscription_expiring:  { icon: CreditCard,    color: '#F59E0B' },
  subscription_expired:   { icon: CreditCard,    color: '#EF4444' },
  grace_period:           { icon: AlertTriangle, color: '#F59E0B' },
  class_reminder:         { icon: Calendar,      color: '#3B82F6' },
  class_cancelled:        { icon: Calendar,      color: '#EF4444' },
  booking_confirmed:      { icon: CheckCircle2,  color: '#22C55E' },
  waitlist_promoted:      { icon: CheckCircle2,  color: '#22C55E' },
  announcement:           { icon: Megaphone,     color: '#8B5CF6' },
  referral_converted:     { icon: Gift,          color: '#06B6D4' },
}

function getCfg(type: string) {
  return TYPE_CONFIG[type] ?? { icon: Info, color: '#6B7280' }
}

export default function NotificationsScreen() {
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme } = useTheme()
  const qc = useQueryClient()
  const router = useRouter()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['member-notifications', slug],
    queryFn: () => memberApi.getNotifications(slug),
    enabled: !!slug && !!accessToken,
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
  const unreadCount   = data?.unreadCount ?? 0

  return (
    <Screen>
      <AppHeader
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <Text style={[styles.markAll, { color: accent }]}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Could not load"
          subtitle="Something went wrong fetching your notifications."
          action={{ label: 'Try again', onPress: refetch }}
          iconColor="#EF4444"
        />
      ) : isLoading ? (
        <View style={styles.loadingWrap}>
          {[1, 2, 3, 4].map(i => (
            <MotiView key={i}
              from={{ opacity: 0.4 }} animate={{ opacity: 1 }}
              transition={{ loop: true, type: 'timing', duration: 800, delay: i * 80 }}
              style={[styles.skeleton, { backgroundColor: theme.skeleton }]}
            />
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="All caught up"
          subtitle="You'll be notified about classes, payments, and membership updates."
        />
      ) : (
        <FlashList
          data={notifications}
          keyExtractor={n => n.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
          renderItem={({ item, index }: { item: NotifItem; index: number }) => {
            const cfg     = getCfg(item.type)
            const isUnread = !item.read_at

            return (
              <MotiView
                from={{ opacity: 0, translateX: isUnread ? -8 : 0 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 280, delay: index * 35 }}
              >
                <TouchableOpacity
                  activeOpacity={0.72}
                  onPress={() => handlePress(item)}
                  style={[
                    styles.item,
                    { backgroundColor: isUnread ? (accent + '08') : theme.bg, borderBottomColor: theme.borderSub },
                  ]}
                >
                  {isUnread && (
                    <View style={[styles.unreadDot, { backgroundColor: accent }]} />
                  )}
                  <View style={[styles.iconWrap, { backgroundColor: cfg.color + '18' }]}>
                    <cfg.icon size={18} color={cfg.color} strokeWidth={1.8} />
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.itemTop}>
                      <Text
                        style={[styles.itemTitle, { color: isUnread ? theme.text : theme.textSub }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={[styles.itemTime, { color: theme.textMuted }]}>
                        {fmtRelative(item.created_at)}
                      </Text>
                    </View>
                    <Text style={[styles.itemBody, { color: theme.textSub }]} numberOfLines={2}>
                      {item.body}
                    </Text>
                  </View>
                </TouchableOpacity>
              </MotiView>
            )
          }}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  markAll: { fontSize: 13, fontFamily: F.semibold },

  loadingWrap: { padding: 16, gap: 10 },
  skeleton:    { height: 72, borderRadius: 14 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontFamily: F.bold },
  emptySub:   { fontSize: 14, fontFamily: F.regular, textAlign: 'center', paddingHorizontal: 40 },
  retryText:  { fontSize: 14, fontFamily: F.semibold },

  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, position: 'relative',
  },
  unreadDot: {
    position: 'absolute', left: 5, top: '50%',
    width: 6, height: 6, borderRadius: 3,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemContent: { flex: 1, gap: 3 },
  itemTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemTitle:   { fontSize: 14, fontFamily: F.semibold, flex: 1 },
  itemTime:    { fontSize: 11, fontFamily: F.regular, flexShrink: 0 },
  itemBody:    { fontSize: 13, fontFamily: F.regular, lineHeight: 19 },
})
