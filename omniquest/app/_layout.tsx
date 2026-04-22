import '../global.css'
import { Pacifico_400Regular, useFonts } from '@expo-google-fonts/pacifico'
import { useEffect, useState } from 'react'
import { Stack, usePathname, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { View, ActivityIndicator } from 'react-native'

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [fontsLoaded, fontError] = useFonts({
    Pacifico_400Regular,
  })
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let isMounted = true

    const redirectToLogin = () => {
      if (pathname !== '/login') {
        router.replace('/login' as any)
      }
    }

    const clearInvalidSession = async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch (error) {
        console.error('[auth] failed to clear invalid session', error)
      }
    }

    const syncNavigation = async (session: any) => {
      const isAuthRoute = pathname === '/login' || pathname === '/register'

      if (!session) {
        if (!isAuthRoute) {
          redirectToLogin()
        }
        if (isMounted) {
          setIsInitialized(true)
        }
        return
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        console.warn('[auth] invalid persisted session detected', userError)
        await clearInvalidSession()
        if (isMounted) {
          redirectToLogin()
          setIsInitialized(true)
        }
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      if (profileError) {
        console.error('[auth] failed to fetch profile', profileError)
        await clearInvalidSession()
        redirectToLogin()
        setIsInitialized(true)
        return
      }

      if (!profile) {
        console.warn('[auth] profile not found for user', session.user.id)
        await clearInvalidSession()
        redirectToLogin()
        setIsInitialized(true)
        return
      }

      if (profile?.role_id === 'teacher') {
        if (pathname !== '/dashboard') {
          router.replace('/dashboard' as any)
        }
      } else if (pathname !== '/home') {
        router.replace('/home' as any)
      }

      setIsInitialized(true)
    }

    supabase.auth.getSession().then(({ data }) => {
      void syncNavigation(data.session)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncNavigation(session)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [pathname, router])

  if (!isInitialized || (!fontsLoaded && !fontError)) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
