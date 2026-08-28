import { TouchableOpacity, View, StyleSheet } from 'react-native'
import { Check, Minus } from 'lucide-react-native'

interface CheckboxProps {
  value: boolean | 'indeterminate'
  onValueChange?: (v: boolean) => void
  disabled?: boolean
  color?: string
  size?: number
}

export function Checkbox({
  value,
  onValueChange,
  disabled = false,
  color = '#14B946',
  size = 22,
}: CheckboxProps) {
  const checked = value === true
  const indeterminate = value === 'indeterminate'
  const active = checked || indeterminate
  const iconSize = Math.round(size * 0.6)

  const handlePress = () => {
    if (disabled || !onValueChange) return
    if (value === 'indeterminate') {
      onValueChange(true)
    } else {
      onValueChange(!value)
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: size * 0.25,
            backgroundColor: active ? color : 'transparent',
            borderColor: active ? color : '#C0C0D0',
            borderWidth: active ? 0 : 1.5,
          },
        ]}
      >
        {checked && <Check size={iconSize} color="#FFFFFF" strokeWidth={3} />}
        {indeterminate && <Minus size={iconSize} color="#FFFFFF" strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
