import { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Dimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { MotiView } from 'moti'
import {
  Eye, EyeOff, QrCode, Calendar, CreditCard,
  Crown, ChevronRight,
  ScanLine, CheckCheck, Users, TrendingUp,
} from 'lucide-react-native'
import { SvgXml } from 'react-native-svg'
import { PROFILE_HERO_BG_RAW } from '../../src/assets/profileHeroBg'
import { Badge } from '../../src/components/ui/Badge'
import { NotificationIcon } from '../../src/components/ui/TabIcons'
import { StyledQRCode } from '../../src/components/ui/StyledQRCode'
import { DiceBearAvatar } from '../../src/components/ui/DiceBearAvatar'
import { memberApi } from '../../src/lib/api'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { F } from '../../src/theme'

const { width, height: SCREEN_H } = Dimensions.get('window')

function mixColor(hex: string, withWhite: boolean, amount: number): string {
  const h    = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n    = parseInt(full, 16)
  const r0 = (n >> 16) & 0xff; const g0 = (n >> 8) & 0xff; const b0 = n & 0xff
  const t  = withWhite ? 255 : 0
  return `#${[r0, g0, b0].map(c => Math.round(c + (t - c) * amount).toString(16).padStart(2, '0')).join('')}`
}

function daysRemaining(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const DAILY_QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Push yourself — no one else is going to do it for you.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Don't limit your challenges. Challenge your limits.",
  "Train insane or remain the same.",
  "The pain you feel today is the strength you feel tomorrow.",
  "Sweat is just fat crying.",
  "Be stronger than your excuses.",
  "Every rep gets you closer.",
  "Consistency beats perfection.",
  "Make yourself proud.",
  "Earn it.",
]
function getDailyQuote() {
  return DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length]
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(diff / 3600000)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// ─── Custom Book/Calendar SVG ─────────────────────────────────────────────────
// ─── Custom Book/Calendar SVG ─────────────────────────────────────────────────
const BOOK_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6.94028 2C7.35614 2 7.69326 2.32421 7.69326 2.72414V4.18487C8.36117 4.17241 9.10983 4.17241 9.95219 4.17241H13.9681C14.8104 4.17241 15.5591 4.17241 16.227 4.18487V2.72414C16.227 2.32421 16.5641 2 16.98 2C17.3958 2 17.733 2.32421 17.733 2.72414V4.24894C19.178 4.36022 20.1267 4.63333 20.8236 5.30359C21.5206 5.97385 21.8046 6.88616 21.9203 8.27586L22 9H2.92456H2V8.27586C2.11571 6.88616 2.3997 5.97385 3.09665 5.30359C3.79361 4.63333 4.74226 4.36022 6.1873 4.24894V2.72414C6.1873 2.32421 6.52442 2 6.94028 2Z" fill="FILL_ACCENT"/>
<path d="M22 14.0001V12.0001C22 11.161 21.9968 9.66527 21.9839 9H2.00966C1.99675 9.66527 2.00001 11.161 2.00001 12.0001V14.0001C2.00001 17.7713 2.00001 19.6569 3.17159 20.8285C4.34316 22.0001 6.22878 22.0001 10 22.0001H14C17.7713 22.0001 19.6569 22.0001 20.8284 20.8285C22 19.6569 22 17.7713 22 14.0001Z" fill="FILL_DARK"/>
<path d="M18 17C18 17.5523 17.5523 18 17 18C16.4477 18 16 17.5523 16 17C16 16.4477 16.4477 16 17 16C17.5523 16 18 16.4477 18 17Z" fill="FILL_ACCENT"/>
<path d="M18 13C18 13.5523 17.5523 14 17 14C16.4477 14 16 13.5523 16 13C16 12.4477 16.4477 12 17 12C17.5523 12 18 12.4477 18 13Z" fill="FILL_ACCENT"/>
<path d="M13 17C13 17.5523 12.5523 18 12 18C11.4477 18 11 17.5523 11 17C11 16.4477 11.4477 16 12 16C12.5523 16 13 16.4477 13 17Z" fill="FILL_ACCENT"/>
<path d="M13 13C13 13.5523 12.5523 14 12 14C11.4477 14 11 13.5523 11 13C11 12.4477 11.4477 12 12 12C12.5523 12 13 12.4477 13 13Z" fill="FILL_ACCENT"/>
<path d="M8 17C8 17.5523 7.55228 18 7 18C6.44772 18 6 17.5523 6 17C6 16.4477 6.44772 16 7 16C7.55228 16 8 16.4477 8 17Z" fill="FILL_ACCENT"/>
<path d="M8 13C8 13.5523 7.55228 14 7 14C6.44772 14 6 13.5523 6 13C6 12.4477 6.44772 12 7 12C7.55228 12 8 12.4477 8 13Z" fill="FILL_ACCENT"/>
</svg>`

function BookCalendarIcon({ size = 28 }: { size?: number; color?: string }) {
  const { branding } = useTenant()
  const accent = branding?.primary_color ?? '#22C55E'
  const xml = useMemo(
    () => BOOK_ICON_SVG.replace(/FILL_DARK/g, '#1C274C').replace(/FILL_ACCENT/g, accent),
    [accent],
  )
  return <SvgXml xml={xml} width={size} height={size} />
}

// ─── Custom Scan SVG ──────────────────────────────────────────────────────────
const SCAN_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3.46447 3.46447C2 4.92893 2 7.28595 2 12C2 16.714 2 19.0711 3.46447 20.5355C4.92893 22 7.28595 22 12 22C16.714 22 19.0711 22 20.5355 20.5355C22 19.0711 22 16.714 22 12C22 7.28595 22 4.92893 20.5355 3.46447C19.0711 2 16.714 2 12 2C7.28595 2 4.92893 2 3.46447 3.46447Z" fill="FILL_DARK"/>
<path d="M10.004 5.75194C10.4182 5.74975 10.7522 5.41219 10.75 4.99798C10.7478 4.58377 10.4102 4.24977 9.99602 4.25196C8.91427 4.2577 8.01583 4.2824 7.28261 4.41067C6.53075 4.5422 5.88786 4.79268 5.36144 5.29403C4.90634 5.72746 4.60191 6.16641 4.43626 6.797C4.28612 7.36858 4.25937 8.07179 4.25231 8.9945C4.24914 9.40871 4.58234 9.74705 4.99654 9.75022C5.41074 9.75339 5.74909 9.42019 5.75226 9.00599C5.75952 8.05721 5.79204 7.53976 5.88704 7.1781C5.96654 6.87546 6.09314 6.6686 6.39592 6.38024C6.63788 6.1498 6.96814 5.98846 7.54109 5.88823C8.13268 5.78473 8.91071 5.75774 10.004 5.75194Z" fill="FILL_ACCENT"/>
<path d="M14.0041 4.25196C13.5899 4.24977 13.2523 4.58377 13.2501 4.99798C13.2479 5.41218 13.5819 5.74975 13.9961 5.75194C15.0894 5.75774 15.8674 5.78474 16.4589 5.88823C17.0319 5.98846 17.3621 6.1498 17.6041 6.38024C17.9069 6.6686 18.0335 6.87546 18.113 7.1781C18.208 7.53976 18.2405 8.05721 18.2477 9.00599C18.2509 9.42019 18.5893 9.75339 19.0035 9.75022C19.4177 9.74705 19.7509 9.40871 19.7477 8.9945C19.7406 8.07179 19.7139 7.36858 19.5637 6.797C19.3981 6.16641 19.0937 5.72746 18.6386 5.29403C18.1121 4.79269 17.4693 4.5422 16.7174 4.41067C15.9842 4.2824 15.0858 4.2577 14.0041 4.25196Z" fill="FILL_ACCENT"/>
<path d="M5 11.2503C4.58579 11.2503 4.25 11.5861 4.25 12.0003C4.25 12.4145 4.58579 12.7503 5 12.7503H19C19.4142 12.7503 19.75 12.4145 19.75 12.0003C19.75 11.5861 19.4142 11.2503 19 11.2503H5Z" fill="FILL_ACCENT"/>
<path d="M5.75226 14.9946C5.74909 14.5804 5.41074 14.2472 4.99654 14.2504C4.58234 14.2535 4.24914 14.5919 4.25231 15.0061C4.25937 15.9288 4.28612 16.632 4.43626 17.2036C4.60191 17.8342 4.90634 18.2731 5.36144 18.7066C5.88785 19.2079 6.53073 19.4584 7.28258 19.5899C8.01578 19.7182 8.91421 19.7429 9.99593 19.7486C10.4101 19.7508 10.7477 19.4168 10.7499 19.0026C10.7521 18.5884 10.4181 18.2508 10.0039 18.2487C8.91065 18.2429 8.13264 18.2159 7.54107 18.1124C6.96814 18.0121 6.63788 17.8508 6.39592 17.6204C6.09314 17.332 5.96654 17.1251 5.88704 16.8225C5.79204 16.4608 5.75952 15.9434 5.75226 14.9946Z" fill="FILL_ACCENT"/>
<path d="M19.7477 15.0061C19.7509 14.5919 19.4177 14.2535 19.0035 14.2504C18.5893 14.2472 18.2509 14.5804 18.2477 14.9946C18.2405 15.9434 18.208 16.4608 18.113 16.8225C18.0335 17.1251 17.9069 17.332 17.6041 17.6204C17.3621 17.8508 17.0319 18.0121 16.4589 18.1124C15.8674 18.2159 15.0894 18.2429 13.9961 18.2487C13.5819 18.2508 13.2479 18.5884 13.2501 19.0026C13.2523 19.4168 13.5899 19.7508 14.0041 19.7486C15.0858 19.7429 15.9842 19.7182 16.7174 19.5899C17.4693 19.4584 18.1121 19.2079 18.6386 18.7066C19.0937 18.2731 19.3981 17.8342 19.5637 17.2036C19.7139 16.632 19.7406 15.9288 19.7477 15.0061Z" fill="FILL_ACCENT"/>
</svg>`

function ScanCustomIcon({ size = 28 }: { size?: number; color?: string }) {
  const { branding } = useTenant()
  const accent = branding?.primary_color ?? '#22C55E'
  const xml = useMemo(
    () => SCAN_ICON_SVG.replace(/FILL_DARK/g, '#1C274C').replace(/FILL_ACCENT/g, accent),
    [accent],
  )
  return <SvgXml xml={xml} width={size} height={size} />
}

// ─── Custom Checkin SVG ───────────────────────────────────────────────────────
const CHECKIN_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M9.94358 1.25L10 1.25C10.4142 1.25 10.75 1.58579 10.75 2C10.75 2.41421 10.4142 2.75 10 2.75C8.09318 2.75 6.73851 2.75159 5.71085 2.88976C4.70476 3.02502 4.12511 3.27869 3.7019 3.7019C3.27869 4.12511 3.02502 4.70476 2.88976 5.71085C2.75159 6.73851 2.75 8.09318 2.75 10C2.75 10.4142 2.41421 10.75 2 10.75C1.58579 10.75 1.25 10.4142 1.25 10L1.25 9.94358C1.24998 8.10582 1.24997 6.65019 1.40314 5.51098C1.56076 4.33856 1.89288 3.38961 2.64124 2.64124C3.38961 1.89288 4.33856 1.56076 5.51098 1.40314C6.65019 1.24997 8.10582 1.24998 9.94358 1.25ZM18.2892 2.88976C17.2615 2.75159 15.9068 2.75 14 2.75C13.5858 2.75 13.25 2.41421 13.25 2C13.25 1.58579 13.5858 1.25 14 1.25L14.0564 1.25C15.8942 1.24998 17.3498 1.24997 18.489 1.40314C19.6614 1.56076 20.6104 1.89288 21.3588 2.64124C22.1071 3.38961 22.4392 4.33856 22.5969 5.51098C22.75 6.65019 22.75 8.10583 22.75 9.94359V10C22.75 10.4142 22.4142 10.75 22 10.75C21.5858 10.75 21.25 10.4142 21.25 10C21.25 8.09318 21.2484 6.73851 21.1102 5.71085C20.975 4.70476 20.7213 4.12511 20.2981 3.7019C19.8749 3.27869 19.2952 3.02502 18.2892 2.88976ZM2 13.25C2.41421 13.25 2.75 13.5858 2.75 14C2.75 15.9068 2.75159 17.2615 2.88976 18.2892C3.02502 19.2952 3.27869 19.8749 3.7019 20.2981C4.12511 20.7213 4.70476 20.975 5.71085 21.1102C6.73851 21.2484 8.09318 21.25 10 21.25C10.4142 21.25 10.75 21.5858 10.75 22C10.75 22.4142 10.4142 22.75 10 22.75H9.94359C8.10583 22.75 6.65019 22.75 5.51098 22.5969C4.33856 22.4392 3.38961 22.1071 2.64124 21.3588C1.89288 20.6104 1.56076 19.6614 1.40314 18.489C1.24997 17.3498 1.24998 15.8942 1.25 14.0564L1.25 14C1.25 13.5858 1.58579 13.25 2 13.25ZM22 13.25C22.4142 13.25 22.75 13.5858 22.75 14V14.0564C22.75 15.8942 22.75 17.3498 22.5969 18.489C22.4392 19.6614 22.1071 20.6104 21.3588 21.3588C20.6104 22.1071 19.6614 22.4392 18.489 22.5969C17.3498 22.75 15.8942 22.75 14.0564 22.75H14C13.5858 22.75 13.25 22.4142 13.25 22C13.25 21.5858 13.5858 21.25 14 21.25C15.9068 21.25 17.2615 21.2484 18.2892 21.1102C19.2952 20.975 19.8749 20.7213 20.2981 20.2981C20.7213 19.8749 20.975 19.2952 21.1102 18.2892C21.2484 17.2615 21.25 15.9068 21.25 14C21.25 13.5858 21.5858 13.25 22 13.25Z" fill="FILL_ACCENT"/>
<path d="M10 5.5H14C15.8856 5.5 16.8284 5.5 17.4142 6.08579C17.9642 6.63575 17.9978 7.5004 17.9999 9.16448L18 12.0167V14.5C18 16.3856 18 17.3284 17.4142 17.9142C16.8284 18.5 15.8856 18.5 14 18.5H10C8.11438 18.5 7.17157 18.5 6.58579 17.9142C6 17.3284 6 16.3856 6 14.5V12.0167L6.00013 9.16449C6.00219 7.5004 6.03582 6.63575 6.58579 6.08579C7.17157 5.5 8.11438 5.5 10 5.5Z" fill="FILL_DARK"/>
<path d="M18.3693 9.29994C18.2513 9.25455 18.1281 9.20929 17.9999 9.16445C16.1667 8.38595 11.2002 7.29605 6.00013 9.16446C5.87187 9.20929 5.74878 9.25456 5.63078 9.29994C4.9385 9.5662 4.42459 9.83556 4.07665 10.0443C3.90273 10.1487 3.77043 10.2378 3.67815 10.3037C3.63202 10.3367 3.59589 10.3638 3.56958 10.3842C3.55642 10.3943 3.54572 10.4028 3.53745 10.4094L3.52685 10.418L3.52291 10.4213L3.52128 10.4226L3.51988 10.4238C3.20167 10.689 3.15868 11.1619 3.42385 11.4801C3.68807 11.7971 4.15855 11.841 4.47672 11.579L4.4871 11.5708C4.49868 11.5619 4.51958 11.546 4.55001 11.5243C4.61086 11.4808 4.7098 11.4137 4.84839 11.3306C5.12545 11.1643 5.56153 10.9337 6.16925 10.7C7.38288 10.2332 9.29159 9.74995 12 9.74995C14.7085 9.74995 16.6172 10.2332 17.8308 10.7C18.4385 10.9337 18.8746 11.1643 19.1516 11.3306C19.2902 11.4137 19.3892 11.4808 19.45 11.5243C19.4805 11.546 19.5014 11.5619 19.5129 11.5708L19.5233 11.579C19.8415 11.841 20.312 11.7971 20.5762 11.4801C20.8414 11.1619 20.7984 10.689 20.4802 10.4238L20 10.9999C20.4802 10.4238 20.4788 10.4226 20.4788 10.4226L20.4771 10.4213L20.4732 10.418L20.4626 10.4094C20.4543 10.4028 20.4436 10.3943 20.4305 10.3842C20.4041 10.3638 20.368 10.3367 20.3219 10.3037C20.2296 10.2378 20.0973 10.1487 19.9234 10.0443C19.5755 9.83556 19.0615 9.5662 18.3693 9.29994Z" fill="FILL_ACCENT"/>
</svg>`

function CheckinCustomIcon({ size = 28 }: { size?: number; color?: string }) {
  const { branding } = useTenant()
  const accent = branding?.primary_color ?? '#22C55E'
  const xml = useMemo(
    () => CHECKIN_ICON_SVG.replace(/FILL_DARK/g, '#1C274C').replace(/FILL_ACCENT/g, accent),
    [accent],
  )
  return <SvgXml xml={xml} width={size} height={size} />
}

// ─── Action button ────────────────────────────────────────────────────────────
function HeroAction({ icon: Icon, label, onPress, iconBg, iconSize = 22 }: {
  icon: any; label: string; onPress: () => void
  iconBg?: string; iconSize?: number
}) {
  return (
    <TouchableOpacity style={styles.heroAction} onPress={onPress} activeOpacity={0.78}>
      <View style={[styles.heroActionIcon, { backgroundColor: iconBg ?? 'rgba(255,255,255,0.18)' }]}>
        <Icon size={iconSize} color="#fff" strokeWidth={1.8} />
      </View>
      <Text style={styles.heroActionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

// ─── Activity row ─────────────────────────────────────────────────────────────
function ActivityRow({ icon: Icon, iconBg, title, sub, tag, tagColor }: {
  icon: any; iconBg: string; title: string; sub: string; tag: string; tagColor: string
}) {
  return (
    <View style={styles.actRow}>
      <View style={[styles.actIcon, { backgroundColor: iconBg }]}>
        <Icon size={18} color="#fff" strokeWidth={2} />
      </View>
      <View style={styles.actBody}>
        <Text style={styles.actTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.actSub}>{sub}</Text>
      </View>
      <View style={[styles.actTag, { backgroundColor: tagColor + '18' }]}>
        <Text style={[styles.actTagText, { color: tagColor }]}>{tag}</Text>
      </View>
    </View>
  )
}

// ─── Promo card ───────────────────────────────────────────────────────────────
function PromoCard({ title, body, color, onPress }: {
  title: string; body: string; color: string; onPress?: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.promoCard, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.promoTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.promoBody} numberOfLines={2}>{body}</Text>
      <View style={styles.promoBtn}>
        <Text style={styles.promoBtnText}>Learn More</Text>
      </View>
    </TouchableOpacity>
  )
}

const PROMO_COLORS = ['#16A34A', '#2563EB', '#7C3AED', '#EA580C']

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router  = useRouter()
  const { branding } = useTenant()
  const { accessToken } = useAuth()
  const insets  = useSafeAreaInsets()
  const { theme } = useTheme()
  const accent = branding?.primary_color ?? '#22C55E'
  const slug   = branding?.slug ?? ''

  const [statHidden, setStatHidden] = useState(false)

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['member-profile', slug],
    queryFn:  () => memberApi.getProfile(slug),
    enabled:  !!slug && !!accessToken,
  })
  const { data: scheduleData } = useQuery({
    queryKey: ['member-schedule', slug],
    queryFn:  () => memberApi.getSchedule(slug),
    enabled:  !!slug && !!accessToken,
  })
  const { data: notifData } = useQuery({
    queryKey: ['member-notifications', slug],
    queryFn:  () => memberApi.getNotifications(slug),
    enabled:  !!slug && !!accessToken,
  })
  const { data: receiptsData } = useQuery({
    queryKey: ['member-receipts', slug],
    queryFn:  () => memberApi.getReceipts(slug),
    enabled:  !!slug && !!accessToken,
  })

  const profile   = data?.member
  const sub       = data?.subscription
  const stats     = data?.stats
  const gym       = data?.gym
  const bookings  = scheduleData?.bookings ?? []
  const notifs    = notifData?.notifications?.slice(0, 4) ?? []
  const receipts  = receiptsData?.receipts?.slice(0, 5) ?? []
  const firstName = profile?.name?.split(' ')[0] ?? ''
  const avatarSeed = String(profile?.name ?? profile?.id ?? 'member')

  const daysLeft   = sub?.expires_at ? daysRemaining(sub.expires_at) : 0
  const barWidth: `${number}%` = sub
    ? `${Math.min(100, Math.max(6, (daysLeft / 365) * 100))}%`
    : '0%'
  const qrValue    = profile?.qr_code ?? (profile ? `myfiti:member:${profile.id}` : 'myfiti')
  const memberId   = profile?.id ? `#${String(profile.id).slice(-6).toUpperCase()}` : ''

  const bannerFrom = mixColor(accent, false, 0.20)
  const bannerTo   = mixColor(accent, false, 0.45)

  const isExpiringSoon = sub?.status === 'expiring_soon'
  const hasNoSub       = !sub
  const checkIns       = stats?.visitsThisMonth ?? 0
  const greeting       = getGreeting()

  const gradTop = mixColor(accent, false, 0.15)
  const gradBot = mixColor(accent, false, 0.55)

  const heroBgSvg = useMemo(
    () => PROFILE_HERO_BG_RAW.replace('FILL_COLOR', 'rgba(255,255,255,0.13)'),
    [],
  )

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Hero gradient — covers top 60% only, so status bar and bottom show theme.bg */}
      <LinearGradient
        colors={[gradTop, gradBot]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_H * 0.60 }}
      >
        <SvgXml
          xml={heroBgSvg}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          style={StyleSheet.absoluteFill}
        />
      </LinearGradient>

      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />}
        >

          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.avatarPill}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.85}
            >
              <DiceBearAvatar seed={avatarSeed} size={44} photoUrl={profile?.avatar_url} />
              <Text style={styles.avatarPillName} numberOfLines={1}>
                {isLoading ? '...' : firstName}
              </Text>
            </TouchableOpacity>

            <View style={styles.headerRight}>
              {(hasNoSub || isExpiringSoon) && (
                <TouchableOpacity
                  style={[styles.upgradeBtn, { backgroundColor: '#fff' }]}
                  onPress={() => router.push('/plans')}
                  activeOpacity={0.85}
                >
                  <Crown size={14} color={accent} strokeWidth={2} fill={accent} />
                  <Text style={[styles.upgradeBtnText, { color: accent }]}>
                    {hasNoSub ? 'Get a Plan' : 'Renew'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/notifications')}
                activeOpacity={0.75}
                style={styles.bellBtn}
              >
                <NotificationIcon size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Greeting ── */}
          <View style={styles.greetWrap}>
            <Text style={styles.greetHi}>
              {isLoading ? 'Welcome back' : greeting}
            </Text>
            <Text style={styles.greetPunch}>
              {isExpiringSoon
                ? "Don't lose your streak — renew now."
                : hasNoSub
                ? 'Your body is waiting. Start today.'
                : 'Stay consistent. Results follow.'}
            </Text>
          </View>

          {/* ── Daily motivation ── */}
          <View style={styles.quoteCard}>
            <Text style={styles.quoteLabel}>Today's motivation</Text>
            <Text style={styles.quoteText}>"{getDailyQuote()}"</Text>
          </View>

          {/* ── Hero stats ── */}
          <View style={styles.hero}>

            {/* Eye toggle row — always visible, collapses the block below */}
            <TouchableOpacity
              onPress={() => setStatHidden(v => !v)}
              activeOpacity={0.7}
              style={styles.eyeRow}
            >
              {statHidden
                ? <EyeOff size={15} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
                : <Eye    size={15} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
              }
              <Text style={styles.eyeRowLabel}>
                {statHidden ? 'Show stats' : 'Hide stats'}
              </Text>
            </TouchableOpacity>

            {/* Collapsible stat pills — maxHeight collapses layout so content pulls up */}
            <MotiView
              animate={{ opacity: statHidden ? 0 : 1, maxHeight: statHidden ? 0 : 300 }}
              transition={{ type: 'timing', duration: 280 }}
              style={{ overflow: 'hidden' }}
              pointerEvents={statHidden ? 'none' : 'auto'}
            >
              <View style={styles.statPills}>
                <View style={styles.statPill}>
                  <Text style={styles.statPillLabel}>Days Left</Text>
                  <Text style={styles.statPillNum}>{sub ? daysLeft : '—'}</Text>
                  <Text style={styles.statPillSub} numberOfLines={1}>
                    {sub ? sub.plan_name : 'No plan'}
                  </Text>
                </View>

                <View style={styles.statPillDivider} />

                <View style={styles.statPill}>
                  <Text style={styles.statPillLabel}>Check-ins</Text>
                  <Text style={styles.statPillNum}>{checkIns}</Text>
                  <Text style={styles.statPillSub}>This month</Text>
                </View>
              </View>

              {sub && (
                <View style={styles.statBarWrap}>
                  <View style={styles.statBarTrack}>
                    <View style={[styles.statBarFill, { width: barWidth as any, backgroundColor: '#fff' }]} />
                  </View>
                  <Text style={styles.statBarLabel}>
                    {sub.plan_name} · expires {new Date(sub.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              )}
            </MotiView>

            {/* Quick actions */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.heroActions}
            >
              <HeroAction icon={QrCode}      label="My QR"     onPress={() => router.push('/(tabs)/checkin')}   />
              <HeroAction icon={ScanLine}    label="Scan"      onPress={() => router.push('/scan-checkin')}    />
              <HeroAction icon={Calendar}    label="Book"      onPress={() => router.push('/(tabs)/schedule')} />
              <HeroAction icon={CheckCheck}  label="Check-ins" onPress={() => router.push('/(tabs)/schedule')}  />
              <HeroAction icon={CreditCard}  label="Payments"  onPress={() => router.push('/(tabs)/payments')}  />
            </ScrollView>
          </View>

          {/* ── White card body ── */}
          <View style={styles.body}>

            {/* Membership card (mini, clean) */}
            <TouchableOpacity
              onPress={() => router.push('/plans')}
              activeOpacity={0.88}
              style={styles.memberCardWrap}
            >
              <LinearGradient
                colors={[bannerFrom, bannerTo]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.memberCard}
              >
                {/* bg circles */}
                <View style={styles.mc1} />
                <View style={styles.mc2} />

                <View style={styles.memberCardCols}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.mcGymName} numberOfLines={1}>
                      {(gym?.name ?? branding?.name ?? slug).toUpperCase()} · MEMBERSHIP
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.mcPlan} numberOfLines={1}>
                        {sub ? `${sub.plan_name} Plan` : 'No Active Plan'}
                      </Text>
                      {sub && (
                        <View style={styles.mcBadge}>
                          <Text style={styles.mcBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.mcSub}>
                      {sub ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` : 'Contact your gym to get started.'}
                    </Text>
                    {sub && (
                      <View style={styles.mcBar}>
                        <View style={[styles.mcBarFill, { width: barWidth as any }]} />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.mcBtn}
                      onPress={() => router.push('/plans')}
                      activeOpacity={0.82}
                    >
                      <Text style={styles.mcBtnText}>{sub ? 'Upgrade' : 'Get a Plan'}</Text>
                      <ChevronRight size={12} color={bannerTo} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>

                  {/* QR side */}
                  <TouchableOpacity
                    style={styles.mcQrSide}
                    onPress={() => router.push('/(tabs)/checkin')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.mcQrBox}>
                      {profile ? (
                        <StyledQRCode
                          value={qrValue}
                          size={96}
                          dotColor="#111111"
                          finderColor={accent}
                          backgroundColor="#FFFFFF"
                        />
                      ) : (
                        <View style={{ width: 96, height: 96, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8 }} />
                      )}
                    </View>
                    <Text style={styles.mcQrLabel}>Scan to check in</Text>
                    {memberId ? <Text style={styles.mcQrId}>Member {memberId}</Text> : null}
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* ── Quick Actions Grid — 3 per row, 2 rows ── */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            {([
              [
                { icon: ScanCustomIcon,   label: 'Scan',      route: '/scan-checkin',        size: 80 },
                { icon: CheckinCustomIcon, label: 'Check-in',  route: '/(tabs)/checkin',  size: 80    },
                { icon: BookCalendarIcon, label: 'Book',      route: '/(tabs)/schedule',     size: 80 },
              ],
              [
                { icon: CreditCard,  label: 'Payments',  route: '/(tabs)/payments'      },
                { icon: Users,       label: 'Referrals', route: '/(tabs)/notifications' },
                { icon: TrendingUp,  label: 'Progress',  route: '/(tabs)/progress'      },
              ],
            ] as { icon: any; label: string; route: string; size?: number }[][]).map((row, ri) => (
              <View key={ri} style={styles.gridRow}>
                {row.map(({ icon: Icon, label, route, size }) => (
                  <TouchableOpacity
                    key={label}
                    style={styles.gridItem}
                    onPress={() => router.push(route as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.gridIconBox, { backgroundColor: accent + '18' }]}>
                      <Icon size={size ?? 30} color={accent} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.gridLabel}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* ── Recent Payments ── */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Recent Payments</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/payments')} activeOpacity={0.7}>
                <Text style={[styles.seeAll, { color: accent }]}>See all</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actCard}>
              {receipts.length > 0 ? receipts.map((r, i) => (
                <View key={r.id}>
                  <ActivityRow
                    icon={CreditCard}
                    iconBg={r.status === 'paid' ? '#2563EB' : '#9CA3AF'}
                    title={r.plan_name ?? 'Payment'}
                    sub={r.paid_at ? fmtRelative(r.paid_at) : fmtRelative(r.created_at)}
                    tag={`${r.currency} ${Number(r.amount).toLocaleString()}`}
                    tagColor={r.status === 'paid' ? '#2563EB' : '#9CA3AF'}
                  />
                  {i < receipts.length - 1 && <View style={styles.actDivider} />}
                </View>
              )) : (
                <View style={styles.emptyRow}>
                  <CreditCard size={22} color="#C4C9D4" strokeWidth={1.5} />
                  <Text style={styles.emptyText}>No payments yet</Text>
                </View>
              )}
            </View>

            {/* ── Announcements ── */}
            <Text style={styles.sectionTitle}>Announcements</Text>
            {notifs.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.promoScroll}
              >
                {notifs.map((n, i) => (
                  <PromoCard
                    key={n.id}
                    title={n.title}
                    body={n.body}
                    color={PROMO_COLORS[i % PROMO_COLORS.length]}
                    onPress={() => router.push('/(tabs)/notifications')}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.actCard, styles.emptyRow]}>
                <QrCode size={22} color="#C4C9D4" strokeWidth={1.5} />
                <Text style={styles.emptyText}>No announcements from your gym</Text>
              </View>
            )}

            {/* ── Upcoming Classes ── */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>What's Coming Up</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')} activeOpacity={0.7}>
                <Text style={[styles.seeAll, { color: accent }]}>See all</Text>
              </TouchableOpacity>
            </View>

            {bookings.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.classScroll}
              >
                {bookings.slice(0, 5).map(b => (
                  <View key={b.booking_id} style={styles.classCard}>
                    <View style={[styles.classCardAccent, { backgroundColor: accent }]} />
                    <View style={styles.classCardBody}>
                      <Text style={styles.classCardName} numberOfLines={1}>{b.class_name}</Text>
                      <Text style={styles.classCardTime}>{fmtDate(b.scheduled_at)}</Text>
                      <Text style={styles.classCardTime}>{fmtTime(b.scheduled_at)}</Text>
                      {b.trainer_name && (
                        <Text style={styles.classCardTrainer} numberOfLines={1}>{b.trainer_name}</Text>
                      )}
                      <Badge
                        label={b.booking_status === 'confirmed' ? 'Confirmed' : 'Waitlisted'}
                        variant={b.booking_status === 'confirmed' ? 'success' : 'warning'}
                        size="sm"
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.actCard, styles.emptyRow]}>
                <Calendar size={22} color="#C4C9D4" strokeWidth={1.5} />
                <Text style={styles.emptyText}>No classes booked yet</Text>
              </View>
            )}

            {/* Loading skeleton */}
            {isLoading && (
              <View style={{ gap: 12, padding: 4 }}>
                {[120, 80, 80, 80].map((h, i) => (
                  <MotiView key={i}
                    from={{ opacity: 0.3 }} animate={{ opacity: 0.8 }}
                    transition={{ loop: true, type: 'timing', duration: 900, delay: i * 100 }}
                    style={{ height: h, borderRadius: 16, backgroundColor: '#E5E7EB' }}
                  />
                ))}
              </View>
            )}

            <View style={{ height: 32 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4,
  },
  avatarPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 99,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  avatarPillName: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8,
  },
  upgradeBtnText: { fontSize: 13, fontFamily: F.bold },

  /* Quick actions grid — 3 per row, 2 rows */
  gridRow: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 12, gap: 12,
  },
  gridItem: {
    flex: 1, alignItems: 'center', gap: 8,
  },
  gridIconBox: {
    width: '100%', aspectRatio: 1,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  gridLabel: { fontSize: 12, fontFamily: F.semibold, color: '#3D4454', textAlign: 'center' },

  /* Greeting */
  greetWrap:  { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  greetHi:    { fontSize: 20, fontFamily: F.semibold, color: '#fff', lineHeight: 26 },
  greetPunch: { fontSize: 13, fontFamily: F.regular, color: 'rgba(255,255,255,0.55)', marginTop: 3 },

  /* Daily quote */
  quoteCard: {
    marginHorizontal: 20, marginTop: 10, marginBottom: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
  },
  quoteLabel: {
    fontSize: 9, fontFamily: F.semibold, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5,
  },
  quoteText: {
    fontSize: 12.5, fontFamily: F.regular, color: 'rgba(255,255,255,0.62)',
    fontStyle: 'italic', lineHeight: 18,
  },

  /* Eye toggle row */
  eyeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', marginBottom: 8, opacity: 0.75,
  },
  eyeRowLabel: { fontSize: 11, fontFamily: F.medium, color: 'rgba(255,255,255,0.6)' },

  /* Hero */
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },

  statPills: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20, padding: 16, gap: 12,
    marginBottom: 14,
  },
  statPill:       { flex: 1, alignItems: 'center', gap: 2 },
  statPillLabel:  { fontSize: 11, fontFamily: F.semibold, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.6 },
  statPillNum:    { fontSize: 36, fontFamily: F.extrabold, color: '#fff', lineHeight: 42 },
  statPillSub:    { fontSize: 11, fontFamily: F.regular, color: 'rgba(255,255,255,0.5)' },
  statPillDivider:{ width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.15)' },
  statEyeBtn: {
    position: 'absolute', top: 10, right: 12,
    padding: 4,
  },

  statBarWrap:  { marginBottom: 14, gap: 5 },
  statBarTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  statBarFill:  { height: 3, borderRadius: 2 },
  statBarLabel: { fontSize: 11, fontFamily: F.regular, color: 'rgba(255,255,255,0.55)' },

  heroActions:    { flexDirection: 'row', marginTop: 28, gap: 8, paddingRight: 8 },
  heroAction:     { width: 72, alignItems: 'center', gap: 8 },
  heroActionIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroActionLabel:{ fontSize: 12, fontFamily: F.semibold, color: 'rgba(255,255,255,0.85)' },

  /* White body */
  body: {
    backgroundColor: '#F5F6FA',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 24, paddingHorizontal: 16, gap: 16,
  },

  /* Section headers */
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontFamily: F.extrabold, color: '#0D0D18' },
  seeAll:       { fontSize: 13, fontFamily: F.semibold },

  /* Membership card */
  memberCardWrap: { borderRadius: 22, overflow: 'hidden', elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  memberCard:   { padding: 18 },
  mc1: { position: 'absolute', top: -30, right: -16, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  mc2: { position: 'absolute', bottom: -40, right: 70, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)' },
  memberCardCols: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  mcGymName:    { fontSize: 10, fontFamily: F.bold, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.7, textTransform: 'uppercase' },
  mcPlan:       { fontSize: 18, fontFamily: F.extrabold, color: '#fff', flexShrink: 1 },
  mcBadge:      { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  mcBadgeText:  { fontSize: 9, fontFamily: F.bold, color: '#fff', letterSpacing: 0.6 },
  mcSub:        { fontSize: 11, fontFamily: F.regular, color: 'rgba(255,255,255,0.72)' },
  mcBar:        { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 4 },
  mcBarFill:    { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.75)' },
  mcBtn: {
    marginTop: 12, alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fff', borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  mcBtnText:    { fontSize: 12, fontFamily: F.bold, color: '#000' },
  mcQrSide:     { alignItems: 'center', gap: 4 },
  mcQrBox:      { borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  mcQrLabel:    { fontSize: 9, fontFamily: F.semibold, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  mcQrId:       { fontSize: 8, fontFamily: F.regular, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },

  /* Activity */
  actCard:    { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  actRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  actIcon:    { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actBody:    { flex: 1, gap: 2 },
  actTitle:   { fontSize: 14, fontFamily: F.semibold, color: '#0D0D18' },
  actSub:     { fontSize: 12, fontFamily: F.regular, color: '#6B7280' },
  actTag:     { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  actTagText: { fontSize: 11, fontFamily: F.bold },
  actDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 68 },
  emptyRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, justifyContent: 'center' },
  emptyText:  { fontSize: 13, fontFamily: F.regular, color: '#C4C9D4' },

  /* Promos */
  promoScroll: { gap: 12, paddingRight: 4 },
  promoCard: {
    width: width * 0.6, borderRadius: 20, padding: 18, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  promoTitle:   { fontSize: 15, fontFamily: F.extrabold, color: '#fff' },
  promoBody:    { fontSize: 12, fontFamily: F.regular, color: 'rgba(255,255,255,0.8)', lineHeight: 17 },
  promoBtn:     { marginTop: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  promoBtnText: { fontSize: 12, fontFamily: F.semibold, color: '#fff' },

  /* Class cards */
  classScroll: { gap: 12, paddingRight: 4, paddingBottom: 4 },
  classCard: {
    width: 150, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  classCardAccent:  { height: 4 },
  classCardBody:    { padding: 14, gap: 4 },
  classCardName:    { fontSize: 14, fontFamily: F.bold, color: '#0D0D18' },
  classCardTime:    { fontSize: 12, fontFamily: F.regular, color: '#6B7280' },
  classCardTrainer: { fontSize: 11, fontFamily: F.regular, color: '#9CA3AF' },
})
