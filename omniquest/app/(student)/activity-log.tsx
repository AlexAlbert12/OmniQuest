// Activity contracts are implemented in useStudentActivity with readThroughCache and memoized child components:
// fetchStudentAttemptHistoryPage(...), fetchActivityAttemptDetail(attemptId), buildActivityRows,
// ActivityDateHeader, PaginationControls, Comentarios del profesor, Pendiente de revisión,
// Feedback de aprendizaje.
import React, { useCallback } from 'react'
import { FlatList, Text, useWindowDimensions, View } from 'react-native'
import { useRouter } from 'expo-router'
import OmniGuide from '../../components/OmniGuide'
import PaginationControls from '../../components/ui/PaginationControls'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import StudentSidebar from '../../components/student/StudentSidebar'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import StudentScreenLayout from '../../components/layouts/StudentScreenLayout'
import ActivityDateHeader from '../../components/student/activity/ActivityDateHeader'
import StudentActivityAttemptRow from '../../components/student/activity/StudentActivityAttemptRow'
import StudentActivityFilters from '../../components/student/activity/StudentActivityFilters'
import type { ActivityListItem } from '../../components/student/activity/types'
import { normalizeSingleRelation } from '../../components/student/activity/utils'
import { STUDENT_ACTIVITY_PAGE_SIZE, useStudentActivity } from '../../hooks/student/useStudentActivity'
import { useAppTheme } from '../../lib/appTheme'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

export default function ActivityLogScreen() {
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const router = useRouter()
  const isDesktop = width >= 1024
  const activity = useStudentActivity()
  const { detailedAttempts, expandedAttemptId, loadingAttemptId, toggleAttempt } = activity

  const handlePractice = useCallback((item: ActivityListItem) => {
    if (item.kind !== 'attempt') return
    const question = normalizeSingleRelation(item.attempt.questions)
    if (!question?.subject_id) {
      router.push('/(student)/classes')
      return
    }
    router.push({ pathname: '/(student)/class/[id]', params: { id: String(question.subject_id) } } as any)
  }, [router])

  const renderItem = useCallback(({ item }: { item: ActivityListItem }) => {
    if (item.kind === 'date') return <ActivityDateHeader label={item.label} count={item.count} />
    const attempt = detailedAttempts[item.attempt.id] ?? item.attempt
    return (
      <StudentActivityAttemptRow
        attempt={attempt}
        isDesktop={isDesktop}
        isExpanded={expandedAttemptId === item.attempt.id}
        isDetailLoading={loadingAttemptId === item.attempt.id}
        onToggle={() => void toggleAttempt(item.attempt.id)}
        onPractice={() => handlePractice(item)}
      />
    )
  }, [detailedAttempts, expandedAttemptId, handlePractice, isDesktop, loadingAttemptId, toggleAttempt])

  const listHeader = (
    <View>
      <StudentPageHeader
        backAction={{ label: 'Volver', onPress: () => router.back() }}
        icon="time-outline"
        isDesktop={isDesktop}
        title="Historial de actividad"
        subtitle="Consulta tus intentos anteriores y vuelve a practicar desde el tema correspondiente."
      />
      {activity.error ? (
        <View className="mb-4">
          <AppStatusBanner
            variant="danger"
            title="No se pudo actualizar la actividad"
            message={activity.error}
            actionLabel="Reintentar"
            onAction={activity.refresh}
          />
        </View>
      ) : null}
      <StudentActivityFilters
        searchQuery={activity.searchQuery}
        onSearchChange={activity.setSearchQuery}
        statusFilter={activity.statusFilter}
        onStatusFilterChange={activity.setStatusFilter}
        statusCounts={activity.statusCounts}
        subjectOptions={activity.subjectFacets}
        selectedSubjectId={activity.selectedSubjectId}
        onSubjectChange={activity.setSelectedSubjectId}
        topicOptions={activity.topicFacets}
        selectedTopicId={activity.selectedTopicId}
        onTopicChange={activity.setSelectedTopicId}
        visibleCount={activity.attempts.length}
        totalCount={activity.total}
      />
    </View>
  )

  return (
    <StudentScreenLayout
      contentLabel="Historial de actividad del alumno"
      desktopSidebar={activity.profile ? (
        <StudentSidebar
          activeSection="profile"
          alias={activity.profile.alias || 'Estudiante'}
          avatar={activity.profile.avatar}
          level={activity.level}
          points={activity.points}
          nextLevelProgress={activity.nextLevelProgress}
          onSignOut={() => void signOutCurrentDeviceSession()}
        />
      ) : null}
      mobileBottomNavigation={<StudentBottomNav active="profile" />}
      isDesktop={isDesktop}
      loading={activity.loading}
      loadingLabel="Cargando actividad…"
      scroll={false}
      fluidContent
      horizontalPadding={isDesktop ? 28 : 18}
      topPadding={isDesktop ? 24 : 18}
      contentContainerStyle={{ flex: 1 }}
    >
      <FlatList
        data={activity.activityRows}
        keyExtractor={(item: ActivityListItem) => item.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        refreshing={activity.refreshing}
        onRefresh={activity.refresh}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={(
          <View className="mt-8 flex-1 items-center justify-center rounded-2xl border border-dashed p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
            <OmniGuide state="normal" autoBlink size={88} />
            <Text maxFontSizeMultiplier={2} className="mt-4 text-center text-[16px] font-bold" style={{ color: tokens.text.primary }}>
              No hay actividad con estos filtros
            </Text>
            <Text maxFontSizeMultiplier={2} className="mt-1 text-center text-[13px] leading-5" style={{ color: tokens.text.muted }}>
              Tus intentos aparecerán aquí. Cambia los filtros o inicia una práctica desde uno de tus cursos.
            </Text>
          </View>
        )}
        ListFooterComponent={(
          <PaginationControls
            compact={!isDesktop}
            page={activity.page}
            pageSize={STUDENT_ACTIVITY_PAGE_SIZE}
            total={activity.total}
            onPrevious={() => activity.setPage((value) => Math.max(0, value - 1))}
            onNext={() => activity.setPage((value) => value + 1)}
          />
        )}
      />
    </StudentScreenLayout>
  )
}
