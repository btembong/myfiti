import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, Share, Alert } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { MotiView } from 'moti'
import { Receipt, CreditCard, Download, ChevronRight } from 'lucide-react-native'
import { Screen } from '../../src/components/ui/Screen'
import { Card } from '../../src/components/ui/Card'
import { Badge } from '../../src/components/ui/Badge'
import { AppHeader } from '../../src/components/ui/AppHeader'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'

type ReceiptItem = {
  id: string; amount: number; currency: string
  provider: string; tranzak_ref: string | null
  status: string; payment_type: string
  paid_at: string | null; created_at: string; plan_name: string | null
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('fr-CM')}`
}

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  paid:      { label: 'Paid',     variant: 'success' },
  completed: { label: 'Paid',     variant: 'success' },
  pending:   { label: 'Pending',  variant: 'warning' },
  failed:    { label: 'Failed',   variant: 'danger'  },
  refunded:  { label: 'Refunded', variant: 'neutral' },
}

const PAY_LABELS: Record<string, string> = {
  mtn_momo: 'MTN MoMo', orange_money: 'Orange Money',
  cash: 'Cash', card: 'Card', tranzak: 'Tranzak',
}

function shareReceipt(item: ReceiptItem, gymName: string) {
  const date = fmtDate(item.paid_at ?? item.created_at)
  const plan = item.plan_name ?? (item.payment_type === 'day_pass' ? 'Day Pass' : 'Membership')
  const method = PAY_LABELS[item.provider] ?? item.provider
  const ref = item.tranzak_ref ? `\nRef: ${item.tranzak_ref}` : ''
  const text = [
    `${gymName} — Payment Receipt`,
    `─────────────────────`,
    `Plan:    ${plan}`,
    `Amount:  ${fmtMoney(item.amount, item.currency)}`,
    `Method:  ${method}`,
    `Date:    ${date}`,
    `Status:  ${STATUS_BADGE[item.status]?.label ?? 'Paid'}${ref}`,
    `─────────────────────`,
    `Receipt ID: ${item.id.slice(0, 12).toUpperCase()}`,
  ].join('\n')
  Share.share({ message: text }).catch(() => {})
}

export default function PaymentsScreen() {
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme } = useTheme()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''
  const gymName = branding?.name ?? 'Gym'

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['member-receipts', slug],
    queryFn: () => memberApi.getReceipts(slug),
    enabled: !!slug && !!accessToken,
  })

  const receipts = data?.receipts ?? []

  return (
    <Screen>
      <AppHeader title="Payment History" subtitle="Your receipts & invoices" />

      {isError ? (
        <EmptyState
          icon={Receipt}
          title="Could not load"
          subtitle="Something went wrong fetching your payment history."
          action={{ label: 'Try again', onPress: refetch }}
          iconColor="#EF4444"
        />
      ) : isLoading ? (
        <View style={styles.loadingWrap}>
          {[1, 2, 3].map(i => (
            <MotiView key={i}
              from={{ opacity: 0.4 }} animate={{ opacity: 1 }}
              transition={{ loop: true, type: 'timing', duration: 800, delay: i * 100 }}
              style={[styles.skeleton, { backgroundColor: theme.skeleton }]}
            />
          ))}
        </View>
      ) : receipts.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No payments yet"
          subtitle="Your receipts and invoices will appear here once you make a payment."
        />
      ) : (
        <FlashList
          data={receipts}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
          renderItem={({ item, index }: { item: ReceiptItem; index: number }) => {
            const badge = STATUS_BADGE[item.status] ?? { label: 'Paid', variant: 'success' as const }
            return (
              <MotiView
                from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 320, delay: index * 45 }}
                style={styles.cardWrap}
              >
                <Card padding={0}>
                  <View style={styles.cardInner}>
                    {/* Left accent */}
                    <View style={[styles.accentBar, { backgroundColor: accent }]} />

                    <View style={styles.cardBody}>
                      <View style={styles.topRow}>
                        <View style={styles.cardLeft}>
                          <Text style={[styles.planName, { color: theme.text }]} numberOfLines={1}>
                            {item.plan_name ?? (item.payment_type === 'day_pass' ? 'Day Pass' : 'Membership')}
                          </Text>
                          <Text style={[styles.dateText, { color: theme.textMuted }]}>
                            {fmtDate(item.paid_at ?? item.created_at)}
                          </Text>
                        </View>
                        <View style={styles.cardRight}>
                          <Text style={[styles.amountText, { color: theme.text }]}>
                            {fmtMoney(item.amount, item.currency)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.bottomRow}>
                        <View style={styles.methodRow}>
                          <CreditCard size={12} color={theme.textMuted} strokeWidth={1.8} />
                          <Text style={[styles.methodText, { color: theme.textSub }]}>
                            {PAY_LABELS[item.provider] ?? item.provider}
                          </Text>
                        </View>
                        <View style={styles.badgeRow}>
                          <Badge label={badge.label} variant={badge.variant} />
                        </View>
                      </View>

                      {item.tranzak_ref && (
                        <Text style={[styles.refText, { color: theme.textMuted }]} numberOfLines={1}>
                          Ref: {item.tranzak_ref}
                        </Text>
                      )}
                    </View>

                    {/* Download/share button */}
                    <TouchableOpacity
                      style={[styles.downloadBtn, { borderLeftColor: theme.border }]}
                      onPress={() => shareReceipt(item, gymName)}
                      activeOpacity={0.7}
                    >
                      <Download size={16} color={theme.textSub} strokeWidth={1.8} />
                    </TouchableOpacity>
                  </View>
                </Card>
              </MotiView>
            )
          }}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  loadingWrap: { padding: 16, gap: 12 },
  skeleton:    { height: 96, borderRadius: 18 },
  list:        { padding: 16 },
  cardWrap:    { marginBottom: 10 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontFamily: F.bold },
  emptySub:   { fontSize: 13, fontFamily: F.regular, textAlign: 'center' },
  retryText:  { fontSize: 14, fontFamily: F.semibold },

  cardInner: { flexDirection: 'row', overflow: 'hidden', borderRadius: 18 },
  accentBar: { width: 4 },
  cardBody:  { flex: 1, padding: 14, gap: 8 },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft:  { flex: 1, marginRight: 12 },
  cardRight: { alignItems: 'flex-end' },
  planName:  { fontSize: 15, fontFamily: F.bold },
  dateText:  { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  amountText:{ fontSize: 16, fontFamily: F.extrabold },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  methodText:{ fontSize: 12, fontFamily: F.regular },
  badgeRow:  { flexDirection: 'row', gap: 6, alignItems: 'center' },
  refText:   { fontSize: 11, fontFamily: F.regular },

  downloadBtn: {
    width: 48, alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: 1,
  },
})
