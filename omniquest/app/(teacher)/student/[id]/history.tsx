import OmniLoadingScreen from '../../../../components/ui/OmniLoadingScreen'
import React from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { supabase } from '../../../../lib/supabase'
import { useAppTheme } from '../../../../lib/appTheme'
import { useResponsiveLayout } from '../../../../lib/responsive'
import { useTeacherStudentHistory, type TeacherStudentHistoryTab } from '../../../../hooks/teacher/useTeacherStudentHistory'
import TeacherSidebar from '../../../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../../../components/teacher/TeacherPageHeader'
import TeacherScreenLayout from '../../../../components/layouts/TeacherScreenLayout'
import AppBackButton from '../../../../components/ui/AppBackButton'
import AppStatusBanner from '../../../../components/ui/AppStatusBanner'
import AppTabs from '../../../../components/ui/AppTabs'
import AvatarImage from '../../../../components/ui/AvatarImage'
import { useAppFeedback } from '../../../../hooks/useAppFeedback'
import {
  StudentHistoryMetrics,
  StudentHistoryReviews,
  StudentHistorySummary,
  StudentHistoryTimeline,
  StudentHistoryWeaknesses,
} from '../../../../components/teacher/student-history'
import { signOutCurrentDeviceSession } from '../../../../lib/pushNotifications'

const historyTabs: { key: TeacherStudentHistoryTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'activity', label: 'Actividad', icon: 'time-outline' },
  { key: 'weaknesses', label: 'Áreas de refuerzo', icon: 'warning-outline' },
  { key: 'reviews', label: 'Revisiones', icon: 'chatbox-ellipses-outline' },
  { key: 'metrics', label: 'Métricas', icon: 'analytics-outline' },
]

export default function TeacherStudentHistoryScreen() {
  const params = useLocalSearchParams<{ id?: string; subjectId?: string; classroomId?: string }>()
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const feedback = useAppFeedback()
  const isDesktop = responsive.isDesktop
  const studentId = normalizeStringParam(params.id)
  const subjectId = parseNumberParam(params.subjectId)
  const classroomId = parseNumberParam(params.classroomId)
  const history = useTeacherStudentHistory({ studentId, subjectId, classroomId })

  const handleRecommendation = async () => {
    const recommendation = history.summary?.recommendation
    if (!recommendation || !studentId) return
    if (recommendation.code === 'review') {
      router.push({ pathname: '/(teacher)/reviews', params: { studentId, ...(subjectId ? { subjectId: String(subjectId) } : {}), ...(classroomId ? { classroomId: String(classroomId) } : {}) } } as Href)
      return
    }
    if (recommendation.code === 'practice' || recommendation.code === 'challenge') {
      const fallbackContext = history.summary?.courseContexts[0]
      const targetSubjectId = recommendation.subjectId || subjectId || fallbackContext?.subjectId || null
      const targetClassroomId = recommendation.classroomId || classroomId || (targetSubjectId === fallbackContext?.subjectId ? fallbackContext?.classroomId : null)
      if (!targetSubjectId) {
        feedback.warning('Sin curso', 'No hay un curso disponible para preparar la práctica.')
        return
      }
      router.push({ pathname: '/(teacher)/subject/add-question', params: { subjectId: String(targetSubjectId), ...(targetClassroomId ? { classroomId: String(targetClassroomId) } : {}), ...(recommendation.topicId ? { topicId: String(recommendation.topicId) } : {}) } } as Href)
      return
    }

    try {
      const contexts = history.summary?.courseContexts || []
      const subjectIds = [...new Set(contexts.map((context) => context.subjectId))]
      const { error } = await supabase.functions.invoke('teacher-student-reminder', {
        body: { studentIds: [studentId], subjectIds, mode: 'reminder', ...(classroomId ? { classroomId } : {}) },
      })
      if (error) throw error
      feedback.success('Recordatorio enviado', 'El alumno recibirá una notificación para retomar su aprendizaje.')
    } catch (error) {
      feedback.error('No se pudo enviar', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    }
  }

  if (history.loadingSummary) return <OmniLoadingScreen />

  const summary = history.summary
  if (!summary) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: tokens.background.primary }}>
        <Ionicons name="alert-circle-outline" size={48} color={tokens.semantic.danger} />
        <Text className="mt-4 text-center text-[18px] font-black" style={{ color: tokens.text.primary }}>No se pudo abrir el historial</Text>
        <Text className="mt-2 text-center" style={{ color: tokens.text.muted }}>{history.error || 'Comprueba que el alumno pertenece a uno de tus cursos.'}</Text>
        <AppBackButton label="Volver" style={{ marginTop: 20 }} onPress={() => router.back()} />
      </View>
    )
  }

  const content = (
    <>
      <TeacherPageHeader
        icon="person-circle-outline"
        isDesktop={isDesktop}
        title="Historial"
        backAction={{ label: 'Alumnos', onPress: () => router.back() }}
        notificationOnPress={() => router.push('/(teacher)/notifications' as Href)}
      />

      <View className={`mb-5 flex-row items-center rounded-2xl border ${isDesktop ? 'gap-4 p-5' : 'gap-3 p-3'}`} style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <View className={`${isDesktop ? 'h-16 w-16' : 'h-12 w-12'} overflow-hidden rounded-full border-2`} style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.selected }}>
          {summary.profile.avatar?.startsWith('http') ? (
            <AvatarImage accessibilityLabel={`Foto de ${summary.profile.alias || 'alumno'}`} uri={summary.profile.avatar} />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className={`${isDesktop ? 'text-[20px]' : 'text-[16px]'} font-black`} style={{ color: tokens.brand.teacher }}>{getInitials(summary.profile.alias || 'Alumno')}</Text>
            </View>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className={`${isDesktop ? 'text-[21px]' : 'text-[18px]'} font-black`} style={{ color: tokens.text.primary }} numberOfLines={2}>{summary.profile.alias || 'Alumno'}</Text>
        </View>
        <View className="shrink-0 items-end">
          <Text className={`${isDesktop ? 'text-[11px]' : 'text-[9px]'} font-black uppercase`} style={{ color: tokens.text.muted }}>XP global</Text>
          <Text className={`${isDesktop ? 'mt-1 text-[24px]' : 'mt-0.5 text-[20px]'} font-black`} style={{ color: tokens.gamification.xp }}>{summary.profile.points || 0}</Text>
        </View>
      </View>

      {history.error ? (
        <View className="mb-4">
          <AppStatusBanner variant="danger" title="No se pudo completar la operación" message={history.error} actionLabel="Reintentar" onAction={history.retryTab} />
        </View>
      ) : null}

      <View className={`mb-5 rounded-2xl border ${isDesktop ? 'p-4' : 'p-3'}`} style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className="mb-2 text-[10px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Periodo de análisis</Text>
        <AppTabs<number>
          compact
          role="teacher"
          accessibilityLabel="Seleccionar periodo del historial"
          items={[
            { key: 30, label: '30 días' },
            { key: 60, label: '60 días' },
            { key: 90, label: '90 días' },
          ]}
          value={history.periodDays}
          onChange={history.setPeriodDays}
        />
        <Text className="mt-2 text-[11px] leading-4" style={{ color: tokens.text.muted }}>Afecta al resumen, comparación, refuerzo y métricas. Actividad y Revisiones muestran el historial completo.</Text>
      </View>

      <StudentHistorySummary
        data={summary}
        savingNote={history.savingNote}
        onRecommendation={() => { void handleRecommendation() }}
        onAddNote={async (body) => {
          try { await history.addNote(body); feedback.success('Comentario guardado', 'La nota privada se ha añadido al historial.') }
          catch (noteError) { feedback.error('No se pudo guardar el comentario', noteError instanceof Error ? noteError : 'Inténtalo de nuevo.'); throw noteError }
        }}
      />

      <View className="mb-4 mt-6">
        <AppTabs<TeacherStudentHistoryTab>
          role="teacher"
          accessibilityLabel="Secciones del historial del alumno"
          items={historyTabs}
          value={history.activeTab}
          onChange={history.setActiveTab}
        />
      </View>

      {history.loadingTab ? (
        <View className="items-center py-12">
          <ActivityIndicator color={tokens.brand.teacher} />
          <Text className="mt-3" style={{ color: tokens.text.muted }}>Cargando esta sección...</Text>
        </View>
      ) : null}
      {!history.loadingTab && history.activeTab === 'activity' ? (
        <StudentHistoryTimeline
          items={history.timeline}
          total={history.timelineTotal}
          page={history.timelinePage}
          pageSize={history.timelinePageSize}
          onPage={history.setTimelinePage}
        />
      ) : null}
      {!history.loadingTab && history.activeTab === 'weaknesses' ? <StudentHistoryWeaknesses items={history.weaknesses} /> : null}
      {!history.loadingTab && history.activeTab === 'reviews' ? (
        <StudentHistoryReviews
          items={history.reviews}
          total={history.reviewsTotal}
          page={history.reviewsPage}
          pageSize={history.reviewsPageSize}
          onPage={history.setReviewsPage}
          onOpenReview={(item) => router.push({ pathname: '/(teacher)/reviews', params: { studentId, attemptId: String(item.id), subjectId: String(item.subject_id), ...(item.classroom_id ? { classroomId: String(item.classroom_id) } : {}) } } as Href)}
        />
      ) : null}
      {!history.loadingTab && history.activeTab === 'metrics' ? <StudentHistoryMetrics data={history.metrics} /> : null}
    </>
  )

  return (
    <TeacherScreenLayout
      isDesktop={isDesktop}
      desktopSidebar={<TeacherSidebar activeSection="students" subjectsCount={summary.subjectsCount} onSignOut={() => void signOutCurrentDeviceSession()} />}
      mobileBottomNavigation={<TeacherBottomNav active="students" />}
      refreshControl={<RefreshControl refreshing={history.refreshing} onRefresh={history.refresh} tintColor={tokens.brand.teacher} />}
    >
      {content}
    </TeacherScreenLayout>
  )
}

function normalizeStringParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || null : value || null
}

function parseNumberParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getInitials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AL'
}
