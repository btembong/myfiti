import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface TenantFeatures {
  show_announcements: boolean
  allow_self_renewal: boolean
  referral_system: boolean
  guest_passes: boolean
  show_leaderboard: boolean
  show_body_metrics: boolean
  show_trainer_ratings: boolean
  wod_leaderboard: boolean
}

export interface TenantBranding {
  id: string
  slug: string
  name: string
  logo_url: string
  primary_color: string
  secondary_color: string
  splash_bg_color: string
  font: 'default' | 'inter' | 'roboto'
  timezone: string
  currency: string
  features: TenantFeatures
}

interface TenantContextValue {
  branding: TenantBranding | null
  setTenant: (branding: TenantBranding) => void
  clearTenant: () => void
}

const TenantContext = createContext<TenantContextValue | null>(null)

const STORAGE_KEY = 'gymflow:tenant'

export function TenantProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<TenantBranding | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setBranding(JSON.parse(raw) as TenantBranding)
    })
  }, [])

  function setTenant(b: TenantBranding) {
    setBranding(b)
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(b))
  }

  function clearTenant() {
    setBranding(null)
    AsyncStorage.removeItem(STORAGE_KEY)
  }

  return (
    <TenantContext.Provider value={{ branding, setTenant, clearTenant }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider')
  return ctx
}
