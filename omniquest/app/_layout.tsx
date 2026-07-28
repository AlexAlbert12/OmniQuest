import '../global.css'
import { Pacifico_400Regular, useFonts } from '@expo-google-fonts/pacifico'
import { useEffect, useState } from 'react'
import { Stack, usePathname, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Text, View } from 'react-native'
import { AppThemeProvider, useAppTheme } from '../lib/appTheme'
import { I18nProvider, useI18n } from '../lib/i18n'
import { usePushNotificationObserver } from '../hooks/usePushNotificationObserver'
import { StatusBar } from 'expo-status-bar'
import { NotificationProvider } from '../hooks/useNotifications'
import { AppModalProvider } from '../components/AppModalProvider'
import OmniGuide from '../components/OmniGuide'
import { AppHapticsProvider } from '../lib/haptics'
import { registerCurrentSession } from '../lib/sessionSecurity'
import { syncAnalyticsConsentFromServer, trackScreenView } from '../lib/analytics'
import { OfflineSyncProvider } from '../hooks/useOfflineSync'
import OfflineSyncBanner from '../components/OfflineSyncBanner'
import { getNetworkAvailability } from '../lib/gameOffline'
import { readOfflineCache, writeOfflineCache } from '../lib/offlineCache'
import { isRetriableOfflineError } from '../lib/offlineMutations'

type CachedAuthProfile = { role_id: string | null; active: boolean | null }

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
    <I18nProvider>
      <AppThemeProvider>
        <AppHapticsProvider>
          <AppModalProvider>
            <OfflineSyncProvider>
              <NotificationProvider>
                <RootNavigator />
              </NotificationProvider>
            </OfflineSyncProvider>
          </AppModalProvider>
        </AppHapticsProvider>
      </AppThemeProvider>
    </I18nProvider>
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
  const { theme, colors, ready } = useAppTheme()
  const { ready: localeReady, t } = useI18n()
  usePushNotificationObserver()

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

      const networkAvailable = await getNetworkAvailability()
      const cachedAuth = await readOfflineCache<CachedAuthProfile>(session.user.id, 'auth:profile')
      let verifiedUser = session.user

      if (networkAvailable) {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData.user) {
          if (cachedAuth && isRetriableOfflineError(userError)) {
            console.warn('[auth] using cached role while auth service is unavailable')
          } else {
            console.warn('[auth] invalid persisted session detected', userError)
            await clearInvalidSession()
            if (isMounted) {
              redirectToLogin()
              setIsInitialized(true)
            }
            return
          }
        } else {
          verifiedUser = userData.user
        }
      }

      let profile: CachedAuthProfile | null = null
      let profileError: unknown = null
      if (networkAvailable) {
        const profileResult = await supabase
          .from('profiles')
          .select('role_id, active')
          .eq('id', session.user.id)
          .maybeSingle()
        profile = profileResult.data
        profileError = profileResult.error
      } else {
        profile = cachedAuth?.data || null
      }

      if (networkAvailable && !profile && verifiedUser.is_anonymous) {
        const { data: guestProfile, error: guestProfileError } = await supabase
          .from('profiles')
          .upsert({
            id: session.user.id,
            alias: verifiedUser.user_metadata?.alias || 'Invitado',
            role_id: 'guest',
            points: 0,
            active: true,
          })
          .select('role_id, active')
          .single()

        profile = guestProfile
        profileError = guestProfileError
      }

      if (!networkAvailable && !profile) {
        profile = {
          role_id: verifiedUser.is_anonymous ? 'guest' : String(verifiedUser.user_metadata?.role_id || 'student'),
          active: true,
        }
      }

      if (!isMounted) {
        return
      }

      if ((profileError && !cachedAuth) || !profile) {
        console.error('[auth] failed to fetch profile or profile not found', profileError)
        await clearInvalidSession()
        redirectToLogin()
        setIsInitialized(true)
        return
      }

      if (profileError && cachedAuth) profile = cachedAuth.data

      if (profile.active === false) {
        console.warn('[auth] inactive user blocked')
        await clearInvalidSession()
        redirectToLogin()
        setIsInitialized(true)
        return
      }


      if (networkAvailable) {
        void writeOfflineCache(session.user.id, 'auth:profile', profile)
      }

      void syncAnalyticsConsentFromServer(session.user.id)

      if (profile.role_id === 'teacher' || profile.role_id === 'admin') {
        try {
          const managedSession = await registerCurrentSession()
          if (managedSession.revoked) {
            await clearInvalidSession()
            redirectToLogin()
            setIsInitialized(true)
            return
          }
        } catch (sessionError) {
          console.warn('[security] could not register managed session', sessionError)
        }
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

  useEffect(() => {
    if (!isInitialized) return
    const normalizedPath = normalizeAuthPath(pathname)
    const routeGroup = getRouteGroup(rootSegment, normalizedPath)
    if (routeGroup === 'auth' || normalizedPath === '/') return
    void trackScreenView(normalizedPath, routeGroup)
  }, [isInitialized, pathname, rootSegment])

  if (!isInitialized || (!fontsLoaded && !fontError) || !ready || !localeReady) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: colors.background }}
      >
        <OmniGuide state="blink" size={118} />
        <Text className="mt-4 text-center font-bold" style={{ color: colors.textSecondary }}>
          {t('root.preparing')}
        </Text>
      </View>
    )
  }

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
      />
      <OfflineSyncBanner />
    </>
  )
}
