import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Linking,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ChevronLeft, ChevronDown, ChevronUp,
  Search, AlertCircle, CreditCard, Wallet, User,
  QrCode, Gift, Phone, Mail, MessageCircle,
} from 'lucide-react-native'
import { useTheme } from '../src/context/ThemeContext'
import { useTenant } from '../src/context/TenantContext'
import { F } from '../src/theme'

const CATEGORIES = [
  { id: 'checkin',  label: 'Check-In',    sub: 'QR code & scanning',  Icon: QrCode,      color: '#3B82F6' },
  { id: 'payments', label: 'Payments',    sub: 'Receipts & billing',   Icon: CreditCard,  color: '#EF4444' },
  { id: 'wallet',   label: 'Wallet',      sub: 'Top-up & balance',     Icon: Wallet,      color: '#10B981' },
  { id: 'referral', label: 'Referrals',   sub: 'Codes & rewards',      Icon: Gift,        color: '#8B5CF6' },
  { id: 'account',  label: 'My Account',  sub: 'Profile & security',   Icon: User,        color: '#F97316' },
  { id: 'other',    label: 'Other',       sub: 'General questions',    Icon: AlertCircle, color: '#6B7280' },
]

const ALL_FAQS = [
  // Check-in
  { cat: 'checkin', q: 'Why is my QR code not scanning?', a: 'Ensure the full QR code is visible in the camera frame. Clean your camera lens, increase screen brightness, and hold your phone steady. If the problem persists, try logging out and back in to refresh your QR code.' },
  { cat: 'checkin', q: 'How do I check in at the gym?', a: 'Open the app and tap the QR button at the bottom centre. Show the QR code to the staff scanner at the entrance, or use the "Scan to Enter" option if your gym has a self-service terminal.' },
  { cat: 'checkin', q: 'Can I check in using a PIN?', a: 'Yes. Set up a PIN in Profile → Security → Setup PIN. You can then log in with your PIN instead of OTP, which is faster for daily check-ins.' },
  { cat: 'checkin', q: 'What is the History tab on the check-in screen?', a: 'The History tab shows a log of all your past check-ins grouped by week, including the date, time, and method used (QR scan, PIN, or staff-assisted).' },
  { cat: 'checkin', q: 'My check-in says "Grace period" — what does that mean?', a: 'Your membership has expired but the gym is allowing a short grace period for you to renew. You can still enter during this time but should renew as soon as possible to avoid being locked out.' },

  // Payments
  { cat: 'payments', q: 'How do I view my payment history?', a: 'Go to the Payments tab from the home screen. You can filter by All, Paid, Pending, or Failed. Each receipt shows the plan, amount, date, and payment method.' },
  { cat: 'payments', q: 'Why does a payment show as "Pending"?', a: 'A payment is pending while we wait for confirmation from Mobile Money. This usually takes 1–3 minutes. If it stays pending for more than 10 minutes, contact your gym or check your Mobile Money balance.' },
  { cat: 'payments', q: 'How do I renew my membership?', a: 'Go to Profile → My Membership and tap "Renew with Mobile Money". Select a plan and enter your Mobile Money number. You will receive a USSD prompt on your phone to confirm the payment.' },
  { cat: 'payments', q: 'Can wallet credits be used to pay for membership?', a: 'Wallet credits accumulate automatically from referral rewards and can be applied towards membership fees when your gym enables auto-deduction.' },

  // Wallet
  { cat: 'wallet', q: 'How do I top up my wallet?', a: 'Go to Profile → My Wallet and tap "Top up". Select an amount (or enter a custom amount), enter your Mobile Money number, and confirm. A USSD prompt will appear on your phone — approve it to complete the top-up.' },
  { cat: 'wallet', q: 'Why has my wallet balance not updated after a top-up?', a: 'Pull down to refresh the wallet screen. If the balance still has not updated after 5 minutes, the payment may have failed. Check your Mobile Money transaction history and contact support if funds were deducted.' },
  { cat: 'wallet', q: 'How do I earn wallet credits?', a: 'You earn XAF 500 in wallet credit for every friend you refer who joins the gym and pays their first month. Credits are added automatically once the referral is confirmed.' },
  { cat: 'wallet', q: 'Can I withdraw money from my wallet?', a: 'Wallet credits are currently non-withdrawable and can only be used for gym payments. Contact your gym for specific withdrawal policies.' },

  // Referrals
  { cat: 'referral', q: 'How does the referral program work?', a: 'Share your personal referral code with a friend. When they join the gym and tell staff your code, and after they pay their first month, you automatically receive XAF 500 in wallet credit.' },
  { cat: 'referral', q: 'Where do I find my referral code?', a: 'Go to Profile → Refer & Earn. Your unique referral code is displayed prominently on the screen. Tap "Share code" to send it via any messaging app.' },
  { cat: 'referral', q: 'Why has my referral not been credited?', a: 'Referral credits are only issued after the referred member pays their first full month. If they have joined but not yet paid, the credit will appear as "Pending" in your referral history.' },
  { cat: 'referral', q: 'Is there a limit on how many people I can refer?', a: 'There is no limit. You can refer as many people as you like and earn credit for each successful referral.' },

  // Account
  { cat: 'account', q: 'How do I update my phone number?', a: 'Go to Profile and tap "Edit Profile". Update your phone number and save. Note: your phone number is also your login identifier, so keep it current.' },
  { cat: 'account', q: 'How do I enable biometric login?', a: 'Go to Profile → Security → Biometric Login and toggle it on. You will be asked to verify with Face ID or fingerprint. Once set up, you can log in without entering your OTP each time.' },
  { cat: 'account', q: 'I forgot my PIN — how do I reset it?', a: 'Go to Profile → Security → Setup PIN. You will need to verify via OTP to reset your PIN. If you cannot receive OTP, contact your gym to reset your account access.' },
  { cat: 'account', q: 'How do I turn off push notifications?', a: 'Go to Profile → Settings → Push notifications and toggle it off. To manage OS-level permissions, tap "System permissions" to open your phone settings.' },

  // Other
  { cat: 'other', q: 'The app is slow or not loading — what should I do?', a: 'Check your internet connection first. Try pulling down to refresh any screen. If the issue persists, close and reopen the app. For persistent issues, contact your gym or our support team.' },
  { cat: 'other', q: 'How do I delete my account?', a: 'Go to Profile, scroll to the bottom, and tap "Delete Account". You will be asked for a reason and asked to confirm. Account deletion is permanent and cannot be undone.' },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  return (
    <TouchableOpacity
      style={[styles.faqItem, { borderBottomColor: theme.borderSub }]}
      onPress={() => setOpen(v => !v)}
      activeOpacity={0.7}
    >
      <View style={styles.faqRow}>
        <Text style={[styles.faqQ, { color: theme.text }]}>{q}</Text>
        {open
          ? <ChevronUp size={17} color={theme.textMuted} strokeWidth={1.8} />
          : <ChevronDown size={17} color={theme.textMuted} strokeWidth={1.8} />
        }
      </View>
      {open && <Text style={[styles.faqA, { color: theme.textSub }]}>{a}</Text>}
    </TouchableOpacity>
  )
}

export default function HelpScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const { theme } = useTheme()
  const { branding } = useTenant()
  const accent = branding?.primary_color ?? '#5B8EF4'

  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)

  const filtered = ALL_FAQS.filter(f => {
    const matchesCat = !activeCat || f.cat === activeCat
    const matchesSearch = !search.trim() ||
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color={theme.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Help Center</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.headline, { color: theme.text }]}>How can we help?</Text>

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: theme.input, borderColor: theme.inputBorder }]}>
          <Search size={16} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search help articles..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={t => { setSearch(t); setActiveCat(null) }}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Text style={[styles.clearBtn, { color: theme.textMuted }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category grid */}
        <View style={styles.grid}>
          {CATEGORIES.map(cat => {
            const active = activeCat === cat.id
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catCard,
                  {
                    backgroundColor: active ? cat.color + '18' : theme.surface,
                    borderColor: active ? cat.color + '50' : theme.border,
                  },
                ]}
                onPress={() => { setActiveCat(active ? null : cat.id); setSearch('') }}
                activeOpacity={0.78}
              >
                <View style={[styles.catIconWrap, { backgroundColor: cat.color + '18' }]}>
                  <cat.Icon size={20} color={cat.color} strokeWidth={1.8} />
                </View>
                <Text style={[styles.catLabel, { color: theme.text }]}>{cat.label}</Text>
                <Text style={[styles.catSub, { color: theme.textMuted }]}>{cat.sub}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* FAQ list */}
        <View style={styles.faqHeader}>
          <Text style={[styles.faqTitle, { color: theme.text }]}>
            {activeCat
              ? CATEGORIES.find(c => c.id === activeCat)?.label ?? 'FAQs'
              : search.trim() ? 'Search results' : 'Frequently Asked'}
          </Text>
          {(activeCat || search.trim()) && (
            <TouchableOpacity onPress={() => { setActiveCat(null); setSearch('') }} activeOpacity={0.7}>
              <Text style={[styles.clearFilter, { color: accent }]}>Show all</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.faqCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {filtered.length > 0
            ? filtered.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)
            : (
              <View style={styles.noResults}>
                <Text style={[styles.noResultsText, { color: theme.textMuted }]}>
                  No results for "{search}"
                </Text>
              </View>
            )
          }
        </View>

        {/* Contact section */}
        <Text style={[styles.contactTitle, { color: theme.text }]}>Still need help?</Text>
        <View style={[styles.contactCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.contactRow, { borderBottomColor: theme.border }]}
            onPress={() => Linking.openURL('tel:+237600000000').catch(() => {})}
            activeOpacity={0.75}
          >
            <View style={[styles.contactIcon, { backgroundColor: '#22C55E18' }]}>
              <Phone size={18} color="#22C55E" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactLabel, { color: theme.text }]}>Call your gym</Text>
              <Text style={[styles.contactSub, { color: theme.textMuted }]}>Speak to staff directly</Text>
            </View>
            <ChevronLeft size={16} color={theme.textMuted} strokeWidth={1.8} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contactRow, { borderBottomColor: theme.border }]}
            onPress={() => Linking.openURL('mailto:support@myfiti.app').catch(() => {})}
            activeOpacity={0.75}
          >
            <View style={[styles.contactIcon, { backgroundColor: '#3B82F618' }]}>
              <Mail size={18} color="#3B82F6" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactLabel, { color: theme.text }]}>Email support</Text>
              <Text style={[styles.contactSub, { color: theme.textMuted }]}>support@myfiti.app</Text>
            </View>
            <ChevronLeft size={16} color={theme.textMuted} strokeWidth={1.8} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL('https://wa.me/237600000000').catch(() => {})}
            activeOpacity={0.75}
          >
            <View style={[styles.contactIcon, { backgroundColor: '#25D36618' }]}>
              <MessageCircle size={18} color="#25D366" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactLabel, { color: theme.text }]}>WhatsApp</Text>
              <Text style={[styles.contactSub, { color: theme.textMuted }]}>Chat with us on WhatsApp</Text>
            </View>
            <ChevronLeft size={16} color={theme.textMuted} strokeWidth={1.8} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { width: 36, alignItems: 'flex-start' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: F.bold },

  scroll: { padding: 20, paddingTop: 20 },

  headline: { fontSize: 22, fontFamily: F.extrabold, marginBottom: 16 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14, height: 50, marginBottom: 20,
  },
  searchInput: {
    flex: 1, fontSize: 15, fontFamily: F.regular,
    borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0,
  },
  clearBtn: { fontSize: 13, fontFamily: F.medium },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  catCard: {
    width: '31%', borderRadius: 16, borderWidth: 1,
    padding: 12, gap: 6,
  },
  catIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catLabel:    { fontSize: 13, fontFamily: F.bold },
  catSub:      { fontSize: 11, fontFamily: F.regular, lineHeight: 15 },

  faqHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  faqTitle:    { fontSize: 17, fontFamily: F.extrabold },
  clearFilter: { fontSize: 13, fontFamily: F.semibold },

  faqCard:  { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  faqItem:  { borderBottomWidth: StyleSheet.hairlineWidth, padding: 16 },
  faqRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faqQ:     { flex: 1, fontSize: 14, fontFamily: F.medium, lineHeight: 20 },
  faqA:     { fontSize: 13, fontFamily: F.regular, lineHeight: 20, marginTop: 10 },

  noResults:     { padding: 24, alignItems: 'center' },
  noResultsText: { fontSize: 14, fontFamily: F.regular },

  contactTitle: { fontSize: 17, fontFamily: F.extrabold, marginBottom: 12 },
  contactCard:  { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contactIcon:  { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 14, fontFamily: F.semibold },
  contactSub:   { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
})
