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
      if (pathname !== '/login' && pathname !== '/(auth)/login') {
        router.replace('/(auth)/login' as any)
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
      const isAuthRoute = 
        pathname === '/' || 
        pathname === '/login' || 
        pathname === '/register' || 
        pathname === '/forgot-password' ||
        pathname === '/update-password' ||
        pathname === '/(auth)/login' || 
        pathname === '/(auth)/register' ||
        pathname === '/(auth)/forgot-password' ||
        pathname === '/(auth)/update-password'
      const isPasswordRecoveryRoute =
        pathname === '/update-password' ||
        pathname === '/(auth)/update-password'

      if (!session) {
        if (!isAuthRoute) {
          redirectToLogin()
        }
        if (isMounted) {
          setIsInitialized(true)
        }
        return
      }

      if (isPasswordRecoveryRoute) {
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

      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!profile && userData.user.is_anonymous) {
        const { data: guestProfile, error: guestProfileError } = await supabase
          .from('profiles')
          .upsert({
            id: session.user.id,
            alias: session.user.user_metadata?.alias || 'Invitado',
            role_id: 'guest',
            points: 0,
          })
          .select('role_id')
          .single()

        profile = guestProfile
        profileError = guestProfileError
      }

      if (!isMounted) {
        return
      }

      if (profileError || !profile) {
        console.error('[auth] failed to fetch profile or profile not found', profileError)
        await clearInvalidSession()
        redirectToLogin()
        setIsInitialized(true)
        return
      }

      if (isAuthRoute) {
        if (profile.role_id === 'teacher') {
          router.replace('/(teacher)/dashboard' as any)
        } else {
          router.replace('/(student)/home' as any)
        }
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
      <View className="flex-1 justify-center items-center bg-[#0F2854]">
        <ActivityIndicator size="large" color="#BDE8F5" />
      </View>
    )
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
