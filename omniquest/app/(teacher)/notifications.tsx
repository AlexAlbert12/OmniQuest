import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../components/ui/AppButton'
import AppTabs from '../../components/ui/AppTabs'
import NotificationEmptyState from '../../components/notifications/NotificationEmptyState'
import NotificationListItem from '../../components/notifications/NotificationListItem'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import { useNotifications, type AppNotification, type NotificationType } from '../../hooks/useNotifications'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { supabase } from '../../lib/supabase'

type NotificationFilter = 'all' | 'unread' | NotificationType

const filterOptions: { key: NotificationFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todas', icon: 'list-outline' },
  { key: 'unread', label: 'Sin leer', icon: 'mail-unread-outline' },
  { key: 'enrollment', label: 'Alumnos', icon: 'people-outline' },
  { key: 'student_activity', label: 'Actividad', icon: 'pulse-outline' },
  { key: 'new_class', label: 'Cursos', icon: 'book-outline' },
  { key: 'announcement', label: 'Sistema', icon: 'megaphone-outline' },
]

const categoryLabels: Record<NotificationType, string> = {
  enrollment: 'Alumnos',
  student_activity: 'Actividad',
  achievement: 'Logros',
  new_class: 'Cursos',
  announcement: 'Sistema',
}

export default function TeacherNotificationsScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const { tokens } = useAppTheme()
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    error,
    clearError,
  } = useNotifications('teacher')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<NotificationFilter>('all')
  const isDesktop = width >= 1080

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === 'all') return notifications
    if (selectedFilter === 'unread') return notifications.filter((notification) => !notification.isRead)
    return notifications.filter((notification) => notification.type === selectedFilter)
  }, [notifications, selectedFilter])

  const tabs = useMemo(() => filterOptions.map((option) => ({
    ...option,
    badge: option.key === 'all'
      ? notifications.length
      : option.key === 'unread'
        ? unreadCount
        : notifications.filter((notification) => notification.type === option.key).length,
  })), [notifications, unreadCount])

  const onRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { void refresh() }, [refresh]))

  useEffect(() => {
    if (!error) return
    if (Platform.OS === 'web') window.alert(`Error de notificaciones\n${error}`)
    else Alert.alert('Error de notificaciones', error)
    clearError()
  }, [clearError, error])

  const handleNotificationAction = async (notification: AppNotification) => {
    if (!notification.isRead) await markAsRead(notification.id)
    if (notification.actionUrl) router.push(notification.actionUrl as any)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: tokens.background.primary }}>
        <ActivityIndicator size="large" color={tokens.brand.teacher} />
        <Text className="mt-4" style={{ color: tokens.text.muted }}>Cargando notificaciones…</Text>
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <View className="flex-1 flex-row">
        {isDesktop ? <TeacherSidebar activeSection="notifications" subjectsCount={0} onSignOut={handleSignOut} /> : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 28 : 18,
            paddingBottom: isDesktop ? 32 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.teacher} />}
          showsVerticalScrollIndicator={false}
        >
          <TeacherPageHeader
            icon="notifications"
            isDesktop={isDesktop}
            title="Centro de notificaciones"
            mobileTitle="Notificaciones"
            subtitle={unreadCount > 0 ? `Tienes ${unreadCount} novedad${unreadCount === 1 ? '' : 'es'} por revisar` : 'Todas las notificaciones están al día'}
            showNotifications={false}
            actions={(
              <View className="flex-row gap-2">
                <AppButton
                  accessibilityLabel="Actualizar notificaciones"
                  icon="refresh-outline"
                  iconOnly={!isDesktop}
                  label={isDesktop ? 'Actualizar' : undefined}
                  loading={refreshing}
                  size="sm"
                  variant="secondary"
                  onPress={() => void onRefresh()}
                />
                {unreadCount > 0 ? (
                  <AppButton
                    accessibilityLabel="Marcar todas como leídas"
                    icon="checkmark-done-outline"
                    iconOnly={!isDesktop}
                    label={isDesktop ? 'Marcar todas como leídas' : undefined}
                    role="teacher"
                    size="sm"
                    onPress={() => void markAllAsRead()}
                  />
                ) : null}
              </View>
            )}
          />

          <AppTabs<NotificationFilter>
            accessibilityLabel="Filtrar notificaciones"
            compact
            role="teacher"
            items={tabs}
            value={selectedFilter}
            onChange={setSelectedFilter}
          />

          <View className="mb-3 mt-5 flex-row items-center justify-between gap-3">
            <View>
              <Text className="text-[20px] font-black" style={{ color: tokens.text.primary }}>{getSectionTitle(selectedFilter)}</Text>
              {!isDesktop ? <Text className="mt-1 text-[11px]" style={{ color: tokens.text.muted }}>Desliza para marcar como leída o eliminar.</Text> : null}
            </View>
            <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: tokens.surface.interactive }}>
              <Text className="text-[11px] font-black" style={{ color: tokens.text.secondary }}>{filteredNotifications.length}</Text>
            </View>
          </View>

          <View style={{ gap: 11 }}>
            {filteredNotifications.length > 0 ? filteredNotifications.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                categoryLabel={categoryLabels[notification.type]}
                role="teacher"
                compact={!isDesktop}
                swipeEnabled={!isDesktop}
                onPress={() => handleNotificationAction(notification)}
                onMarkAsRead={() => markAsRead(notification.id)}
                onDelete={() => deleteNotification(notification.id)}
              />
            )) : (
              <NotificationEmptyState audience="teacher" unreadOnly={selectedFilter === 'unread'} />
            )}
          </View>
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="notifications" /> : null}
    </View>
  )
}

function getSectionTitle(filter: NotificationFilter) {
  if (filter === 'all') return 'Novedades docentes'
  if (filter === 'unread') return 'Sin leer'
  return categoryLabels[filter]
}
