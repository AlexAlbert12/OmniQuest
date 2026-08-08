import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import {
  configurePushNotificationHandler,
  subscribeToPushResponses,
  syncPushRegistrationFromPreferences,
} from '../lib/pushNotifications'

export function usePushNotificationObserver() {
  const router = useRouter()

  useEffect(() => {
    let unsubscribeResponse: (() => void) | undefined
    let mounted = true

    const start = async () => {
      await configurePushNotificationHandler().catch(() => undefined)
      const unsubscribe = await subscribeToPushResponses((url) => router.push(url as never))
      if (mounted) unsubscribeResponse = unsubscribe
      const registration = await syncPushRegistrationFromPreferences().catch((error) => ({
        status: 'error' as const,
        message: error instanceof Error ? error.message : String(error),
      }))
      if (registration?.status === 'error') console.warn('[push] could not synchronize device token', registration.message)
    }

    void start()

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void syncPushRegistrationFromPreferences().then((registration) => {
          if (registration?.status === 'error') console.warn('[push] could not synchronize device token', registration.message)
        }).catch((error) => console.warn('[push] could not synchronize device token', error))
      }
    })

    return () => {
      mounted = false
      unsubscribeResponse?.()
      listener.subscription.unsubscribe()
    }
  }, [router])
}
