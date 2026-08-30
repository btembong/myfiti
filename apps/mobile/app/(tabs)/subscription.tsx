import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Linking, Alert, ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MotiView } from 'moti'
import {
  ArrowLeft, CheckCircle, XCircle,
  RotateCcw, Phone, ChevronRight, Calendar,
  Dumbbell, Wallet, TrendingUp, AlertTriangle,
} from 'lucide-react-native'
import { TxRow, fmtTxDate } from '../../src/components/ui/TxRow'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'
import { useRouter } from 'expo-router'

function daysRemaining(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function fmtMoney(raw: number | string | null | undefined, currency: string) {
  const n = Number(raw)
  if (!raw || isNaN(n) || n === 0) return '—'
  return `${currency} ${n.toLocaleString('fr-CM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function SubscriptionScreen() {
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme, isDark } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''
  const queryClient = useQueryClient()

  const [payingWithWallet, setPayingWithWallet] = useState(false)

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn: () => memberApi.getProfile(slug),
    enabled: !!slug && !!accessToken,
  })

  const { data: receiptsData } = useQuery({
    queryKey: ['member-receipts', slug],
    queryFn: () => memberApi.getReceipts(slug),
    enabled: !!slug && !!accessToken,
  })

  const { data: walletData } = useQuery({
    queryKey: ['member-wallet', slug],
    queryFn: () => memberApi.getWallet(slug),
    enabled: !!slug && !!accessToken,
  })

  const sub      = data?.subscription
  const gym      = data?.gym
  const stats    = data?.stats
  const receipts = (receiptsData?.receipts ?? []).filter(r => r.status === 'completed').slice(0, 3)
  const currency = gym?.currency ?? 'XAF'
  const walletBalance = walletData?.balance ?? 0

  const daysLeft   = sub?.expires_at ? daysRemaining(sub.expires_at) : 0
  const totalDays  = sub?.started_at && sub?.expires_at
    ? Math.max(1, Math.ceil((new Date(sub.expires_at).getTime() - new Date(sub.started_at).getTime()) / 86400000))
    : 30
  const consumed   = sub ? Math.max(0, Math.min(1, 1 - daysLeft / totalDays)) : 0
  const isExpired  = sub?.status === 'expired' || sub?.status === 'cancelled'
  const isExpiring = daysLeft <= 7 && (sub?.status === 'active' || sub?.status === 'expiring_soon')
  const isGrace    = sub?.status === 'grace_period'

  const statusColor = isExpired || isGrace ? '#EF4444'
    : isExpiring ? '#F59E0B'
    : '#22C55E'
  const StatusIcon  = isExpired || isGrace ? XCircle
    : isExpiring ? AlertTriangle
    : CheckCircle
  const statusLabel = isExpired ? 'Expired'
    : isGrace ? 'Grace period'
    : isExpiring ? `Expiring in ${daysLeft}d`
    : 'Active'

  async function handleWalletPay() {
    if (!sub) return
    const price = sub.plan_price ?? 0
    if (walletBalance < price) {
      Alert.alert(
        'Insufficient balance',
        `Your wallet has ${fmtMoney(walletBalance, currency)} but the plan costs ${fmtMoney(price, currency)}. Top up your wallet first.`,
        [{ text: 'Top Up', onPress: () => router.push('/wallet') }, { text: 'Cancel', style: 'cancel' }],
      )
      return
    }
    Alert.alert(
      'Pay with wallet?',
      `${fmtMoney(price, currency)} will be deducted from your wallet to renew your ${sub.plan_name} plan.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setPayingWithWallet(true)
            try {
              const res = await memberApi.walletPaySubscription(slug)
              queryClient.invalidateQueries({ queryKey: ['member-wallet', slug] })
              queryClient.invalidateQueries({ queryKey: ['member-profile', slug] })
              Alert.alert(
                'Renewed!',
                `Your membership has been extended to ${new Date(res.newEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.\nWallet balance: ${fmtMoney(res.newBalance, currency)}`,
              )
            } catch (err: any) {
              Alert.alert('Payment failed', err?.message ?? 'Please try again.')
            } finally {
              setPayingWithWallet(false)
            }
          },
        },
      ],
    )
  }

  function callGym() {
    const phone = (gym as any)?.phone
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() =>
        Alert.alert('Cannot call', 'Unable to open the phone app.')
      )
    } else {
      Alert.alert('Contact your gym', 'Visit the reception desk to renew your membership.')
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      {/* ── Hero ── */}
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e'] : [accent, accent + 'BB']}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.heroNav}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>My Membership</Text>
          <View style={{ width: 40 }} />
        </View>

        {isLoading ? (
          <View style={[styles.heroSkeleton, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
        ) : sub ? (
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 360 }}
            style={styles.heroCard}
          >
            {/* Plan name + status */}
            <View style={styles.heroCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroPlanName, { color: theme.text }]} numberOfLines={1}>
                  {sub.plan_name}
                </Text>
                <Text style={[styles.heroPlanPrice, { color: accent }]}>
                  {fmtMoney(sub.plan_price, currency)} / cycle
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
                <StatusIcon size={12} color={statusColor} strokeWidth={2} />
                <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressWrap}>
              <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <View style={[styles.progressFill, { width: `${consumed * 100}%` as any, backgroundColor: statusColor }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={[styles.progressText, { color: theme.textSub }]}>
                  {isExpired ? 'Expired' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                </Text>
                <Text style={[styles.progressText, { color: theme.textSub }]}>
                  {sub.expires_at ? fmtDate(sub.expires_at) : '—'}
                </Text>
              </View>
            </View>

            {/* Date row */}
            <View style={styles.heroDateRow}>
              <View style={styles.heroDateCell}>
                <Text style={[styles.heroDateLabel, { color: theme.textMuted }]}>STARTED</Text>
                <Text style={[styles.heroDateValue, { color: theme.text }]}>
                  {sub.started_at ? fmtDate(sub.started_at) : '—'}
                </Text>
              </View>
              <View style={[styles.heroDateDivider, { backgroundColor: theme.border }]} />
              <View style={styles.heroDateCell}>
                <Text style={[styles.heroDateLabel, { color: theme.textMuted }]}>EXPIRES</Text>
                <Text style={[styles.heroDateValue, { color: theme.text }]}>
                  {sub.expires_at ? fmtDate(sub.expires_at) : '—'}
                </Text>
              </View>
              <View style={[styles.heroDateDivider, { backgroundColor: theme.border }]} />
              <View style={styles.heroDateCell}>
                <Text style={[styles.heroDateLabel, { color: theme.textMuted }]}>AUTO-RENEW</Text>
                <Text style={[styles.heroDateValue, { color: sub.auto_renew ? accent : theme.textMuted }]}>
                  {sub.auto_renew ? 'On' : 'Off'}
                </Text>
              </View>
            </View>
          </MotiView>
        ) : (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.heroCard}
          >
            <Text style={[styles.heroPlanName, { color: theme.text }]}>No active plan</Text>
            <Text style={[styles.heroPlanPrice, { color: theme.textMuted }]}>
              Contact your gym to get started
            </Text>
          </MotiView>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
      >
        {isError ? (
          <View style={styles.errWrap}>
            <Text style={[styles.errText, { color: theme.textSub }]}>Could not load membership</Text>
            <TouchableOpacity onPress={() => refetch()}>
              <Text style={[styles.retryText, { color: accent }]}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Stats row ── */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 60 }}
              style={styles.statsRow}
            >
              {[
                {
                  icon: Dumbbell,
                  label: 'Visits this month',
                  value: isLoading ? '—' : String(stats?.visitsThisMonth ?? 0),
                },
                {
                  icon: TrendingUp,
                  label: 'Last visit',
                  value: isLoading ? '—' : (stats?.lastVisit ? fmtDateShort(stats.lastVisit) : 'None'),
                },
                {
                  icon: Wallet,
                  label: 'Wallet balance',
                  value: isLoading ? '—' : fmtMoney(walletBalance, currency),
                },
              ].map(({ icon: Icon, label, value }) => (
                <View key={label} style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: accent + '18' }]}>
                    <Icon size={15} color={accent} strokeWidth={1.8} />
                  </View>
                  <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
                </View>
              ))}
            </MotiView>

            {/* ── Expiry / grace alert ── */}
            {(isExpired || isExpiring || isGrace) && sub && (
              <MotiView
                from={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'timing', duration: 280, delay: 80 }}
                style={[styles.alertCard, { backgroundColor: statusColor + '0E', borderColor: statusColor + '30' }]}
              >
                <View style={[styles.alertIcon, { backgroundColor: statusColor + '18' }]}>
                  <StatusIcon size={20} color={statusColor} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: statusColor }]}>
                    {isExpired ? 'Membership expired'
                      : isGrace ? `Grace period — renew before ${sub.expires_at ? fmtDate(sub.expires_at) : ''}`
                      : `Expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                  </Text>
                  <Text style={[styles.alertSub, { color: theme.textSub }]}>
                    Renew now to keep your gym access uninterrupted.
                  </Text>
                  <TouchableOpacity
                    style={[styles.callBtn, { borderColor: statusColor + '40' }]}
                    onPress={callGym}
                  >
                    <Phone size={12} color={statusColor} strokeWidth={1.8} />
                    <Text style={[styles.callBtnText, { color: statusColor }]}>Call gym</Text>
                  </TouchableOpacity>
                </View>
              </MotiView>
            )}

            {/* ── Wallet shortcut ── */}
            <TouchableOpacity
              style={[styles.shortcutRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/wallet')}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: '#7C3AED18' }]}>
                <Wallet size={16} color="#7C3AED" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shortcutLabel, { color: theme.text }]}>My Wallet</Text>
                <Text style={[styles.shortcutSub, { color: theme.textMuted }]}>
                  {fmtMoney(walletBalance, currency)} available
                </Text>
              </View>
              <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>

            {/* ── Progress shortcut ── */}
            <TouchableOpacity
              style={[styles.shortcutRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/(tabs)/progress')}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: accent + '18' }]}>
                <TrendingUp size={16} color={accent} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shortcutLabel, { color: theme.text }]}>My Progress</Text>
                <Text style={[styles.shortcutSub, { color: theme.textMuted }]}>
                  {stats?.visitsThisMonth ?? 0} visit{(stats?.visitsThisMonth ?? 0) !== 1 ? 's' : ''} this month
                </Text>
              </View>
              <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>

            {/* ── Renew CTA ── */}
            {sub && (
              <>
                {/* Payment method row */}
                <View style={styles.payRow}>
                  {/* Mobile Money */}
                  <TouchableOpacity
                    style={[styles.payOption, { borderColor: theme.border, backgroundColor: theme.surface }]}
                    onPress={() => router.push('/plans')}
                    activeOpacity={0.85}
                  >
                    <RotateCcw size={18} color={accent} strokeWidth={2} />
                    <Text style={[styles.payOptionTitle, { color: theme.text }]}>Mobile Money</Text>
                    <Text style={[styles.payOptionSub, { color: theme.textMuted }]}>Pay via USSD</Text>
                  </TouchableOpacity>

                  {/* Wallet */}
                  <TouchableOpacity
                    style={[
                      styles.payOption,
                      walletBalance >= (sub.plan_price ?? 0)
                        ? { borderColor: accent, backgroundColor: accent + '0C' }
                        : { borderColor: theme.border, backgroundColor: theme.surface, opacity: 0.6 },
                    ]}
                    onPress={handleWalletPay}
                    disabled={payingWithWallet}
                    activeOpacity={0.85}
                  >
                    {payingWithWallet ? (
                      <ActivityIndicator size="small" color={accent} />
                    ) : (
                      <Wallet size={18} color={walletBalance >= (sub.plan_price ?? 0) ? accent : theme.textMuted} strokeWidth={1.8} />
                    )}
                    <Text style={[styles.payOptionTitle, { color: walletBalance >= (sub.plan_price ?? 0) ? accent : theme.text }]}>
                      Wallet
                    </Text>
                    <Text style={[styles.payOptionSub, { color: theme.textMuted }]}>
                      {fmtMoney(walletBalance, currency)}
                    </Text>
                    {walletBalance >= (sub.plan_price ?? 0) && (
                      <View style={[styles.payOptionBadge, { backgroundColor: accent }]}>
                        <Text style={styles.payOptionBadgeText}>Ready</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.plansBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  onPress={() => router.push('/plans')}
                  activeOpacity={0.8}
                >
                  <Calendar size={15} color={accent} strokeWidth={1.8} />
                  <Text style={[styles.plansBtnText, { color: theme.text }]}>View available plans</Text>
                  <ChevronRight size={15} color={theme.textMuted} strokeWidth={1.8} />
                </TouchableOpacity>
              </>
            )}

            {!sub && !isLoading && (
              <TouchableOpacity
                style={[styles.renewBtn, { backgroundColor: accent }]}
                onPress={() => router.push('/plans')}
                activeOpacity={0.85}
              >
                <Calendar size={16} color="#fff" strokeWidth={2} />
                <Text style={styles.renewBtnText}>Browse membership plans</Text>
              </TouchableOpacity>
            )}

            {/* ── Recent payments ── */}
            {receipts.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>RECENT PAYMENTS</Text>
                <View style={[styles.txCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {receipts.map((r: any, i: number) => (
                    <TxRow
                      key={r.id}
                      circleKey={r.provider ?? r.payment_type ?? 'membership'}
                      title={r.plan_name ?? 'Membership'}
                      dateStr={fmtTxDate(r.paid_at ?? r.created_at)}
                      amount={r.amount}
                      currency={currency}
                      category={r.payment_type === 'day_pass' ? 'Day Pass' : 'Membership'}
                      isCredit={false}
                      isLast={i === receipts.length - 1}
                      dividerColor={theme.border}
                      theme={theme}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.allPaymentsBtn, { borderColor: theme.border }]}
                  onPress={() => router.push('/(tabs)/payments')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.allPaymentsBtnText, { color: accent }]}>View all payments</Text>
                  <ChevronRight size={14} color={accent} strokeWidth={2} />
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Hero */
  hero:    { paddingHorizontal: 20, paddingBottom: 28 },
  heroNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 18, fontFamily: F.bold, color: '#fff' },

  heroSkeleton: { height: 160, borderRadius: 20 },

  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20, padding: 20, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  heroCardTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroPlanName: { fontSize: 20, fontFamily: F.extrabold },
  heroPlanPrice:{ fontSize: 13, fontFamily: F.semibold, marginTop: 3 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 99, borderWidth: 1,
  },
  statusPillText: { fontSize: 12, fontFamily: F.bold },

  progressWrap:   { gap: 7 },
  progressTrack:  { height: 6, borderRadius: 99, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 99 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText:   { fontSize: 11, fontFamily: F.medium },

  heroDateRow: { flexDirection: 'row', alignItems: 'center' },
  heroDateCell: { flex: 1, alignItems: 'center', gap: 3 },
  heroDateDivider: { width: 1, height: 32 },
  heroDateLabel: { fontSize: 9, fontFamily: F.bold, letterSpacing: 0.8, textTransform: 'uppercase' },
  heroDateValue: { fontSize: 13, fontFamily: F.semibold },

  /* Body */
  body: { padding: 16, gap: 10 },

  errWrap:   { alignItems: 'center', gap: 8, paddingTop: 40 },
  errText:   { fontSize: 15, fontFamily: F.medium },
  retryText: { fontSize: 14, fontFamily: F.semibold },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    padding: 12, alignItems: 'center', gap: 5,
  },
  statIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statValue:    { fontSize: 14, fontFamily: F.extrabold, textAlign: 'center' },
  statLabel:    { fontSize: 10, fontFamily: F.regular, textAlign: 'center', lineHeight: 14 },

  /* Alert */
  alertCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  alertIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 13, fontFamily: F.bold },
  alertSub:   { fontSize: 12, fontFamily: F.regular, marginTop: 3, lineHeight: 17 },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start',
  },
  callBtnText: { fontSize: 12, fontFamily: F.bold },

  /* Wallet shortcut */
  shortcutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  shortcutIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 14, fontFamily: F.semibold },
  shortcutSub:   { fontSize: 12, fontFamily: F.regular, marginTop: 1 },

  /* Payment method picker */
  payRow: { flexDirection: 'row', gap: 10 },
  payOption: {
    flex: 1, borderRadius: 16, borderWidth: 1.5,
    padding: 14, alignItems: 'center', gap: 6,
  },
  payOptionTitle: { fontSize: 13, fontFamily: F.bold, textAlign: 'center' },
  payOptionSub:   { fontSize: 11, fontFamily: F.regular, textAlign: 'center' },
  payOptionBadge: {
    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2,
  },
  payOptionBadgeText: { fontSize: 10, fontFamily: F.bold, color: '#fff' },

  /* CTA buttons */
  renewBtn: {
    height: 52, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  renewBtnText: { fontSize: 15, fontFamily: F.bold, color: '#fff' },
  plansBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  plansBtnText: { flex: 1, fontSize: 14, fontFamily: F.medium },

  /* Recent payments */
  sectionTitle: {
    fontSize: 11, fontFamily: F.bold, letterSpacing: 0.9,
    textTransform: 'uppercase', marginTop: 4, marginBottom: 2,
  },
  txCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 2 },

  allPaymentsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  allPaymentsBtnText: { fontSize: 13, fontFamily: F.semibold },
})
