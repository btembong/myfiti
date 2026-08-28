import { TouchableOpacity, View, StyleSheet } from 'react-native'

interface RadioButtonProps {
  selected: boolean
  onPress: () => void
  disabled?: boolean
  color?: string
  size?: number
}

export function RadioButton({
  selected,
  onPress,
  disabled = false,
  color = '#14B946',
  size = 22,
}: RadioButtonProps) {
  const inner = size * 0.45

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <View
        style={[
          styles.outer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: selected ? color : '#C0C0D0',
            borderWidth: selected ? 2 : 1.5,
            backgroundColor: selected ? color + '10' : 'transparent',
          },
        ]}
      >
        {selected && (
          <View
            style={{
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: color,
            }}
          />
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
