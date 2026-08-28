import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { F } from '../../theme'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'custom'

const DARK_PRESETS: Record<Exclude<BadgeVariant, 'custom'>, { bg: string; text: string }> = {
  success: { bg: 'rgba(74,222,128,0.14)',  text: '#4ade80' },
  warning: { bg: 'rgba(251,191,36,0.14)',  text: '#fbbf24' },
  danger:  { bg: 'rgba(248,113,113,0.14)', text: '#f87171' },
  info:    { bg: 'rgba(147,197,253,0.14)', text: '#93c5fd' },
  neutral: { bg: 'rgba(255,255,255,0.08)', text: '#8C8CA8' },
}

const LIGHT_PRESETS: Record<Exclude<BadgeVariant, 'custom'>, { bg: string; text: string }> = {
  success: { bg: '#DCFCE7', text: '#16A34A' },
  warning: { bg: '#FEF9C3', text: '#B45309' },
  danger:  { bg: '#FEE2E2', text: '#DC2626' },
  info:    { bg: '#DBEAFE', text: '#2563EB' },
  neutral: { bg: '#F0F0F8', text: '#585872' },
}

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  bg?: string
  color?: string
  size?: 'sm' | 'md'
}

export function Badge({ label, variant = 'neutral', bg, color, size = 'sm' }: BadgeProps) {
  const { isDark } = useTheme()
  const presets = isDark ? DARK_PRESETS : LIGHT_PRESETS
  const preset = variant !== 'custom' ? presets[variant] : null
  const bgColor = bg ?? preset?.bg ?? (isDark ? 'rgba(255,255,255,0.08)' : '#F0F0F8')
  const textColor = color ?? preset?.text ?? (isDark ? '#8C8CA8' : '#585872')

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, size === 'md' && styles.md]}>
      <Text style={[styles.text, { color: textColor }, size === 'md' && styles.textMd]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, alignSelf: 'flex-start' },
  text:   { fontSize: 11, fontFamily: F.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  md:     { paddingHorizontal: 12, paddingVertical: 5 },
  textMd: { fontSize: 12 },
})
