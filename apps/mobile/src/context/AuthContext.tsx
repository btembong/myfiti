import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'

// Web fallback — localStorage instead of SecureStore
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key)
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return }
    await SecureStore.setItemAsync(key, value)
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return }
    await SecureStore.deleteItemAsync(key)
  },
}

const BIOMETRIC_ENABLED_KEY = 'gymflow_biometric_enabled'

interface AuthState {
  accessToken: string | null
  memberId: string | null
}

interface AuthContextValue extends AuthState {
  signIn: (accessToken: string, memberId: string, refreshToken: string) => Promise<void>
  signOut: () => Promise<void>
  isLoading: boolean
  biometricEnabled: boolean
  enableBiometrics: () => Promise<boolean>
  disableBiometrics: () => Promise<void>
  biometricLogin: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth]                     = useState<AuthState>({ accessToken: null, memberId: null })
  const [isLoading, setIsLoading]           = useState(true)
  const [biometricEnabled, setBiometricEnabled] = useState(false)

  useEffect(() => {
    Promise.all([
      storage.get('gymflow_access_token'),
      storage.get('gymflow_member_id'),
      storage.get(BIOMETRIC_ENABLED_KEY),
    ]).then(([token, memberId, bioFlag]) => {
      setAuth({ accessToken: token, memberId })
      setBiometricEnabled(bioFlag === 'true')
      setIsLoading(false)
    })
  }, [])

  async function signIn(accessToken: string, memberId: string, refreshToken: string) {
    await storage.set('gymflow_access_token', accessToken)
    await storage.set('gymflow_refresh_token', refreshToken)
    await storage.set('gymflow_member_id', memberId)
    setAuth({ accessToken, memberId })
  }

  async function signOut() {
    await storage.remove('gymflow_access_token')
    await storage.remove('gymflow_refresh_token')
    await storage.remove('gymflow_member_id')
    setAuth({ accessToken: null, memberId: null })
    // Biometric flag persists across sign-out so it's ready for next login
  }

  /** Prompt biometric to confirm, then store the enabled flag */
  async function enableBiometrics(): Promise<boolean> {
    if (Platform.OS === 'web') return false
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm to enable biometric login',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    })
    if (result.success) {
      await storage.set(BIOMETRIC_ENABLED_KEY, 'true')
      setBiometricEnabled(true)
      return true
    }
    return false
  }

  /** Remove the biometric flag */
  async function disableBiometrics(): Promise<void> {
    await storage.remove(BIOMETRIC_ENABLED_KEY)
    setBiometricEnabled(false)
  }

  /**
   * Authenticate with biometrics then restore the stored token into auth state.
   * Used on the login screen when a stored token exists but the state is cleared.
   */
  async function biometricLogin(): Promise<boolean> {
    if (Platform.OS === 'web') return false
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Log in with biometrics',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    })
    if (!result.success) return false
    const [token, memberId] = await Promise.all([
      storage.get('gymflow_access_token'),
      storage.get('gymflow_member_id'),
    ])
    if (!token || !memberId) return false
    setAuth({ accessToken: token, memberId })
    return true
  }

  return (
    <AuthContext.Provider value={{
      ...auth,
      signIn, signOut, isLoading,
      biometricEnabled, enableBiometrics, disableBiometrics, biometricLogin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
