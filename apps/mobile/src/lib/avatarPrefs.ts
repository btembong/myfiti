import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_AVATAR_STYLE, type AvatarStyleId } from './avatarStyles'

const KEY = 'myfiti_avatar_style'

export async function getStoredAvatarStyle(): Promise<AvatarStyleId> {
  try {
    return ((await AsyncStorage.getItem(KEY)) ?? DEFAULT_AVATAR_STYLE) as AvatarStyleId
  } catch {
    return DEFAULT_AVATAR_STYLE
  }
}

export async function storeAvatarStyle(style: AvatarStyleId): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, style)
  } catch {}
}
