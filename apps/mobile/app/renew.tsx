import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MotiView } from 'moti'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, Check, Calendar, Clock, Zap, Star,
  CheckCircle2, XCircle, Smartphone, RefreshCw,
} from 'lucide-react-native'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'plan' | 'phone' | 'waiting' | 'done'

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

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan, selected, accent, theme, onSelect,
}: {
  plan: Plan; selected: boolean; accent: string
  theme: any; onSelect: () => void
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
      {/* Left: icon */}
      <View style={[styles.planIconWrap, { backgroundColor: selected ? accent + '22' : accent + '10' }]}>
        <Icon size={22} color={accent} strokeWidth={1.8} />
      </View>

      {/* Center: info */}
      <View style={styles.planBody}>
        <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
        <View style={styles.planMeta}>
          <View style={[styles.cyclePill, { backgroundColor: accent + '14' }]}>
            <Text style={[styles.cyclePillText, { color: accent }]}>
              {cycleBadge(plan.cycle, plan.duration_days)}
            </Text>
          </View>
          <Text style={[styles.planDuration, { color: theme.textMuted }]}>
            · {plan.duration_days} days
          </Text>
        </View>
        {plan.description ? (
          <Text style={[styles.planDesc, { color: theme.textMuted }]} numberOfLines={2}>
            {plan.description}
          </Text>
        ) : null}
      </View>

      {/* Right: price + radio */}
      <View style={styles.planRight}>
        <Text style={[styles.planPrice, { color: selected ? accent : theme.text }]}>
          {fmtMoney(plan.price, plan.currency)}
        </Text>
        <View style={[
          styles.radioRing,
          { borderColor: selected ? accent : theme.border },
          selected && { backgroundColor: accent },
        ]}>
          {selected && <Check size={11} color="#fff" strokeWidth={3} />}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RenewScreen() {
  const router   = useRouter()
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme } = useTheme()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''

  const [step, setStep]               = useState<Step>('plan')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [phone, setPhone]             = useState('')
  const [paymentId, setPaymentId]     = useState<string | null>(null)
  const [paymentResult, setPaymentResult] = useState<'success' | 'failed' | null>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptsRef = useRef(0)

  // ── Fetch plans ──────────────────────────────────────────────────────────────
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['public-plans', slug],
    queryFn:  () => memberApi.getPlans(slug),
    enabled:  !!slug,
  })
  const plans = plansData?.plans ?? []

  // ── Renew mutation ───────────────────────────────────────────────────────────
  const renewMutation = useMutation({
    mutationFn: ({ plan_id, phone }: { plan_id: string; phone: string }) =>
      memberApi.initiateRenewal(slug, { plan_id, phone }),
    onSuccess: (data) => {
      setPaymentId(data.payment_id)
      setStep('waiting')
      startPolling(data.payment_id)
    },
    onError: () => {
      setStep('done')
      setPaymentResult('failed')
    },
  })

  // ── Polling ──────────────────────────────────────────────────────────────────
  function startPolling(pid: string) {
    attemptsRef.current = 0
    pollRef.current = setInterval(async () => {
      attemptsRef.current++
      if (attemptsRef.current > 40) {
        stopPolling()
        setPaymentResult('failed')
        setStep('done')
        return
      }
      try {
        const result = await memberApi.getPaymentStatus(slug, pid)
        if (result.status === 'completed') {
          stopPolling(); setPaymentResult('success'); setStep('done')
        } else if (result.status === 'failed') {
          stopPolling(); setPaymentResult('failed'); setStep('done')
        }
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

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Plan selection
  // ────────────────────────────────────────────────────────────────────────────
  if (step === 'plan') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
        <Header onBack={() => router.back()} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Step indicator */}
          <View style={styles.stepDots}>
            <View style={[styles.dot, styles.dotActive, { backgroundColor: accent }]} />
            <View style={[styles.dotLine, { backgroundColor: theme.border }]} />
            <View style={[styles.dot, { backgroundColor: theme.border }]} />
          </View>

          <Text style={[styles.stepLabel, { color: theme.textMuted }]}>STEP 1 OF 2</Text>
          <Text style={[styles.stepTitle, { color: theme.text }]}>Choose your plan</Text>
          <Text style={[styles.stepSub, { color: theme.textSub }]}>
            Select the membership that works best for you.
          </Text>

          {plansLoading ? (
            [1, 2, 3].map(i => (
              <MotiView key={i}
                from={{ opacity: 0.4 }} animate={{ opacity: 1 }}
                transition={{ loop: true, type: 'timing', duration: 900, delay: i * 100 }}
                style={[styles.skeleton, { backgroundColor: theme.skeleton }]}
              />
            ))
          ) : plans.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.surfaceHigh }]}>
              <Calendar size={32} color={theme.textMuted} strokeWidth={1.5} />
              <Text style={[styles.emptyText, { color: theme.textSub }]}>No active plans available.</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>Contact your gym for membership options.</Text>
            </View>
          ) : (
            plans.map((plan, i) => (
              <MotiView key={plan.id}
                from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: i * 70 }}>
                <PlanCard
                  plan={plan}
                  selected={selectedPlan?.id === plan.id}
                  accent={accent}
                  theme={theme}
                  onSelect={() => setSelectedPlan(plan)}
                />
              </MotiView>
            ))
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom CTA */}
        {selectedPlan && (
          <MotiView
            from={{ opacity: 0, translateY: 24 }} animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={[styles.bottomBar, { backgroundColor: theme.bg, borderTopColor: theme.border }]}
          >
            <View style={styles.bottomSummary}>
              <Text style={[styles.bottomPlanName, { color: theme.text }]} numberOfLines={1}>
                {selectedPlan.name}
              </Text>
              <Text style={[styles.bottomPrice, { color: accent }]}>
                {fmtMoney(selectedPlan.price, selectedPlan.currency)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: accent }]}
              onPress={() => setStep('phone')}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>Continue</Text>
            </TouchableOpacity>
          </MotiView>
        )}
      </SafeAreaView>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Phone number
  // ────────────────────────────────────────────────────────────────────────────
  if (step === 'phone') {
    const phoneReady = phone.replace(/\s/g, '').length >= 9
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Header onBack={() => setStep('plan')} />

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            <View style={styles.stepDots}>
              <View style={[styles.dot, { backgroundColor: accent + '40' }]} />
              <View style={[styles.dotLine, { backgroundColor: accent + '40' }]} />
              <View style={[styles.dot, styles.dotActive, { backgroundColor: accent }]} />
            </View>

            <Text style={[styles.stepLabel, { color: theme.textMuted }]}>STEP 2 OF 2</Text>
            <Text style={[styles.stepTitle, { color: theme.text }]}>Mobile Money payment</Text>
            <Text style={[styles.stepSub, { color: theme.textSub }]}>
              Enter your phone number to receive a USSD prompt for payment.
            </Text>

            {/* Plan recap pill */}
            <View style={[styles.recapPill, { backgroundColor: accent + '12', borderColor: accent + '28' }]}>
              <View style={[styles.recapIcon, { backgroundColor: accent + '20' }]}>
                <Calendar size={15} color={accent} strokeWidth={2} />
              </View>
              <Text style={[styles.recapName, { color: theme.text }]}>{selectedPlan!.name}</Text>
              <Text style={[styles.recapDivider, { color: theme.border }]}>·</Text>
              <Text style={[styles.recapDuration, { color: theme.textSub }]}>{selectedPlan!.duration_days}d</Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.recapPrice, { color: accent }]}>
                {fmtMoney(selectedPlan!.price, selectedPlan!.currency)}
              </Text>
            </View>

            {/* Phone input */}
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

            {/* Supported networks */}
            <Text style={[styles.networkTitle, { color: theme.textMuted }]}>Accepted networks</Text>
            <View style={styles.networksRow}>
              {[
                { name: 'MTN MoMo',     color: '#FFC107' },
                { name: 'Orange Money', color: '#FF6600' },
              ].map(n => (
                <View key={n.name} style={[styles.networkBadge, { backgroundColor: theme.surfaceHigh, borderColor: theme.border }]}>
                  <View style={[styles.networkDot, { backgroundColor: n.color }]} />
                  <Text style={[styles.networkLabel, { color: theme.textSub }]}>{n.name}</Text>
                </View>
              ))}
            </View>

            <View style={styles.ussdNote}>
              <Smartphone size={14} color={theme.textMuted} strokeWidth={1.8} />
              <Text style={[styles.ussdNoteText, { color: theme.textMuted }]}>
                You'll get a USSD prompt on your phone. No app required.
              </Text>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Pay button */}
          <View style={[styles.bottomBar, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.ctaBtn, { flex: 1, backgroundColor: phoneReady ? accent : theme.border }]}
              onPress={() => {
                if (!phoneReady) return
                const full = `237${phone.replace(/\s/g, '')}`
                renewMutation.mutate({ plan_id: selectedPlan!.id, phone: full })
              }}
              disabled={!phoneReady || renewMutation.isPending}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>
                {renewMutation.isPending
                  ? 'Sending request...'
                  : `Pay ${fmtMoney(selectedPlan!.price, selectedPlan!.currency)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Waiting for USSD confirmation
  // ────────────────────────────────────────────────────────────────────────────
  if (step === 'waiting') {
    return (
      <SafeAreaView style={[styles.root, styles.centered, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
        <MotiView
          from={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          style={styles.centeredContent}
        >
          {/* Pulsing orb */}
          <View style={styles.orbWrap}>
            <MotiView
              from={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.55, opacity: 0 }}
              transition={{ loop: true, type: 'timing', duration: 1600 }}
              style={[styles.orbPulse, { backgroundColor: accent }]}
            />
            <MotiView
              from={{ scale: 1, opacity: 0.3 }} animate={{ scale: 1.3, opacity: 0 }}
              transition={{ loop: true, type: 'timing', duration: 1600, delay: 400 }}
              style={[styles.orbPulse, { backgroundColor: accent }]}
            />
            <View style={[styles.orb, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
              <Smartphone size={34} color={accent} strokeWidth={1.6} />
            </View>
          </View>

          <Text style={[styles.waitTitle, { color: theme.text }]}>Check your phone</Text>
          <Text style={[styles.waitSub, { color: theme.textSub }]}>
            A USSD prompt has been sent to{'\n'}
            <Text style={{ fontFamily: F.bold, color: theme.text }}>+237 {phone}</Text>
          </Text>

          {/* Instruction steps */}
          <View style={styles.stepsWrap}>
            {[
              'A USSD code will appear on your screen',
              'Enter your Mobile Money PIN',
              'Confirm the payment amount',
            ].map((s, i) => (
              <MotiView key={i}
                from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 280, delay: 300 + i * 130 }}
                style={[styles.instrRow, { backgroundColor: theme.surfaceHigh }]}
              >
                <View style={[styles.instrNum, { backgroundColor: accent + '18' }]}>
                  <Text style={[styles.instrNumText, { color: accent }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.instrText, { color: theme.text }]}>{s}</Text>
              </MotiView>
            ))}
          </View>

          <View style={styles.waitingFooter}>
            <RefreshCw size={13} color={theme.textMuted} strokeWidth={2} />
            <Text style={[styles.waitingFooterText, { color: theme.textMuted }]}>
              Checking payment status automatically...
            </Text>
          </View>
        </MotiView>
      </SafeAreaView>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4 — Result
  // ────────────────────────────────────────────────────────────────────────────
  const isSuccess = paymentResult === 'success'
  const resultColor = isSuccess ? '#22C55E' : '#EF4444'

  return (
    <SafeAreaView style={[styles.root, styles.centered, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <MotiView
        from={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 16 }}
        style={styles.centeredContent}
      >
        <View style={[styles.resultIcon, { backgroundColor: resultColor + '18' }]}>
          {isSuccess
            ? <CheckCircle2 size={54} color={resultColor} strokeWidth={1.5} />
            : <XCircle     size={54} color={resultColor} strokeWidth={1.5} />}
        </View>

        <Text style={[styles.resultTitle, { color: theme.text }]}>
          {isSuccess ? 'Payment confirmed!' : 'Payment failed'}
        </Text>
        <Text style={[styles.resultSub, { color: theme.textSub }]}>
          {isSuccess
            ? `Your ${selectedPlan?.name} membership has been renewed for ${selectedPlan?.duration_days} days.`
            : 'The payment could not be completed. Please try again or contact your gym.'}
        </Text>

        {isSuccess ? (
          <TouchableOpacity
            style={[styles.resultBtn, { backgroundColor: accent }]}
            onPress={() => router.replace('/(tabs)/subscription')}
            activeOpacity={0.85}
          >
            <Text style={styles.resultBtnText}>View Membership</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: accent }]}
              onPress={() => {
                setStep('plan')
                setPaymentId(null)
                setPaymentResult(null)
              }}
              activeOpacity={0.85}
            >
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1 },
  centered:{ justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: F.bold },

  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 12 },

  // Step indicator
  stepDots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  dotActive:{ width: 22 },
  dotLine:  { flex: 1, height: 2, borderRadius: 1 },

  stepLabel: { fontSize: 11, fontFamily: F.bold, letterSpacing: 1, textTransform: 'uppercase' },
  stepTitle: { fontSize: 24, fontFamily: F.extrabold, marginTop: 2 },
  stepSub:   { fontSize: 14, fontFamily: F.regular, lineHeight: 21, marginTop: 2 },

  skeleton: { height: 96, borderRadius: 18 },

  emptyBox:  { borderRadius: 18, padding: 28, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 16, fontFamily: F.bold },
  emptySub:  { fontSize: 13, fontFamily: F.regular, textAlign: 'center' },

  // Plan card
  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1.5, padding: 16,
  },
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

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1,
  },
  bottomSummary: { flex: 1 },
  bottomPlanName:{ fontSize: 14, fontFamily: F.semibold },
  bottomPrice:   { fontSize: 16, fontFamily: F.extrabold, marginTop: 2 },

  ctaBtn:     { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ctaBtnText: { fontSize: 16, fontFamily: F.bold, color: '#fff' },

  // Phone step
  recapPill:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  recapIcon:     { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  recapName:     { fontSize: 14, fontFamily: F.bold },
  recapDivider:  { fontSize: 14 },
  recapDuration: { fontSize: 13, fontFamily: F.regular },
  recapPrice:    { fontSize: 15, fontFamily: F.extrabold },

  inputLabel: { fontSize: 13, fontFamily: F.semibold, marginBottom: -4 },
  phoneWrap:  { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, overflow: 'hidden' },
  countryCode:{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 16, borderRightWidth: 1 },
  flagEmoji:  { fontSize: 20 },
  dialCode:   { fontSize: 15, fontFamily: F.semibold },
  phoneInput: { flex: 1, fontSize: 18, fontFamily: F.semibold, paddingHorizontal: 14, paddingVertical: 16 },

  networkTitle: { fontSize: 11, fontFamily: F.bold, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
  networksRow:  { flexDirection: 'row', gap: 10 },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  networkDot:   { width: 8, height: 8, borderRadius: 4 },
  networkLabel: { fontSize: 13, fontFamily: F.medium },

  ussdNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  ussdNoteText: { flex: 1, fontSize: 12, fontFamily: F.regular, lineHeight: 18 },

  // Waiting step
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

  // Result step
  resultIcon:  { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  resultTitle: { fontSize: 26, fontFamily: F.extrabold, textAlign: 'center' },
  resultSub:   { fontSize: 15, fontFamily: F.regular, textAlign: 'center', lineHeight: 23 },
  resultBtn:   { width: '100%', height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  resultBtnText: { fontSize: 16, fontFamily: F.bold, color: '#fff' },
  resultDismiss: { marginTop: 12, padding: 8 },
  resultDismissText: { fontSize: 14, fontFamily: F.medium },
})
