import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { F } from '../../theme'

type LabelVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const LIGHT: Record<LabelVariant, { bg: string; text: string }> = {
  neutral: { bg: '#F0F0F8', text: '#585872' },
  info:    { bg: '#EEF2FF', text: '#4F46E5' },
  success: { bg: '#DCFCE7', text: '#16A34A' },
  warning: { bg: '#FFF7ED', text: '#C2410C' },
  danger:  { bg: '#FFF1F2', text: '#E11D48' },
}

const DARK: Record<LabelVariant, { bg: string; text: string }> = {
  neutral: { bg: 'rgba(255,255,255,0.08)', text: '#8C8CA8' },
  info:    { bg: 'rgba(99,102,241,0.15)',  text: '#818CF8' },
  success: { bg: 'rgba(74,222,128,0.14)',  text: '#4ade80' },
  warning: { bg: 'rgba(251,191,36,0.14)',  text: '#fbbf24' },
  danger:  { bg: 'rgba(251,113,133,0.14)', text: '#fb7185' },
}

interface StatusLabelProps {
  label: string
  variant?: LabelVariant
  bg?: string
  color?: string
}

export function StatusLabel({ label, variant = 'neutral', bg, color }: StatusLabelProps) {
  const { isDark } = useTheme()
  const preset = (isDark ? DARK : LIGHT)[variant]
  const bgColor = bg ?? preset.bg
  const textColor = color ?? preset.text

  return (
    <View style={[styles.pill, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 13,
    fontFamily: F.medium,
    letterSpacing: 0.1,
  },
})
