import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { MotiView } from 'moti'
import { useTheme } from '../../context/ThemeContext'
import { F } from '../../theme'

interface EmptyStateProps {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>
  title: string
  subtitle?: string
  action?: { label: string; onPress: () => void }
  iconColor?: string
  animate?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  iconColor,
  animate = true,
}: EmptyStateProps) {
  const { theme } = useTheme()
  const color = iconColor ?? theme.textMuted

  const inner = (
    <View style={styles.root}>
      {/* Icon circle */}
      <View style={[styles.circle, { backgroundColor: color + '12', borderColor: color + '20' }]}>
        <View style={[styles.innerCircle, { backgroundColor: color + '14' }]}>
          <Icon size={42} color={color} strokeWidth={1.4} />
        </View>
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: theme.textSub }]}>{subtitle}</Text>
        )}
      </View>

      {action && (
        <TouchableOpacity
          style={[styles.btn, { borderColor: color + '40', backgroundColor: color + '0E' }]}
          onPress={action.onPress}
          activeOpacity={0.75}
        >
          <Text style={[styles.btnText, { color }]}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  if (!animate) return inner

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 420 }}
    >
      {inner}
    </MotiView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 32,
    paddingBottom: 48,
    gap: 20,
  },
  circle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: F.extrabold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: F.regular,
    textAlign: 'center',
    lineHeight: 21,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnText: {
    fontSize: 14,
    fontFamily: F.semibold,
  },
})
