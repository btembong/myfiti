import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../../context/ThemeContext'
import { F } from '../../theme'

interface AppHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  showBack?: boolean
  right?: React.ReactNode
  style?: ViewStyle
  transparent?: boolean
}

export function AppHeader({
  title, subtitle, onBack, showBack = true,
  right, style, transparent = false,
}: AppHeaderProps) {
  const { theme } = useTheme()
  const router = useRouter()

  function handleBack() {
    if (onBack) onBack()
    else router.back()
  }

  return (
    <View style={[
      styles.container,
      transparent ? {} : { backgroundColor: theme.bg, borderBottomColor: theme.border, borderBottomWidth: 1 },
      style,
    ]}>
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            style={[styles.backBtn, { backgroundColor: theme.surfaceHigh, borderColor: theme.border }]}
          >
            <ChevronLeft size={20} color={theme.text} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.center}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: theme.textSub }]} numberOfLines={1}>{subtitle}</Text>}
      </View>

      <View style={styles.right}>
        {right ?? null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  left:   { width: 44, alignItems: 'flex-start' },
  center: { flex: 1, alignItems: 'center' },
  right:  { width: 44, alignItems: 'flex-end' },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  title:    { fontSize: 17, fontWeight: '700', fontFamily: F.bold },
  subtitle: { fontSize: 12, marginTop: 1, fontFamily: F.regular },
})
