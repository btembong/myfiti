import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TenantBranding } from '@gymflow/types'

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
