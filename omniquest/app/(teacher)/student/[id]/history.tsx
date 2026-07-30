import React from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../../lib/mobileLayout'
import { useAppTheme } from '../../../../lib/appTheme'
import { useTeacherStudentHistory, type TeacherStudentHistoryTab } from '../../../../hooks/teacher/useTeacherStudentHistory'
import TeacherSidebar from '../../../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../../../components/teacher/TeacherPageHeader'
import AppButton from '../../../../components/ui/AppButton'
import AppStatusBanner from '../../../../components/ui/AppStatusBanner'
import AppTabs from '../../../../components/ui/AppTabs'
import {
  StudentHistoryMetrics,
  StudentHistoryReviews,
  StudentHistorySummary,
  StudentHistoryTimeline,
  StudentHistoryWeaknesses,
} from '../../../../components/teacher/student-history'

const historyTabs: Array<{ key: TeacherStudentHistoryTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'activity', label: 'Actividad', icon: 'time-outline' },
  { key: 'weaknesses', label: 'Áreas de refuerzo', icon: 'warning-outline' },
  { key: 'reviews', label: 'Revisiones', icon: 'chatbox-ellipses-outline' },
  { key: 'metrics', label: 'Métricas', icon: 'analytics-outline' },
]

export default function TeacherStudentHistoryScreen() {
  const params = useLocalSearchParams<{ id?: string; subjectId?: string; classroomId?: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isDesktop = width >= 1080
  const studentId = normalizeStringParam(params.id)
  const subjectId = parseNumberParam(params.subjectId)
  const classroomId = parseNumberParam(params.classroomId)
  const history = useTeacherStudentHistory({ studentId, subjectId, classroomId })

  const handleRecommendation = async () => {
    const recommendation = history.summary?.recommendation
    if (!recommendation || !studentId) return
    if (recommendation.code === 'review') {
      router.push('/(teacher)/reviews' as any)
      return
    }
    if (recommendation.code === 'practice' || recommendation.code === 'challenge') {
      const context = history.summary?.courseContexts[0]
      if (!context) {
        Alert.alert('Sin curso', 'No hay un curso disponible para preparar la práctica.')
        return
      }
      router.push({
        pathname: '/(teacher)/subject/add-question',
        params: {
          subjectId: String(subjectId || context.subjectId),
          ...(classroomId || context.classroomId ? { classroomId: String(classroomId || context.classroomId) } : {}),
          ...(recommendation.topicId ? { topicId: String(recommendation.topicId) } : {}),
        },
      } as any)
      return
    }

    try {
      const contexts = history.summary?.courseContexts || []
      const subjectIds = [...new Set(contexts.map((context) => context.subjectId))]
      const { error } = await supabase.functions.invoke('teacher-student-reminder', {
        body: { studentIds: [studentId], subjectIds, mode: 'reminder' },
      })
      if (error) throw error
      Alert.alert('Recordatorio enviado', 'El alumno recibirá una notificación para retomar su aprendizaje.')
    } catch (error) {
      Alert.alert('No se pudo enviar', error instanceof Error ? error.message : 'Inténtalo de nuevo más tarde.')
    }
  }

  if (history.loadingSummary) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: tokens.background.primary }}>
        <ActivityIndicator size="large" color={tokens.brand.teacher} />
        <Text className="mt-4" style={{ color: tokens.text.muted }}>Generando el resumen docente...</Text>
      </View>
    )
  }

  const summary = history.summary
  if (!summary) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: tokens.background.primary }}>
        <Ionicons name="alert-circle-outline" size={48} color={tokens.semantic.danger} />
        <Text className="mt-4 text-center text-[18px] font-black" style={{ color: tokens.text.primary }}>No se pudo abrir el historial</Text>
        <Text className="mt-2 text-center" style={{ color: tokens.text.muted }}>{history.error || 'Comprueba que el alumno pertenece a uno de tus cursos.'}</Text>
        <AppButton label="Volver" icon="arrow-back" variant="secondary" style={{ marginTop: 20 }} onPress={() => router.back()} />
      </View>
    )
  }

  const content = (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingHorizontal: isDesktop ? 28 : 16,
        paddingTop: isDesktop ? 24 : 16,
        paddingBottom: isDesktop ? 36 : MOBILE_BOTTOM_NAV_SPACER,
      }}
      refreshControl={<RefreshControl refreshing={history.refreshing} onRefresh={history.refresh} tintColor={tokens.brand.teacher} />}
      showsVerticalScrollIndicator={false}
    >
      <TeacherPageHeader
        icon="person-circle-outline"
        isDesktop={isDesktop}
        title={summary.profile.alias || 'Alumno'}
        subtitle="Resumen en servidor, actividad paginada y métricas cargadas solo cuando se necesitan."
        backAction={{ label: 'Alumnos', onPress: () => router.back() }}
        notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
      />

      <View className="mb-5 flex-row flex-wrap items-center gap-4 rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: tokens.surface.selected }}>
          <Text className="text-[20px] font-black" style={{ color: tokens.brand.teacher }}>{getInitials(summary.profile.alias || 'Alumno')}</Text>
        </View>
        <View className="min-w-[230px] flex-1">
          <Text className="text-[21px] font-black" style={{ color: tokens.text.primary }}>{summary.profile.alias || 'Alumno'}</Text>
          <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>
            {summary.courseContexts.map((context) => context.subjectName).filter((value, index, values) => values.indexOf(value) === index).join(' · ') || 'Sin cursos visibles'}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>XP global</Text>
          <Text className="mt-1 text-[24px] font-black" style={{ color: tokens.gamification.xp }}>{summary.profile.points || 0}</Text>
        </View>
      </View>

      {history.error ? (
        <View className="mb-4">
          <AppStatusBanner variant="danger" title="No se pudo cargar una sección" message={history.error} actionLabel="Reintentar" onAction={history.retryTab} />
        </View>
      ) : null}

      <View className="mb-5 rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className="mb-2 text-[10px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Periodo comparado</Text>
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
      </View>

      <StudentHistorySummary
        data={summary}
        savingNote={history.savingNote}
        onRecommendation={() => { void handleRecommendation() }}
        onAddNote={history.addNote}
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
          <Text className="mt-3" style={{ color: tokens.text.muted }}>Cargando solo esta sección...</Text>
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
      {!history.loadingTab && history.activeTab === 'reviews' ? <StudentHistoryReviews items={history.reviews} total={history.reviewsTotal} /> : null}
      {!history.loadingTab && history.activeTab === 'metrics' ? <StudentHistoryMetrics data={history.metrics} /> : null}
    </ScrollView>
  )

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <View className="flex-1 flex-row">
        {isDesktop ? <TeacherSidebar activeSection="students" subjectsCount={summary.subjectsCount} onSignOut={() => supabase.auth.signOut()} /> : null}
        {content}
      </View>
      {!isDesktop ? <TeacherBottomNav active="students" /> : null}
    </View>
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
