import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { memberApi } from './api'

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

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

  // Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('gymflow-default', {
      name: 'GymFlow Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C47FF',
    })
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync()
    await memberApi.registerPushToken(tenantSlug, token.data)
    console.log('[push] Token registered:', token.data)
  } catch (err) {
    console.warn('[push] Failed to register token:', err)
  }
}

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
