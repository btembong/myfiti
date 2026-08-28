import { TouchableOpacity, View, StyleSheet, Animated } from 'react-native'
import { useEffect, useRef } from 'react'

interface ToggleProps {
  value: boolean
  onValueChange: (v: boolean) => void
  disabled?: boolean
  color?: string
}

export function Toggle({
  value,
  onValueChange,
  disabled = false,
  color = '#14B946',
}: ToggleProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start()
  }, [value])

  const thumbLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 23] })
  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['#D0D0E0', color] })

  return (
    <TouchableOpacity
      onPress={() => !disabled && onValueChange(!value)}
      activeOpacity={0.8}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { left: thumbLeft }]} />
      </Animated.View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
})
