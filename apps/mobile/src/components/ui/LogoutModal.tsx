import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, TouchableWithoutFeedback,
} from 'react-native'
import { LogOut, X } from 'lucide-react-native'
import { F } from '../../theme'

interface Props {
  visible: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function LogoutModal({ visible, onCancel, onConfirm }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={onCancel} activeOpacity={0.7}>
          <X size={18} color="#111827" strokeWidth={2.2} />
        </TouchableOpacity>

        <Text style={styles.title}>Log out of your account?</Text>
        <Text style={styles.subtitle}>
          You'll be signed out from this device and will need to log in again to continue.
        </Text>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            activeOpacity={0.75}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={onConfirm}
            activeOpacity={0.82}
          >
            <Text style={styles.logoutText}>Logout</Text>
            <LogOut size={18} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 14,
  },

  closeBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },

  title: {
    fontSize: 22,
    fontFamily: F.extrabold,
    color: '#111827',
    lineHeight: 30,
  },

  subtitle: {
    fontSize: 14,
    fontFamily: F.regular,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },

  cancelBtn: {
    flex: 1, height: 56, borderRadius: 99,
    borderWidth: 1.5, borderColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16, fontFamily: F.semibold, color: '#EF4444',
  },

  logoutBtn: {
    flex: 1, height: 56, borderRadius: 99,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    fontSize: 16, fontFamily: F.bold, color: '#fff',
  },
})
