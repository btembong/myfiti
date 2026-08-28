import { View, ScrollView, StyleSheet, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../context/ThemeContext'

// Extra padding to clear the floating tab bar above the safe area
// QR protrusion (46) + bar height (64) = 110
const FLOATING_BAR_EXTRA = 110

interface ScreenProps {
  children: React.ReactNode
  scroll?: boolean
  style?: ViewStyle
  contentStyle?: ViewStyle
  bg?: string
  /** Pass false for non-tab screens (settings, modals) that don't have the floating bar */
  tabBarPadding?: boolean
}

export function Screen({ children, scroll = false, style, contentStyle, bg, tabBarPadding = true }: ScreenProps) {
  const { theme } = useTheme()
  const backgroundColor = bg ?? theme.bg
  const extraPad = tabBarPadding ? FLOATING_BAR_EXTRA : 0

  if (scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor }, style]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: extraPad }, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }, style]}>
      <View style={[styles.inner, contentStyle]}>{children}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1 },
  inner:         { flex: 1 },
  scrollContent: { flexGrow: 1 },
})
