import { useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Modal, Dimensions,
} from 'react-native'
import { SvgXml } from 'react-native-svg'
import { createAvatar } from '@dicebear/core'
import { Check, X } from 'lucide-react-native'
import { useAvatarStyle } from '../../context/AvatarStyleContext'
import { AVATAR_STYLES, type AvatarStyleId } from '../../lib/avatarStyles'
import { F } from '../../theme'

const { width } = Dimensions.get('window')
const ITEM_SIZE = (width - 48 - 24) / 3   // 3 columns with gaps
const BG_COLORS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf']

interface StyleItemProps {
  item: typeof AVATAR_STYLES[number]
  seed: string
  selected: boolean
  accent: string
  onSelect: () => void
}

function StyleItem({ item, seed, selected, accent, onSelect }: StyleItemProps) {
  const svg = useMemo(
    () => createAvatar(item.style, { seed, backgroundColor: BG_COLORS }).toString(),
    [item.style, seed],
  )

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.75}
      style={[
        styles.item,
        { width: ITEM_SIZE, height: ITEM_SIZE + 28 },
        selected && { borderColor: accent, borderWidth: 2.5 },
      ]}
    >
      <View style={styles.previewWrap}>
        <SvgXml xml={svg} width={ITEM_SIZE - 16} height={ITEM_SIZE - 16} />
      </View>
      <Text style={[styles.itemLabel, selected && { color: accent }]} numberOfLines={1}>
        {item.label}
      </Text>
      {selected && (
        <View style={[styles.checkBadge, { backgroundColor: accent }]}>
          <Check size={9} color="#fff" strokeWidth={3.5} />
        </View>
      )}
    </TouchableOpacity>
  )
}

interface Props {
  visible: boolean
  onClose: () => void
  seed: string
  accent?: string
}

export function AvatarPicker({ visible, onClose, seed, accent = '#14B946' }: Props) {
  const { avatarStyle, setAvatarStyle } = useAvatarStyle()

  function handleSelect(id: AvatarStyleId) {
    setAvatarStyle(id)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Avatar Style</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#5C6478" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={AVATAR_STYLES as unknown as typeof AVATAR_STYLES[number][]}
            numColumns={3}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <StyleItem
                item={item}
                seed={seed}
                selected={avatarStyle === item.id}
                accent={accent}
                onSelect={() => handleSelect(item.id as AvatarStyleId)}
              />
            )}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D0D5DD',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 16,
  },
  title: { fontSize: 17, fontFamily: F.bold, color: '#0D0D18' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  grid:  { paddingHorizontal: 24, paddingBottom: 16 },
  row:   { gap: 12, marginBottom: 12 },
  item: {
    borderRadius: 16,
    backgroundColor: '#F8F9FB',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    position: 'relative',
  },
  previewWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemLabel: {
    fontSize: 11, fontFamily: F.medium,
    color: '#5C6478', marginTop: 4,
  },
  checkBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
})
