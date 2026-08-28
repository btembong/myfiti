import { useMemo } from 'react'
import { View, Image } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { createAvatar } from '@dicebear/core'
import { useAvatarStyle } from '../../context/AvatarStyleContext'
import { getAvatarStyle } from '../../lib/avatarStyles'

const BG_COLORS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf']

interface Props {
  seed: string
  size?: number
  photoUrl?: string | null
  styleOverride?: string
}

export function DiceBearAvatar({ seed, size = 44, photoUrl, styleOverride }: Props) {
  const { avatarStyle } = useAvatarStyle()
  const activeId  = styleOverride ?? avatarStyle
  const br        = size / 2

  const svg = useMemo(() => {
    if (photoUrl) return null
    const { style } = getAvatarStyle(activeId)
    return createAvatar(style, { seed, backgroundColor: BG_COLORS }).toString()
  }, [seed, activeId, photoUrl])

  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: br }} />
  }

  if (svg) {
    return (
      <View style={{ width: size, height: size, borderRadius: br, overflow: 'hidden' }}>
        <SvgXml xml={svg} width={size} height={size} />
      </View>
    )
  }

  return <View style={{ width: size, height: size, borderRadius: br, backgroundColor: '#E8E8F0' }} />
}
