import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getStoredAvatarStyle, storeAvatarStyle } from '../lib/avatarPrefs'
import { DEFAULT_AVATAR_STYLE, type AvatarStyleId } from '../lib/avatarStyles'

interface AvatarStyleContextValue {
  avatarStyle: AvatarStyleId
  setAvatarStyle: (s: AvatarStyleId) => void
}

const AvatarStyleContext = createContext<AvatarStyleContextValue>({
  avatarStyle: DEFAULT_AVATAR_STYLE,
  setAvatarStyle: () => {},
})

export function AvatarStyleProvider({ children }: { children: ReactNode }) {
  const [avatarStyle, setStyle] = useState<AvatarStyleId>(DEFAULT_AVATAR_STYLE)

  useEffect(() => {
    getStoredAvatarStyle().then(setStyle)
  }, [])

  function setAvatarStyle(s: AvatarStyleId) {
    setStyle(s)
    storeAvatarStyle(s)
  }

  return (
    <AvatarStyleContext.Provider value={{ avatarStyle, setAvatarStyle }}>
      {children}
    </AvatarStyleContext.Provider>
  )
}

export const useAvatarStyle = () => useContext(AvatarStyleContext)
