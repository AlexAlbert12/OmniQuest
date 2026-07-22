import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import AppButton from '../../components/ui/AppButton'
import AppTabs from '../../components/ui/AppTabs'
import NotificationEmptyState from '../../components/notifications/NotificationEmptyState'
import NotificationListItem from '../../components/notifications/NotificationListItem'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import { useNotifications, type AppNotification } from '../../hooks/useNotifications'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { supabase } from '../../lib/supabase'

type NotificationFilter = 'all' | 'unread' | 'students' | 'review' | 'courses' | 'system' | 'audit'

const filterOptions: { key: NotificationFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todas', icon: 'list-outline' },
  { key: 'unread', label: 'Sin leer', icon: 'mail-unread-outline' },
  { key: 'students', label: 'Alumnos', icon: 'people-outline' },
  { key: 'review', label: 'Revisión', icon: 'create-outline' },
  { key: 'courses', label: 'Cursos', icon: 'book-outline' },
  { key: 'system', label: 'Sistema', icon: 'megaphone-outline' },
  { key: 'audit', label: 'Auditoría', icon: 'shield-checkmark-outline' },
]

const categoryLabels: Record<Exclude<NotificationFilter, 'all' | 'unread'>, string> = {
  students: 'Alumnos',
  review: 'Revisión',
  courses: 'Cursos',
  system: 'Sistema',
  audit: 'Auditoría',
}

type TeacherAttentionSummary = {
  pendingReviews: number
  inactiveStudents: number
  sensitiveActions: number
}

const EMPTY_ATTENTION_SUMMARY: TeacherAttentionSummary = {
  pendingReviews: 0,
  inactiveStudents: 0,
  sensitiveActions: 0,
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
  const [attentionSummary, setAttentionSummary] = useState<TeacherAttentionSummary>(EMPTY_ATTENTION_SUMMARY)
  const isDesktop = width >= 1080

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === 'all') return notifications
    if (selectedFilter === 'unread') return notifications.filter((notification) => !notification.isRead)
    return notifications.filter((notification) => getTeacherNotificationCategory(notification) === selectedFilter)
  }, [notifications, selectedFilter])

  const tabs = useMemo(() => filterOptions.map((option) => ({
    ...option,
    badge: option.key === 'all'
      ? notifications.length
      : option.key === 'unread'
        ? unreadCount
        : notifications.filter((notification) => getTeacherNotificationCategory(notification) === option.key).length,
  })), [notifications, unreadCount])

  const fetchAttentionSummary = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const teacherId = sessionData.session?.user.id
      if (!teacherId) return

      const subjectsResult = await supabase
        .from('subjects')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('is_archived', false)

      if (subjectsResult.error) throw subjectsResult.error
      const subjectIds = (subjectsResult.data || []).map((subject) => Number(subject.id))

      const [reviewResult, auditResult, enrollmentsResult, scoresResult] = await Promise.all([
        supabase.rpc('get_teacher_manual_review_queue', {
          p_subject_id: null,
          p_classroom_id: null,
          p_status: 'pending',
          p_search: null,
          p_limit: 1,
          p_offset: 0,
        }),
        supabase.rpc('get_teacher_audit_logs_page', {
          p_category: 'all',
          p_search: null,
          p_limit: 1,
          p_offset: 0,
        }),
        subjectIds.length > 0
          ? supabase.from('enrollments').select('student_id, subject_id').in('subject_id', subjectIds)
          : Promise.resolve({ data: [], error: null }),
        subjectIds.length > 0
          ? supabase.from('subject_scores').select('student_id, subject_id, max_score').in('subject_id', subjectIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      const enrolledStudents = new Set<string>()
      for (const row of (enrollmentsResult.data || []) as { student_id?: string | null }[]) {
        if (row.student_id) enrolledStudents.add(row.student_id)
      }
      const activeStudents = new Set<string>()
      for (const row of (scoresResult.data || []) as { student_id?: string | null; max_score?: number | null }[]) {
        if (row.student_id && Number(row.max_score || 0) > 0) activeStudents.add(row.student_id)
      }

      const reviewPayload = (reviewResult.data || {}) as { total?: number | null }
      const auditRows = (auditResult.data || []) as { total_count?: number | null }[]
      setAttentionSummary({
        pendingReviews: Number(reviewPayload.total || 0),
        inactiveStudents: [...enrolledStudents].filter((studentId) => !activeStudents.has(studentId)).length,
        sensitiveActions: Number(auditRows[0]?.total_count || 0),
      })
    } catch (error) {
      console.warn('No se pudo cargar el resumen docente de notificaciones:', error)
    }
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refresh(), fetchAttentionSummary()])
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => {
    void refresh()
    void fetchAttentionSummary()
  }, [fetchAttentionSummary, refresh]))

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

          <View className={`${isDesktop ? 'flex-row' : 'flex-row flex-wrap'} mb-5 gap-3`}>
            <MobileMetricCard
              compact
              className="min-w-[170px] flex-1"
              semantic="attention"
              label="Pendientes de revisar"
              value={attentionSummary.pendingReviews}
              detail="Respuestas abiertas"
              onPress={() => router.push('/(teacher)/reviews' as any)}
            />
            <MobileMetricCard
              compact
              className="min-w-[170px] flex-1"
              icon="time"
              color={tokens.semantic.info}
              label="Sin actividad"
              value={attentionSummary.inactiveStudents}
              detail="Alumnos por activar"
              onPress={() => router.push('/(teacher)/students?status=no_activity' as any)}
            />
            <MobileMetricCard
              compact
              className="min-w-[170px] flex-1"
              semantic="audit"
              label="Acciones sensibles"
              value={attentionSummary.sensitiveActions}
              detail="Trazabilidad docente"
              onPress={() => router.push('/(teacher)/audit' as any)}
            />
          </View>

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
                categoryLabel={categoryLabels[getTeacherNotificationCategory(notification)]}
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

function getTeacherNotificationCategory(notification: AppNotification): Exclude<NotificationFilter, 'all' | 'unread'> {
  const searchable = `${notification.title} ${notification.description} ${notification.actionUrl || ''}`.toLowerCase()

  if (searchable.includes('/reviews') || searchable.includes('revisi') || searchable.includes('respuesta abierta')) return 'review'
  if (searchable.includes('/audit') || searchable.includes('auditor') || searchable.includes('acción sensible') || searchable.includes('codigo regenerado') || searchable.includes('código regenerado')) return 'audit'
  if (notification.type === 'enrollment' || notification.type === 'student_activity') return 'students'
  if (notification.type === 'new_class') return 'courses'
  return 'system'
}

function getSectionTitle(filter: NotificationFilter) {
  if (filter === 'all') return 'Novedades docentes'
  if (filter === 'unread') return 'Sin leer'
  return categoryLabels[filter]
}
