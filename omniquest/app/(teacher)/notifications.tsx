import React, { useCallback, useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import TeacherScreenLayout from '../../components/layouts/TeacherScreenLayout'
import NotificationFeed from '../../components/notifications/NotificationFeed'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import AppButton from '../../components/ui/AppButton'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import AppTabs from '../../components/ui/AppTabs'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import { useAppModal } from '../../components/AppModalProvider'
import {
  useTeacherNotifications,
  type TeacherNotificationBucket,
  type TeacherNotificationCategory,
} from '../../hooks/teacher/useTeacherNotifications'
import type { AppNotification } from '../../lib/notifications/types'
import { useAppTheme } from '../../lib/appTheme'
import { useResponsiveLayout } from '../../lib/responsive'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

const bucketTabs = [
  { key: 'all' as const, label: 'Todas', icon: 'list-outline' as const },
  { key: 'critical' as const, label: 'Críticas', icon: 'alert-circle-outline' as const },
  { key: 'informative' as const, label: 'Informativas', icon: 'information-circle-outline' as const },
]

const categoryTabs = [
  { key: 'all' as const, label: 'Todas' },
  { key: 'students' as const, label: 'Alumnos' },
  { key: 'review' as const, label: 'Revisión' },
  { key: 'courses' as const, label: 'Cursos' },
  { key: 'system' as const, label: 'Sistema' },
  { key: 'audit' as const, label: 'Auditoría' },
]

export default function TeacherNotificationsScreen() {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const notifications = useTeacherNotifications()

  useEffect(() => {
    if (!notifications.error) return
    showModal({ title: 'Error de notificaciones', message: notifications.error, variant: 'error' })
    notifications.clearError()
  }, [notifications, showModal])

  const handleSignOut = useCallback(async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as never)
  }, [router])

  const tabs = useMemo(() => bucketTabs.map((tab) => ({
    ...tab,
    badge: tab.key === 'all'
      ? notifications.total
      : tab.key === 'critical'
        ? notifications.criticalCount
        : notifications.informativeCount,
  })), [notifications.criticalCount, notifications.informativeCount, notifications.total])

  const header = (
    <View>
      <TeacherPageHeader
        icon="notifications"
        isDesktop={responsive.isDesktop}
        title="Centro de notificaciones"
        mobileTitle="Notificaciones"
        subtitle={notifications.activeFilterDescription}
        showNotifications={false}
        actions={(
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <AppButton
              accessibilityLabel="Abrir preferencias de notificaciones"
              icon="options-outline"
              iconOnly={!responsive.isDesktop}
              label={responsive.isDesktop ? 'Preferencias' : undefined}
              role="teacher"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/(teacher)/settings?section=teaching' as never)}
            />
            {notifications.unreadCount > 0 ? (
              <AppButton
                accessibilityLabel="Marcar notificaciones cargadas como leídas"
                icon="checkmark-done-outline"
                iconOnly={!responsive.isDesktop}
                label={responsive.isDesktop ? 'Marcar leídas' : undefined}
                role="teacher"
                size="sm"
                onPress={() => void notifications.markAllAsRead()}
              />
            ) : null}
          </View>
        )}
      />

      {notifications.summary.mutedUntil && new Date(notifications.summary.mutedUntil).getTime() > Date.now() ? (
        <AppStatusBanner
          style={{ marginBottom: 14 }}
          variant="info"
          title="Notificaciones informativas silenciadas"
          message={`El silencio temporal termina el ${new Date(notifications.summary.mutedUntil).toLocaleString('es-ES')}. Las alertas críticas continúan activas.`}
          actionLabel="Reactivar ahora"
          onAction={() => void notifications.muteUntil(null)}
        />
      ) : (
        <View style={{ marginBottom: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <AppButton label="Silenciar 1 hora" icon="volume-mute-outline" size="sm" variant="secondary" onPress={() => void notifications.muteUntil(new Date(Date.now() + 60 * 60 * 1000).toISOString())} />
          <AppButton label="Silenciar hasta mañana" icon="moon-outline" size="sm" variant="secondary" onPress={() => void notifications.muteUntil(nextMorningIso())} />
        </View>
      )}

      <View style={{ marginBottom: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <MobileMetricCard compact className="min-w-[165px] flex-1" semantic="attention" label="Pendientes de revisar" value={notifications.summary.pendingReviews} detail="Respuestas abiertas" onPress={() => router.push('/(teacher)/reviews' as never)} />
        <MobileMetricCard compact className="min-w-[165px] flex-1" icon="time" color={tokens.semantic.info} label="Sin actividad" value={notifications.summary.inactiveStudents} detail="Últimos 7 días" onPress={() => router.push('/(teacher)/students?status=no_activity' as never)} />
        <MobileMetricCard compact className="min-w-[165px] flex-1" semantic="audit" label="Acciones sensibles" value={notifications.summary.sensitiveActions} detail="Últimos 7 días" onPress={() => router.push('/(teacher)/audit' as never)} />
      </View>

      <AppTabs<TeacherNotificationBucket>
        accessibilityLabel="Separar alertas críticas e informativas"
        compact
        fill
        role="teacher"
        items={tabs}
        value={notifications.bucket}
        onChange={notifications.setBucket}
      />

      <View style={{ marginTop: 10 }}>
        <AppTabs<TeacherNotificationCategory>
          accessibilityLabel="Filtrar notificaciones docentes por categoría"
          compact
          role="teacher"
          items={categoryTabs}
          value={notifications.category}
          onChange={notifications.setCategory}
        />
      </View>

      <View style={{ marginTop: 10, marginBottom: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <AppButton
          label={notifications.unreadOnly ? 'Mostrando sin leer' : 'Solo sin leer'}
          icon={notifications.unreadOnly ? 'mail-unread' : 'mail-unread-outline'}
          role="teacher"
          size="sm"
          variant={notifications.unreadOnly ? 'primary' : 'secondary'}
          onPress={() => notifications.setUnreadOnly(!notifications.unreadOnly)}
        />
        <AppButton label="Actualizar" icon="refresh-outline" loading={notifications.refreshing} size="sm" variant="secondary" onPress={() => void notifications.refresh()} />
      </View>
    </View>
  )

  return (
    <TeacherScreenLayout
      isDesktop={responsive.isDesktop}
      loading={notifications.loading}
      loadingLabel="Cargando notificaciones docentes…"
      scroll={false}
      maxContentWidth={1240}
      contentContainerStyle={{ flex: 1 }}
      desktopSidebar={<TeacherSidebar activeSection="notifications" subjectsCount={0} onSignOut={() => void handleSignOut()} />}
      mobileBottomNavigation={<TeacherBottomNav active="notifications" />}
    >
      <NotificationFeed
        audience="teacher"
        notifications={notifications.notifications}
        unreadOnly={notifications.unreadOnly}
        hasMore={notifications.hasMore}
        loadingMore={notifications.loadingMore}
        refreshing={notifications.refreshing}
        header={header}
        categoryLabel={teacherCategoryLabel}
        onPress={async (notification) => {
          await notifications.markAsRead(notification)
          if (notification.actionUrl) router.push(notification.actionUrl as never)
        }}
        onMarkAsRead={notifications.markAsRead}
        onDelete={notifications.deleteNotification}
        onRefresh={notifications.refresh}
        onLoadMore={notifications.loadMore}
        contentContainerStyle={{ paddingBottom: responsive.isDesktop ? 36 : 100 }}
      />
    </TeacherScreenLayout>
  )
}

function teacherCategoryLabel(notification: AppNotification) {
  const labels: Record<string, string> = {
    students: 'Alumnos',
    review: 'Revisión',
    courses: 'Cursos',
    system: 'Sistema',
    audit: 'Auditoría',
  }
  return labels[notification.category || 'system'] || 'Sistema'
}

function nextMorningIso() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(8, 0, 0, 0)
  return date.toISOString()
}
