import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { F } from '../../theme'

// ─── Provider / type → circle metadata ────────────────────────────────────────

export const TX_CIRCLE: Record<string, { bg: string; initials: string }> = {
  // Payment providers
  mtn_momo:             { bg: '#FFCB00', initials: 'MTN' },
  orange_money:         { bg: '#FF6600', initials: 'OM'  },
  cash:                 { bg: '#4ADE80', initials: '$'   },
  card:                 { bg: '#3B82F6', initials: 'Cd'  },
  tranzak:              { bg: '#0EA5E9', initials: 'TZ'  },
  wallet:               { bg: '#8B5CF6', initials: 'W'   },
  voucher:              { bg: '#EC4899', initials: 'V'   },
  // Wallet transaction types
  topup:                { bg: '#22C55E', initials: '+'   },
  credit:               { bg: '#22C55E', initials: '+'   },
  referral_credit:      { bg: '#06B6D4', initials: 'Ref' },
  transfer:             { bg: '#6366F1', initials: 'T'   },
  debit:                { bg: '#EF4444', initials: '−'   },
  subscription_payment: { bg: '#8B5CF6', initials: 'Sub' },
  cashout:              { bg: '#F59E0B', initials: 'Out' },
  voucher_redeem:       { bg: '#EC4899', initials: 'V'   },
  // Payment types (used when provider is the key source)
  membership:           { bg: '#6366F1', initials: 'M'   },
  day_pass:             { bg: '#F59E0B', initials: 'D'   },
}

export function getCircle(key: string) {
  return TX_CIRCLE[key] ?? { bg: '#9CA3AF', initials: '?' }
}

// ─── Date formatter ───────────────────────────────────────────────────────────

export function fmtTxDate(iso: string | null): string {
  if (!iso) return '—'
  const d         = new Date(iso)
  const now       = new Date()
  const todayMs   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const itemMs    = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (itemMs === todayMs) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getDateBucket(iso: string | null): string {
  if (!iso) return 'Earlier'
  const d        = new Date(iso)
  const now      = new Date()
  const todayMs  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const itemMs   = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((todayMs - itemMs) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)   return 'This Week'
  return 'Earlier'
}

export const BUCKET_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier']

// ─── TxRow component ──────────────────────────────────────────────────────────

interface TxRowProps {
  circleKey : string
  title     : string
  dateStr   : string
  amount    : number | string
  currency  : string
  category  : string
  isCredit  : boolean
  isLast   ?: boolean
  dividerColor?: string
  theme     : {
    text: string; textSub: string; textMuted: string
    surface: string; border: string
  }
  onPress  ?: () => void
}

export function TxRow({
  circleKey, title, dateStr, amount, currency,
  category, isCredit, isLast = false,
  dividerColor, theme, onPress,
}: TxRowProps) {
  const meta   = getCircle(circleKey)
  const n      = Number(amount)
  const amtStr = isNaN(n)
    ? '0'
    : n.toLocaleString('fr-CM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor ?? '#E5E7EB' },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Circle icon */}
      <View style={[styles.circle, { backgroundColor: meta.bg }]}>
        <Text
          style={[styles.circleText, meta.initials.length > 2 && { fontSize: 9 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {meta.initials}
        </Text>
      </View>

      {/* Title + date */}
      <View style={styles.left}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.date,  { color: theme.textMuted }]}>{dateStr}</Text>
      </View>

      {/* Amount + category */}
      <View style={styles.right}>
        <Text style={[styles.amount, { color: isCredit ? '#22C55E' : '#EF4444' }]}>
          {isCredit ? '+' : '−'}{currency} {amtStr}
        </Text>
        <Text style={[styles.category, { color: theme.textMuted }]}>{category}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  circle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  circleText: {
    fontSize: 12, fontFamily: F.extrabold, color: '#fff',
    textAlign: 'center', letterSpacing: 0.2,
  },
  left:     { flex: 1, gap: 3 },
  title:    { fontSize: 15, fontFamily: F.bold, lineHeight: 20 },
  date:     { fontSize: 12, fontFamily: F.regular },
  right:    { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  amount:   { fontSize: 15, fontFamily: F.extrabold },
  category: { fontSize: 12, fontFamily: F.regular },
})
