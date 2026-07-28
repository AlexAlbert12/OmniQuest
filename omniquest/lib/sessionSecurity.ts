import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const DEVICE_ID_KEY = 'omniquest.device-id.v1'

export async function getOrCreateDeviceId() {
  let value = await AsyncStorage.getItem(DEVICE_ID_KEY)
  if (!value) {
    value = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
    await AsyncStorage.setItem(DEVICE_ID_KEY, value)
  }
  return value
}

export async function registerCurrentSession() {
  const deviceId = await getOrCreateDeviceId()
  const deviceName = Device.deviceName || Device.modelName || (Platform.OS === 'web' ? 'Navegador web' : 'Dispositivo')
  const userAgent = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : null
  const { data, error } = await supabase.rpc('register_user_session', {
    p_device_id: deviceId,
    p_device_name: deviceName,
    p_platform: Platform.OS,
    p_user_agent: userAgent ?? undefined,
  })
  if (error) throw error
  const sessionData = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  return { deviceId, ...sessionData } as { deviceId: string; session_id?: string; is_new_device?: boolean; revoked?: boolean }
}
