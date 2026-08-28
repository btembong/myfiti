import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChevronLeft, ChevronDown, ChevronUp,
  Search, AlertCircle, FileText, Wallet, User,
} from 'lucide-react-native'
import { useTheme } from '../src/context/ThemeContext'
import { F } from '../src/theme'

// ─── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'scan',
    label: 'Scan Failed',
    sub: 'Camera & QR issues',
    Icon: AlertCircle,
    color: '#EF4444',
    bg: '#FEF2F2',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    sub: 'History & receipts',
    Icon: FileText,
    color: '#3B82F6',
    bg: '#EFF6FF',
  },
  {
    id: 'balance',
    label: 'Balance Info',
    sub: 'Top-up & limits',
    Icon: Wallet,
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    id: 'account',
    label: 'My Account',
    sub: 'Profile & security',
    Icon: User,
    color: '#F97316',
    bg: '#FFF7ED',
  },
]

const FAQS = [
  {
    q: 'Why does the scanner take too long to detect?',
    a: 'Make sure the QR code is well-lit and held steady. Poor lighting or camera shake can slow detection. Try moving closer or farther from the code.',
  },
  {
    q: 'Why is my scan not detecting the QR code?',
    a: 'Ensure the full QR code is visible in the camera frame. Clean your camera lens and make sure there are no obstructions or reflections on the code.',
  },
  {
    q: 'Why is the QR code blurry or unreadable?',
    a: 'Your QR code might be too small or the screen brightness too low. Try increasing brightness or asking the staff to scan from a different angle.',
  },
  {
    q: 'Can I scan QR codes from screenshots or gallery?',
    a: 'The check-in scanner uses your live camera. For now, screenshots are not supported — show your QR code directly from the app.',
  },
  {
    q: 'Does Scan to Pay work in low light?',
    a: 'Yes, the QR code on your screen generates its own light, so it works in dim environments. If the gym scanner has trouble, increase your screen brightness.',
  },
]

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

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
          ? <ChevronUp size={18} color={theme.textMuted} strokeWidth={1.8} />
          : <ChevronDown size={18} color={theme.textMuted} strokeWidth={1.8} />
        }
      </View>
      {open && (
        <Text style={[styles.faqA, { color: theme.textSub }]}>{a}</Text>
      )}
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const [search, setSearch] = useState('')

  const filteredFaqs = search.trim()
    ? FAQS.filter(f =>
        f.q.toLowerCase().includes(search.toLowerCase()) ||
        f.a.toLowerCase().includes(search.toLowerCase())
      )
    : FAQS

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color={theme.text} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Help Center</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Headline */}
          <Text style={[styles.headline, { color: theme.text }]}>How can we help?</Text>

          {/* Search */}
          <View style={[styles.searchRow, { backgroundColor: theme.input, borderColor: theme.inputBorder }]}>
            <Search size={16} color={theme.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search issue, keywords..."
              placeholderTextColor={theme.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>

          {/* Category grid */}
          <View style={styles.grid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.card, { backgroundColor: cat.bg, borderColor: cat.color + '22' }]}
                activeOpacity={0.78}
              >
                <View style={[styles.cardIconWrap, { backgroundColor: cat.color + '20' }]}>
                  <cat.Icon size={22} color={cat.color} strokeWidth={1.8} />
                </View>
                <Text style={[styles.cardLabel, { color: '#0D0D18' }]}>{cat.label}</Text>
                <Text style={[styles.cardSub, { color: '#6B7280' }]}>{cat.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* FAQ */}
          <Text style={[styles.faqTitle, { color: theme.text }]}>Frequently Asked Questions</Text>

          <View style={[styles.faqCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {filteredFaqs.length > 0
              ? filteredFaqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)
              : (
                <Text style={[styles.noResults, { color: theme.textMuted }]}>
                  No results for "{search}"
                </Text>
              )
            }
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { width: 36, alignItems: 'flex-start' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: F.bold },

  scroll: { padding: 20, paddingTop: 24 },

  headline: { fontSize: 22, fontFamily: F.extrabold, marginBottom: 16 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14, height: 50,
    marginBottom: 24,
  },
  searchIcon:  { marginRight: 10 },
  searchInput: {
    flex: 1, fontSize: 15, fontFamily: F.regular,
    outlineStyle: 'none' as any,
    borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0,
  },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    marginBottom: 28,
  },
  card: {
    width: '47.5%', borderRadius: 18, borderWidth: 1,
    padding: 16, gap: 8,
  },
  cardIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontSize: 15, fontFamily: F.bold },
  cardSub:   { fontSize: 12, fontFamily: F.regular },

  faqTitle: { fontSize: 18, fontFamily: F.extrabold, marginBottom: 14 },
  faqCard:  { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },

  faqItem:  { borderBottomWidth: StyleSheet.hairlineWidth, padding: 16 },
  faqRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faqQ:     { flex: 1, fontSize: 14, fontFamily: F.medium, lineHeight: 20 },
  faqA:     { fontSize: 13, fontFamily: F.regular, lineHeight: 20, marginTop: 10 },

  noResults: { padding: 20, textAlign: 'center', fontFamily: F.regular, fontSize: 14 },
})
