import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { memberApi } from './api'

// ─── Category preference keys (must match notification-settings.tsx) ──────────

const KEY_PUSH = 'push_notifications_enabled'
const KEY_CAT  = (cat: string) => `notif_cat_${cat}`

// Maps notification data.type values → category preference key
const TYPE_TO_CAT: Record<string, string> = {
  motivation:          'motivation',
  wallet_auto_renewal: 'wallet',
  wallet_topup:        'wallet',
  wallet_cashout:      'wallet',
  wallet_debit:        'wallet',
  expiry_reminder:     'membership',
  grace_period:        'membership',
  suspension_notice:   'membership',
  renewal:             'membership',
  class_reminder:      'classes',
  booking_confirmed:   'classes',
  announcement:        'announcements',
  in_app:              'announcements',
}

async function isCategoryEnabled(type?: string): Promise<boolean> {
  // Check master push toggle first
  const masterVal = await AsyncStorage.getItem(KEY_PUSH)
  if (masterVal === 'false') return false

  // Resolve category from type, default to 'announcements'
  const cat = (type && TYPE_TO_CAT[type]) ?? 'announcements'

  const catVal = await AsyncStorage.getItem(KEY_CAT(cat))
  // Default true when not yet set
  return catVal !== 'false'
}

// ─── Notification handler — runs before a notification is shown ───────────────
// Checks user's category preferences and suppresses silently if disabled.

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type as string | undefined
    const enabled = await isCategoryEnabled(type)
    return {
      shouldShowBanner: enabled,
      shouldShowList:   enabled,
      shouldPlaySound:  enabled,
      shouldSetBadge:   false,
    }
  },
})

// ─── Token registration ────────────────────────────────────────────────────────

export async function deregisterPushToken(tenantSlug: string): Promise<void> {
  try {
    await memberApi.deregisterPushToken(tenantSlug)
    console.log('[push] Token deregistered')
  } catch (err) {
    console.warn('[push] Failed to deregister token:', err)
  }
}

export async function registerPushToken(tenantSlug: string): Promise<void> {
  if (!Device.isDevice) {
    console.log('[push] Skipping — not a physical device')
    return
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[push] Permission denied')
    return
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('gymflow-default', {
      name: 'GymFlow Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C47FF',
    })
  }

  try {
    // projectId is required in standalone EAS builds — read from app.json extra
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    await memberApi.registerPushToken(tenantSlug, token.data)
    console.log('[push] Token registered:', token.data)
  } catch (err) {
    console.warn('[push] Failed to register token:', err)
  }
}

// ─── Notification listeners ────────────────────────────────────────────────────

export function addNotificationListeners(
  onReceive?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void,
) {
  const receiveListener = Notifications.addNotificationReceivedListener(notif => {
    onReceive?.(notif)
  })

  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    onResponse?.(response)
  })

  return () => {
    receiveListener.remove()
    responseListener.remove()
  }
}
