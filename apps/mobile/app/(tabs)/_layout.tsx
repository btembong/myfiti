import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { QrCode } from 'lucide-react-native'
import {
  HomeIcon, ActivityIcon, NotificationIcon, ProfileIcon,
  HomeIconBold, ActivityIconBold, NotificationIconBold, ProfileIconBold,
} from '../../src/components/ui/TabIcons'
import Svg, { Path } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import { useTenant } from '../../src/context/TenantContext'
import { useAuth } from '../../src/context/AuthContext'
import { memberApi } from '../../src/lib/api'
import { F } from '../../src/theme'

const W          = Dimensions.get('window').width
const QR_SIZE     = 68
const QR_R        = QR_SIZE / 2     // 34 — radius
const QR_PROTRUDE = QR_R + 12       // 46 — QR center sits 12 px above bar top
const BAR_H       = 64
const BAR_MARGIN  = 16
const BAR_W       = W - BAR_MARGIN * 2
const BAR_R       = 26              // corner radius
// Notch: circular arc matching the QR button's own curve (+ 2 px gap)
// Center of QR circle is QR_PROTRUDE - QR_R px above bar top.
// Arc radius = QR_R + 2 so the notch hugs the button with a tiny gap.
const NOTCH_R  = QR_R + 2
const NOTCH_HW = Math.sqrt(NOTCH_R * NOTCH_R - (QR_PROTRUDE - QR_R) ** 2)

// Pre-compute path (static — never changes)
const CX = BAR_W / 2
const notchPath = (() => {
  const r = BAR_R
  const w = BAR_W
  const h = BAR_H
  return [
    `M ${r} 0`,
    `H ${CX - NOTCH_HW}`,
    // Circular arc — clockwise from left to right, dipping into the bar.
    // sweep-flag=1 (clockwise), large-arc-flag=0 (minor arc ~141°)
    `A ${NOTCH_R} ${NOTCH_R} 0 0 1 ${CX + NOTCH_HW} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ')
})()

const LABELS: Record<string, string> = {
  home: 'Home', schedule: 'Activity', notifications: 'Inbox', profile: 'Profile',
}
const ICONS: Record<string, any> = {
  home: HomeIcon, schedule: ActivityIconBold, notifications: NotificationIcon, profile: ProfileIcon,
}
const ICONS_BOLD: Record<string, any> = {
  home: HomeIconBold, schedule: ActivityIcon, notifications: NotificationIconBold, profile: ProfileIconBold,
}

/** Mix hex color with white */
function lighten(hex: string, t: number): string {
  const h   = hex.replace('#', '')
  const src = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n   = parseInt(src, 16)
  const mix = (ch: number) => Math.round(ch + (255 - ch) * t)
  const r   = mix((n >> 16) & 0xff)
  const g   = mix((n >> 8)  & 0xff)
  const b   = mix((n)       & 0xff)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function CustomTabBar({ state, navigation }: any) {
  const insets          = useSafeAreaInsets()
  const { branding }    = useTenant()
  const { accessToken } = useAuth()
  const accent = branding?.primary_color ?? '#14B946'
  const slug            = branding?.slug ?? ''

  const { data: notifData } = useQuery({
    queryKey: ['member-notifications', slug],
    queryFn:  () => memberApi.getNotifications(slug),
    enabled:  !!slug && !!accessToken,
    refetchInterval: 60_000,
  })
  const hasUnread = (notifData?.unreadCount ?? 0) > 0

  const pressTab = (route: any) => {
    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (!e.defaultPrevented) navigation.navigate(route.name)
  }

  const renderTab = (route: any, index: number) => {
    const focused = state.index === index
    const Icon    = focused ? (ICONS_BOLD[route.name] ?? ICONS[route.name]) : ICONS[route.name]
    const label   = LABELS[route.name]
    if (!Icon || !label) return null

    return (
      <TouchableOpacity
        key={route.key}
        onPress={() => pressTab(route)}
        style={styles.tab}
        activeOpacity={0.7}
      >
        <View style={{ position: 'relative', opacity: focused ? 1 : 0.55 }}>
          <Icon
            size={focused ? 26 : 23}
            color={focused ? accent : '#8A94A6'}
          />
          {route.name === 'notifications' && hasUnread && (
            <View style={styles.dot} />
          )}
        </View>
        <Text style={[
          styles.label,
          { color: focused ? '#FFFFFF' : '#5C6478', fontFamily: focused ? F.bold : F.medium },
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  const checkinRoute = state.routes[2]

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>

      {/* ── Dark pill bar rendered by SVG (transparent notch, no overlay tricks) ── */}
      <View style={styles.barWrap}>
        <Svg width={BAR_W} height={BAR_H} style={StyleSheet.absoluteFill}>
          <Path d={notchPath} fill="#0D1117" />
        </Svg>

        {/* Shadow rendered as a separate View behind the SVG (iOS shadow on transparent won't work) */}
        <View style={styles.barShadow} pointerEvents="none" />

        {/* Tabs row */}
        <View style={styles.tabRow}>
          <View style={styles.side}>
            {state.routes.slice(0, 2).map((r: any, i: number) => renderTab(r, i))}
          </View>
          {/* Gap matching the notch width */}
          <View style={{ width: NOTCH_HW * 2 + 16 }} />
          <View style={styles.side}>
            {state.routes.slice(3, 5).map((r: any, i: number) => renderTab(r, i + 3))}
          </View>
        </View>
      </View>

      {/* ── QR circle — protrudes above bar center ── */}
      {/* top:0 in wrapper + paddingTop:QR_PROTRUDE on wrapper = QR top is 0, bar top is QR_PROTRUDE */}
      {/* left: centers the QR over the bar center (= screen center) */}
      <TouchableOpacity
        onPress={() => pressTab(checkinRoute)}
        activeOpacity={0.85}
        style={[
          styles.qrBtn,
          {
            top:  0,
            left: BAR_MARGIN + CX - QR_R,   // BAR_MARGIN offset + bar-center - QR-radius
            shadowColor: accent,
          },
        ]}
      >
        <LinearGradient
          colors={[lighten(accent, 0.28), accent]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={styles.qrGradient}
        >
          <QrCode size={30} color="#FFFFFF" strokeWidth={1.8} />
        </LinearGradient>
      </TouchableOpacity>

    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="checkin" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="progress"     options={{ href: null }} />
      <Tabs.Screen name="payments"     options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    paddingTop:      QR_PROTRUDE,
    backgroundColor: 'transparent',
  },
  barWrap: {
    width:           BAR_W,
    height:          BAR_H,
    marginHorizontal: BAR_MARGIN,  // horizontal float
    overflow:        'visible',
  },
  // Separate shadow view (SVG transparent cutout won't cast shadow correctly)
  barShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_R,
    // We can't shadow a transparent shape, so we rely on the QR glow for the visual depth
  },
  tabRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 4,
  },
  side: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
  },
  tab: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             3,
    paddingVertical: 8,
  },
  label: {
    fontSize:      11,
    letterSpacing: 0.2,
  },
  dot: {
    position:        'absolute',
    top:             -3,
    right:           -4,
    width:           9,
    height:          9,
    borderRadius:    5,
    backgroundColor: '#EF4444',
  },
  qrBtn: {
    position:    'absolute',
    width:       QR_SIZE,
    height:      QR_SIZE,
    borderRadius: QR_R,
    overflow:    'hidden',
    // Glow
    shadowOffset:   { width: 0, height: 0 },
    shadowOpacity:  0.7,
    shadowRadius:   22,
    elevation:      16,
    zIndex:         10,
  },
  qrGradient: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
  },
})
