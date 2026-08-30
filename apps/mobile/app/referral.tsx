import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import { MotiView } from 'moti'
import { useRouter } from 'expo-router'
import {
  ArrowLeft, Users, Gift, Share2,
  CheckCircle, Clock, ChevronRight,
} from 'lucide-react-native'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReferralScreen() {
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme, isDark } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const accent   = branding?.primary_color ?? '#5B8EF4'
  const slug     = branding?.slug ?? ''
  const gymName  = branding?.name ?? 'your gym'

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['member-referral', slug],
    queryFn: () => memberApi.getReferral(slug),
    enabled: !!slug && !!accessToken,
  })

  const code         = data?.referral_code  ?? '—'
  const totalReferred = data?.total_referred ?? 0
  const converted    = data?.converted      ?? 0
  const totalEarned  = data?.total_earned   ?? 0
  const referred     = data?.referred       ?? []

  function shareCode() {
    Share.share({
      message:
        `Join me at ${gymName}! Use my referral code ${code} when signing up ` +
        `and we both get rewarded. Download the myfiti app to get started.`,
    }).catch(() => {})
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
          <Text style={styles.heroTitle}>Refer & Earn</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Code card */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 380 }}
          style={styles.codeCard}
        >
          <Text style={[styles.codeLabel, { color: theme.textMuted }]}>Your referral code</Text>
          <Text style={[styles.code, { color: theme.text, letterSpacing: 6 }]}>{code}</Text>
          <Text style={[styles.codeSub, { color: theme.textSub }]}>
            Share this code — when a friend joins and pays their first month, you earn a wallet credit
          </Text>
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: accent }]}
            onPress={shareCode}
            activeOpacity={0.85}
          >
            <Share2 size={16} color="#fff" strokeWidth={2} />
            <Text style={styles.shareBtnText}>Share code</Text>
          </TouchableOpacity>
        </MotiView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accent} />}
      >
        {/* Stats row */}
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320, delay: 80 }}
          style={styles.statsRow}
        >
          {[
            { label: 'Friends referred', value: String(totalReferred), icon: Users },
            { label: 'Joined & paid',    value: String(converted),    icon: CheckCircle },
            { label: 'XAF earned',       value: Number(totalEarned).toLocaleString('fr-CM', { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: Gift },
          ].map(({ label, value, icon: Icon }) => (
            <View key={label} style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIconWrap, { backgroundColor: accent + '18' }]}>
                <Icon size={16} color={accent} strokeWidth={1.8} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{isLoading ? '—' : value}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
            </View>
          ))}
        </MotiView>

        {/* How it works */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>HOW IT WORKS</Text>
        <View style={[styles.stepsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {[
            { n: '1', text: 'Share your code with a friend' },
            { n: '2', text: 'They join the gym and tell staff your code' },
            { n: '3', text: 'When they pay their first month, you get a wallet credit automatically' },
          ].map(step => (
            <View key={step.n} style={[styles.step, { borderBottomColor: theme.border }]}>
              <View style={[styles.stepNum, { backgroundColor: accent + '18' }]}>
                <Text style={[styles.stepNumText, { color: accent }]}>{step.n}</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.textSub }]}>{step.text}</Text>
            </View>
          ))}
          <View style={[styles.rewardRow, { backgroundColor: accent + '0D' }]}>
            <Gift size={14} color={accent} strokeWidth={1.8} />
            <Text style={[styles.rewardText, { color: accent }]}>
              You earn XAF 500 wallet credit per successful referral
            </Text>
          </View>
        </View>

        {/* Wallet shortcut */}
        <TouchableOpacity
          style={[styles.walletRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push('/wallet')}
          activeOpacity={0.8}
        >
          <Gift size={16} color={accent} strokeWidth={1.8} />
          <Text style={[styles.walletRowText, { color: theme.text }]}>
            Earned XAF {totalEarned.toLocaleString('fr-CM')} in your wallet
          </Text>
          <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
        </TouchableOpacity>

        {/* Referral list */}
        {referred.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>REFERRED MEMBERS</Text>
            {referred.map((r, i) => (
              <MotiView
                key={i}
                from={{ opacity: 0, translateX: -8 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 260, delay: i * 40 }}
              >
                <View style={[styles.referredRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.referredAvatar, { backgroundColor: accent + '20' }]}>
                    <Text style={[styles.referredInitials, { color: accent }]}>{r.initials}</Text>
                  </View>
                  <View style={styles.referredInfo}>
                    <Text style={[styles.referredName, { color: theme.text }]}>Member {r.initials}</Text>
                    <Text style={[styles.referredDate, { color: theme.textMuted }]}>{fmtDate(r.created_at)}</Text>
                  </View>
                  <View style={[
                    styles.referredBadge,
                    { backgroundColor: r.status === 'converted' ? '#22C55E18' : '#F59E0B18' },
                  ]}>
                    {r.status === 'converted'
                      ? <CheckCircle size={12} color="#22C55E" strokeWidth={2} />
                      : <Clock size={12} color="#F59E0B" strokeWidth={2} />
                    }
                    <Text style={[
                      styles.referredBadgeText,
                      { color: r.status === 'converted' ? '#22C55E' : '#F59E0B' },
                    ]}>
                      {r.status === 'converted' ? 'Rewarded' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </MotiView>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero:    { paddingHorizontal: 20, paddingBottom: 28 },
  heroNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 24,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 18, fontFamily: F.bold, color: '#fff' },

  codeCard: {
    backgroundColor: '#fff',
    borderRadius: 22, padding: 22, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  codeLabel:   { fontSize: 12, fontFamily: F.semibold, textTransform: 'uppercase', letterSpacing: 0.8 },
  code:        { fontSize: 34, fontFamily: F.extrabold },
  codeSub:     { fontSize: 13, fontFamily: F.regular, lineHeight: 19 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14, marginTop: 4,
  },
  shareBtnText: { fontSize: 15, fontFamily: F.bold, color: '#fff' },

  body: { padding: 16, gap: 8 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    padding: 14, alignItems: 'center', gap: 6,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue:    { fontSize: 18, fontFamily: F.extrabold },
  statLabel:    { fontSize: 11, fontFamily: F.regular, textAlign: 'center' },

  sectionTitle: {
    fontSize: 11, fontFamily: F.bold, letterSpacing: 0.9,
    textTransform: 'uppercase', marginTop: 8, marginBottom: 4,
  },
  stepsCard:  { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  step: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 14, borderBottomWidth: 1,
  },
  stepNum: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 13, fontFamily: F.extrabold },
  stepText:    { flex: 1, fontSize: 13, fontFamily: F.regular, lineHeight: 19, paddingTop: 4 },
  rewardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14,
  },
  rewardText: { fontSize: 13, fontFamily: F.semibold, flex: 1 },

  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 4,
  },
  walletRowText: { flex: 1, fontSize: 14, fontFamily: F.medium },

  referredRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 8,
  },
  referredAvatar:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  referredInitials: { fontSize: 14, fontFamily: F.bold },
  referredInfo:     { flex: 1 },
  referredName:     { fontSize: 14, fontFamily: F.semibold },
  referredDate:     { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  referredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  referredBadgeText: { fontSize: 11, fontFamily: F.semibold },
})
