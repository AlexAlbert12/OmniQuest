import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const PUSH_TOKEN_STORAGE_KEY = 'omniquest:expo-push-token'

export type PushRegistrationResult = {
  status: 'registered' | 'denied' | 'unsupported' | 'error'
  token?: string
  message?: string
}

let notificationHandlerConfigured = false

async function notificationsModule() {
  return import('expo-notifications')
}

export async function configurePushNotificationHandler() {
  if (Platform.OS === 'web' || notificationHandlerConfigured) return
  const Notifications = await notificationsModule()
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
  notificationHandlerConfigured = true
}

function getProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
}

export async function registerCurrentDeviceForPush(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', message: 'Las notificaciones push nativas no están disponibles en web.' }
  }

  if (!Device.isDevice) {
    return { status: 'unsupported', message: 'Usa un dispositivo físico o una compilación compatible para registrar push.' }
  }

  try {
    await configurePushNotificationHandler()
    const Notifications = await notificationsModule()

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'OmniQuest',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C5CFF',
        sound: 'default',
      })
    }

    const currentPermission = await Notifications.getPermissionsAsync()
    let permissionStatus = currentPermission.status
    if (permissionStatus !== 'granted') {
      const requestedPermission = await Notifications.requestPermissionsAsync()
      permissionStatus = requestedPermission.status
    }

    if (permissionStatus !== 'granted') {
      return { status: 'denied', message: 'No se concedió permiso para mostrar notificaciones.' }
    }

    const projectId = getProjectId()
    if (!projectId) {
      return { status: 'error', message: 'No se encontró extra.eas.projectId en la configuración de Expo.' }
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    const appVersion = Constants.expoConfig?.version || null
    const deviceName = Device.deviceName || Device.modelName || null

    const { error } = await supabase.rpc('register_push_token', {
      p_expo_push_token: token,
      p_platform: Platform.OS,
      p_device_name: deviceName ?? undefined,
      p_app_version: appVersion ?? undefined,
    })

    if (error) throw error
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token)
    return { status: 'registered', token }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'No se pudo registrar el dispositivo para push.',
    }
  }
}

export async function deactivateCurrentDevicePushToken() {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY)
  if (!token) return

  const { error } = await supabase.rpc('deactivate_push_token', {
    p_expo_push_token: token,
  })
  if (error) throw error
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY)
}

export async function syncPushRegistrationFromPreferences() {
  if (Platform.OS === 'web') return
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) return

  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('push_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data?.push_enabled) return
  await registerCurrentDeviceForPush()
}

export async function subscribeToPushResponses(onUrl: (url: string) => void) {
  if (Platform.OS === 'web') return () => undefined
  const Notifications = await notificationsModule()

  const redirect = (notification: import('expo-notifications').Notification) => {
    const url = notification.request.content.data?.url
    if (typeof url === 'string' && url.startsWith('/')) onUrl(url)
  }

  const lastResponse = Notifications.getLastNotificationResponse()
  if (lastResponse?.notification) redirect(lastResponse.notification)

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    redirect(response.notification)
  })

  return () => subscription.remove()
}
