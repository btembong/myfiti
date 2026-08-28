import { View, StyleSheet, type ViewStyle } from 'react-native'
import { useTheme } from '../../context/ThemeContext'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle | ViewStyle[]
  padding?: number
  bg?: string
}

export function Card({ children, style, padding = 16, bg }: CardProps) {
  const { theme } = useTheme()
  return (
    <View style={[
      styles.card,
      {
        backgroundColor: bg ?? theme.surface,
        borderColor: theme.border,
        shadowColor: theme.shadow,
        padding,
      },
      ...(Array.isArray(style) ? style : style ? [style] : []),
    ]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
})
