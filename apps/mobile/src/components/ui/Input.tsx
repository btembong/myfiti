import { useState } from 'react'
import {
  View, TextInput, Text, TouchableOpacity, StyleSheet,
  type TextInputProps, type ViewStyle,
} from 'react-native'
import { Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react-native'
import { useTheme } from '../../context/ThemeContext'
import { F } from '../../theme'

/**
 * States  : default | focus | error | success | disabled
 * Sizes   : md (52 px, default) | sm (42 px)
 */

type InputSize = 'md' | 'sm'

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?:       string
  error?:       string
  hint?:        string
  success?:     string
  secure?:      boolean
  size?:        InputSize
  accentColor?: string
  /** Icon rendered on the left inside the field */
  icon?:        React.ReactNode
  style?:       ViewStyle
}

export function Input({
  label,
  error,
  hint,
  success,
  secure   = false,
  size     = 'md',
  accentColor = '#14B946',
  icon,
  style,
  editable = true,
  ...props
}: InputProps) {
  const { theme }            = useTheme()
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)

  const isDisabled = editable === false
  const hasError   = !!error
  const hasSuccess = !!success && !hasError

  const borderColor =
    hasError   ? '#EF4444' :
    hasSuccess ? '#22C55E' :
    focused    ? accentColor :
    theme.inputBorder

  const height = size === 'sm' ? 42 : 52
  const fontSize = size === 'sm' ? 14 : 15

  return (
    <View style={[styles.wrapper, style]}>

      {label && (
        <Text style={[styles.label, { color: theme.textSub }]}>{label}</Text>
      )}

      <View style={[
        styles.row,
        {
          height,
          borderColor,
          backgroundColor: isDisabled ? theme.surfaceHigh : theme.input,
          opacity: isDisabled ? 0.55 : 1,
        },
      ]}>
        {icon && <View style={styles.iconLeft}>{icon}</View>}

        <TextInput
          style={[
            styles.input,
            { color: theme.text, fontSize },
            icon ? { paddingLeft: 6 } : null,
          ]}
          secureTextEntry={secure && !visible}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          {...props}
        />

        {/* Right side: success icon OR secure toggle */}
        {hasSuccess && !secure && (
          <CheckCircle size={18} color="#22C55E" style={styles.iconRight} />
        )}
        {hasError && !secure && (
          <AlertCircle size={18} color="#EF4444" style={styles.iconRight} />
        )}
        {secure && (
          <TouchableOpacity onPress={() => setVisible(v => !v)} style={styles.eyeBtn}>
            {visible
              ? <EyeOff size={18} color={theme.textSub} />
              : <Eye    size={18} color={theme.textSub} />}
          </TouchableOpacity>
        )}
      </View>

      {hasError   && <Text style={styles.errorText}>{error}</Text>}
      {hasSuccess && <Text style={[styles.successText]}>{success}</Text>}
      {!hasError && !hasSuccess && hint && (
        <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },

  label: { fontSize: 13, fontFamily: F.semibold },

  row: {
    flexDirection:  'row',
    alignItems:     'center',
    borderWidth:    1.5,
    borderRadius:   13,
    paddingHorizontal: 14,
  },

  input: {
    flex:       1,
    height:     '100%',
    fontFamily: F.regular,
  },

  iconLeft:  { marginRight: 4 },
  iconRight: { marginLeft: 4 },
  eyeBtn:    { padding: 4, marginLeft: 4 },

  errorText:   { fontSize: 12, fontFamily: F.regular, color: '#EF4444' },
  successText: { fontSize: 12, fontFamily: F.regular, color: '#22C55E' },
  hint:        { fontSize: 12, fontFamily: F.regular },
})
