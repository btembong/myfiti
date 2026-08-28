import {
  adventurerNeutral, avataaars, bigSmile, lorelei,
  micah, openPeeps, personas, funEmoji, bottts, pixelArt,
} from '@dicebear/collection'

export const AVATAR_STYLES = [
  { id: 'adventurerNeutral', label: 'Adventurer', style: adventurerNeutral },
  { id: 'avataaars',         label: 'Bitmoji',    style: avataaars },
  { id: 'bigSmile',          label: 'Big Smile',  style: bigSmile },
  { id: 'lorelei',           label: 'Lorelei',    style: lorelei },
  { id: 'micah',             label: 'Micah',      style: micah },
  { id: 'openPeeps',         label: 'Open Peeps', style: openPeeps },
  { id: 'personas',          label: 'Persona',    style: personas },
  { id: 'funEmoji',          label: 'Fun Emoji',  style: funEmoji },
  { id: 'bottts',            label: 'Robot',      style: bottts },
  { id: 'pixelArt',          label: 'Pixel Art',  style: pixelArt },
] as const

export type AvatarStyleId = typeof AVATAR_STYLES[number]['id']
export const DEFAULT_AVATAR_STYLE: AvatarStyleId = 'adventurerNeutral'

export function getAvatarStyle(id: string) {
  return AVATAR_STYLES.find(s => s.id === id) ?? AVATAR_STYLES[0]
}
