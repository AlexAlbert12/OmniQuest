import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { View, ActivityIndicator } from 'react-native'

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const inAuthGroup = (segments[0] as string) === '(auth)'      
      
      if (!session) {
        if (!inAuthGroup) {
          router.replace('/(auth)/login' as any)
        }
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role_id')
          .eq('id', session.user.id)
          .single()

        if (profile?.role_id === 'teacher') {
          router.replace('/(teacher)/dashboard' as any)
        } else {
          router.replace('/(student)/home' as any)
        }
      }
      setIsInitialized(true)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [segments])

  if (!isInitialized) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(teacher)" />
      <Stack.Screen name="(student)" />
    </Stack>
  )
}