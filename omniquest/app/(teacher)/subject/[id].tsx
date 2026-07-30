import React from 'react'
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import TeacherSidebar from '../../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../../components/teacher/TeacherPageHeader'
import TeacherScreenLayout from '../../../components/layouts/TeacherScreenLayout'
import TeacherStudentImportModal from '../../../components/teacher/TeacherStudentImportModal'
import AppButton from '../../../components/ui/AppButton'
import AppTabs from '../../../components/ui/AppTabs'
import SubjectSummaryTab from '../../../components/teacher/subject/SubjectSummaryTab'
import SubjectAnalyticsTab from '../../../components/teacher/subject/SubjectAnalyticsTab'
import SubjectTabState from '../../../components/teacher/subject/SubjectTabState'
import { SubjectQuestionsTab } from '../../../components/teacher/subject/SubjectQuestionsTab'
import { SubjectStudentsTab } from '../../../components/teacher/subject/SubjectStudentsTab'
import {
  SubjectAddQuestionCTA,
  SubjectClassroomsSection,
  SubjectTopicsSection,
} from '../../../components/teacher/subject/SubjectCourseStructure'
import {
  teacherSubjectTabItems,
  useTeacherSubjectDetail,
  type SubjectTabKey,
} from '../../../hooks/teacher/useTeacherSubjectDetail'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'

export default function SubjectDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; tab?: string | string[]; importStudents?: string | string[] }>()
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const subjectId = firstParam(params.id)
  const importStudents = firstParam(params.importStudents)
  const isDesktop = responsive.isDesktop
  const isWide = !responsive.isMobile

  const detail = useTeacherSubjectDetail({ subjectId, tab: params.tab })

  React.useEffect(() => {
    if (importStudents !== '1') return
    detail.setActiveTab('students')
    detail.setShowStudentImportModal(true)
  }, [detail.setActiveTab, detail.setShowStudentImportModal, importStudents])

  if (detail.loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary">
        <ActivityIndicator size="large" color={tokens.brand.teacher} />
        <Text className="mt-4 text-text-muted">Cargando curso...</Text>
      </View>
    )
  }

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
          <AppButton
            label="Volver a cursos"
            accessibilityLabel="Volver al listado de cursos"
            icon="arrow-back-outline"
            variant={loadFailed ? 'secondary' : 'primary'}
            role="teacher"
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
        bottomPadding={isDesktop ? 36 : 166}
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
          titleNumberOfLines={2}
          subtitle={`${subject.description || 'Curso sin descripción'} · Código: ${subject.code} · ${detail.classrooms.length} clase${detail.classrooms.length === 1 ? '' : 's'} · Clase activa: ${detail.selectedClassroom?.name || 'Sin clase'} · Creado ${formatDate(subject.created_at)}`}
          subtitleNumberOfLines={3}
          leading={(
            <View className={`${isDesktop ? 'h-20 w-20' : 'h-16 w-16'} items-center justify-center rounded-2xl border border-border-active bg-surface-selected`}>
              <Ionicons name={iconForSubject(subject.icon)} size={isDesktop ? 42 : 34} color={tokens.brand.teacher} />
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
                onPress={() => detail.showAlert('Código del curso', `Comparte este código con tus alumnos: ${subject.code}`)}
              />
              <AppButton
                label={isDesktop ? 'Editar curso' : undefined}
                accessibilityLabel="Editar curso"
                icon="create-outline"
                iconOnly={!isDesktop}
                role="teacher"
                onPress={() => router.push(`/(teacher)/edit-subject?id=${subject.id}` as never)}
              />
              {isDesktop ? <SubjectAddQuestionCTA href={addQuestionHref} /> : null}
            </>
          )}
        />

        <View className="mb-5">
          <AppTabs<SubjectTabKey>
            accessibilityLabel="Secciones del curso"
            items={teacherSubjectTabItems}
            onChange={changeTab}
            role="teacher"
            value={detail.activeTab}
          />
        </View>

        {detail.activeTab === 'summary' ? (
          <View className="gap-5">
            <SubjectClassroomsSection
              classrooms={detail.classrooms}
              creating={detail.creatingClassroom}
              newClassroomName={detail.newClassroomName}
              onCreate={detail.handleCreateClassroom}
              onNameChange={detail.setNewClassroomName}
              onSelect={(classroomId) => {
                detail.setSelectedClassroomId(classroomId)
                detail.setSelectedTopicId('all')
              }}
              selectedClassroomId={detail.selectedClassroomId}
            />
            <SubjectSummaryTab
              activity={detail.recentActivity}
              addQuestionHref={addQuestionHref}
              gradeDistribution={detail.gradeDistribution}
              isDesktop={isDesktop}
              onOpenAnalytics={() => changeTab('analytics')}
              onShowCode={() => detail.showAlert('Código del curso', `Comparte este código con tus alumnos: ${subject.code}`)}
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
            selectedTopicId={detail.selectedTopicId}
            topicRows={detail.topicRows}
          />
        ) : null}

        {!detail.tabLoading && !detail.tabError && detail.activeTab === 'questions' ? (
          <SubjectQuestionsTab
            filteredQuestions={detail.questions}
            isDesktop={isDesktop}
            onDeleteQuestion={detail.handleDelete}
            onDifficultyChange={detail.setSelectedDifficulty}
            questionsCount={detail.questionTotal}
            selectedClassroomId={detail.selectedClassroomId}
            selectedDifficulty={detail.selectedDifficulty}
            selectedTopicId={detail.selectedTopicId}
            selectedTopicLabel={detail.selectedTopicLabel}
            subjectId={subject.id}
            topics={detail.topics}
          />
        ) : null}

        {!detail.tabLoading && !detail.tabError && detail.activeTab === 'students' ? (
          <SubjectStudentsTab
            averageXp={detail.studentsSummary.averageXp}
            enrollmentsCount={detail.studentsSummary.enrolled}
            gradeDistribution={detail.gradeDistribution}
            isDesktop={isDesktop}
            isWide={isWide}
            onImportStudents={() => detail.setShowStudentImportModal(true)}
            onStudentSearchChange={detail.setStudentSearch}
            onStudentSortKeyChange={detail.setStudentSortKey}
            onStudentStatusFilterChange={detail.setStudentStatusFilter}
            questionsCount={detail.studentsSummary.questionsCount}
            reportParticipation={detail.studentsSummary.participation}
            scorePerformanceCount={detail.studentReportRows.filter((student) => student.hasActivity).length}
            scores={detail.scores}
            studentListRows={detail.studentListRows}
            studentReportRows={detail.studentReportRows}
            studentSearch={detail.studentSearch}
            studentSortKey={detail.studentSortKey}
            studentStatusFilter={detail.studentStatusFilter}
          />
        ) : null}

        {!detail.tabLoading && !detail.tabError && detail.activeTab === 'analytics' ? (
          <SubjectAnalyticsTab analytics={detail.analytics} isDesktop={isDesktop} />
        ) : null}
      </TeacherScreenLayout>

      {!isDesktop ? <SubjectAddQuestionCTA href={addQuestionHref} sticky /> : null}

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

function formatDate(value?: string | null) {
  if (!value) return 'sin fecha'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('es-ES') : 'sin fecha'
}

function iconForSubject(icon?: string | null): keyof typeof Ionicons.glyphMap {
  const normalized = (icon || '').toLowerCase()
  if (normalized.includes('math') || normalized.includes('calcul')) return 'calculator-outline'
  if (normalized.includes('language') || normalized.includes('book')) return 'book-outline'
  if (normalized.includes('science') || normalized.includes('flask')) return 'flask-outline'
  if (normalized.includes('history')) return 'time-outline'
  if (normalized.includes('tech') || normalized.includes('code')) return 'code-slash-outline'
  return 'school-outline'
}
