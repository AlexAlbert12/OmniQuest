import '../global.css'
import { Pacifico_400Regular, useFonts } from '@expo-google-fonts/pacifico'
import { useEffect, useState } from 'react'
import { Stack, usePathname, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { View, ActivityIndicator } from 'react-native'
import { AppThemeProvider, useAppTheme } from '../lib/appTheme'
import { NotificationProvider } from '../hooks/useNotifications'

const AUTH_ROUTE_ALIASES: Record<string, string> = {
  '/login': '/(auth)/login',
  '/register': '/(auth)/register',
  '/forgot-password': '/(auth)/forgot-password',
  '/update-password': '/(auth)/update-password',
}

const TEACHER_HOME = '/(teacher)/homeTeacher'
const STUDENT_HOME = '/(student)/homeStudent'
const ADMIN_HOME = '/(admin)/homeAdmin'

function normalizeAuthPath(path: string) {
  return AUTH_ROUTE_ALIASES[path] || path
}

function getRouteGroup(rootSegment: string | undefined, pathname: string) {
  if (rootSegment === '(teacher)' || pathname.startsWith('/(teacher)')) return 'teacher'
  if (rootSegment === '(student)' || pathname.startsWith('/(student)')) return 'student'
  if (rootSegment === '(admin)' || pathname.startsWith('/(admin)')) return 'admin'
  if (rootSegment === '(auth)' || pathname.startsWith('/(auth)')) return 'auth'
  return null
}

function getHomeRouteForRole(roleId: string | null | undefined) {
  if (roleId === 'admin') return ADMIN_HOME
  return roleId === 'teacher' ? TEACHER_HOME : STUDENT_HOME
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <NotificationProvider>
        <RootNavigator />
      </NotificationProvider>
    </AppThemeProvider>
  )
}

function RootNavigator() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [fontsLoaded, fontError] = useFonts({
    Pacifico_400Regular,
  })
  const router = useRouter()
  const pathname = usePathname()
  const segments = useSegments()
  const rootSegment = segments[0]
  const { theme, ready } = useAppTheme()

  useEffect(() => {
    let isMounted = true
    const normalizedPath = normalizeAuthPath(pathname)
    const routeGroup = getRouteGroup(rootSegment, normalizedPath)

    const redirectToLogin = () => {
      if (normalizedPath !== '/(auth)/login') {
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
        normalizedPath === '/' ||
        normalizedPath === '/(auth)/login' || 
        normalizedPath === '/(auth)/register' ||
        normalizedPath === '/(auth)/forgot-password' ||
        normalizedPath === '/(auth)/update-password'
      const isPasswordRecoveryRoute =
        normalizedPath === '/(auth)/update-password'

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
        router.replace(getHomeRouteForRole(profile.role_id) as any)
        setIsInitialized(true)
        return
      }

      const isTeacherRouteBlocked = routeGroup === 'teacher' && profile.role_id !== 'teacher'
      const isStudentRouteBlocked = routeGroup === 'student' && profile.role_id !== 'student' && profile.role_id !== 'guest'
      const isAdminRouteBlocked = routeGroup === 'admin' && profile.role_id !== 'admin'

      if (isTeacherRouteBlocked || isStudentRouteBlocked || isAdminRouteBlocked) {
        router.replace(getHomeRouteForRole(profile.role_id) as any)
        setIsInitialized(true)
        return
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
  }, [pathname, rootSegment, router])

  if (!isInitialized || (!fontsLoaded && !fontError) || !ready) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: theme === 'dark' ? '#0F2854' : '#F4F7FF' }}
      >
        <ActivityIndicator size="large" color={theme === 'dark' ? '#BDE8F5' : '#5364F5'} />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme === 'dark' ? '#061126' : '#F4F7FF' },
      }}
    />
  )
}
