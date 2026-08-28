import { View, Text, StyleSheet, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import QRCode from 'react-native-qrcode-svg'
import { F } from '../../theme'

interface MembershipCardProps {
  memberName: string
  memberNo: string
  planName: string
  expiresAt: string
  gymName: string
  gymLogoUrl?: string | null
  primaryColor: string
  qrValue: string
  status: string
}

function fmtExpiry(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function lightenHex(hex: string, amt = 40): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (num >> 16) + amt)
  const g = Math.min(255, ((num >> 8) & 0xff) + amt)
  const b = Math.min(255, (num & 0xff) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function MembershipCard({
  memberName, memberNo, planName, expiresAt,
  gymName, gymLogoUrl, primaryColor, qrValue, status,
}: MembershipCardProps) {
  const lightColor = lightenHex(primaryColor, 50)
  const isActive = status === 'active' || status === 'expiring_soon'

  return (
    <LinearGradient
      colors={[primaryColor, lightColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.gymInfo}>
          {gymLogoUrl ? (
            <Image source={{ uri: gymLogoUrl }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Text style={styles.gymName}>{gymName}</Text>
          )}
        </View>
        <View style={[styles.statusPill, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }]}>
          <Text style={styles.statusText}>{status.toUpperCase().replace('_', ' ')}</Text>
        </View>
      </View>

      {/* Member name */}
      <Text style={styles.memberName} numberOfLines={1}>{memberName}</Text>
      <Text style={styles.memberNo}>{memberNo}</Text>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom row: plan info + QR */}
      <View style={styles.bottomRow}>
        <View style={styles.planInfo}>
          <Text style={styles.planLabel}>PLAN</Text>
          <Text style={styles.planName} numberOfLines={1}>{planName}</Text>
          <Text style={styles.planLabel}>EXPIRES</Text>
          <Text style={styles.planValue}>{fmtExpiry(expiresAt)}</Text>
        </View>
        <View style={styles.qrContainer}>
          <QRCode value={qrValue} size={72} color="#fff" backgroundColor="transparent" />
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gymInfo: { flex: 1 },
  logo: { width: 80, height: 24 },
  gymName: { color: '#fff', fontSize: 14, fontFamily: F.bold, opacity: 0.9 },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  statusText: { color: '#fff', fontSize: 10, fontFamily: F.extrabold, letterSpacing: 0.5 },
  memberName: { color: '#fff', fontSize: 22, fontFamily: F.extrabold, letterSpacing: 0.3 },
  memberNo: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: F.regular, marginTop: 2, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 14 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  planInfo: { flex: 1 },
  planLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontFamily: F.bold, letterSpacing: 1, marginBottom: 1 },
  planName: { color: '#fff', fontSize: 14, fontFamily: F.bold, marginBottom: 8 },
  planValue: { color: '#fff', fontSize: 13, fontFamily: F.semibold },
  qrContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 8,
  },
})
