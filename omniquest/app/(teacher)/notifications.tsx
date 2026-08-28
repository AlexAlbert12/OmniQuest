import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import TeacherScreenLayout from '../../components/layouts/TeacherScreenLayout'
import NotificationFeed from '../../components/notifications/NotificationFeed'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import AppButton from '../../components/ui/AppButton'
import AppBottomSheet from '../../components/ui/AppBottomSheet'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import AppTabs from '../../components/ui/AppTabs'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import { useAppModal, type AppModalButton } from '../../components/AppModalProvider'
import { useTeacherNotifications, type TeacherNotificationBucket, type TeacherNotificationCategory } from '../../hooks/teacher/useTeacherNotifications'
import type { AppNotification } from '../../lib/notifications/types'
import { useAppTheme } from '../../lib/appTheme'
import { useResponsiveLayout } from '../../lib/responsive'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
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
  const notificationError = notifications.error
  const clearNotificationError = notifications.clearError
  const muteNotificationsUntil = notifications.muteUntil
  const markAllNotificationsAsRead = notifications.markAllAsRead
  const unreadNotifications = notifications.summary.unreadNotifications
  const [filtersOpen, setFiltersOpen] = useState(false)
  const shellHorizontalPadding = responsive.isDesktop ? 28 : responsive.isTablet ? 24 : 18

  useEffect(() => {
    if (!notificationError) return
    showModal({ title: 'Error de notificaciones', message: notificationError, variant: 'error' })
    clearNotificationError()
  }, [clearNotificationError, notificationError, showModal])

  const handleSignOut = useCallback(async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as never)
  }, [router])

  const tabs = useMemo(() => bucketTabs.map((tab) => ({
    ...tab,
    label: responsive.isMobile && tab.key === 'informative' ? 'Avisos' : tab.label,
    badge: tab.key === 'all' ? notifications.total : tab.key === 'critical' ? notifications.criticalCount : notifications.informativeCount,
  })), [notifications.criticalCount, notifications.informativeCount, notifications.total, responsive.isMobile])

  const openMuteMenu = useCallback(() => {
    showModal({
      title: 'Silenciar avisos informativos',
      message: 'Las notificaciones seguirán disponibles en este centro y las alertas críticas permanecerán activas. Elige durante cuánto tiempo quieres pausar únicamente los avisos informativos.',
      variant: 'info',
      buttons: [
        { label: 'Durante 1 hora', role: 'primary', onPress: () => muteNotificationsUntil(new Date(Date.now() + 60 * 60 * 1000).toISOString()) },
        { label: 'Durante 8 horas', role: 'primary', onPress: () => muteNotificationsUntil(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()) },
        { label: 'Hasta mañana', role: 'primary', onPress: () => muteNotificationsUntil(nextMorningIso()) },
        { label: 'Cancelar', role: 'cancel' },
      ],
    })
  }, [muteNotificationsUntil, showModal])

  const openMobileActions = useCallback(() => {
    const buttons: AppModalButton[] = [
      { label: 'Preferencias', role: 'primary' as const, onPress: () => router.push('/(teacher)/settings?section=teaching' as never) },
      { label: 'Silenciar avisos informativos', role: 'primary' as const, onPress: openMuteMenu },
    ]
    if (unreadNotifications > 0) buttons.unshift({ label: 'Marcar todas como leídas', role: 'primary' as const, onPress: markAllNotificationsAsRead })
    showModal({ title: 'Acciones de notificaciones', message: 'Gestiona las notificaciones sin ocultar el contenido del centro.', variant: 'info', buttons: [...buttons, { label: 'Cancelar', role: 'cancel' as const }] })
  }, [markAllNotificationsAsRead, openMuteMenu, router, showModal, unreadNotifications])

  const headerActions = responsive.isDesktop ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
      <AppButton accessibilityLabel="Abrir preferencias de notificaciones" icon="options-outline" label="Preferencias" role="teacher" size="sm" variant="secondary" onPress={() => router.push('/(teacher)/settings?section=teaching' as never)} />
      {notifications.summary.unreadNotifications > 0 ? <AppButton accessibilityLabel="Marcar todas las notificaciones como leídas" icon="checkmark-done-outline" label="Marcar todas como leídas" role="teacher" size="sm" onPress={() => void notifications.markAllAsRead()} /> : null}
      <AppButton accessibilityLabel="Silenciar avisos informativos temporalmente" icon="volume-mute-outline" label="Silenciar avisos informativos" size="sm" variant="secondary" onPress={openMuteMenu} />
    </View>
  ) : (
    <AppButton accessibilityLabel="Más acciones de notificaciones" icon="ellipsis-horizontal" iconOnly role="teacher" size="sm" variant="secondary" onPress={openMobileActions} />
  )

  const header = (
    <View>
      <TeacherPageHeader
        icon="notifications"
        isDesktop={responsive.isDesktop}
        title="Centro de notificaciones"
        mobileTitle="Notificaciones"
        subtitle={notifications.activeFilterDescription}
        showNotifications={false}
        mobileStackedIdentity={responsive.isMobile}
        actionsPosition={responsive.isDesktop ? 'below' : 'top'}
        actions={headerActions}
      />

      {notifications.summary.mutedUntil && new Date(notifications.summary.mutedUntil).getTime() > Date.now() ? (
        <AppStatusBanner
          style={{ marginBottom: 14 }}
          variant="info"
          title="Avisos informativos silenciados"
          message={`La pausa termina el ${new Date(notifications.summary.mutedUntil).toLocaleString('es-ES')}. Las notificaciones siguen disponibles aquí y las alertas críticas continúan activas.`}
          actionLabel="Reactivar ahora"
          onAction={() => void notifications.muteUntil(null)}
        />
      ) : null}

      <View style={{ marginBottom: 12, flexDirection: 'row', flexWrap: responsive.isDesktop ? 'wrap' : 'nowrap', gap: responsive.isDesktop ? 10 : 8 }}>
        <MobileMetricCard compact dense={!responsive.isDesktop} className={responsive.isDesktop ? 'min-w-[165px] flex-1' : 'min-w-0 flex-1'} semantic="attention" label={responsive.isDesktop ? 'Pendientes de revisar' : 'Pendientes'} value={notifications.summary.pendingReviews} detail="Respuestas abiertas" onPress={() => router.push('/(teacher)/reviews' as never)} />
        <MobileMetricCard compact dense={!responsive.isDesktop} className={responsive.isDesktop ? 'min-w-[165px] flex-1' : 'min-w-0 flex-1'} icon="time" color={tokens.semantic.info} label="Sin actividad" value={notifications.summary.inactiveStudents} detail="Últimos 7 días" onPress={() => router.push('/(teacher)/students?status=no_activity' as never)} />
        <MobileMetricCard compact dense={!responsive.isDesktop} className={responsive.isDesktop ? 'min-w-[165px] flex-1' : 'min-w-0 flex-1'} semantic="audit" label={responsive.isDesktop ? 'Alertas de auditoría' : 'Alertas'} value={notifications.summary.sensitiveActions} detail="Últimos 7 días" onPress={() => router.push('/(teacher)/audit' as never)} />
      </View>

      <AppTabs<TeacherNotificationBucket> accessibilityLabel="Separar alertas críticas e informativas" compact fill role="teacher" items={tabs} value={notifications.bucket} onChange={notifications.setBucket} />

      {responsive.isDesktop ? (
        <>
          <View style={{ marginTop: 10 }}>
            <AppTabs<TeacherNotificationCategory> accessibilityLabel="Filtrar notificaciones docentes por categoría" compact role="teacher" items={categoryTabs} value={notifications.category} onChange={notifications.setCategory} />
          </View>
          <View style={{ marginTop: 10, marginBottom: 6 }}>
            <AppButton label={notifications.unreadOnly ? 'Mostrando sin leer' : 'Solo sin leer'} icon={notifications.unreadOnly ? 'mail-unread' : 'mail-unread-outline'} role="teacher" size="sm" variant={notifications.unreadOnly ? 'primary' : 'secondary'} onPress={() => notifications.setUnreadOnly(!notifications.unreadOnly)} />
          </View>
        </>
      ) : (
        <View style={{ marginTop: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
          <View style={{ minWidth: 0, flex: 1 }}>
            <AppButton fullWidth label={notifications.category === 'all' ? 'Filtros' : `Filtros · ${categoryLabelForKey(notifications.category)}`} icon="options-outline" role="teacher" size="sm" variant="secondary" onPress={() => setFiltersOpen(true)} />
          </View>
          <View style={{ minWidth: 0, flex: 1 }}>
            <AppButton fullWidth label={notifications.unreadOnly ? 'Sin leer' : 'Solo sin leer'} icon={notifications.unreadOnly ? 'mail-unread' : 'mail-unread-outline'} role="teacher" size="sm" variant={notifications.unreadOnly ? 'primary' : 'secondary'} onPress={() => notifications.setUnreadOnly(!notifications.unreadOnly)} />
          </View>
        </View>
      )}
    </View>
  )

  return (
    <>
      <TeacherScreenLayout
        isDesktop={responsive.isDesktop}
        loading={notifications.loading}
        loadingLabel="Cargando notificaciones docentes…"
        scroll={false}
        horizontalPadding={shellHorizontalPadding}
        contentContainerStyle={{ flex: 1, width: '100%' }}
        desktopSidebar={<TeacherSidebar activeSection="notifications" subjectsCount={notifications.summary.activeSubjects} onSignOut={() => void handleSignOut()} />}
        mobileBottomNavigation={<TeacherBottomNav active="notifications" />}
      >
        <NotificationFeed
          audience="teacher"
          compact={!responsive.isDesktop}
          swipeEnabled={!responsive.isDesktop}
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
          contentContainerStyle={{ paddingBottom: responsive.isDesktop ? 36 : MOBILE_BOTTOM_NAV_SPACER }}
        />
      </TeacherScreenLayout>

      <AppBottomSheet visible={!responsive.isDesktop && filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros" description="Elige qué tipo de notificaciones quieres consultar.">
        <Text maxFontSizeMultiplier={2} style={{ color: tokens.text.secondary, fontSize: 12, fontWeight: '800' }}>Tipo de notificación</Text>
        <View style={{ marginTop: 10, gap: 8 }}>
          {categoryTabs.map((item) => (
            <AppButton key={item.key} fullWidth label={item.label} icon={notifications.category === item.key ? 'radio-button-on' : 'radio-button-off'} role="teacher" size="sm" variant={notifications.category === item.key ? 'primary' : 'secondary'} onPress={() => { notifications.setCategory(item.key); setFiltersOpen(false) }} />
          ))}
        </View>
        <View style={{ marginTop: 16 }}>
          <AppButton fullWidth label={notifications.unreadOnly ? 'Mostrar también las leídas' : 'Mostrar solo sin leer'} icon={notifications.unreadOnly ? 'mail-open-outline' : 'mail-unread-outline'} role="teacher" size="sm" variant={notifications.unreadOnly ? 'primary' : 'secondary'} onPress={() => { notifications.setUnreadOnly(!notifications.unreadOnly); setFiltersOpen(false) }} />
        </View>
      </AppBottomSheet>
    </>
  )
}

function teacherCategoryLabel(notification: AppNotification) {
  return categoryLabelForKey((notification.category || 'system') as TeacherNotificationCategory)
}

function categoryLabelForKey(category: TeacherNotificationCategory) {
  const labels: Record<TeacherNotificationCategory, string> = { all: 'Todas', students: 'Alumnos', review: 'Revisión', courses: 'Cursos', system: 'Sistema', audit: 'Auditoría' }
  return labels[category] || 'Sistema'
}

function nextMorningIso() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(8, 0, 0, 0)
  return date.toISOString()
}
