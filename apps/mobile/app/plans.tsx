import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { MotiView } from 'moti'
import { Check, Phone, Zap, Clock, Calendar } from 'lucide-react-native'
import { Screen } from '../src/components/ui/Screen'
import { AppHeader } from '../src/components/ui/AppHeader'
import { Card } from '../src/components/ui/Card'
import { memberApi } from '../src/lib/api'
import { useTenant } from '../src/context/TenantContext'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

function fmtMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('fr-CM')}`
}

const PLAN_ICONS: Record<string, any> = {
  monthly: Calendar,
  weekly:  Clock,
  daily:   Zap,
  annual:  Check,
}

const PLAN_FEATURES = [
  'Unlimited gym access',
  'Class booking',
  'QR check-in',
  'Progress tracking',
]

export default function PlansScreen() {
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const { theme } = useTheme()
  const accent = branding?.primary_color ?? '#5B8EF4'
  const slug   = branding?.slug ?? ''

  const { data, isLoading } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn: () => memberApi.getProfile(slug),
    enabled: !!slug && !!accessToken,
  })

  const gym      = data?.gym
  const gymAny   = gym as any
  const currency = gym?.currency ?? 'XAF'
  // Plans may be in gymAny.plans or we show generic info
  const plans: any[] = gymAny?.plans ?? []

  function callGym() {
    const phone = gymAny?.phone
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() =>
        Alert.alert('Cannot call', 'Unable to open the phone app.')
      )
    } else {
      Alert.alert('Contact gym', 'Visit the reception to enquire about membership plans.')
    }
  }

  return (
    <Screen>
      <AppHeader title="Membership Plans" subtitle={gym?.name ?? branding?.name} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header card */}
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 360 }}>
          <Card padding={20} style={[styles.heroBanner, { borderColor: accent + '30' }]}
            bg={accent + '0C'}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>Choose your plan</Text>
            <Text style={[styles.heroSub, { color: theme.textSub }]}>
              All plans include full gym access and QR check-in. Contact the gym to sign up.
            </Text>
          </Card>
        </MotiView>

        {/* Plan cards */}
        {isLoading ? (
          [1, 2, 3].map(i => (
            <MotiView key={i}
              from={{ opacity: 0.4 }} animate={{ opacity: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900, delay: i * 80 }}
              style={[styles.skeleton, { backgroundColor: theme.skeleton }]}
            />
          ))
        ) : plans.length > 0 ? (
          plans.map((plan, i) => {
            const PlanIcon = PLAN_ICONS[plan.billing_cycle?.toLowerCase()] ?? Calendar
            return (
              <MotiView key={plan.id ?? i}
                from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 340, delay: 80 + i * 60 }}>
                <Card padding={20} style={styles.planCard}>
                  <View style={styles.planTop}>
                    <View style={[styles.planIconWrap, { backgroundColor: accent + '18' }]}>
                      <PlanIcon size={20} color={accent} strokeWidth={1.8} />
                    </View>
                    <View style={styles.planInfo}>
                      <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                      <Text style={[styles.planCycle, { color: theme.textSub }]}>
                        {plan.billing_cycle ?? 'Monthly'}
                      </Text>
                    </View>
                    <View style={styles.planPriceWrap}>
                      <Text style={[styles.planPrice, { color: accent }]}>
                        {fmtMoney(plan.price, currency)}
                      </Text>
                      <Text style={[styles.planPricePer, { color: theme.textMuted }]}>
                        /{plan.duration_days ?? 30}d
                      </Text>
                    </View>
                  </View>

                  {plan.description && (
                    <Text style={[styles.planDesc, { color: theme.textSub }]}>{plan.description}</Text>
                  )}

                  <View style={styles.featureList}>
                    {(plan.features ?? PLAN_FEATURES).slice(0, 4).map((f: string, fi: number) => (
                      <View key={fi} style={styles.featureRow}>
                        <View style={[styles.featureCheck, { backgroundColor: accent + '18' }]}>
                          <Check size={11} color={accent} strokeWidth={2.5} />
                        </View>
                        <Text style={[styles.featureText, { color: theme.textSub }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </MotiView>
            )
          })
        ) : (
          /* Fallback generic plans if API doesn't return plans */
          [
            { label: 'Monthly', price: null, cycle: '30 days', desc: 'Most popular choice — full access for one month.' },
            { label: 'Quarterly', price: null, cycle: '90 days', desc: 'Save more with a 3-month commitment.' },
            { label: 'Annual', price: null, cycle: '365 days', desc: 'Best value — 12 months of unlimited access.' },
          ].map((p, i) => (
            <MotiView key={i}
              from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 340, delay: 80 + i * 60 }}>
              <Card padding={20} style={styles.planCard}>
                <View style={styles.planTop}>
                  <View style={[styles.planIconWrap, { backgroundColor: accent + '18' }]}>
                    <Calendar size={20} color={accent} strokeWidth={1.8} />
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={[styles.planName, { color: theme.text }]}>{p.label}</Text>
                    <Text style={[styles.planCycle, { color: theme.textSub }]}>{p.cycle}</Text>
                  </View>
                  <View style={styles.planPriceWrap}>
                    <Text style={[styles.planPrice, { color: accent }]}>Ask gym</Text>
                  </View>
                </View>
                <Text style={[styles.planDesc, { color: theme.textSub }]}>{p.desc}</Text>
                <View style={styles.featureList}>
                  {PLAN_FEATURES.map((f, fi) => (
                    <View key={fi} style={styles.featureRow}>
                      <View style={[styles.featureCheck, { backgroundColor: accent + '18' }]}>
                        <Check size={11} color={accent} strokeWidth={2.5} />
                      </View>
                      <Text style={[styles.featureText, { color: theme.textSub }]}>{f}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </MotiView>
          ))
        )}

        {/* CTA */}
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 360, delay: 300 }}>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: accent }]}
            onPress={callGym}
            activeOpacity={0.82}
          >
            <Phone size={16} color="#fff" strokeWidth={2} />
            <Text style={styles.contactBtnText}>Contact gym to sign up</Text>
          </TouchableOpacity>
          <Text style={[styles.footerNote, { color: theme.textMuted }]}>
            Pricing may vary. Contact your gym for current rates.
          </Text>
        </MotiView>

        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  skeleton:{ height: 160, borderRadius: 18 },

  heroBanner: { gap: 8 },
  heroTitle:  { fontSize: 20, fontFamily: F.extrabold },
  heroSub:    { fontSize: 14, fontFamily: F.regular, lineHeight: 21 },

  planCard: { gap: 14 },
  planTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planInfo: { flex: 1 },
  planName: { fontSize: 17, fontFamily: F.bold },
  planCycle:{ fontSize: 13, fontFamily: F.regular, marginTop: 2 },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice:     { fontSize: 17, fontFamily: F.extrabold },
  planPricePer:  { fontSize: 11, fontFamily: F.regular },

  planDesc: { fontSize: 13, fontFamily: F.regular, lineHeight: 19 },

  featureList: { gap: 8 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureCheck:{ width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 13, fontFamily: F.regular },

  contactBtn: {
    height: 52, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 4,
  },
  contactBtnText: { color: '#fff', fontSize: 16, fontFamily: F.bold },
  footerNote: { fontSize: 12, fontFamily: F.regular, textAlign: 'center', marginTop: 10 },
})
