import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ── Token sets ────────────────────────────────────────────────────────────────
export interface ThemeTokens {
  bg: string
  surface: string
  surfaceHigh: string
  border: string
  borderSub: string
  text: string
  textSub: string
  textMuted: string
  input: string
  inputBorder: string
  tabBar: string
  tabBarBorder: string
  skeleton: string
  shadow: string
  isDark: boolean
}

export const DARK: ThemeTokens = {
  bg:           '#0B0B10',
  surface:      '#13131A',
  surfaceHigh:  '#1C1C26',
  border:       '#242438',
  borderSub:    '#1A1A26',
  text:         '#F2F2FA',
  textSub:      '#8C8CA8',
  textMuted:    '#3C3C58',
  input:        '#0E0E16',
  inputBorder:  '#28283E',
  tabBar:       '#0B0B10',
  tabBarBorder: '#1A1A28',
  skeleton:     '#1C1C28',
  shadow:       'rgba(0,0,0,0.6)',
  isDark:       true,
}

export const LIGHT: ThemeTokens = {
  bg:           '#F4F5F8',
  surface:      '#FFFFFF',
  surfaceHigh:  '#FFFFFF',
  border:       '#E8E8F0',
  borderSub:    '#F0F0F8',
  text:         '#0D0D18',
  textSub:      '#585872',
  textMuted:    '#A0A0BC',
  input:        '#FFFFFF',
  inputBorder:  '#D8D8EC',
  tabBar:       '#FFFFFF',
  tabBarBorder: '#E8E8F0',
  skeleton:     '#E8E8F4',
  shadow:       'rgba(0,0,0,0.08)',
  isDark:       false,
}

export type ThemeMode = 'dark' | 'light' | 'system'
const STORAGE_KEY = 'myfiti_theme_mode'

interface ThemeCtx {
  theme: ThemeTokens
  themeMode: ThemeMode
  isDark: boolean
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeCtx>({
  theme: DARK,
  themeMode: 'dark',
  isDark: true,
  setThemeMode: () => {},
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setThemeModeState(val)
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  function setThemeMode(mode: ThemeMode) {
    setThemeModeState(mode)
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {})
  }

  function toggleTheme() {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark')
  }

  const resolvedDark = themeMode === 'system'
    ? systemScheme === 'dark'
    : themeMode === 'dark'

  const theme = resolvedDark ? DARK : LIGHT

  if (!loaded) return null

  return (
    <ThemeContext.Provider value={{ theme, themeMode, isDark: resolvedDark, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
