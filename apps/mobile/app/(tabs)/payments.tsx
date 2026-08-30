import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, RefreshControl,
} from 'react-native'
import { useState, useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import {
  Receipt, CreditCard, Wallet,
  Share2, TrendingUp, Calendar,
  CheckCircle2, Clock, XCircle, RotateCcw,
  Tag, ArrowRight, ChevronRight,
} from 'lucide-react-native'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReceiptItem = {
  id: string; amount: number; currency: string
  provider: string; tranzak_ref: string | null
  status: string; payment_type: string
  paid_at: string | null; created_at: string; plan_name: string | null
}

type FilterKey = 'all' | 'paid' | 'pending' | 'failed'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'All'     },
  { key: 'paid',    label: 'Paid'    },
  { key: 'pending', label: 'Pending' },
  { key: 'failed',  label: 'Failed'  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateShort(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function fmtMoney(raw: number | string, currency: string) {
  const n = Number(raw)
  return `${currency} ${isNaN(n) ? '0' : n.toLocaleString('fr-CM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtMoneyShort(raw: number | string, currency: string) {
  const n = Number(raw)
  if (isNaN(n)) return `${currency} 0`
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${currency} ${(n / 1_000).toFixed(0)}K`
  return `${currency} ${n.toLocaleString('fr-CM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const PAY_LABELS: Record<string, string> = {
  mtn_momo:     'MTN MoMo',
  orange_money: 'Orange Money',
  cash:         'Cash',
  card:         'Card',
  tranzak:      'Tranzak',
  wallet:       'Gym Wallet',
  voucher:      'Voucher',
}

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; accent: string
  Icon: React.ElementType
}> = {
  paid:      { label: 'Paid',     color: '#16A34A', bg: '#DCFCE7', accent: '#22C55E', Icon: CheckCircle2 },
  completed: { label: 'Paid',     color: '#16A34A', bg: '#DCFCE7', accent: '#22C55E', Icon: CheckCircle2 },
  pending:   { label: 'Pending',  color: '#D97706', bg: '#FEF3C7', accent: '#F59E0B', Icon: Clock        },
  failed:    { label: 'Failed',   color: '#DC2626', bg: '#FEE2E2', accent: '#EF4444', Icon: XCircle      },
  refunded:  { label: 'Refunded', color: '#7C3AED', bg: '#EDE9FE', accent: '#8B5CF6', Icon: RotateCcw    },
}

// Dark-mode aware bg for status pills
function statusBg(cfg: typeof STATUS_CONFIG[string], isDark: boolean) {
  return isDark ? cfg.accent + '22' : cfg.bg
}
function statusColor(cfg: typeof STATUS_CONFIG[string], isDark: boolean) {
  return isDark ? cfg.accent : cfg.color
}

function matchesFilter(item: ReceiptItem, filter: FilterKey) {
  if (filter === 'all') return true
  if (filter === 'paid') return item.status === 'paid' || item.status === 'completed'
  return item.status === filter
}

function shareReceipt(item: ReceiptItem, gymName: string) {
  const date   = fmtDate(item.paid_at ?? item.created_at)
  const plan   = item.plan_name ?? (item.payment_type === 'day_pass' ? 'Day Pass' : 'Membership')
  const method = PAY_LABELS[item.provider] ?? item.provider
  const ref    = item.tranzak_ref ? `\nRef: ${item.tranzak_ref}` : ''
  Share.share({
    message: [
      `${gymName} — Payment Receipt`,
      `─────────────────────`,
      `Plan:    ${plan}`,
      `Amount:  ${fmtMoney(item.amount, item.currency)}`,
      `Method:  ${method}`,
      `Date:    ${date}`,
      `Status:  ${STATUS_CONFIG[item.status]?.label ?? 'Paid'}${ref}`,
      `─────────────────────`,
      `Receipt ID: ${item.id.slice(0, 12).toUpperCase()}`,
    ].join('\n'),
  }).catch(() => {})
}

// ─── Receipt card ──────────────────────────────────────────────────────────────

function ReceiptCard({
  item, index, accent, theme, isDark, gymName,
}: {
  item: ReceiptItem; index: number
  accent: string; theme: any; isDark: boolean; gymName: string
}) {
  const cfg        = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.paid
  const StatusIcon = cfg.Icon
  const isDay      = item.payment_type === 'day_pass'
  const isWallet   = item.provider === 'wallet'
  const isVoucher  = item.provider === 'voucher'
  const planLabel  = item.plan_name ?? (isDay ? 'Day Pass' : 'Membership')
  const dateStr    = fmtDateShort(item.paid_at ?? item.created_at)
  const method     = PAY_LABELS[item.provider] ?? item.provider

  const iconColor = isWallet ? '#8B5CF6' : isVoucher ? '#EC4899' : accent

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: index * 40 }}
    >
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardInner}>
          {/* Top row: icon · plan · amount + status */}
          <View style={styles.cardTop}>
            {/* Icon */}
            <View style={[styles.typeIcon, { backgroundColor: iconColor + '18' }]}>
              {isDay
                ? <Tag    size={17} color={iconColor} strokeWidth={1.8} />
                : isWallet || isVoucher
                  ? <Wallet size={17} color={iconColor} strokeWidth={1.8} />
                  : <CreditCard size={17} color={iconColor} strokeWidth={1.8} />
              }
            </View>

            {/* Plan + method·date */}
            <View style={styles.cardBody}>
              <Text style={[styles.cardPlan, { color: theme.text }]} numberOfLines={1}>
                {planLabel}
              </Text>
              <Text style={[styles.cardMeta, { color: theme.textMuted }]} numberOfLines={1}>
                {method} · {dateStr}
              </Text>
            </View>

            {/* Amount + status pill */}
            <View style={styles.cardRight}>
              <Text style={[styles.cardAmount, { color: theme.text }]}>
                {fmtMoney(item.amount, item.currency)}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusBg(cfg, isDark) }]}>
                <StatusIcon size={10} color={statusColor(cfg, isDark)} strokeWidth={2.2} />
                <Text style={[styles.statusText, { color: statusColor(cfg, isDark) }]}>{cfg.label}</Text>
              </View>
            </View>
          </View>

          {/* Bottom row: share */}
          <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
            <Text style={[styles.receiptId, { color: theme.textMuted }]}>
              #{item.id.slice(0, 8).toUpperCase()}
            </Text>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: theme.surfaceHigh }]}
              onPress={() => shareReceipt(item, gymName)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Share2 size={13} color={theme.textSub} strokeWidth={1.8} />
              <Text style={[styles.shareLabel, { color: theme.textSub }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </MotiView>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton({ theme, index }: { theme: any; index: number }) {
  return (
    <MotiView
      from={{ opacity: 0.3 }} animate={{ opacity: 0.8 }}
      transition={{ loop: true, type: 'timing', duration: 900, delay: index * 150 }}
      style={[styles.skeleton, { backgroundColor: theme.skeleton }]}
    />
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const { branding }      = useTenant()
  const { accessToken }   = useAuth()
  const { theme, isDark } = useTheme()
  const router            = useRouter()
  const insets            = useSafeAreaInsets()
  const accent   = branding?.primary_color ?? '#5B8EF4'
  const slug     = branding?.slug ?? ''
  const gymName  = branding?.name ?? 'Gym'

  const [filter, setFilter] = useState<FilterKey>('all')

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['member-receipts', slug],
    queryFn:  () => memberApi.getReceipts(slug),
    enabled:  !!slug && !!accessToken,
  })

  const { data: profileData } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn:  () => memberApi.getProfile(slug),
    enabled:  !!slug && !!accessToken,
  })

  const { data: walletData } = useQuery({
    queryKey: ['member-wallet', slug],
    queryFn:  () => memberApi.getWallet(slug),
    enabled:  !!slug && !!accessToken,
  })

  const allReceipts    = (data?.receipts ?? []) as ReceiptItem[]
  const sub            = profileData?.subscription ?? null
  const walletBalance  = walletData?.balance ?? null
  const walletCurrency = walletData?.currency ?? 'XAF'

  // ── Stats ──────────────────────────────────────────────────────────────────

  const { totalSpent, thisMonth, paidCount } = useMemo(() => {
    const paid = allReceipts.filter(r => r.status === 'paid' || r.status === 'completed')
    const now  = new Date()
    const monthPaid = paid.filter(r => {
      const d = new Date(r.paid_at ?? r.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    return {
      totalSpent: paid.reduce((s, r) => s + parseFloat(String(r.amount)), 0),
      thisMonth:  monthPaid.reduce((s, r) => s + parseFloat(String(r.amount)), 0),
      paidCount:  paid.length,
    }
  }, [allReceipts])

  const currency = allReceipts[0]?.currency ?? walletCurrency

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = useMemo(
    () => allReceipts.filter(r => matchesFilter(r, filter)),
    [allReceipts, filter],
  )

  // ── Group by month ─────────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const groups: { label: string; items: ReceiptItem[] }[] = []
    const seen: Record<string, number> = {}
    filtered.forEach(item => {
      const d = new Date(item.paid_at ?? item.created_at)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      if (seen[key] === undefined) {
        seen[key] = groups.length
        groups.push({ label, items: [] })
      }
      groups[seen[key]].items.push(item)
    })
    return groups
  }, [filtered])

  // ── Renewal ────────────────────────────────────────────────────────────────

  const daysLeft = sub?.expires_at
    ? Math.max(0, Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000))
    : null
  const isUrgent = daysLeft !== null && daysLeft <= 7

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      {/* ── Header ── */}
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e'] : [accent, accent + 'CC']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.headerEyebrow}>PAYMENTS</Text>
        <Text style={styles.heroAmount} numberOfLines={1}>
          {isLoading ? '—' : fmtMoneyShort(totalSpent, currency)}
        </Text>
        <Text style={styles.heroSub}>
          {isLoading ? 'Loading…' : `Lifetime across ${paidCount} payment${paidCount !== 1 ? 's' : ''}`}
        </Text>
        {!isLoading && thisMonth > 0 && (
          <View style={styles.monthChip}>
            <Calendar size={11} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />
            <Text style={styles.monthChipText}>
              {fmtMoneyShort(thisMonth, currency)} this month
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
      >

        {/* ── Financial cards row ── */}
        <View style={styles.finRow}>

          {/* Wallet */}
          <TouchableOpacity
            style={[styles.finCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/wallet')}
            activeOpacity={0.82}
          >
            <View style={[styles.finCardIcon, { backgroundColor: '#8B5CF618' }]}>
              <Wallet size={16} color="#8B5CF6" strokeWidth={1.8} />
            </View>
            <Text style={[styles.finCardLabel, { color: theme.textMuted }]}>Gym Wallet</Text>
            <Text style={[styles.finCardValue, { color: '#8B5CF6' }]} numberOfLines={1}>
              {walletBalance !== null ? fmtMoneyShort(walletBalance, walletCurrency) : '—'}
            </Text>
            <View style={styles.finCardCta}>
              <Text style={[styles.finCardCtaText, { color: theme.textMuted }]}>View</Text>
              <ChevronRight size={12} color={theme.textMuted} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {/* This month */}
          <View style={[styles.finCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.finCardIcon, { backgroundColor: accent + '18' }]}>
              <TrendingUp size={16} color={accent} strokeWidth={1.8} />
            </View>
            <Text style={[styles.finCardLabel, { color: theme.textMuted }]}>This month</Text>
            <Text style={[styles.finCardValue, { color: theme.text }]} numberOfLines={1}>
              {isLoading ? '—' : fmtMoneyShort(thisMonth, currency)}
            </Text>
            {!isLoading && totalSpent > 0 && (
              <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <View style={[
                  styles.progressFill,
                  { width: `${Math.min(thisMonth / totalSpent, 1) * 100}%` as any, backgroundColor: accent },
                ]} />
              </View>
            )}
          </View>

        </View>

        {/* ── Renewal card ── */}
        {sub && (
          <TouchableOpacity
            style={[
              styles.renewalCard,
              {
                backgroundColor: theme.surface,
                borderColor: isUrgent ? '#F59E0B' : theme.border,
                borderLeftWidth: isUrgent ? 3 : 1,
                borderLeftColor: isUrgent ? '#F59E0B' : accent + '80',
              },
            ]}
            onPress={() => router.push('/(tabs)/subscription')}
            activeOpacity={0.82}
          >
            <View style={styles.renewalBody}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.renewalEyebrow, { color: theme.textMuted }]}>
                  NEXT RENEWAL
                </Text>
                <Text style={[styles.renewalPlan, { color: theme.text }]} numberOfLines={1}>
                  {sub.plan_name}
                </Text>
                <Text style={[styles.renewalDate, { color: isUrgent ? '#F59E0B' : theme.textMuted }]}>
                  {fmtDateShort(sub.expires_at)}
                  {' · '}
                  {daysLeft === 0 ? 'Expires today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days left`}
                </Text>
              </View>
              <View style={[styles.renewalBtn, { backgroundColor: isUrgent ? '#FEF3C7' : accent + '18' }]}>
                <Text style={[styles.renewalBtnText, { color: isUrgent ? '#D97706' : accent }]}>
                  Renew
                </Text>
                <ArrowRight size={13} color={isUrgent ? '#D97706' : accent} strokeWidth={2} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── History section ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            History
            {paidCount > 0 && (
              <Text style={{ color: theme.textMuted }}> · {paidCount} paid</Text>
            )}
          </Text>
        </View>

        {/* ── Filter tabs ── */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => {
            const active = filter === f.key
            return (
              <TouchableOpacity
                key={f.key}
                style={styles.filterTab}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterTabText,
                  { color: active ? accent : theme.textMuted },
                ]}>
                  {f.label}
                </Text>
                {active && (
                  <View style={[styles.filterUnderline, { backgroundColor: accent }]} />
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── Receipt list ── */}
        {isError ? (
          <EmptyState
            icon={Receipt}
            title="Could not load"
            subtitle="Something went wrong fetching your payment history."
            action={{ label: 'Try again', onPress: refetch }}
            iconColor="#EF4444"
          />
        ) : isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map(i => <CardSkeleton key={i} theme={theme} index={i} />)}
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={filter === 'all' ? 'No payments yet' : `No ${filter} payments`}
            subtitle={
              filter === 'all'
                ? 'Your receipts will appear here once you make a payment.'
                : `You have no ${filter} transactions.`
            }
          />
        ) : (
          <View style={styles.list}>
            {grouped.map(group => (
              <View key={group.label}>
                <Text style={[styles.monthLabel, { color: theme.textMuted }]}>
                  {group.label}
                </Text>
                {group.items.map((item, index) => (
                  <ReceiptCard
                    key={item.id}
                    item={item}
                    index={index}
                    accent={accent}
                    theme={theme}
                    isDark={isDark}
                    gymName={gymName}
                  />
                ))}
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

  // ── Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerEyebrow: {
    fontSize: 11,
    fontFamily: F.bold,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 38,
    fontFamily: F.extrabold,
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: F.regular,
    color: 'rgba(255,255,255,0.60)',
    marginTop: 3,
  },
  monthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  monthChipText: {
    fontSize: 12,
    fontFamily: F.semibold,
    color: 'rgba(255,255,255,0.80)',
  },

  // ── Body
  body: { padding: 16, gap: 10 },

  // ── Financial cards row
  finRow: { flexDirection: 'row', gap: 10 },
  finCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 3,
  },
  finCardIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  finCardLabel: { fontSize: 11, fontFamily: F.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  finCardValue: { fontSize: 18, fontFamily: F.extrabold, marginTop: 1 },
  finCardSub:   { fontSize: 11, fontFamily: F.regular, marginTop: 1 },
  progressTrack: { height: 4, borderRadius: 99, marginTop: 8, overflow: 'hidden' },
  progressFill:  { height: 4, borderRadius: 99 },
  finCardCta:   { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  finCardCtaText: { fontSize: 12, fontFamily: F.medium },

  // ── Renewal card
  renewalCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  renewalBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  renewalEyebrow: { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  renewalPlan:    { fontSize: 15, fontFamily: F.bold },
  renewalDate:    { fontSize: 12, fontFamily: F.medium, marginTop: 2 },
  renewalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, flexShrink: 0,
  },
  renewalBtnText: { fontSize: 13, fontFamily: F.bold },

  // ── Section header
  sectionHeader: {
    paddingTop: 6, paddingBottom: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: F.bold,
  },

  // ── Filter tabs
  filterRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
    marginBottom: 4,
  },
  filterTab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    position: 'relative',
  },
  filterTabText: {
    fontSize: 13,
    fontFamily: F.semibold,
  },
  filterUnderline: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 2, borderRadius: 99,
  },

  // ── Month group label
  monthLabel: {
    fontSize: 11,
    fontFamily: F.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 2,
  },

  // ── List
  list: { gap: 0 },
  skeletons: { gap: 8 },
  skeleton:  { height: 96, borderRadius: 16 },

  // ── Receipt card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardInner: { paddingHorizontal: 14, paddingTop: 13 },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  typeIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardBody: { flex: 1, justifyContent: 'center' },
  cardPlan: { fontSize: 14, fontFamily: F.bold, lineHeight: 19 },
  cardMeta: { fontSize: 12, fontFamily: F.regular, marginTop: 2, lineHeight: 16 },

  cardRight: { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  cardAmount: { fontSize: 15, fontFamily: F.extrabold },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
  },
  statusText: { fontSize: 11, fontFamily: F.semibold },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9, marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  receiptId: { fontSize: 11, fontFamily: F.regular, letterSpacing: 0.3 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8,
  },
  shareLabel: { fontSize: 12, fontFamily: F.medium },
})
