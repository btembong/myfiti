import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, View, type ViewStyle, type TextStyle,
} from 'react-native'
import { F } from '../../theme'

/**
 * Variants
 *   primary   — filled brand color                  (design: Primary)
 *   secondary — transparent with brand border       (design: Secondary)
 *   tertiary  — no border, brand-colored label      (design: Tertiary)
 *   danger    — filled red
 *   ghost     — alias for tertiary (backward compat)
 *   outline   — alias for secondary (backward compat)
 *
 * Sizes
 *   xl → 56 px   lg → 48 px   md → 42 px   sm → 34 px
 */

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost' | 'outline'
type Size    = 'xl' | 'lg' | 'md' | 'sm'

interface ButtonProps {
  label:      string
  onPress:    () => void
  variant?:   Variant
  size?:      Size
  loading?:   boolean
  disabled?:  boolean
  color?:     string
  /** Icon rendered to the left of the label */
  icon?:      React.ReactNode
  /** Full-width (default true) */
  fullWidth?: boolean
  /** Pill shape — borderRadius 100 (default false → uses 12) */
  pill?:      boolean
  style?:     ViewStyle
  textStyle?: TextStyle
}

const HEIGHT:    Record<Size, number> = { xl: 56, lg: 48, md: 42, sm: 34 }
const FONT_SIZE: Record<Size, number> = { xl: 17, lg: 15, md: 15, sm: 13 }

export function Button({
  label, onPress,
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  disabled = false,
  color    = '#14B946',
  icon,
  fullWidth = true,
  pill      = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled  = disabled || loading
  const radius      = pill ? 100 : 12
  // secondary and outline are the same; tertiary and ghost are the same
  const resolvedVariant: Variant =
    variant === 'outline' ? 'secondary' :
    variant === 'ghost'   ? 'tertiary'  : variant

  const containerStyle: ViewStyle = {
    height:           HEIGHT[size],
    borderRadius:     radius,
    alignItems:       'center',
    justifyContent:   'center',
    flexDirection:    'row',
    gap:              6,
    paddingHorizontal: size === 'xl' ? 28 : size === 'lg' ? 22 : size === 'sm' ? 14 : 18,
    ...(fullWidth && { alignSelf: 'stretch' }),
    ...(resolvedVariant === 'primary'   && { backgroundColor: color }),
    ...(resolvedVariant === 'secondary' && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: color }),
    ...(resolvedVariant === 'tertiary'  && { backgroundColor: 'transparent' }),
    ...(resolvedVariant === 'danger'    && { backgroundColor: '#EF4444' }),
    ...(isDisabled && { opacity: 0.45 }),
  }

  const labelColor =
    resolvedVariant === 'primary'   ? '#FFFFFF' :
    resolvedVariant === 'secondary' ? color :
    resolvedVariant === 'tertiary'  ? color :
    resolvedVariant === 'danger'    ? '#FFFFFF' : '#FFFFFF'

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.78}
      style={[containerStyle, style]}
    >
      {loading ? (
        <ActivityIndicator
          color={resolvedVariant === 'primary' || resolvedVariant === 'danger' ? '#FFFFFF' : color}
          size="small"
        />
      ) : (
        <>
          {icon && <View style={{ opacity: isDisabled ? 0.6 : 1 }}>{icon}</View>}
          <Text style={[
            styles.label,
            { color: labelColor, fontSize: FONT_SIZE[size] },
            textStyle,
          ]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  label: { fontFamily: F.semibold, letterSpacing: 0.1 },
})
