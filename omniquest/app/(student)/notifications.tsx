import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, useWindowDimensions, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../components/ui/AppButton'
import AppTabs from '../../components/ui/AppTabs'
import NotificationFeed from '../../components/notifications/NotificationFeed'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import StudentSidebar from '../../components/student/StudentSidebar'
import { useNotifications, type AppNotification, type NotificationType } from '../../hooks/useNotifications'
import { useAppTheme } from '../../lib/appTheme'
import { formatCount } from '../../lib/formatCount'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { supabase } from '../../lib/supabase'
import { readThroughCache } from '../../lib/offlineCache'
import { useAppModal } from '../../components/AppModalProvider'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

type NotificationFilter = 'all' | 'unread' | NotificationType
type Profile = { alias: string; avatar: string | null; points: number | null }
type EmptyStateCopy = { title: string; message: string }

const filterOptions: { key: NotificationFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todas', icon: 'list-outline' },
  { key: 'unread', label: 'Sin leer', icon: 'mail-unread-outline' },
  { key: 'new_class', label: 'Cursos', icon: 'book-outline' },
  { key: 'student_activity', label: 'Actividad', icon: 'checkmark-circle-outline' },
  { key: 'achievement', label: 'Logros', icon: 'trophy-outline' },
  { key: 'announcement', label: 'Avisos', icon: 'alert-circle-outline' },
]

const categoryLabels: Record<NotificationType, string> = {
  enrollment: 'Inscripciones',
  student_activity: 'Actividad',
  achievement: 'Logros',
  new_class: 'Cursos',
  announcement: 'Avisos',
}

export default function StudentNotificationsScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const {
    notifications,
    unreadCount,
    total,
    loading,
    loadingMore,
    hasMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    loadMore,
    error,
    clearError,
  } = useNotifications('student')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<NotificationFilter>('all')

  const isDesktop = width >= 1080
  const points = profile?.points ?? 0
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === 'all') return notifications
    if (selectedFilter === 'unread') return notifications.filter((notification) => !notification.isRead)
    return notifications.filter((notification) => notification.type === selectedFilter)
  }, [notifications, selectedFilter])

  const tabs = useMemo(() => filterOptions.map((option) => {
    const count = option.key === 'all'
      ? total
      : option.key === 'unread'
        ? unreadCount
        : notifications.filter((notification) => notification.type === option.key).length
    return { ...option, badge: count > 0 ? count : undefined }
  }), [notifications, total, unreadCount])

  const emptyState = useMemo(() => getEmptyStateCopy({ selectedFilter, total, unreadCount, hasMore }), [hasMore, selectedFilter, total, unreadCount])

  const fetchProfile = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return
      await readThroughCache<Profile>({
        userId,
        resource: 'student:notifications:profile',
        fetcher: async () => {
          const { data, error: profileError } = await supabase.from('profiles').select('alias, avatar, points').eq('id', userId).single()
          if (profileError) throw profileError
          return data as Profile
        },
        onData: (snapshot) => {
          setProfile(snapshot)
          setProfileLoading(false)
        },
      })
    } catch (profileError: any) {
      console.error('Error cargando perfil para notificaciones:', profileError?.message)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    void Promise.all([fetchProfile(), refresh()])
  }, [fetchProfile, refresh]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([refresh(), fetchProfile()])
    } finally {
      setRefreshing(false)
    }
  }, [fetchProfile, refresh])

  useEffect(() => {
    if (!error) return
    showModal({ title: 'Error de notificaciones', message: error, variant: 'error' })
    clearError()
  }, [clearError, error, showModal])

  const handleNotificationAction = async (notification: AppNotification) => {
    if (!notification.isRead) await markAsRead(notification.id)
    if (notification.actionUrl) router.push(notification.actionUrl as any)
  }

  const handleSignOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as any)
  }

  if (loading || profileLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: tokens.background.primary }}>
        <ActivityIndicator size="large" color={tokens.brand.student} />
        <Text className="mt-4" style={{ color: tokens.text.muted }}>Cargando notificaciones…</Text>
      </View>
    )
  }

  const header = (
    <>
      <StudentPageHeader
        icon="notifications"
        isDesktop={isDesktop}
        title="Notificaciones"
        subtitle={unreadCount > 0 ? `Tienes ${formatCount(unreadCount, 'novedad', 'novedades')} por revisar` : 'Todo está al día en tus cursos'}
        showNotifications={false}
        actions={unreadCount > 0 ? (
          <AppButton
            accessibilityLabel="Marcar todas las notificaciones como leídas"
            icon="checkmark-done-outline"
            iconOnly={!isDesktop}
            label={isDesktop ? 'Marcar todas como leídas' : undefined}
            role="student"
            size="sm"
            onPress={() => void markAllAsRead()}
          />
        ) : null}
      />

      <AppTabs<NotificationFilter>
        accessibilityLabel="Filtrar notificaciones"
        compact
        mobileRail={!isDesktop}
        role="student"
        items={tabs}
        value={selectedFilter}
        onChange={setSelectedFilter}
      />

      <View className="mb-3 mt-5">
        <Text className="text-[20px] font-black" style={{ color: tokens.text.primary }}>{getSectionTitle(selectedFilter)}</Text>
        {total > 0 ? (
          <Text className="mt-1 text-[11px]" style={{ color: tokens.text.muted }}>
            Gestiona aquí las novedades de tus cursos, actividad y logros.
          </Text>
        ) : null}
      </View>
    </>
  )

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="notifications"
            alias={profile?.alias || 'Alumno'}
            avatar={profile?.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={handleSignOut}
          />
        ) : null}

        <NotificationFeed
          audience="student"
          notifications={filteredNotifications}
          unreadOnly={selectedFilter === 'unread'}
          compact={!isDesktop}
          swipeEnabled={!isDesktop}
          hasMore={hasMore}
          loadingMore={loadingMore}
          refreshing={refreshing}
          header={header}
          emptyState={emptyState}
          contentContainerStyle={{
            width: '100%',
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 24 : 18,
            paddingBottom: isDesktop ? 32 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          categoryLabel={(notification) => categoryLabels[notification.type]}
          onPress={handleNotificationAction}
          onMarkAsRead={(notification) => markAsRead(notification.id)}
          onDelete={(notification) => deleteNotification(notification.id)}
          onRefresh={onRefresh}
          onLoadMore={loadMore}
        />
      </View>
      {!isDesktop ? <StudentBottomNav active={null} /> : null}
    </View>
  )
}

function getSectionTitle(filter: NotificationFilter) {
  if (filter === 'all') return 'Novedades'
  if (filter === 'unread') return 'Sin leer'
  return categoryLabels[filter]
}

function getEmptyStateCopy({ selectedFilter, total, unreadCount, hasMore }: { selectedFilter: NotificationFilter; total: number; unreadCount: number; hasMore: boolean }): EmptyStateCopy {
  if (selectedFilter === 'all') {
    if (total === 0) return { title: 'No hay notificaciones', message: 'Cuando haya novedades de tus cursos, logros o actividad aparecerán aquí.' }
    return hasMore
      ? { title: 'Hay más notificaciones por cargar', message: 'Carga el siguiente bloque para completar el listado.' }
      : { title: 'Actualizando tus novedades', message: 'La información guardada se está sincronizando con el listado.' }
  }

  if (selectedFilter === 'unread') {
    if (unreadCount === 0) return { title: 'Todo está leído', message: 'Has revisado todas tus novedades. Las próximas aparecerán aquí.' }
    return hasMore
      ? { title: 'Quedan novedades sin leer', message: 'Carga más notificaciones para continuar revisándolas.' }
      : { title: 'Actualizando las novedades sin leer', message: 'El contador y el listado se están sincronizando.' }
  }

  if (hasMore) return { title: `Puede haber más de ${categoryLabels[selectedFilter].toLowerCase()}`, message: 'Carga el siguiente bloque para completar este filtro.' }
  return { title: `No hay notificaciones de ${categoryLabels[selectedFilter].toLowerCase()}`, message: 'Cuando aparezca una novedad de esta categoría la verás aquí.' }
}
