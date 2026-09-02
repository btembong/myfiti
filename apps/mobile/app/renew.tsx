import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MotiView } from 'moti'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, Check, Calendar, Clock, Zap, Star,
  CheckCircle2, XCircle, Smartphone, RefreshCw,
  Wallet, Banknote, Hash,
} from 'lucide-react-native'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'plan' | 'payment' | 'phone' | 'waiting' | 'done' | 'cash-pending'
type PayMethod = 'wallet' | 'mobile_money' | 'cash'

type Plan = {
  id: string; name: string; description: string | null
  price: number; currency: string; duration_days: number; cycle: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CYCLE_ICONS: Record<string, React.ComponentType<any>> = {
  monthly: Calendar, weekly: Clock, daily: Zap, annual: Star,
}

function fmtMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('fr-CM')}`
}

function cycleBadge(cycle: string, days: number) {
  if (cycle) return cycle.charAt(0).toUpperCase() + cycle.slice(1)
  if (days >= 365) return 'Annual'
  if (days >= 90)  return 'Quarterly'
  if (days >= 30)  return 'Monthly'
  if (days >= 7)   return 'Weekly'
  return `${days} days`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, selected, accent, theme, onSelect }: {
  plan: Plan; selected: boolean; accent: string; theme: any; onSelect: () => void
}) {
  const Icon = CYCLE_ICONS[plan.cycle?.toLowerCase()] ?? Calendar
  return (
    <TouchableOpacity
      style={[
        styles.planCard,
        { backgroundColor: theme.surface, borderColor: selected ? accent : theme.border },
        selected && { shadowColor: accent, shadowOpacity: 0.2, shadowRadius: 14, elevation: 5 },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={[styles.planIconWrap, { backgroundColor: selected ? accent + '22' : accent + '10' }]}>
        <Icon size={22} color={accent} strokeWidth={1.8} />
      </View>
      <View style={styles.planBody}>
        <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
        <View style={styles.planMeta}>
          <View style={[styles.cyclePill, { backgroundColor: accent + '14' }]}>
            <Text style={[styles.cyclePillText, { color: accent }]}>{cycleBadge(plan.cycle, plan.duration_days)}</Text>
          </View>
          <Text style={[styles.planDuration, { color: theme.textMuted }]}>· {plan.duration_days} days</Text>
        </View>
        {plan.description ? (
          <Text style={[styles.planDesc, { color: theme.textMuted }]} numberOfLines={2}>{plan.description}</Text>
        ) : null}
      </View>
      <View style={styles.planRight}>
        <Text style={[styles.planPrice, { color: selected ? accent : theme.text }]}>{fmtMoney(plan.price, plan.currency)}</Text>
        <View style={[styles.radioRing, { borderColor: selected ? accent : theme.border }, selected && { backgroundColor: accent }]}>
          {selected && <Check size={11} color="#fff" strokeWidth={3} />}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Payment Option ───────────────────────────────────────────────────────────

function PayOption({ selected, onPress, icon: Icon, title, subtitle, badge, badgeOk, disabled, accent, theme }: {
  selected: boolean; onPress: () => void; icon: React.ComponentType<any>
  title: string; subtitle: string; badge?: string; badgeOk?: boolean
  disabled?: boolean; accent: string; theme: any
}) {
  return (
    <TouchableOpacity
      style={[
        styles.payOption,
        { backgroundColor: theme.surface, borderColor: selected ? accent : theme.border },
        selected && { backgroundColor: accent + '10' },
        disabled && { opacity: 0.45 },
      ]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <View style={[styles.payIconWrap, { backgroundColor: selected ? accent + '20' : accent + '10' }]}>
        <Icon size={18} color={accent} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.payTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.paySub, { color: theme.textMuted }]}>{subtitle}</Text>
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: badgeOk ? accent + '18' : '#ef444418' }]}>
          <Text style={[styles.badgeText, { color: badgeOk ? accent : '#ef4444' }]}>{badge}</Text>
        </View>
      )}
      {selected && (
        <View style={[styles.radioRing, { borderColor: accent, backgroundColor: accent, marginLeft: 8 }]}>
          <Check size={11} color="#fff" strokeWidth={3} />
        </View>
      )}
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RenewScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ gym?: string; mid?: string }>()
  const { branding } = useTenant()
  const { theme } = useTheme()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? params.gym ?? ''

  const [step, setStep]                 = useState<Step>('plan')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [payMethod, setPayMethod]       = useState<PayMethod | null>(null)
  const [phone, setPhone]               = useState('')
  const [_paymentId, setPaymentId] = useState<string | null>(null)
  const [paymentResult, setPaymentResult] = useState<'success' | 'failed' | null>(null)
  const [cashResult, setCashResult]     = useState<{ reference: string; amount: number; currency: string; plan_name: string } | null>(null)
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptsRef = useRef(0)

  // ── Profile (subscription + gym info) ────────────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ['profile', slug],
    queryFn:  () => memberApi.getProfile(slug),
    enabled:  !!slug,
  })
  const sub = profile?.subscription ?? null

  // ── Wallet ────────────────────────────────────────────────────────────────────
  const { data: walletData } = useQuery({
    queryKey: ['wallet', slug],
    queryFn:  () => memberApi.getWallet(slug),
    enabled:  !!slug,
  })
  const walletBalance = walletData?.balance ?? 0
  const walletCurrency = walletData?.currency ?? 'XAF'

  // ── Plans ─────────────────────────────────────────────────────────────────────
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['public-plans', slug],
    queryFn:  () => memberApi.getPlans(slug),
    enabled:  !!slug,
  })
  const plans = plansData?.plans ?? []

  // ── Wallet pay mutation ───────────────────────────────────────────────────────
  const walletMutation = useMutation({
    mutationFn: (planId: string) => memberApi.walletPayPlan(slug, planId),
    onSuccess: () => { setPaymentResult('success'); setStep('done') },
    onError:   () => { setPaymentResult('failed');  setStep('done') },
  })

  // ── Mobile money / cash mutation ─────────────────────────────────────────────
  const renewMutation = useMutation({
    mutationFn: (data: { plan_id: string; payment_method: 'mobile_money' | 'cash'; phone?: string }) =>
      memberApi.initiateRenewal(slug, data),
    onSuccess: (data) => {
      if (data.method === 'cash' && data.reference) {
        setCashResult({ reference: data.reference, amount: data.amount!, currency: data.currency!, plan_name: data.plan_name! })
        setStep('cash-pending')
      } else if (data.payment_id) {
        setPaymentId(data.payment_id)
        setStep('waiting')
        startPolling(data.payment_id)
      }
    },
    onError: () => { setPaymentResult('failed'); setStep('done') },
  })

  // ── Polling ───────────────────────────────────────────────────────────────────
  function startPolling(pid: string) {
    attemptsRef.current = 0
    pollRef.current = setInterval(async () => {
      attemptsRef.current++
      if (attemptsRef.current > 40) { stopPolling(); setPaymentResult('failed'); setStep('done'); return }
      try {
        const result = await memberApi.getPaymentStatus(slug, pid)
        if (result.status === 'completed') { stopPolling(); setPaymentResult('success'); setStep('done') }
        else if (result.status === 'failed') { stopPolling(); setPaymentResult('failed'); setStep('done') }
      } catch {}
    }, 3000)
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  // ── Header ────────────────────────────────────────────────────────────────────
  function Header({ onBack }: { onBack: () => void }) {
    return (
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.surfaceHigh }]} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={theme.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Renew Membership</Text>
        <View style={{ width: 40 }} />
      </View>
    )
  }

  // ── STEP 1: Plan ──────────────────────────────────────────────────────────────
  if (step === 'plan') return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <Header onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <StepDots current={0} total={2} accent={accent} theme={theme} />
        <Text style={[styles.stepLabel, { color: theme.textMuted }]}>STEP 1 OF 2</Text>
        <Text style={[styles.stepTitle, { color: theme.text }]}>Choose your plan</Text>
        <Text style={[styles.stepSub, { color: theme.textSub }]}>Select the membership that works best for you.</Text>

        {/* Current subscription info */}
        {sub && (
          <View style={[styles.subInfoBox, { backgroundColor: theme.surfaceHigh, borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subInfoLabel, { color: theme.textMuted }]}>Current plan</Text>
              <Text style={[styles.subInfoPlan, { color: theme.text }]}>{sub.plan_name}</Text>
            </View>
            <View style={[styles.subStatusPill, {
              backgroundColor: sub.status === 'active' ? accent + '18'
                : sub.status === 'grace_period' ? '#fbbf2418' : '#ef444418',
            }]}>
              <Text style={[styles.subStatusText, {
                color: sub.status === 'active' || sub.status === 'expiring_soon' ? accent
                  : sub.status === 'grace_period' ? '#fbbf24' : '#ef4444',
              }]}>
                {sub.status === 'active' ? `Expires ${fmtDate(sub.expires_at)}`
                  : sub.status === 'expiring_soon' ? `Expiring ${fmtDate(sub.expires_at)}`
                  : sub.status === 'grace_period' ? 'Grace period'
                  : 'Expired'}
              </Text>
            </View>
          </View>
        )}

        {plansLoading ? (
          [1, 2, 3].map(i => (
            <MotiView key={i} from={{ opacity: 0.4 }} animate={{ opacity: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900, delay: i * 100 }}
              style={[styles.skeleton, { backgroundColor: theme.skeleton }]} />
          ))
        ) : plans.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.surfaceHigh }]}>
            <Calendar size={32} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { color: theme.textSub }]}>No active plans available.</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Contact your gym for membership options.</Text>
          </View>
        ) : (
          plans.map((plan, i) => (
            <MotiView key={plan.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: i * 70 }}>
              <PlanCard plan={plan} selected={selectedPlan?.id === plan.id} accent={accent} theme={theme} onSelect={() => setSelectedPlan(plan)} />
            </MotiView>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {selectedPlan && (
        <MotiView from={{ opacity: 0, translateY: 24 }} animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={[styles.bottomBar, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
          <View style={styles.bottomSummary}>
            <Text style={[styles.bottomPlanName, { color: theme.text }]} numberOfLines={1}>{selectedPlan.name}</Text>
            <Text style={[styles.bottomPrice, { color: accent }]}>{fmtMoney(selectedPlan.price, selectedPlan.currency)}</Text>
          </View>
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: accent }]}
            onPress={() => setStep('payment')} activeOpacity={0.85}>
            <Text style={styles.ctaBtnText}>Continue</Text>
          </TouchableOpacity>
        </MotiView>
      )}
    </SafeAreaView>
  )

  // ── STEP 2: Payment method ────────────────────────────────────────────────────
  if (step === 'payment') {
    const canUseWallet = walletBalance >= (selectedPlan?.price ?? 0)
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
        <Header onBack={() => setStep('plan')} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <StepDots current={1} total={2} accent={accent} theme={theme} />
          <Text style={[styles.stepLabel, { color: theme.textMuted }]}>STEP 2 OF 2</Text>
          <Text style={[styles.stepTitle, { color: theme.text }]}>How would you like to pay?</Text>

          {/* Plan recap */}
          <View style={[styles.recapPill, { backgroundColor: accent + '12', borderColor: accent + '28' }]}>
            <View style={[styles.recapIcon, { backgroundColor: accent + '20' }]}>
              <Calendar size={15} color={accent} strokeWidth={2} />
            </View>
            <Text style={[styles.recapName, { color: theme.text }]}>{selectedPlan!.name}</Text>
            <Text style={[styles.recapDivider, { color: theme.border }]}>·</Text>
            <Text style={[styles.recapDuration, { color: theme.textSub }]}>{selectedPlan!.duration_days}d</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.recapPrice, { color: accent }]}>{fmtMoney(selectedPlan!.price, selectedPlan!.currency)}</Text>
          </View>

          <View style={{ gap: 10 }}>
            <PayOption
              selected={payMethod === 'wallet'}
              onPress={() => setPayMethod('wallet')}
              icon={Wallet}
              title="Wallet"
              subtitle={`Balance: ${fmtMoney(walletBalance, walletCurrency)}`}
              badge={canUseWallet ? 'Sufficient' : 'Insufficient'}
              badgeOk={canUseWallet}
              disabled={!canUseWallet}
              accent={accent}
              theme={theme}
            />
            <PayOption
              selected={payMethod === 'mobile_money'}
              onPress={() => setPayMethod('mobile_money')}
              icon={Smartphone}
              title="Mobile Money"
              subtitle="MTN / Orange — instant activation"
              accent={accent}
              theme={theme}
            />
            <PayOption
              selected={payMethod === 'cash'}
              onPress={() => setPayMethod('cash')}
              icon={Banknote}
              title="Pay at Gym"
              subtitle="Get a reference code — pay at the desk"
              accent={accent}
              theme={theme}
            />
          </View>
          <View style={{ height: 120 }} />
        </ScrollView>

        {payMethod && (
          <MotiView from={{ opacity: 0, translateY: 24 }} animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={[styles.bottomBar, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.ctaBtn, { flex: 1, backgroundColor: accent }]}
              onPress={() => {
                if (payMethod === 'wallet') {
                  walletMutation.mutate(selectedPlan!.id)
                  setStep('done')
                  setPaymentResult(null)
                } else if (payMethod === 'mobile_money') {
                  setStep('phone')
                } else {
                  renewMutation.mutate({ plan_id: selectedPlan!.id, payment_method: 'cash' })
                }
              }}
              disabled={walletMutation.isPending || renewMutation.isPending}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>
                {walletMutation.isPending || renewMutation.isPending ? 'Processing…'
                  : payMethod === 'wallet' ? 'Pay with Wallet'
                  : payMethod === 'mobile_money' ? 'Enter phone number'
                  : 'Get reference code'}
              </Text>
            </TouchableOpacity>
          </MotiView>
        )}
      </SafeAreaView>
    )
  }

  // ── STEP 3: Phone (mobile money) ──────────────────────────────────────────────
  if (step === 'phone') {
    const phoneReady = phone.replace(/\s/g, '').length >= 9
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Header onBack={() => setStep('payment')} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            <Text style={[styles.stepTitle, { color: theme.text }]}>Mobile Money payment</Text>
            <Text style={[styles.stepSub, { color: theme.textSub }]}>
              Enter your phone number to receive a USSD prompt for payment.
            </Text>

            <View style={[styles.recapPill, { backgroundColor: accent + '12', borderColor: accent + '28' }]}>
              <View style={[styles.recapIcon, { backgroundColor: accent + '20' }]}>
                <Calendar size={15} color={accent} strokeWidth={2} />
              </View>
              <Text style={[styles.recapName, { color: theme.text }]}>{selectedPlan!.name}</Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.recapPrice, { color: accent }]}>{fmtMoney(selectedPlan!.price, selectedPlan!.currency)}</Text>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>Phone number</Text>
            <View style={[styles.phoneWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.countryCode, { borderRightColor: theme.border }]}>
                <Text style={styles.flagEmoji}>🇨🇲</Text>
                <Text style={[styles.dialCode, { color: theme.textSub }]}>+237</Text>
              </View>
              <TextInput
                style={[styles.phoneInput, { color: theme.text }]}
                placeholder="6XX XXX XXX"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={t => setPhone(t.replace(/[^\d\s]/g, ''))}
                maxLength={11}
                returnKeyType="done"
                autoFocus
              />
            </View>

            <Text style={[styles.networkTitle, { color: theme.textMuted }]}>Accepted networks</Text>
            <View style={styles.networksRow}>
              {[{ name: 'MTN MoMo', color: '#FFC107' }, { name: 'Orange Money', color: '#FF6600' }].map(n => (
                <View key={n.name} style={[styles.networkBadge, { backgroundColor: theme.surfaceHigh, borderColor: theme.border }]}>
                  <View style={[styles.networkDot, { backgroundColor: n.color }]} />
                  <Text style={[styles.networkLabel, { color: theme.textSub }]}>{n.name}</Text>
                </View>
              ))}
            </View>
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={[styles.bottomBar, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.ctaBtn, { flex: 1, backgroundColor: phoneReady ? accent : theme.border }]}
              onPress={() => {
                if (!phoneReady) return
                const full = `237${phone.replace(/\s/g, '')}`
                renewMutation.mutate({ plan_id: selectedPlan!.id, payment_method: 'mobile_money', phone: full })
              }}
              disabled={!phoneReady || renewMutation.isPending}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>
                {renewMutation.isPending ? 'Sending request…' : `Pay ${fmtMoney(selectedPlan!.price, selectedPlan!.currency)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ── Waiting ───────────────────────────────────────────────────────────────────
  if (step === 'waiting') return (
    <SafeAreaView style={[styles.root, styles.centered, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <MotiView from={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 18 }} style={styles.centeredContent}>
        <View style={styles.orbWrap}>
          <MotiView from={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.55, opacity: 0 }}
            transition={{ loop: true, type: 'timing', duration: 1600 }}
            style={[styles.orbPulse, { backgroundColor: accent }]} />
          <View style={[styles.orb, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
            <Smartphone size={34} color={accent} strokeWidth={1.6} />
          </View>
        </View>
        <Text style={[styles.waitTitle, { color: theme.text }]}>Check your phone</Text>
        <Text style={[styles.waitSub, { color: theme.textSub }]}>
          A USSD prompt has been sent to{'\n'}
          <Text style={{ fontFamily: F.bold, color: theme.text }}>+237 {phone}</Text>
        </Text>
        <View style={styles.stepsWrap}>
          {['A USSD code will appear on your screen', 'Enter your Mobile Money PIN', 'Confirm the payment amount'].map((s, i) => (
            <MotiView key={i} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 280, delay: 300 + i * 130 }}
              style={[styles.instrRow, { backgroundColor: theme.surfaceHigh }]}>
              <View style={[styles.instrNum, { backgroundColor: accent + '18' }]}>
                <Text style={[styles.instrNumText, { color: accent }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.instrText, { color: theme.text }]}>{s}</Text>
            </MotiView>
          ))}
        </View>
        <View style={styles.waitingFooter}>
          <RefreshCw size={13} color={theme.textMuted} strokeWidth={2} />
          <Text style={[styles.waitingFooterText, { color: theme.textMuted }]}>Checking payment status automatically...</Text>
        </View>
      </MotiView>
    </SafeAreaView>
  )

  // ── Cash pending ──────────────────────────────────────────────────────────────
  if (step === 'cash-pending' && cashResult) return (
    <SafeAreaView style={[styles.root, styles.centered, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <MotiView from={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 18 }} style={styles.centeredContent}>
        <View style={[styles.refBox, { backgroundColor: theme.surfaceHigh, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Hash size={14} color={theme.textMuted} strokeWidth={2} />
            <Text style={[styles.refLabel, { color: theme.textMuted }]}>Reference code</Text>
          </View>
          <Text style={[styles.refCode, { color: theme.text }]}>{cashResult.reference}</Text>
        </View>
        <Text style={[styles.resultTitle, { color: theme.text }]}>Visit the gym to pay</Text>
        <Text style={[styles.resultSub, { color: theme.textSub }]}>
          Show this code at the desk.{'\n'}
          Amount due: <Text style={{ fontFamily: F.bold, color: theme.text }}>{fmtMoney(cashResult.amount, cashResult.currency)}</Text>{'\n'}
          Plan: <Text style={{ fontFamily: F.bold, color: theme.text }}>{cashResult.plan_name}</Text>
        </Text>
        <Text style={[styles.resultSub, { color: theme.textMuted, fontSize: 12, marginTop: -8 }]}>
          Your membership activates once the gym confirms your payment.
        </Text>
        <TouchableOpacity style={[styles.resultBtn, { backgroundColor: accent }]}
          onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.resultBtnText}>Done</Text>
        </TouchableOpacity>
      </MotiView>
    </SafeAreaView>
  )

  // ── Result ────────────────────────────────────────────────────────────────────
  const isSuccess  = paymentResult === 'success'
  const resultColor = isSuccess ? '#22C55E' : '#EF4444'
  const isPending  = walletMutation.isPending

  return (
    <SafeAreaView style={[styles.root, styles.centered, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <MotiView from={{ scale: 0.85, opacity: 0 }} animate={{ scale: isPending ? 0.85 : 1, opacity: isPending ? 0 : 1 }}
        transition={{ type: 'spring', damping: 16 }} style={styles.centeredContent}>
        <View style={[styles.resultIcon, { backgroundColor: (isPending ? accent : resultColor) + '18' }]}>
          {isPending
            ? <RefreshCw size={54} color={accent} strokeWidth={1.5} />
            : isSuccess
              ? <CheckCircle2 size={54} color={resultColor} strokeWidth={1.5} />
              : <XCircle size={54} color={resultColor} strokeWidth={1.5} />}
        </View>
        <Text style={[styles.resultTitle, { color: theme.text }]}>
          {isPending ? 'Processing…' : isSuccess ? 'Membership renewed!' : 'Payment failed'}
        </Text>
        <Text style={[styles.resultSub, { color: theme.textSub }]}>
          {isPending
            ? 'Debiting your wallet, please wait.'
            : isSuccess
              ? `Your ${selectedPlan?.name} membership has been renewed for ${selectedPlan?.duration_days} days.`
              : 'The payment could not be completed. Please try again or contact your gym.'}
        </Text>
        {!isPending && isSuccess && (
          <TouchableOpacity style={[styles.resultBtn, { backgroundColor: accent }]}
            onPress={() => router.replace('/(tabs)/subscription')} activeOpacity={0.85}>
            <Text style={styles.resultBtnText}>View Membership</Text>
          </TouchableOpacity>
        )}
        {!isPending && !isSuccess && (
          <>
            <TouchableOpacity style={[styles.resultBtn, { backgroundColor: accent }]}
              onPress={() => { setStep('plan'); setPaymentId(null); setPaymentResult(null) }} activeOpacity={0.85}>
              <Text style={styles.resultBtnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resultDismiss} onPress={() => router.back()}>
              <Text style={[styles.resultDismissText, { color: theme.textMuted }]}>Go back</Text>
            </TouchableOpacity>
          </>
        )}
      </MotiView>
    </SafeAreaView>
  )
}

// ─── Step dots ────────────────────────────────────────────────────────────────

function StepDots({ current, total, accent, theme }: { current: number; total: number; accent: string; theme: any }) {
  return (
    <View style={styles.stepDots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[
          styles.dot,
          i < current ? { backgroundColor: accent + '40' } : i === current ? [styles.dotActive, { backgroundColor: accent }] : { backgroundColor: theme.border },
          i < total - 1 && styles.dotWithLine,
        ]} />
      ))}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1 },
  centered:{ justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: F.bold },

  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 12 },

  stepDots:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  dotActive:   { width: 22 },
  dotWithLine: {},
  stepLabel:   { fontSize: 11, fontFamily: F.bold, letterSpacing: 1, textTransform: 'uppercase' },
  stepTitle:   { fontSize: 24, fontFamily: F.extrabold, marginTop: 2 },
  stepSub:     { fontSize: 14, fontFamily: F.regular, lineHeight: 21, marginTop: 2 },

  skeleton: { height: 96, borderRadius: 18 },
  emptyBox: { borderRadius: 18, padding: 28, alignItems: 'center', gap: 10 },
  emptyText:{ fontSize: 16, fontFamily: F.bold },
  emptySub: { fontSize: 13, fontFamily: F.regular, textAlign: 'center' },

  subInfoBox:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  subInfoLabel: { fontSize: 11, fontFamily: F.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  subInfoPlan:  { fontSize: 15, fontFamily: F.bold, marginTop: 2 },
  subStatusPill:{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  subStatusText:{ fontSize: 11, fontFamily: F.bold },

  planCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1.5, padding: 16 },
  planIconWrap: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  planBody:     { flex: 1, gap: 5 },
  planName:     { fontSize: 16, fontFamily: F.bold },
  planMeta:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cyclePill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  cyclePillText:{ fontSize: 11, fontFamily: F.bold },
  planDuration: { fontSize: 12, fontFamily: F.regular },
  planDesc:     { fontSize: 12, fontFamily: F.regular, lineHeight: 17 },
  planRight:    { alignItems: 'flex-end', gap: 8 },
  planPrice:    { fontSize: 15, fontFamily: F.extrabold },
  radioRing:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  payOption:   { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, padding: 14 },
  payIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payTitle:    { fontSize: 15, fontFamily: F.bold },
  paySub:      { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  badge:       { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText:   { fontSize: 11, fontFamily: F.bold },

  bottomBar:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  bottomSummary: { flex: 1 },
  bottomPlanName:{ fontSize: 14, fontFamily: F.semibold },
  bottomPrice:   { fontSize: 16, fontFamily: F.extrabold, marginTop: 2 },
  ctaBtn:        { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ctaBtnText:    { fontSize: 16, fontFamily: F.bold, color: '#fff' },

  recapPill:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, padding: 12 },
  recapIcon:    { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  recapName:    { fontSize: 14, fontFamily: F.bold },
  recapDivider: { fontSize: 14 },
  recapDuration:{ fontSize: 13, fontFamily: F.regular },
  recapPrice:   { fontSize: 15, fontFamily: F.extrabold },

  inputLabel:  { fontSize: 13, fontFamily: F.semibold, marginBottom: -4 },
  phoneWrap:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, overflow: 'hidden' },
  countryCode: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 16, borderRightWidth: 1 },
  flagEmoji:   { fontSize: 20 },
  dialCode:    { fontSize: 15, fontFamily: F.semibold },
  phoneInput:  { flex: 1, fontSize: 18, fontFamily: F.semibold, paddingHorizontal: 14, paddingVertical: 16 },

  networkTitle: { fontSize: 11, fontFamily: F.bold, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
  networksRow:  { flexDirection: 'row', gap: 10 },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  networkDot:   { width: 8, height: 8, borderRadius: 4 },
  networkLabel: { fontSize: 13, fontFamily: F.medium },

  centeredContent: { alignItems: 'center', paddingHorizontal: 24, gap: 18, width: '100%' },
  orbWrap:  { width: 110, height: 110, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  orbPulse: { position: 'absolute', width: 90, height: 90, borderRadius: 45 },
  orb:      { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },

  waitTitle: { fontSize: 24, fontFamily: F.extrabold, textAlign: 'center' },
  waitSub:   { fontSize: 15, fontFamily: F.regular, textAlign: 'center', lineHeight: 23 },

  stepsWrap: { width: '100%', gap: 10 },
  instrRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 13, padding: 14 },
  instrNum:  { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  instrNumText: { fontSize: 13, fontFamily: F.extrabold },
  instrText: { flex: 1, fontSize: 14, fontFamily: F.medium },

  waitingFooter:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  waitingFooterText: { fontSize: 12, fontFamily: F.regular },

  refBox:  { width: '100%', borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center' },
  refLabel:{ fontSize: 12, fontFamily: F.medium },
  refCode: { fontSize: 32, fontFamily: F.extrabold, letterSpacing: 4, marginTop: 4 },

  resultIcon:       { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  resultTitle:      { fontSize: 26, fontFamily: F.extrabold, textAlign: 'center' },
  resultSub:        { fontSize: 15, fontFamily: F.regular, textAlign: 'center', lineHeight: 23 },
  resultBtn:        { width: '100%', height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  resultBtnText:    { fontSize: 16, fontFamily: F.bold, color: '#fff' },
  resultDismiss:    { marginTop: 12, padding: 8 },
  resultDismissText:{ fontSize: 14, fontFamily: F.medium },
})
