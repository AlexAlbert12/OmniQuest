import '../global.css'
import { Pacifico_400Regular, useFonts } from '@expo-google-fonts/pacifico'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Stack, usePathname, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Text, View } from 'react-native'
import { AppThemeProvider, useAppTheme } from '../lib/appTheme'
import { I18nProvider, useI18n } from '../lib/i18n'
import { usePushNotificationObserver } from '../hooks/usePushNotificationObserver'
import { usePasswordRecoveryLinkObserver } from '../hooks/usePasswordRecoveryLinkObserver'
import { StatusBar } from 'expo-status-bar'
import { NotificationProvider } from '../hooks/useNotifications'
import { AppModalProvider } from '../components/AppModalProvider'
import { AppToastProvider } from '../components/ui/AppToast'
import OmniGuide from '../components/OmniGuide'
import { AppHapticsProvider } from '../lib/haptics'
import { registerCurrentSession } from '../lib/sessionSecurity'
import { syncAnalyticsConsentFromServer, trackScreenView } from '../lib/analytics'
import { OfflineSyncProvider } from '../hooks/useOfflineSync'
import OfflineSyncBanner from '../components/OfflineSyncBanner'
import { getNetworkAvailability } from '../lib/gameOffline'
import { readOfflineCache, writeOfflineCache } from '../lib/offlineCache'
import { isRetriableOfflineError } from '../lib/offlineMutations'
import { markPasswordRecoverySession } from '../lib/recoverySession'
import { getOnboardingRouteForRole, profileNeedsOnboarding } from '../lib/onboarding'

type CachedAuthProfile = { role_id: string | null; active: boolean | null; onboarding_version?: number | null; onboarding_completed_at?: string | null }

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
          <AppToastProvider>
            <AppModalProvider>
              <OfflineSyncProvider>
              <NotificationProvider>
                <RootNavigator />
              </NotificationProvider>
              </OfflineSyncProvider>
            </AppModalProvider>
          </AppToastProvider>
        </AppHapticsProvider>
      </AppThemeProvider>
    </I18nProvider>
  )
}

function RootNavigator() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [fontsLoaded, fontError] = useFonts({
    Pacifico_400Regular,
    ...Ionicons.font,
  })
  const router = useRouter()
  const pathname = usePathname()
  const segments = useSegments()
  const rootSegment = segments[0]
  const childSegment = segments[1]
  const { theme, colors, ready } = useAppTheme()
  const { ready: localeReady, t } = useI18n()
  usePasswordRecoveryLinkObserver()
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
      const isPublicLegalRoute = normalizedPath === '/privacy' || normalizedPath === '/terms'
      const isAuthRoute =
        normalizedPath === '/' ||
        normalizedPath === '/(auth)/login' ||
        normalizedPath === '/(auth)/register' ||
        normalizedPath === '/(auth)/forgot-password' ||
        normalizedPath === '/(auth)/update-password'
      const isPasswordRecoveryRoute = normalizedPath === '/(auth)/update-password'

      if (!session) {
        if (!isAuthRoute && !isPublicLegalRoute) {
          redirectToLogin()
        }
        if (isMounted) {
          setIsInitialized(true)
        }
        return
      }

      if (isPasswordRecoveryRoute || isPublicLegalRoute) {
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
          .select('role_id, active, onboarding_version, onboarding_completed_at')
          .eq('id', session.user.id)
          .maybeSingle()
        profile = profileResult.data
        profileError = profileResult.error
      } else {
        profile = cachedAuth?.data || null
      }

      if (networkAvailable && !profile && verifiedUser.is_anonymous) {
        const guestAlias = String(verifiedUser.user_metadata?.alias || 'Invitado')
        const { error: guestInitError } = await supabase.rpc('initialize_guest_profile', {
          p_alias: guestAlias,
        })

        if (!guestInitError) {
          const guestProfileResult = await supabase
            .from('profiles')
            .select('role_id, active, onboarding_version, onboarding_completed_at')
            .eq('id', session.user.id)
            .maybeSingle()
          profile = guestProfileResult.data
          profileError = guestProfileResult.error
        } else {
          profileError = guestInitError
        }
      }

      if (!networkAvailable && !profile) {

        profile = {
          role_id: verifiedUser.is_anonymous ? 'guest' : 'student',
          active: true,
          onboarding_version: undefined,
          onboarding_completed_at: undefined,
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

      if (profile.role_id === 'student' || profile.role_id === 'teacher' || profile.role_id === 'admin') {
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

      const isOwnOnboardingRoute = (profile.role_id === 'student' && rootSegment === '(student)' && childSegment === 'onboarding') || (profile.role_id === 'teacher' && rootSegment === '(teacher)' && childSegment === 'onboarding')
      if (networkAvailable && !profileError && profileNeedsOnboarding(profile) && !isOwnOnboardingRoute) {
        router.replace(getOnboardingRouteForRole(profile.role_id as 'student' | 'teacher') as any)
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

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        void markPasswordRecoverySession()
      }
      void syncNavigation(session)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [childSegment, pathname, rootSegment, router])

  useEffect(() => {
    if (!isInitialized) return
    const normalizedPath = normalizeAuthPath(pathname)
    const routeGroup = getRouteGroup(rootSegment, normalizedPath)
    if (routeGroup === 'auth' || normalizedPath === '/' || normalizedPath === '/privacy' || normalizedPath === '/terms') return
    void trackScreenView(normalizedPath, routeGroup)
  }, [isInitialized, pathname, rootSegment])

  if (!isInitialized || (!fontsLoaded && !fontError) || !ready || !localeReady) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('root.preparing')}
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
