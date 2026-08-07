import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { Linking, Platform } from 'react-native'
import { applyPasswordRecoveryLink } from '../lib/nativeAuthLinks'

export function usePasswordRecoveryLinkObserver() {
  const router = useRouter()

  useEffect(() => {
    if (Platform.OS === 'web') return
    let mounted = true

    const handleUrl = async (url: string | null) => {
      if (!url) return
      try {
        const handled = await applyPasswordRecoveryLink(url)
        if (handled && mounted) router.replace('/(auth)/update-password' as never)
      } catch (error) {
        console.warn('[password-recovery] invalid native recovery link', error)
      }
    }

    void Linking.getInitialURL().then(handleUrl)
    const subscription = Linking.addEventListener('url', ({ url }) => void handleUrl(url))

    return () => {
      mounted = false
      subscription.remove()
    }
  }, [router])
}
