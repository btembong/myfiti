import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, Alert, Modal, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native'
import { useState, useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MotiView } from 'moti'
import { useRouter } from 'expo-router'
import {
  ArrowLeft, Plus, Wallet,
  Send, Banknote, X, RotateCcw, Tag,
} from 'lucide-react-native'
import { TxRow, TX_CIRCLE, fmtTxDate, getDateBucket, BUCKET_ORDER } from '../src/components/ui/TxRow'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

const PRESET_AMOUNTS = [1000, 2000, 5000, 10000]
const INCOME_TYPES   = ['topup', 'credit', 'referral_credit']

function fmtTxType(type: string): string {
  const map: Record<string, string> = {
    topup:                'Top-up',
    credit:               'Credit',
    referral_credit:      'Referral',
    debit:                'Debit',
    subscription_payment: 'Subscription',
    cashout:              'Cashout',
    transfer:             'Transfer',
    voucher_redeem:       'Voucher',
  }
  return map[type] ?? type
}

type WalletTx = {
  id: string; type: string; amount: number
  description: string; status: string; created_at: string
}

function fmtMoney(raw: number | string, currency: string) {
  const n = Number(raw)
  return `${currency} ${isNaN(n) ? '0' : n.toLocaleString('fr-CM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}



// ─── Action button (4-icon row) ────────────────────────────────────────────────
function ActionBtn({ icon: Icon, label, onPress }: {
  icon: any; label: string; onPress: () => void
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionIconBox, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
        <Icon size={22} color="#fff" strokeWidth={1.8} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function WalletScreen() {
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme, isDark } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const accent  = branding?.primary_color ?? '#5B8EF4'
  const slug    = branding?.slug ?? ''

  // Sheet visibility
  const [topupOpen,    setTopupOpen]    = useState(false)
  const [sendOpen,     setSendOpen]     = useState(false)
  const [cashoutOpen,  setCashoutOpen]  = useState(false)

  // Top-up form
  const [amount, setAmount]   = useState('')
  const [phone,  setPhone]    = useState('')
  const [topping, setTopping] = useState(false)

  // Send/Transfer form
  const [sendPhone,      setSendPhone]      = useState('')
  const [sendAmount,     setSendAmount]     = useState('')
  const [sendNote,       setSendNote]       = useState('')
  const [sending,        setSending]        = useState(false)
  const [looking,        setLooking]        = useState(false)
  const [resolvedId,     setResolvedId]     = useState<string | null>(null)
  const [resolvedName,   setResolvedName]   = useState<string | null>(null)

  // Cashout form
  const [cashoutAmount, setCashoutAmount] = useState('')
  const [cashoutPhone,  setCashoutPhone]  = useState('')

  // Redeem voucher form
  const [voucherOpen,   setVoucherOpen]   = useState(false)
  const [voucherCode,   setVoucherCode]   = useState('')
  const [redeeming,     setRedeeming]     = useState(false)
  const [cashingOut,    setCashingOut]    = useState(false)

  // Activity filter
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense' | 'pending'>('all')

  // Detail sheet
  const [selectedTx, setSelectedTx] = useState<WalletTx | null>(null)

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['member-wallet', slug],
    queryFn: () => memberApi.getWallet(slug),
    enabled: !!slug && !!accessToken,
  })

  const balance  = data?.balance  ?? 0
  const currency = data?.currency ?? 'XAF'
  const txs      = data?.transactions ?? []

  const filteredTxs = useMemo(() => {
    if (txFilter === 'income')  return txs.filter((tx: WalletTx) => INCOME_TYPES.includes(tx.type))
    if (txFilter === 'expense') return txs.filter((tx: WalletTx) => !INCOME_TYPES.includes(tx.type) && tx.status !== 'pending')
    if (txFilter === 'pending') return txs.filter((tx: WalletTx) => tx.status === 'pending')
    return txs
  }, [txs, txFilter])

  const groupedTxs = useMemo(() => {
    const map: Record<string, WalletTx[]> = {}
    filteredTxs.forEach((tx: WalletTx) => {
      const b = getDateBucket(tx.created_at)
      if (!map[b]) map[b] = []
      map[b].push(tx)
    })
    return BUCKET_ORDER.filter(b => map[b]).map(b => ({ bucket: b, items: map[b] }))
  }, [filteredTxs])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['member-wallet', slug] })
  }

  // ── Top-up ────────────────────────────────────────────────────────────────
  async function handleTopup() {
    const amt = parseInt(amount, 10)
    if (!amt || amt < 100) { Alert.alert('Invalid amount', 'Minimum top-up is 100.'); return }
    if (!phone.trim())     { Alert.alert('Phone required', 'Enter the Mobile Money number to charge.'); return }
    setTopping(true)
    try {
      await memberApi.walletTopup(slug, amt, phone.trim())
      setTopupOpen(false)
      setAmount('')
      Alert.alert(
        'USSD prompt sent',
        `Approve the charge on your phone (${phone.trim()}) to complete the top-up.`,
        [{ text: 'OK', onPress: () => { setTimeout(invalidate, 15_000) } }],
      )
    } catch (err: any) {
      Alert.alert('Top-up failed', err?.message ?? 'Please try again.')
    } finally {
      setTopping(false)
    }
  }

  // ── Send / Transfer ───────────────────────────────────────────────────────
  async function handleLookup() {
    if (!sendPhone.trim()) { Alert.alert('Required', 'Enter the recipient\'s phone number.'); return }
    setLooking(true)
    setResolvedId(null); setResolvedName(null)
    try {
      const res = await memberApi.walletLookupRecipient(slug, sendPhone.trim())
      setResolvedId(res.id); setResolvedName(res.name)
    } catch (err: any) {
      Alert.alert('Not found', err?.message ?? 'No member with that number.')
    } finally {
      setLooking(false)
    }
  }

  async function handleSend() {
    const amt = parseInt(sendAmount, 10)
    if (!resolvedId)   { Alert.alert('Required', 'Look up a recipient first.'); return }
    if (!amt || amt < 1)       { Alert.alert('Invalid amount', 'Enter a valid amount.'); return }
    if (amt > balance)         { Alert.alert('Insufficient balance', `Your balance is ${fmtMoney(balance, currency)}.`); return }
    setSending(true)
    try {
      const res = await memberApi.walletTransfer(slug, resolvedId, amt, sendNote.trim() || undefined)
      setSendOpen(false)
      setSendPhone(''); setSendAmount(''); setSendNote('')
      setResolvedId(null); setResolvedName(null)
      invalidate()
      Alert.alert('Sent!', `${fmtMoney(amt, currency)} sent to ${res.recipientName}.\nNew balance: ${fmtMoney(res.senderBalance, currency)}`)
    } catch (err: any) {
      Alert.alert('Transfer failed', err?.message ?? 'Please try again.')
    } finally {
      setSending(false)
    }
  }

  // ── Cash out ──────────────────────────────────────────────────────────────
  async function handleCashout() {
    const amt = parseInt(cashoutAmount, 10)
    if (!amt || amt < 500)       { Alert.alert('Invalid amount', 'Minimum cashout is 500.'); return }
    if (amt > balance)           { Alert.alert('Insufficient balance', `Your balance is ${fmtMoney(balance, currency)}.`); return }
    if (!cashoutPhone.trim())    { Alert.alert('Phone required', 'Enter the Mobile Money number to receive funds.'); return }
    setCashingOut(true)
    try {
      const res = await memberApi.walletCashout(slug, amt, cashoutPhone.trim())
      setCashoutOpen(false)
      setCashoutAmount(''); setCashoutPhone('')
      Alert.alert(
        'Cashout initiated',
        `${fmtMoney(amt, currency)} is being sent to ${cashoutPhone.trim()}. Your new balance is ${fmtMoney(res.newBalance, currency)}.`,
        [{ text: 'OK', onPress: () => setTimeout(invalidate, 10_000) }],
      )
    } catch (err: any) {
      Alert.alert('Cashout failed', err?.message ?? 'Please try again.')
    } finally {
      setCashingOut(false)
    }
  }

  // ── Redeem voucher ────────────────────────────────────────────────────────
  async function handleRedeem() {
    const code = voucherCode.trim()
    if (!code) { Alert.alert('Required', 'Enter your voucher code.'); return }
    setRedeeming(true)
    try {
      const res = await memberApi.redeemVoucher(slug, code)
      setVoucherOpen(false)
      setVoucherCode('')
      invalidate()
      Alert.alert(
        'Voucher redeemed!',
        `${fmtMoney(res.credit, res.currency)} added to your wallet.\nNew balance: ${fmtMoney(res.newBalance, res.currency)}`,
      )
    } catch (err: any) {
      Alert.alert('Redemption failed', err?.message ?? 'Invalid or already used voucher code.')
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      {/* ── Hero header ── */}
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e'] : [accent, accent + 'CC']}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.heroNav}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>My Wallet</Text>
          <View style={{ width: 40 }} />
        </View>

        {isLoading ? (
          <View style={styles.balanceWrap}>
            <ActivityIndicator color="rgba(255,255,255,0.6)" />
          </View>
        ) : (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 360 }}
            style={styles.balanceWrap}
          >
            <Text style={styles.balanceLabel}>Available balance</Text>
            <Text style={styles.balanceAmount}>{fmtMoney(balance, currency)}</Text>
            <View style={[styles.walletPill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Wallet size={12} color="rgba(255,255,255,0.8)" strokeWidth={1.8} />
              <Text style={styles.walletPillText}>Gym wallet · auto-deducts on renewal</Text>
            </View>
          </MotiView>
        )}

        {/* ── 4-icon action row ── */}
        <View style={styles.actionRow}>
          <ActionBtn icon={Plus}     label="Top Up"  onPress={() => setTopupOpen(true)}   />
          <ActionBtn icon={Send}     label="Send"    onPress={() => setSendOpen(true)}    />
          <ActionBtn icon={Banknote} label="Cash Out" onPress={() => setCashoutOpen(true)} />
          <ActionBtn icon={RotateCcw} label="Renew" onPress={() => router.push('/(tabs)/subscription')} />
        </View>
      </LinearGradient>

      {/* ── Activity ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
      >
        {/* Header */}
        <View style={styles.activityHeader}>
          <Text style={[styles.activityTitle, { color: theme.text }]}>Activity</Text>
          <TouchableOpacity
            style={[styles.activityIconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setVoucherOpen(true)}
            activeOpacity={0.75}
          >
            <Tag size={15} color={theme.textMuted} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {(['all', 'income', 'expense', 'pending'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterTab,
                txFilter === f
                  ? { backgroundColor: accent }
                  : { borderColor: theme.border, borderWidth: 1, backgroundColor: theme.surface },
              ]}
              onPress={() => setTxFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterTabText, { color: txFilter === f ? '#fff' : theme.textMuted }]}>
                {f === 'all' ? 'All' : f === 'income' ? 'Income' : f === 'expense' ? 'Expense' : 'Pending'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Empty state */}
        {!isLoading && filteredTxs.length === 0 && (
          <View style={styles.emptyWrap}>
            <Wallet size={36} color={theme.textMuted} strokeWidth={1.2} />
            <Text style={[styles.emptyText, { color: theme.textSub }]}>
              {txFilter === 'all' ? 'No transactions yet' : `No ${txFilter} transactions`}
            </Text>
            {txFilter === 'all' && (
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Top up your wallet to get started
              </Text>
            )}
          </View>
        )}

        {/* Date-grouped rows */}
        {groupedTxs.map(({ bucket, items }) => (
          <View key={bucket} style={styles.group}>
            <View style={styles.bucketRow}>
              <Text style={[styles.bucketLabel, { color: theme.textMuted }]}>{bucket}</Text>
              <View style={[styles.bucketLine, { backgroundColor: theme.border }]} />
            </View>
            <View style={[styles.txCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {items.map((tx: WalletTx, i: number) => (
                <TxRow
                  key={tx.id}
                  circleKey={tx.type}
                  title={tx.description}
                  dateStr={fmtTxDate(tx.created_at)}
                  amount={tx.amount}
                  currency={currency}
                  category={fmtTxType(tx.type)}
                  isCredit={INCOME_TYPES.includes(tx.type)}
                  isLast={i === items.length - 1}
                  dividerColor={theme.border}
                  theme={theme}
                  onPress={() => setSelectedTx(tx)}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>

      {/* ── Top-up sheet ── */}
      <BottomSheet
        visible={topupOpen}
        onClose={() => setTopupOpen(false)}
        title="Top up wallet"
        subtitle="A USSD prompt will be sent to your Mobile Money number"
        insets={insets}
        theme={theme}
      >
        <View style={styles.presets}>
          {PRESET_AMOUNTS.map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.presetBtn,
                {
                  borderColor: amount === String(p) ? accent : theme.border,
                  backgroundColor: amount === String(p) ? accent + '14' : theme.surfaceHigh,
                },
              ]}
              onPress={() => setAmount(String(p))}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.presetText,
                { color: amount === String(p) ? accent : theme.textSub },
              ]}>
                {p.toLocaleString('fr-CM')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <InputRow prefix={currency} placeholder="Custom amount" value={amount} onChangeText={setAmount} keyboard="numeric" theme={theme} />
        <InputRow prefix="📱" placeholder="237 6XX XXX XXX" value={phone} onChangeText={setPhone} keyboard="phone-pad" theme={theme} style={{ marginTop: 10 }} />
        <ConfirmBtn label={`Send USSD prompt · ${currency} ${parseInt(amount || '0', 10).toLocaleString('fr-CM')}`} disabled={topping || !amount || !phone} loading={topping} accent={accent} onPress={handleTopup} />
      </BottomSheet>

      {/* ── Send / Transfer sheet ── */}
      <BottomSheet
        visible={sendOpen}
        onClose={() => { setSendOpen(false); setSendPhone(''); setSendAmount(''); setSendNote(''); setResolvedId(null); setResolvedName(null) }}
        title="Send to member"
        subtitle="Enter the recipient's phone number"
        insets={insets}
        theme={theme}
      >
        {/* Phone lookup row */}
        <View style={[styles.lookupRow, { borderColor: theme.border, backgroundColor: theme.surfaceHigh }]}>
          <Text style={[styles.inputPrefix, { color: theme.textMuted }]}>📱</Text>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="237 6XX XXX XXX"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
            value={sendPhone}
            onChangeText={v => { setSendPhone(v); setResolvedId(null); setResolvedName(null) }}
          />
          <TouchableOpacity
            style={[styles.lookupBtn, { backgroundColor: resolvedId ? '#22C55E' : accent }]}
            onPress={handleLookup}
            disabled={looking || !sendPhone.trim()}
            activeOpacity={0.8}
          >
            {looking
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.lookupBtnText}>{resolvedId ? '✓' : 'Find'}</Text>
            }
          </TouchableOpacity>
        </View>

        {resolvedName && (
          <View style={[styles.resolvedRow, { backgroundColor: '#22C55E14', borderColor: '#22C55E40' }]}>
            <Text style={[styles.resolvedText, { color: '#22C55E' }]}>Sending to: {resolvedName}</Text>
          </View>
        )}

        <InputRow prefix={currency} placeholder="Amount" value={sendAmount} onChangeText={setSendAmount} keyboard="numeric" theme={theme} style={{ marginTop: 10 }} />
        <InputRow prefix="✏️" placeholder="Note (optional)" value={sendNote} onChangeText={setSendNote} keyboard="default" theme={theme} style={{ marginTop: 10 }} />
        <Text style={[styles.balanceHint, { color: theme.textMuted }]}>
          Balance: {fmtMoney(balance, currency)}
        </Text>
        <ConfirmBtn label={`Send · ${currency} ${parseInt(sendAmount || '0', 10).toLocaleString('fr-CM')}`} disabled={sending || !resolvedId || !sendAmount} loading={sending} accent={accent} onPress={handleSend} />
      </BottomSheet>

      {/* ── Cashout sheet ── */}
      <BottomSheet
        visible={cashoutOpen}
        onClose={() => setCashoutOpen(false)}
        title="Cash out"
        subtitle={`Withdraw to Mobile Money (min ${currency} 500)`}
        insets={insets}
        theme={theme}
      >
        <View style={styles.presets}>
          {[2000, 5000, 10000, 20000].map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.presetBtn,
                {
                  borderColor: cashoutAmount === String(p) ? accent : theme.border,
                  backgroundColor: cashoutAmount === String(p) ? accent + '14' : theme.surfaceHigh,
                },
              ]}
              onPress={() => setCashoutAmount(String(p))}
              activeOpacity={0.75}
            >
              <Text style={[styles.presetText, { color: cashoutAmount === String(p) ? accent : theme.textSub }]}>
                {p.toLocaleString('fr-CM')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <InputRow prefix={currency} placeholder="Amount" value={cashoutAmount} onChangeText={setCashoutAmount} keyboard="numeric" theme={theme} />
        <InputRow prefix="📱" placeholder="237 6XX XXX XXX" value={cashoutPhone} onChangeText={setCashoutPhone} keyboard="phone-pad" theme={theme} style={{ marginTop: 10 }} />
        <Text style={[styles.balanceHint, { color: theme.textMuted }]}>
          Balance: {fmtMoney(balance, currency)}
        </Text>
        <ConfirmBtn label={`Withdraw · ${currency} ${parseInt(cashoutAmount || '0', 10).toLocaleString('fr-CM')}`} disabled={cashingOut || !cashoutAmount || !cashoutPhone} loading={cashingOut} accent={accent} onPress={handleCashout} />
      </BottomSheet>

      {/* ── Redeem voucher sheet ── */}
      <BottomSheet
        visible={voucherOpen}
        onClose={() => { setVoucherOpen(false); setVoucherCode('') }}
        title="Redeem voucher"
        subtitle="Enter the code printed on your voucher card"
        insets={insets}
        theme={theme}
      >
        <InputRow
          prefix="🎟"
          placeholder="XXXX-XXXX-XXXX"
          value={voucherCode}
          onChangeText={v => setVoucherCode(v.toUpperCase())}
          keyboard="default"
          theme={theme}
        />
        <ConfirmBtn
          label="Redeem voucher"
          disabled={redeeming || !voucherCode.trim()}
          loading={redeeming}
          accent={accent}
          onPress={handleRedeem}
        />
      </BottomSheet>

      {/* ── Transaction Detail sheet ── */}
      {selectedTx && (
        <Modal
          visible={!!selectedTx}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedTx(null)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedTx(null)} />
            <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 24 }]}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />

              {/* Title row */}
              <View style={styles.detailTitleRow}>
                <TouchableOpacity onPress={() => setSelectedTx(null)} style={styles.sheetCloseBtn} activeOpacity={0.7}>
                  <X size={18} color={theme.textMuted} strokeWidth={2} />
                </TouchableOpacity>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Transaction Details</Text>
                <View style={{ width: 34 }} />
              </View>

              {/* Hero: circle + amount + desc + status */}
              <View style={styles.detailHero}>
                <View style={[styles.detailCircle, { backgroundColor: (TX_CIRCLE[selectedTx.type] ?? { bg: '#9CA3AF' }).bg }]}>
                  <Text style={[styles.detailCircleText, (TX_CIRCLE[selectedTx.type]?.initials?.length ?? 0) > 2 && { fontSize: 14 }]}>
                    {TX_CIRCLE[selectedTx.type]?.initials ?? '?'}
                  </Text>
                </View>
                <Text style={[styles.detailAmount, { color: INCOME_TYPES.includes(selectedTx.type) ? '#22C55E' : '#EF4444' }]}>
                  {INCOME_TYPES.includes(selectedTx.type) ? '+' : '−'} {fmtMoney(selectedTx.amount, currency)}
                </Text>
                <Text style={[styles.detailDesc, { color: theme.textSub }]} numberOfLines={2}>
                  {selectedTx.description}
                </Text>
                <View style={[
                  styles.detailStatusPill,
                  {
                    backgroundColor: selectedTx.status === 'completed' ? '#22C55E18'
                      : selectedTx.status === 'pending' ? '#F59E0B18' : '#EF444418',
                    borderColor: selectedTx.status === 'completed' ? '#22C55E40'
                      : selectedTx.status === 'pending' ? '#F59E0B40' : '#EF444440',
                  },
                ]}>
                  <Text style={[
                    styles.detailStatusText,
                    {
                      color: selectedTx.status === 'completed' ? '#22C55E'
                        : selectedTx.status === 'pending' ? '#F59E0B' : '#EF4444',
                    },
                  ]}>
                    {selectedTx.status === 'completed' ? 'Completed'
                      : selectedTx.status === 'pending' ? 'Pending' : 'Failed'}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />

              {/* Detail rows */}
              <View style={styles.detailRows}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailRowLabel, { color: theme.textMuted }]}>Date & Time</Text>
                  <Text style={[styles.detailRowValue, { color: theme.text }]}>
                    {new Date(selectedTx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date(selectedTx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailRowLabel, { color: theme.textMuted }]}>Type</Text>
                  <Text style={[styles.detailRowValue, { color: theme.text }]}>{fmtTxType(selectedTx.type)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailRowLabel, { color: theme.textMuted }]}>Category</Text>
                  <Text style={[styles.detailRowValue, { color: theme.text }]}>
                    {INCOME_TYPES.includes(selectedTx.type) ? 'Income' : 'Expense'}
                  </Text>
                </View>
                {selectedTx.status === 'pending' && (
                  <View style={[styles.detailNote, { backgroundColor: '#F59E0B0E', borderColor: '#F59E0B30' }]}>
                    <Text style={styles.detailNoteText}>
                      This transaction is being processed and will update shortly.
                    </Text>
                  </View>
                )}
                {selectedTx.status === 'failed' && (
                  <View style={[styles.detailNote, { backgroundColor: '#EF44440E', borderColor: '#EF444430' }]}>
                    <Text style={[styles.detailNoteText, { color: '#EF4444' }]}>
                      This transaction failed. No funds were deducted.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  )
}

// ─── Shared sheet sub-components ─────────────────────────────────────────────

function BottomSheet({
  visible, onClose, title, subtitle, insets, theme, children,
}: {
  visible: boolean; onClose: () => void
  title: string; subtitle: string
  insets: any; theme: any; children: React.ReactNode
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
          <View style={styles.sheetHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.sheetSub, { color: theme.textMuted }]}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.sheetCloseBtn}>
              <X size={18} color={theme.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function InputRow({ prefix, placeholder, value, onChangeText, keyboard, theme, style }: {
  prefix: string; placeholder: string; value: string
  onChangeText: (v: string) => void; keyboard: any; theme: any; style?: any
}) {
  return (
    <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.surfaceHigh }, style]}>
      <Text style={[styles.inputPrefix, { color: theme.textMuted }]}>{prefix}</Text>
      <TextInput
        style={[styles.input, { color: theme.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboard}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  )
}

function ConfirmBtn({ label, disabled, loading, accent, onPress }: {
  label: string; disabled: boolean; loading: boolean; accent: string; onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.confirmBtn, { backgroundColor: !disabled ? accent : '#E5E7EB' }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.confirmText, { color: !disabled ? '#fff' : '#9CA3AF' }]}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  heroNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 28,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 18, fontFamily: F.bold, color: '#fff' },

  balanceWrap: { alignItems: 'center', gap: 6, marginBottom: 24 },
  balanceLabel: { fontSize: 13, fontFamily: F.medium, color: 'rgba(255,255,255,0.7)' },
  balanceAmount: { fontSize: 42, fontFamily: F.extrabold, color: '#fff', letterSpacing: -1 },
  walletPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99,
  },
  walletPillText: { fontSize: 11, fontFamily: F.medium, color: 'rgba(255,255,255,0.75)' },

  // 4-icon action row
  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 8,
  },
  actionBtn: { flex: 1, alignItems: 'center', gap: 6 },
  actionIconBox: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: 11, fontFamily: F.semibold, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },

  list: { padding: 16, gap: 8 },

  activityHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  activityTitle: { fontSize: 22, fontFamily: F.extrabold },
  activityIconBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 },
  filterTabText: { fontSize: 13, fontFamily: F.semibold },

  emptyWrap: { alignItems: 'center', gap: 10, paddingTop: 48 },
  emptyText: { fontSize: 16, fontFamily: F.bold },
  emptySub:  { fontSize: 13, fontFamily: F.regular, textAlign: 'center' },

  group: { marginBottom: 12 },
  bucketRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  bucketLabel: { fontSize: 12, fontFamily: F.bold, letterSpacing: 0.4 },
  bucketLine: { flex: 1, height: StyleSheet.hairlineWidth },
  txCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },

  // Modal / sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  sheetCloseBtn: { padding: 4 },
  sheetTitle:  { fontSize: 20, fontFamily: F.extrabold, marginBottom: 4 },
  sheetSub:    { fontSize: 13, fontFamily: F.regular, lineHeight: 19 },

  presets: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  presetBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  presetText: { fontSize: 13, fontFamily: F.bold },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, height: 52,
  },
  inputPrefix: { fontSize: 14, fontFamily: F.semibold },
  input:       { flex: 1, fontSize: 16, fontFamily: F.medium },

  balanceHint: { fontSize: 12, fontFamily: F.regular, textAlign: 'right', marginTop: 6, marginBottom: 2 },

  confirmBtn: {
    height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  confirmText: { fontSize: 15, fontFamily: F.bold },

  lookupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, height: 52,
  },
  lookupBtn: {
    paddingHorizontal: 14, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  lookupBtnText: { fontSize: 13, fontFamily: F.bold, color: '#fff' },
  resolvedRow: {
    borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8,
  },
  resolvedText: { fontSize: 13, fontFamily: F.semibold },

  // Transaction detail sheet
  detailTitleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 24,
  },
  detailHero: { alignItems: 'center', gap: 8, paddingBottom: 24 },
  detailCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  detailCircleText: {
    fontSize: 22, fontFamily: F.extrabold, color: '#fff',
  },
  detailAmount: { fontSize: 34, fontFamily: F.extrabold, letterSpacing: -0.5 },
  detailDesc:   { fontSize: 14, fontFamily: F.medium, textAlign: 'center' },
  detailStatusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 99, borderWidth: 1, marginTop: 4,
  },
  detailStatusText: { fontSize: 13, fontFamily: F.bold },
  detailDivider:    { height: StyleSheet.hairlineWidth, marginBottom: 20 },
  detailRows:       { gap: 16 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailRowLabel: { fontSize: 13, fontFamily: F.regular },
  detailRowValue: { fontSize: 14, fontFamily: F.semibold },
  detailNote: {
    borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 4,
  },
  detailNoteText: { fontSize: 13, fontFamily: F.medium, color: '#F59E0B', lineHeight: 18 },
})
