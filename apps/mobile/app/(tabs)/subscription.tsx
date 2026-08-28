import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Linking, Alert,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { MotiView } from 'moti'
import {
  CreditCard, CheckCircle, XCircle, Clock,
  RotateCcw, Phone, ChevronRight, Calendar,
} from 'lucide-react-native'
import { Screen } from '../../src/components/ui/Screen'
import { Card } from '../../src/components/ui/Card'
import { Badge } from '../../src/components/ui/Badge'
import { AppHeader } from '../../src/components/ui/AppHeader'
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
function fmtMoney(amount: number | null | undefined, currency: string) {
  if (!amount) return '—'
  return `${currency} ${amount.toLocaleString('fr-CM')}`
}

export default function SubscriptionScreen() {
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme } = useTheme()
  const router = useRouter()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''

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

  const sub      = data?.subscription
  const gym      = data?.gym
  const receipts = (receiptsData?.receipts ?? []).slice(0, 4)
  const currency = gym?.currency ?? 'XAF'

  const daysLeft  = sub?.expires_at ? daysRemaining(sub.expires_at) : 0
  const totalDays = sub?.started_at && sub?.expires_at
    ? Math.max(1, Math.ceil((new Date(sub.expires_at).getTime() - new Date(sub.started_at).getTime()) / 86400000))
    : 30
  const consumed   = sub ? Math.max(0, Math.min(1, 1 - daysLeft / totalDays)) : 0
  const isExpired  = sub?.status === 'expired' || sub?.status === 'cancelled'
  const isExpiring = daysLeft <= 7 && (sub?.status === 'active' || sub?.status === 'expiring_soon')

  let statusColor = accent
  let StatusIcon  = CheckCircle
  if (isExpired)       { statusColor = '#EF4444'; StatusIcon = XCircle }
  else if (isExpiring) { statusColor = '#F59E0B'; StatusIcon = Clock }

  const statusLabel = isExpired ? 'Expired' : isExpiring ? 'Expiring' : 'Active'
  const statusVariant = isExpired ? 'danger' : isExpiring ? 'warning' : 'success'

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
    <Screen>
      <AppHeader title="My Membership" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
        showsVerticalScrollIndicator={false}
      >
        {isError ? (
          <View style={styles.empty}>
            <CreditCard size={40} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { color: theme.textSub }]}>Could not load membership</Text>
            <TouchableOpacity onPress={() => refetch()}>
              <Text style={[styles.retryText, { color: accent }]}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <MotiView
            from={{ opacity: 0.4 }} animate={{ opacity: 1 }}
            transition={{ loop: true, type: 'timing', duration: 900 }}
            style={[styles.skeleton, { backgroundColor: theme.skeleton }]}
          />
        ) : sub ? (
          <>
            {/* Main plan card */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 360 }}>
              <Card padding={20} style={styles.planCard}>
                {/* Top */}
                <View style={styles.planTop}>
                  <View>
                    <Text style={[styles.planName, { color: theme.text }]}>{sub.plan_name}</Text>
                    <Text style={[styles.planPrice, { color: accent }]}>
                      {fmtMoney(sub.plan_price, currency)} / cycle
                    </Text>
                  </View>
                  <Badge label={statusLabel} variant={statusVariant} size="md" />
                </View>

                {/* Progress bar */}
                <View style={styles.progressWrap}>
                  <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                    <View style={[
                      styles.progressFill,
                      { width: `${consumed * 100}%` as any, backgroundColor: statusColor },
                    ]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={[styles.progressText, { color: theme.textSub }]}>{daysLeft} days left</Text>
                    <Text style={[styles.progressText, { color: theme.textSub }]}>
                      Expires {fmtDate(sub.expires_at)}
                    </Text>
                  </View>
                </View>

                {/* Dates */}
                <View style={styles.datesRow}>
                  {sub.started_at && (
                    <View style={styles.dateCell}>
                      <Text style={[styles.dateCellLabel, { color: theme.textMuted }]}>STARTED</Text>
                      <Text style={[styles.dateCellValue, { color: theme.text }]}>{fmtDate(sub.started_at)}</Text>
                    </View>
                  )}
                  {sub.expires_at && (
                    <View style={styles.dateCell}>
                      <Text style={[styles.dateCellLabel, { color: theme.textMuted }]}>EXPIRES</Text>
                      <Text style={[styles.dateCellValue, { color: theme.text }]}>{fmtDate(sub.expires_at)}</Text>
                    </View>
                  )}
                </View>

                {/* Auto-renew */}
                <View style={[styles.autoRenewRow, { borderTopColor: theme.border }]}>
                  <RotateCcw size={13} color={theme.textMuted} strokeWidth={1.8} />
                  <Text style={[styles.autoRenewText, { color: theme.textSub }]}>Auto-renew</Text>
                  <View style={[
                    styles.autoRenewPill,
                    { backgroundColor: sub.auto_renew ? accent + '18' : theme.surfaceHigh },
                  ]}>
                    <Text style={[styles.autoRenewVal, { color: sub.auto_renew ? accent : theme.textMuted }]}>
                      {sub.auto_renew ? 'On' : 'Off'}
                    </Text>
                  </View>
                </View>
              </Card>
            </MotiView>

            {/* Expiry notice */}
            {(isExpired || isExpiring) && (
              <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'timing', duration: 300, delay: 100 }}>
                <Card padding={16} style={[styles.alertCard, { borderColor: statusColor + '40' }]}>
                  <View style={styles.alertInner}>
                    <View style={[styles.alertIcon, { backgroundColor: statusColor + '14' }]}>
                      <StatusIcon size={20} color={statusColor} strokeWidth={1.8} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, { color: statusColor }]}>
                        {isExpired ? 'Subscription expired' : `Expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                      </Text>
                      <Text style={[styles.alertSub, { color: theme.textSub }]}>
                        Contact your gym to renew your membership.
                      </Text>
                      <TouchableOpacity style={[styles.callBtn, { borderColor: statusColor + '40' }]} onPress={callGym}>
                        <Phone size={13} color={statusColor} strokeWidth={1.8} />
                        <Text style={[styles.callBtnText, { color: statusColor }]}>Call gym</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              </MotiView>
            )}

            {/* Renew / View plans */}
            <TouchableOpacity
              style={[styles.renewBtn, { backgroundColor: accent }]}
              onPress={() => router.push('/renew')}
              activeOpacity={0.85}
            >
              <RotateCcw size={16} color="#fff" strokeWidth={2} />
              <Text style={styles.renewBtnText}>Renew with Mobile Money</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.plansBtn, { borderColor: theme.border, backgroundColor: theme.surfaceHigh }]}
              onPress={() => router.push('/plans')}
              activeOpacity={0.8}
            >
              <Calendar size={16} color={accent} strokeWidth={1.8} />
              <Text style={[styles.plansBtnText, { color: theme.text }]}>View available plans</Text>
              <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
          </>
        ) : (
          <Card padding={28} style={styles.emptyCard}>
            <CreditCard size={48} color={theme.textMuted} strokeWidth={1.2} />
            <Text style={[styles.emptyTitle, { color: theme.textSub }]}>No active plan</Text>
            <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
              Contact your gym to get started with a membership.
            </Text>
            <TouchableOpacity style={[styles.callBtn, { borderColor: accent + '40' }]} onPress={callGym}>
              <Phone size={13} color={accent} strokeWidth={1.8} />
              <Text style={[styles.callBtnText, { color: accent }]}>Contact gym</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Recent payments */}
        {receipts.length > 0 && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 360, delay: 160 }}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>RECENT PAYMENTS</Text>
            {receipts.map((r, i) => (
              <MotiView key={r.id}
                from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 280, delay: 180 + i * 40 }}
                style={styles.receiptWrap}
              >
                <Card padding={0} style={styles.receiptCard}>
                  <View style={[styles.receiptBar, { backgroundColor: accent }]} />
                  <View style={styles.receiptBody}>
                    <View style={styles.receiptLeft}>
                      <Text style={[styles.receiptPlan, { color: theme.text }]} numberOfLines={1}>
                        {r.plan_name ?? 'Membership'}
                      </Text>
                      <Text style={[styles.receiptDate, { color: theme.textMuted }]}>
                        {r.paid_at ? fmtDate(r.paid_at) : fmtDate(r.created_at)}
                      </Text>
                    </View>
                    <View style={styles.receiptRight}>
                      <Text style={[styles.receiptAmount, { color: theme.text }]}>
                        {currency} {r.amount.toLocaleString('fr-CM')}
                      </Text>
                      <Badge label="Paid" variant="success" />
                    </View>
                  </View>
                </Card>
              </MotiView>
            ))}
          </MotiView>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },

  skeleton: { height: 220, borderRadius: 18 },

  planCard: { gap: 16, borderRadius: 20 },
  planTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName: { fontSize: 20, fontFamily: F.extrabold },
  planPrice:{ fontSize: 14, fontFamily: F.semibold, marginTop: 3 },

  progressWrap:   { gap: 8 },
  progressTrack:  { height: 7, borderRadius: 99, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 99 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText:   { fontSize: 12, fontFamily: F.medium },

  datesRow:      { flexDirection: 'row', gap: 24 },
  dateCell:      { gap: 3 },
  dateCellLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.8, textTransform: 'uppercase' },
  dateCellValue: { fontSize: 14, fontFamily: F.semibold },

  autoRenewRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, paddingTop: 14 },
  autoRenewText: { flex: 1, fontSize: 13, fontFamily: F.medium },
  autoRenewPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  autoRenewVal:  { fontSize: 12, fontFamily: F.bold },

  alertCard:  { borderWidth: 1.5 },
  alertInner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  alertIcon:  { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 14, fontFamily: F.bold },
  alertSub:   { fontSize: 12, fontFamily: F.regular, marginTop: 3, lineHeight: 17 },

  callBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  callBtnText: { fontSize: 13, fontFamily: F.bold },

  renewBtn: {
    height: 52, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  renewBtnText: { fontSize: 15, fontFamily: F.bold, color: '#fff' },

  plansBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  plansBtnText: { flex: 1, fontSize: 15, fontFamily: F.medium },

  emptyCard:  { borderRadius: 20, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: F.bold },
  emptyBody:  { fontSize: 13, fontFamily: F.regular, textAlign: 'center', lineHeight: 20 },

  sectionTitle: { fontSize: 11, fontFamily: F.bold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  receiptWrap:  { marginBottom: 8 },
  receiptCard:  { flexDirection: 'row', overflow: 'hidden', borderRadius: 14 },
  receiptBar:   { width: 4 },
  receiptBody:  { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  receiptLeft:  { flex: 1, marginRight: 12 },
  receiptPlan:  { fontSize: 14, fontFamily: F.bold },
  receiptDate:  { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  receiptRight: { alignItems: 'flex-end', gap: 4 },
  receiptAmount:{ fontSize: 15, fontFamily: F.extrabold },

  empty:     { alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 16, fontFamily: F.bold },
  retryText: { fontSize: 14, fontFamily: F.semibold, marginTop: 4 },
})
