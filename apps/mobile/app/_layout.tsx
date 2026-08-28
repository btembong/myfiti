import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import { TenantProvider } from '../src/context/TenantContext'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { useTenant } from '../src/context/TenantContext'
import { ThemeProvider, useTheme } from '../src/context/ThemeContext'
import { AvatarStyleProvider } from '../src/context/AvatarStyleContext'
import { queryClient } from '../src/lib/queryClient'
import { registerPushToken, addNotificationListeners } from '../src/lib/notifications'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { setUnauthorizedHandler } from '../src/lib/api'

SplashScreen.preventAutoHideAsync()

function AuthGate({ children, fontsLoaded }: { children: React.ReactNode; fontsLoaded: boolean }) {
  const { accessToken, isLoading, signOut } = useAuth()
  const { branding } = useTenant()
  const { theme, isDark } = useTheme()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut().then(() => router.replace('/(auth)/login')).catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (accessToken && branding?.slug) {
      registerPushToken(branding.slug)
    }
  }, [accessToken, branding?.slug])

  useEffect(() => {
    return addNotificationListeners(
      (notif: { request: { content: { title: string | null; body: string | null } } }) => {
        Toast.show({
          type: 'info',
          text1: notif.request.content.title ?? 'Notification',
          text2: notif.request.content.body ?? undefined,
        })
      },
    )
  }, [])

  useEffect(() => {
    if (isLoading || !fontsLoaded) return
    SplashScreen.hideAsync()
    const inAuth = segments[0] === '(auth)'
    if (!accessToken && !inAuth) {
      router.replace('/(auth)/login')
    } else if (accessToken && inAuth) {
      router.replace('/(tabs)/home')
    }
  }, [accessToken, isLoading, fontsLoaded, segments])

  if (isLoading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={branding?.primary_color ?? '#5B8EF4'} size="large" />
      </View>
    )
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0B0B10' }}>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <TenantProvider>
              <AuthProvider>
                <AvatarStyleProvider>
                  <AuthGate fontsLoaded={fontsLoaded ?? false}>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="gym-info" />
                      <Stack.Screen name="plans" />
                      <Stack.Screen name="help" />
                      <Stack.Screen name="delete-account" />
                      <Stack.Screen name="scan-checkin" />
                      <Stack.Screen name="biometrics" options={{ presentation: 'modal' }} />
                    </Stack>
                  </AuthGate>
                  <Toast />
                </AvatarStyleProvider>
              </AuthProvider>
            </TenantProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
