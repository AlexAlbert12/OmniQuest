import React, { useMemo } from 'react'
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import TeacherScreenLayout from '../../components/layouts/TeacherScreenLayout'
import { useResponsiveLayout } from '../../lib/responsive'
import { supabase } from '../../lib/supabase'
import { useTeacherDashboard } from '../../hooks/teacher/useTeacherDashboard'
import {
  TeacherPriorityOverview,
  TeacherTodayFocus,
  type TeacherAttentionItem,
} from '../../components/teacher/home/TeacherHomePriorities'
import {
  TeacherDashboardPanel,
  TeacherProblemQuestions,
  TeacherRecentActivityList,
  TeacherRecentCourses,
} from '../../components/teacher/home/TeacherDashboardSections'

export default function TeacherHomeScreen() {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { attention, error, loading, recentActivity, refresh, refreshing, summary } = useTeacherDashboard()
  const isDesktop = responsive.isDesktop

  const attentionItems = useMemo<TeacherAttentionItem[]>(() => {
    const studentItems = attention.map((student) => ({
      id: student.id,
      icon: student.reason === 'needs_help' ? 'alert-circle-outline' as const : 'time-outline' as const,
      color: student.reason === 'needs_help' ? '#F59E0B' : '#EC4899',
      title: student.studentName,
      detail: student.reason === 'no_activity'
        ? `Todavía no ha empezado ${student.subjectName}`
        : student.reason === 'needs_help'
          ? `${student.accuracyPercent}% de precisión en ${student.subjectName}`
          : `${student.daysInactive} días sin actividad en ${student.subjectName}`,
      actionLabel: 'Revisar',
    }))
    const emptyCourses = summary.emptyCourses.map((course) => ({
      id: `empty-course:${course.id}`,
      icon: 'people-outline' as const,
      color: '#38BDF8',
      title: course.name,
      detail: 'Curso activo sin alumnos inscritos',
      actionLabel: 'Abrir',
    }))
    return [...studentItems, ...emptyCourses].slice(0, 6)
  }, [attention, summary.emptyCourses])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-text-muted">Cargando resumen docente...</Text>
      </View>
    )
  }

  const primaryRoute = summary.openReviewCount > 0
    ? '/(teacher)/reviews'
    : summary.recentCourses[0]
      ? `/(teacher)/subject/add-question?subjectId=${summary.recentCourses[0].id}`
      : '/(teacher)/create-subject'

  return (
    <TeacherScreenLayout
      contentLabel="Inicio del profesor"
      desktopSidebar={isDesktop ? (
        <TeacherSidebar
          activeSection="home"
          subjectsCount={summary.totals.courses}
          onSignOut={() => supabase.auth.signOut()}
        />
      ) : undefined}
      mobileBottomNavigation={!isDesktop ? <TeacherBottomNav active="home" /> : undefined}
      isDesktop={isDesktop}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#8B5CF6" />}
    >
      <TeacherPageHeader
        icon="home"
        isDesktop={isDesktop}
        title={`¡Bienvenido de nuevo, ${summary.teacherAlias}!`}
        mobileTitle="Inicio"
        subtitle="Indicadores calculados en servidor para priorizar lo que requiere tu atención."
        notificationOnPress={() => router.push('/(teacher)/notifications' as never)}
      />

      {error ? (
        <View className="mb-4 rounded-xl border border-semantic-danger bg-semantic-surface-danger p-4">
          <Text className="font-bold text-semantic-danger">{error}</Text>
        </View>
      ) : null}

      <TeacherTodayFocus
        primaryLabel={summary.openReviewCount > 0 ? 'Revisar pendientes' : summary.totals.courses > 0 ? 'Crear pregunta' : 'Crear curso'}
        teacherAlias={summary.teacherAlias}
        onPrimary={() => router.push(primaryRoute as never)}
      />

      <TeacherPriorityOverview
        attentionItems={attentionItems}
        classroomsCount={summary.totals.classrooms}
        coursesCount={summary.totals.courses}
        isDesktop={isDesktop}
        openReviewCount={summary.openReviewCount}
        onOpenAttention={(item) => {
          if (item.id.startsWith('empty-course:')) {
            router.push(`/(teacher)/subject/${item.id.split(':')[1]}` as never)
            return
          }
          const student = attention.find((candidate) => candidate.id === item.id)
          router.push(student ? `/(teacher)/subject/${student.subjectId}?tab=students` as never : '/(teacher)/students' as never)
        }}
        onOpenClasses={() => router.push('/(teacher)/classes' as never)}
        onOpenReviews={() => router.push('/(teacher)/reviews' as never)}
        onOpenStudents={() => router.push('/(teacher)/students' as never)}
      />

      <View className={`${isDesktop ? 'flex-row' : ''} mt-7 gap-6`}>
        <View className={isDesktop ? 'min-w-0 flex-[1.5]' : ''}>
          <TeacherDashboardPanel title="Cursos recientes" actionLabel="Ver todos" onAction={() => router.push('/(teacher)/classes' as never)}>
            <TeacherRecentCourses courses={summary.recentCourses} />
          </TeacherDashboardPanel>
        </View>
        <View className={isDesktop ? 'min-w-0 flex-1 gap-6' : 'gap-6'}>
          <TeacherDashboardPanel title="Actividad reciente" actionLabel="Notificaciones" onAction={() => router.push('/(teacher)/notifications' as never)}>
            <TeacherRecentActivityList items={recentActivity} />
          </TeacherDashboardPanel>
          <TeacherDashboardPanel title="Preguntas a revisar" actionLabel="Cursos" onAction={() => router.push('/(teacher)/classes' as never)}>
            <TeacherProblemQuestions questions={summary.problematicQuestions} />
          </TeacherDashboardPanel>
        </View>
      </View>
    </TeacherScreenLayout>
  )
}
