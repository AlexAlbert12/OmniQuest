import OmniLoadingScreen from '../../../components/ui/OmniLoadingScreen'
import React from 'react'
import { RefreshControl, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import TeacherSidebar from '../../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../../components/teacher/TeacherPageHeader'
import TeacherScreenLayout from '../../../components/layouts/TeacherScreenLayout'
import TeacherStudentImportModal from '../../../components/teacher/TeacherStudentImportModal'
import AppButton from '../../../components/ui/AppButton'
import AppBackButton from '../../../components/ui/AppBackButton'
import AppTabs from '../../../components/ui/AppTabs'
import SubjectSummaryTab from '../../../components/teacher/subject/SubjectSummaryTab'
import SubjectAnalyticsTab from '../../../components/teacher/subject/SubjectAnalyticsTab'
import SubjectTabState from '../../../components/teacher/subject/SubjectTabState'
import { SubjectQuestionsTab } from '../../../components/teacher/subject/SubjectQuestionsTab'
import { SubjectStudentsTab } from '../../../components/teacher/subject/SubjectStudentsTab'
import {
  SubjectClassroomContextSelector,
  SubjectClassroomsSection,
  SubjectTopicsSection,
} from '../../../components/teacher/subject/SubjectCourseStructure'
import {
  teacherSubjectTabItems,
  useTeacherSubjectDetail,
  type SubjectTabKey,
} from '../../../hooks/teacher/useTeacherSubjectDetail'
import { useAppTheme } from '../../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout'
import { useResponsiveLayout } from '../../../lib/responsive'

const STUDENTS_SPLIT_LAYOUT_MIN_WIDTH = 1600

export default function SubjectDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; tab?: string | string[]; classroomId?: string | string[]; importStudents?: string | string[] }>()
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const subjectId = firstParam(params.id)
  const importStudents = firstParam(params.importStudents)
  const isDesktop = responsive.isDesktop
  const isWide = responsive.width >= STUDENTS_SPLIT_LAYOUT_MIN_WIDTH

  const detail = useTeacherSubjectDetail({ subjectId, tab: params.tab, classroomId: params.classroomId })
  const { setActiveTab, setShowStudentImportModal } = detail

  React.useEffect(() => {
    if (importStudents !== '1') return
    setActiveTab('students')
    setShowStudentImportModal(true)
  }, [importStudents, setActiveTab, setShowStudentImportModal])

  if (detail.loading) return <OmniLoadingScreen />

  if (!detail.subject) {
    const loadFailed = Boolean(detail.tabError)
    return (
      <View className="flex-1 items-center justify-center bg-background-primary px-6">
        <Ionicons name={loadFailed ? 'cloud-offline-outline' : 'alert-circle-outline'} size={52} color={tokens.semantic.danger} />
        <Text className="mt-4 text-center text-xl font-black text-text-primary">
          {loadFailed ? 'No se pudo cargar el curso' : 'No se encontró este curso'}
        </Text>
        {loadFailed ? <Text className="mt-2 max-w-[520px] text-center text-text-muted">{detail.tabError}</Text> : null}
        <View className="mt-5 flex-row flex-wrap justify-center gap-3">
          {loadFailed ? (
            <AppButton
              label="Reintentar"
              accessibilityLabel="Reintentar la carga del curso"
              icon="refresh-outline"
              role="teacher"
              onPress={() => { void detail.fetchData() }}
            />
          ) : null}
          <AppBackButton
            label="Volver a cursos"
            accessibilityLabel="Volver al listado de cursos"
            onPress={() => router.replace('/(teacher)/classes' as never)}
          />
        </View>
      </View>
    )
  }

  const subject = detail.subject
  const addQuestionHref = buildAddQuestionHref({
    subjectId: subject.id,
    classroomId: detail.selectedClassroom?.id,
    topicId: detail.selectedTopicId,
    difficulty: detail.selectedDifficulty,
  })

  const changeTab = (tab: SubjectTabKey) => {
    detail.setActiveTab(tab)
    router.setParams({ tab } as any)
  }

  return (
    <View className="flex-1 bg-background-primary">
      <TeacherScreenLayout
        contentLabel={`Curso ${subject.name}`}
        desktopSidebar={(
          <TeacherSidebar
            activeSection="classes"
            subjectsCount={detail.subjectsCount}
            onSignOut={detail.handleSignOut}
          />
        )}
        mobileBottomNavigation={<TeacherBottomNav active="classes" />}
        isDesktop={isDesktop}
        horizontalPadding={isDesktop ? undefined : 14}
        bottomPadding={isDesktop ? 36 : MOBILE_BOTTOM_NAV_SPACER + 32}
        refreshControl={(
          <RefreshControl
            refreshing={detail.refreshing}
            onRefresh={detail.onRefresh}
            tintColor={tokens.brand.teacher}
          />
        )}
      >
        <TeacherPageHeader
          backAction={{ label: 'Cursos', onPress: () => router.push('/(teacher)/classes' as never) }}
          isDesktop={isDesktop}
          title={subject.name}
          titleNumberOfLines={isDesktop ? 2 : 1}
          mobileStackedIdentity
          compactMobileTitle
          leading={(
            <View className={`${isDesktop ? 'h-20 w-20' : 'h-14 w-14'} items-center justify-center rounded-2xl border border-border-active bg-surface-selected`}>
              <Ionicons name={normalizeAcademicIcon(subject.icon, 'school-outline')} size={isDesktop ? 42 : 30} color={tokens.brand.teacher} />
            </View>
          )}
          actions={(
            <>
              <AppButton
                accessibilityLabel="Abrir acciones del curso"
                icon="ellipsis-horizontal"
                iconOnly
                variant="secondary"
                onPress={detail.handleClassMenu}
              />
              <AppButton
                label={isDesktop ? 'Compartir código' : undefined}
                accessibilityLabel="Compartir código del curso"
                icon="share-social-outline"
                iconOnly={!isDesktop}
                variant="secondary"
                onPress={() => { void detail.handleShareCode() }}
              />
              <AppButton
                label={isDesktop ? 'Crear pregunta' : undefined}
                accessibilityLabel="Crear pregunta"
                icon="add-circle-outline"
                iconOnly={!isDesktop}
                role="teacher"
                onPress={() => router.push(addQuestionHref as never)}
              />
            </>
          )}
        />

        <SubjectClassroomContextSelector
          classrooms={detail.classrooms}
          selectedClassroomId={detail.selectedClassroomId}
          compact={!isDesktop}
          onSelect={(classroomId) => {
            detail.setSelectedClassroomId(classroomId)
            detail.setSelectedTopicId('all')
          }}
        />

        <View className="mb-5">
          <AppTabs<SubjectTabKey>
            accessibilityLabel="Secciones del curso"
            items={teacherSubjectTabItems}
            mobileRail={!isDesktop}
            onChange={changeTab}
            role="teacher"
            value={detail.activeTab}
          />
        </View>

        {detail.activeTab === 'summary' ? (
          <View className="gap-5">
            <SubjectClassroomsSection
              compact={!isDesktop}
              creating={detail.creatingClassroom}
              newClassroomName={detail.newClassroomName}
              onCreate={detail.handleCreateClassroom}
              onNameChange={detail.setNewClassroomName}
            />
            <SubjectSummaryTab
              activity={detail.recentActivity}
              addQuestionHref={addQuestionHref}
              gradeDistribution={detail.gradeDistribution}
              isDesktop={isDesktop}
              onOpenAnalytics={() => changeTab('analytics')}
              onCopyCode={() => { void detail.handleCopyCode() }}
              onShareCode={() => { void detail.handleShareCode() }}
              overview={detail.overview}
              subject={subject}
            />
          </View>
        ) : null}

        <SubjectTabState error={detail.tabError} loading={detail.tabLoading} />

        {!detail.tabLoading && !detail.tabError && detail.activeTab === 'topics' ? (
          <SubjectTopicsSection
            creating={detail.creatingTopic}
            newTopicAvailableUntil={detail.newTopicAvailableUntil}
            newTopicDescription={detail.newTopicDescription}
            newTopicDifficulty={detail.newTopicDifficulty}
            newTopicTitle={detail.newTopicTitle}
            onAvailableUntilChange={detail.setNewTopicAvailableUntil}
            onCreate={detail.handleCreateTopic}
            onDescriptionChange={detail.setNewTopicDescription}
            onDifficultyChange={detail.setNewTopicDifficulty}
            onOpenTopic={(topicId) => router.push(`/(teacher)/topic/${topicId}` as never)}
            onSelectTopic={(topicId) => {
              detail.setSelectedTopicId(topicId)
              changeTab('questions')
            }}
            onTitleChange={detail.setNewTopicTitle}
            selectedClassroomName={detail.selectedClassroom?.name}
            isMobile={!isDesktop}
            selectedTopicId={detail.selectedTopicId}
            topicRows={detail.topicRows}
          />
        ) : null}

        {!detail.tabLoading && !detail.tabError && detail.activeTab === 'questions' ? (
          <SubjectQuestionsTab
            filteredQuestions={detail.questions}
            onDeleteQuestion={detail.handleDelete}
            onDifficultyChange={detail.setSelectedDifficulty}
            onTopicChange={detail.setSelectedTopicId}
            selectedClassroomId={detail.selectedClassroomId}
            selectedDifficulty={detail.selectedDifficulty}
            selectedTopicId={detail.selectedTopicId}
            subjectId={subject.id}
            topics={detail.topics}
          />
        ) : null}

        {!detail.tabLoading && !detail.tabError && detail.activeTab === 'students' ? (
          <SubjectStudentsTab
            activeThisWeek={detail.studentsSummary.activeThisWeek}
            attentionStudents={detail.studentsSummary.attention}
            averageXp={detail.studentsSummary.averageXp}
            bestStudent={detail.studentsSummary.bestStudent}
            enrollmentsCount={detail.studentsSummary.enrolled}
            generatedXp={detail.studentsSummary.generatedXp}
            gradeDistribution={detail.gradeDistribution}
            isDesktop={isDesktop}
            isWide={isWide}
            onImportStudents={() => detail.setShowStudentImportModal(true)}
            onPageChange={detail.setStudentPage}
            onStudentSearchChange={detail.setStudentSearch}
            onStudentSortKeyChange={detail.setStudentSortKey}
            onStudentStatusFilterChange={detail.setStudentStatusFilter}
            page={detail.studentPage}
            pageSize={detail.studentPageSize}
            playedSessionsTotal={detail.studentsSummary.playedSessionsTotal}
            questionsCount={detail.studentsSummary.questionsCount}
            scorePerformanceCount={detail.studentsSummary.answered}
            studentListRows={detail.studentListRows}
            studentSearch={detail.studentSearch}
            studentSortKey={detail.studentSortKey}
            studentStatusFilter={detail.studentStatusFilter}
            totalStudents={detail.studentsTotal}
            unassessedCount={detail.studentsSummary.unassessed}
          />
        ) : null}

        {!detail.tabLoading && !detail.tabError && detail.activeTab === 'analytics' ? (
          <SubjectAnalyticsTab analytics={detail.analytics} isDesktop={isDesktop} />
        ) : null}
      </TeacherScreenLayout>

      <TeacherStudentImportModal
        visible={detail.showStudentImportModal}
        subjectId={subject.id}
        subjectName={subject.name}
        classroomId={detail.selectedClassroom?.id ?? null}
        classroomName={detail.selectedClassroom?.name ?? null}
        onClose={() => detail.setShowStudentImportModal(false)}
        onImported={detail.fetchData}
        onViewInactiveStudents={() => {
          detail.setShowStudentImportModal(false)
          changeTab('students')
          detail.setStudentStatusFilter('no_activity')
          detail.setStudentSortKey('last_activity')
        }}
      />
    </View>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function buildAddQuestionHref({
  classroomId,
  difficulty,
  subjectId,
  topicId,
}: {
  classroomId?: number | null
  difficulty: number | 'all'
  subjectId: number
  topicId: number | 'all' | 'general'
}) {
  return `/(teacher)/subject/add-question?subjectId=${subjectId}${classroomId ? `&classroomId=${classroomId}` : ''}${typeof topicId === 'number' ? `&topicId=${topicId}` : ''}${difficulty !== 'all' ? `&difficulty=${difficulty}` : ''}`
}
