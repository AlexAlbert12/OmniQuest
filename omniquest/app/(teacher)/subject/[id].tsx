import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MobileMetricCard from '../../../components/ui/mobile/MobileMetricCard'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout';
import { useAppTheme } from '../../../lib/appTheme';
import type { SemanticIconKey } from '../../../lib/designTokens';
import { exportCsvFile, exportMarkdownFile, formatExportDateTime, slugifyFilename } from '../../../lib/reportExports';
import {
  type EvolutionReport,
  type StudentReport,
} from '../../../lib/teacherSubjectAnalytics';
import TeacherSidebar from '../../../components/teacher/TeacherSidebar';
import TeacherBottomNav from '../../../components/teacher/TeacherBottomNav';
import TeacherPageHeader from '../../../components/teacher/TeacherPageHeader';
import TeacherStudentImportModal from '../../../components/teacher/TeacherStudentImportModal';
import AppButton from '../../../components/ui/AppButton';
import AppTabs from '../../../components/ui/AppTabs';
import { GradeDistributionBars, SubjectPanel as Panel, type IconName } from '../../../components/teacher/subject/SubjectShared';
import { SubjectQuestionsPanel, SubjectQuestionsTab } from '../../../components/teacher/subject/SubjectQuestionsTab';
import { SubjectStudentsTab } from '../../../components/teacher/subject/SubjectStudentsTab';
import {
  SubjectAddQuestionCTA,
  SubjectClassroomsSection,
  SubjectTopicsSection,
} from '../../../components/teacher/subject/SubjectCourseStructure';
import {
  teacherSubjectTabItems,
  useTeacherSubjectDetail,
  type FailedQuestionReport,
  type ManualReviewRow,
  type Subject,
} from '../../../hooks/teacher/useTeacherSubjectDetail';

const INSUFFICIENT_TREND_DATA = 'Datos disponibles cuando haya actividad suficiente'

export default function SubjectDetailScreen() {
  const { id, tab, importStudents } = useLocalSearchParams<{ id: string; tab?: string; importStudents?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { tokens } = useAppTheme();

  const isDesktop = width >= 1080;
  const isWide = width >= 900;
  const subjectId = Array.isArray(id) ? id[0] : id;
  const {
    activeTab,
    answeredClassQuestions,
    averageAccuracy,
    averageGrade,
    averageXp,
    classrooms,
    creatingClassroom,
    creatingTopic,
    enrollments,
    failedQuestionRows,
    fetchData,
    filteredQuestions,
    gradeDistribution,
    handleClassMenu,
    handleCreateClassroom,
    handleCreateTopic,
    handleDelete,
    handleReviewOpenAttempt,
    handleSignOut,
    latestQuestion,
    loading,
    manualReviewPendingCount,
    manualReviewReviewedCount,
    manualReviewRows,
    newClassroomName,
    newTopicAvailableUntil,
    newTopicDescription,
    newTopicDifficulty,
    newTopicTitle,
    onRefresh,
    participation,
    possibleClassQuestions,
    progress,
    questions,
    recentActivity,
    refreshing,
    reportSummary,
    reviewingAttemptId,
    scorePerformanceRows,
    scores,
    selectedClassroom,
    selectedClassroomId,
    selectedDifficulty,
    selectedTopicId,
    selectedTopicLabel,
    setActiveTab,
    setNewClassroomName,
    setNewTopicAvailableUntil,
    setNewTopicDescription,
    setNewTopicDifficulty,
    setNewTopicTitle,
    setSelectedClassroomId,
    setSelectedDifficulty,
    setSelectedTopicId,
    setShowStudentImportModal,
    setStudentSearch,
    setStudentSortKey,
    setStudentStatusFilter,
    showAlert,
    showStudentImportModal,
    studentListRows,
    studentReportRows,
    studentSearch,
    studentSortKey,
    studentStatusFilter,
    subject,
    subjectsCount,
    temporalEvolution,
    topicRows,
    topics,
  } = useTeacherSubjectDetail({ subjectId, tab });


  React.useEffect(() => {
    const shouldOpenImport = Array.isArray(importStudents) ? importStudents[0] === '1' : importStudents === '1';
    if (!shouldOpenImport) return;
    setActiveTab('students');
    setShowStudentImportModal(true);
  }, [importStudents, setActiveTab, setShowStudentImportModal]);


  const handleExportClassRankingCsv = async (currentSubject: Subject) => {
    const classroomName = selectedClassroom?.name || 'Todas las clases'
    const exportedAt = new Date().toISOString().slice(0, 10)
    const filename = `omniquest_ranking_${slugifyFilename(currentSubject.name)}_${slugifyFilename(classroomName)}_${exportedAt}.csv`

    const rows = studentReportRows
      .slice()
      .sort((a, b) => b.score - a.score || b.grade - a.grade || a.name.localeCompare(b.name))
      .map((student, index) => [
        index + 1,
        currentSubject.id,
        currentSubject.name,
        classroomName,
        student.id,
        student.name,
        student.score,
        student.grade.toFixed(1),
        student.accuracyPercent,
        student.correctAnswers,
        student.failedAnswers,
        student.participation,
        student.playedSessions,
        student.hasActivity ? 'Sí' : 'No',
        formatExportDateTime(student.lastActivity || null),
      ])

    const exported = await exportCsvFile(
      filename,
      [
        'Puesto',
        'Curso_ID',
        'Curso',
        'Clase',
        'Alumno_ID',
        'Alumno',
        'XP',
        'Nota',
        'Precision_pct',
        'Correctas',
        'Fallos',
        'Participacion_pct',
        'Sesiones',
        'Tiene_actividad',
        'Ultima_actividad',
      ],
      rows
    )

    if (!exported) {
      showAlert('No se pudo compartir el archivo', 'En web se descarga como CSV. En móvil, revisa que el dispositivo tenga opciones para compartir archivos.')
    }
  }

  const handleExportWeeklyTeacherSummary = async (currentSubject: Subject) => {
    const classroomName = selectedClassroom?.name || 'Todas las clases'
    const exportedAt = new Date()
    const exportedDate = exportedAt.toLocaleDateString('es-ES')
    const filename = `omniquest_resumen_docente_${slugifyFilename(currentSubject.name)}_${exportedAt.toISOString().slice(0, 10)}.md`
    const studentsNeedingSupport = studentReportRows
      .filter((student) => student.hasActivity && (student.grade < 5 || student.accuracyPercent < 45 || student.failedAnswers >= 3))
      .sort((a, b) => a.grade - b.grade || b.failedAnswers - a.failedAnswers)
      .slice(0, 8)
    const inactiveStudents = studentReportRows
      .filter((student) => !student.hasActivity)
      .slice(0, 8)
    const topFailedQuestions = failedQuestionRows.slice(0, 8)

    const lines = [
      `# Resumen docente semanal`,
      ``,
      `**Curso:** ${currentSubject.name}`,
      `**Clase:** ${classroomName}`,
      `**Generado:** ${exportedDate}`,
      ``,
      `## Indicadores`,
      `- Alumnos evaluados: ${reportSummary.answered}/${reportSummary.enrolled}`,
      `- Participación: ${reportSummary.participation}%`,
      `- Nota media: ${reportSummary.averageGrade.toFixed(1)}/10`,
      `- Precisión media: ${reportSummary.averageAccuracy}%`,
      `- Respuestas correctas: ${reportSummary.correctAnswers}`,
      `- Fallos registrados: ${reportSummary.failedAnswers}`,
      `- XP media: ${averageXp.toLocaleString('es-ES')}`,
      ``,
      `## Alumnos que requieren seguimiento`,
      ...(studentsNeedingSupport.length > 0
        ? studentsNeedingSupport.map((student, index) => `${index + 1}. ${student.name}: nota ${student.grade.toFixed(1)}, ${student.accuracyPercent}% precisión, ${student.failedAnswers} fallos.`)
        : ['- Sin alumnos críticos con los datos actuales.']),
      ``,
      `## Alumnos sin actividad`,
      ...(inactiveStudents.length > 0
        ? inactiveStudents.map((student, index) => `${index + 1}. ${student.name}`)
        : ['- No hay alumnos sin actividad en este curso/clase.']),
      ``,
      `## Preguntas más falladas`,
      ...(topFailedQuestions.length > 0
        ? topFailedQuestions.map((question, index) => `${index + 1}. ${question.text} — ${question.failureRate}% fallo (${question.actualFailures}/${question.totalAttempts}).`)
        : ['- No hay fallos suficientes para destacar preguntas.']),
      ``,
      `## Evolución reciente`,
      ...(temporalEvolution.length > 0
        ? temporalEvolution.map((item) => `- ${item.label}: ${item.activityCount} actividades, media ${item.averageScore}.`)
        : ['- Todavía no hay datos suficientes de evolución.']),
      ``,
      `## Próximas acciones sugeridas`,
      `- Revisar las preguntas con mayor tasa de fallo y crear una pregunta de repaso si procede.`,
      `- Contactar o recordar acceso a alumnos sin actividad.`,
      `- Priorizar temas con baja precisión antes de añadir contenido nuevo.`,
      ``,
    ]

    const exported = await exportMarkdownFile(filename, lines.join('\n'))

    if (!exported) {
      showAlert('No se pudo compartir el archivo', 'En web se descarga como Markdown. En móvil, revisa que el dispositivo tenga opciones para compartir archivos.')
    }
  }

  const renderTabContent = (currentSubject: Subject) => {
    if (activeTab === 'students') {
      return (
        <SubjectStudentsTab
          averageXp={averageXp}
          enrollmentsCount={enrollments.length}
          gradeDistribution={gradeDistribution}
          isDesktop={isDesktop}
          isWide={isWide}
          onImportStudents={() => setShowStudentImportModal(true)}
          onStudentSearchChange={setStudentSearch}
          onStudentSortKeyChange={setStudentSortKey}
          onStudentStatusFilterChange={setStudentStatusFilter}
          questionsCount={questions.length}
          reportParticipation={reportSummary.participation}
          scorePerformanceCount={scorePerformanceRows.length}
          scores={scores}
          studentListRows={studentListRows}
          studentReportRows={studentReportRows}
          studentSearch={studentSearch}
          studentSortKey={studentSortKey}
          studentStatusFilter={studentStatusFilter}
        />
      );
    }

    if (activeTab === 'activities') {
      return (
        <View className="gap-5">
          <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
          <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
            <Panel title="Actividad reciente">
              {recentActivity.map((item, index) => (
                <ActivityRow key={`${item.title}-${index}`} {...item} />
              ))}
            </Panel>
          </View>

          <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
            <Panel title="Actividad por tema">
              {topicRows.length > 0 ? (
                topicRows.map((topic) => (
                  <View key={String(topic.id)} className="flex-row items-center justify-between border-b border-border-subtle py-3">
                    <View className="min-w-0 flex-1 pr-3">
                      <Text className="font-semibold text-text-primary">{topic.title}</Text>
                      <Text className="mt-1 text-[11px] text-text-muted">{topic.questionsCount} preguntas</Text>
                    </View>
                    <Text className="text-[12px] font-bold text-brand-teacher">{topic.playedCount} jugados</Text>
                  </View>
                ))
              ) : (
                <Text className="text-[12px] text-text-muted">Aún no hay temas para analizar actividad.</Text>
              )}
            </Panel>
          </View>
          </View>
        </View>
      );
    }

    if (activeTab === 'questions') {
      return (
        <SubjectQuestionsTab
          filteredQuestions={filteredQuestions}
          isDesktop={isDesktop}
          onDeleteQuestion={handleDelete}
          onDifficultyChange={setSelectedDifficulty}
          questionsCount={questions.length}
          selectedClassroomId={selectedClassroom?.id}
          selectedDifficulty={selectedDifficulty}
          selectedTopicId={selectedTopicId}
          selectedTopicLabel={selectedTopicLabel}
          subjectId={currentSubject.id}
          topics={topics}
        />
      );
    }

    if (activeTab === 'analytics' || activeTab === 'reports') {
      return (
        <View className="gap-5">
          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <ReportMetricCard icon="people" label="Alumnos evaluados" value={`${reportSummary.answered}/${reportSummary.enrolled}`} color={tokens.semantic.info} detail={`${reportSummary.participation}% participación`} />
            <ReportMetricCard icon="shield-checkmark" label="Nota media" value={reportSummary.averageGrade.toFixed(1)} suffix="/10" color={tokens.semantic.warning} detail={`${reportSummary.averageAccuracy}% precisión media`} />
            <ReportMetricCard icon="close-circle" label="Preguntas falladas" value={String(reportSummary.failedAnswers)} color={tokens.semantic.danger} detail={`${reportSummary.correctAnswers} correctas registradas`} />
            <ReportMetricCard icon="star" label="XP media" value={`${averageXp.toLocaleString('es-ES')}`} color={tokens.brand.teacher} detail="puntos con bonus aparte" />
          </View>

          <ReportExportActions
            onExportRanking={() => handleExportClassRankingCsv(currentSubject)}
            onExportWeeklySummary={() => handleExportWeeklyTeacherSummary(currentSubject)}
          />

          <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
            <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
              <Panel title="Métricas por alumno">
                {studentReportRows.length > 0 ? (
                  <View className="gap-3">
                    {studentReportRows.map((student, index) => (
                      <StudentReportRow key={student.id} student={student} index={index} />
                    ))}
                  </View>
                ) : (
                  <Text className="text-[12px] text-text-muted">Aún no hay alumnos inscritos para generar métricas.</Text>
                )}
              </Panel>

              <Panel title="Evolución temporal">
                <View className="gap-3">
                  {temporalEvolution.map((item) => (
                    <EvolutionRow key={item.label} item={item} maxValue={Math.max(1, reportSummary.enrolled)} />
                  ))}
                </View>
              </Panel>
            </View>

            <View className={isDesktop ? 'w-[380px] gap-5' : 'gap-5'}>
              <Panel title="Preguntas más falladas">
                {failedQuestionRows.length > 0 ? (
                  <View className="gap-3">
                    {failedQuestionRows.map((question) => (
                      <FailedQuestionRow key={question.id} question={question} />
                    ))}
                  </View>
                ) : (
                  <Text className="text-[12px] text-text-muted">No hay fallos registrados en attempt_history todavía.</Text>
                )}
              </Panel>

              <Panel title="Distribución de notas">
                <GradeDistributionBars distribution={gradeDistribution} total={scorePerformanceRows.length} />
              </Panel>
            </View>
          </View>
        </View>
      );
    }

    if (activeTab === 'review') {
      return (
        <View className="gap-5">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(teacher)/reviews' as any)}
            className="flex-row items-center justify-between rounded-2xl border border-border-active bg-surface-selected p-4"
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface-interactive">
                <Ionicons name="create-outline" size={23} color={tokens.brand.teacher} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-black text-text-primary">Abrir cola avanzada de revisión</Text>
                <Text className="mt-1 text-[12px] text-text-secondary">Estados, comentarios visibles, notas internas y paginación.</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={21} color={tokens.brand.teacher} />
          </Pressable>
          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <ReportMetricCard
              icon="time"
              label="Pendientes"
              value={String(manualReviewPendingCount)}
              color={tokens.semantic.warning}
              detail="Respuestas abiertas sin corregir"
            />
            <ReportMetricCard
              icon="checkmark-done"
              label="Revisadas"
              value={String(manualReviewReviewedCount)}
              color={tokens.semantic.success}
              detail="Marcadas como correctas o fallidas"
            />
            <ReportMetricCard
              icon="chatbox-ellipses"
              label="Total abiertas"
              value={String(manualReviewRows.length)}
              color={tokens.semantic.info}
              detail="Últimas respuestas recibidas"
            />
          </View>

          <Panel title="Corrección de respuestas abiertas">
            {manualReviewRows.length === 0 ? (
              <View className="items-center rounded-xl border border-dashed border-border-default bg-surface-default p-8">
                <Ionicons name="chatbox-ellipses-outline" size={44} color={tokens.text.muted} />
                <Text className="mt-3 text-center font-bold text-text-primary">No hay respuestas abiertas para revisar</Text>
                <Text className="mt-1 text-center text-[12px] text-text-muted">
                  Cuando un alumno responda una pregunta abierta, aparecerá aquí para que puedas corregirla.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {manualReviewRows.map((row) => (
                  <ManualReviewRowCard
                    key={row.id}
                    row={row}
                    busy={reviewingAttemptId === row.id}
                    onApprove={() => handleReviewOpenAttempt(row.id, true)}
                    onReject={() => handleReviewOpenAttempt(row.id, false)}
                  />
                ))}
              </View>
            )}
          </Panel>
        </View>
      );
    }

    if (activeTab === 'resources') {
      return (
        <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
          <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
            <Panel title="Recursos del curso">
              <View className="gap-3">
                <Pressable
                  onPress={() => router.push(`/(teacher)/edit-subject?id=${currentSubject.id}` as any)}
                  className="rounded-xl border border-border-default bg-surface-default px-4 py-3"
                >
                  <Text className="font-bold text-text-primary">Editar información del curso</Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab('students')}
                  className="rounded-xl border border-border-default bg-surface-default px-4 py-3"
                >
                  <Text className="font-bold text-text-primary">Gestionar alumnos</Text>
                </Pressable>
                <Pressable
                  onPress={() => showAlert('Código del curso', currentSubject.code)}
                  className="rounded-xl border border-border-active bg-surface-selected px-4 py-3"
                >
                  <Text className="font-bold text-brand-teacher">Ver código de acceso</Text>
                </Pressable>
              </View>
            </Panel>
          </View>

          <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
            <Panel title="Temas disponibles">
              {topicRows.length > 0 ? (
                topicRows.map((topic) => (
                  <View key={String(topic.id)} className="border-b border-border-subtle py-3">
                    <Text className="font-semibold text-text-primary">{topic.title}</Text>
                    <Text className="mt-1 text-[11px] text-text-muted">{topic.questionsCount} preguntas</Text>
                  </View>
                ))
              ) : (
                <Text className="text-[12px] text-text-muted">Sin temas todavía.</Text>
              )}
            </Panel>
          </View>
        </View>
      );
    }

    if (activeTab === 'settings') {
      return (
        <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
          <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
            <Panel title="Configuración del curso">
              <View className="gap-3">
                <Pressable
                  onPress={() => router.push(`/(teacher)/edit-subject?id=${currentSubject.id}` as any)}
                  className="rounded-xl bg-brand-teacher px-4 py-3"
                >
                  <Text className="text-center font-bold text-text-inverse">Editar curso</Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab('students')}
                  className="rounded-xl border border-border-default bg-surface-default px-4 py-3"
                >
                  <Text className="text-center font-bold text-text-primary">Gestionar estudiantes</Text>
                </Pressable>
                <Pressable
                  onPress={() => showAlert('Código del curso', `Comparte este código con tus alumnos: ${currentSubject.code}`)}
                  className="rounded-xl border border-border-active bg-surface-selected px-4 py-3"
                >
                  <Text className="text-center font-bold text-brand-teacher">Compartir código</Text>
                </Pressable>
              </View>
            </Panel>
          </View>
        </View>
      );
    }

    return (
      <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
        <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
          <Panel
            title="Actividad reciente"
            actionLabel="Ver todo"
            onAction={() => setActiveTab('analytics')}
          >
            {recentActivity.map((item, index) => (
              <ActivityRow key={`${item.title}-${index}`} {...item} />
            ))}
          </Panel>

          <View className="rounded-xl border border-border-default bg-surface-default p-5">
            <View className="flex-row flex-wrap items-center gap-4">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-semantic-surface-danger">
                <Ionicons name="radio-button-on" size={27} color={tokens.semantic.danger} />
              </View>
              <View className="min-w-[220px] flex-1">
                <Text className="text-[12px] font-semibold text-text-secondary">Última pregunta creada</Text>
                <Text className="mt-1 text-[20px] font-black text-text-primary">{latestQuestion?.text || 'Crea la primera pregunta'}</Text>
              </View>
              <InfoStack label="Progreso de la clase" value={`${progress}%`} />
              <InfoStack label="Participación" value={`${scores.length} / ${Math.max(enrollments.length, 1)}`} />
              <Link
                href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${selectedClassroom?.id ? `&classroomId=${selectedClassroom.id}` : ''}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`}
                asChild
              >
                <Pressable className="rounded-xl bg-surface-selected px-5 py-3">
                  <Text className="text-[12px] font-bold text-text-primary">Nueva pregunta</Text>
                </Pressable>
              </Link>
            </View>
            <View className="mt-4 h-2 overflow-hidden rounded-full bg-surface-interactive">
              <View className="h-full rounded-full bg-brand-teacher" style={{ width: `${Math.min(progress, 100)}%` }} />
            </View>
            <Text className="mt-3 text-[12px] text-text-muted">
              {answeredClassQuestions} de {possibleClassQuestions} preguntas posibles respondidas
            </Text>
          </View>

          <SubjectQuestionsPanel
            addQuestionHref={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${selectedClassroom?.id ? `&classroomId=${selectedClassroom.id}` : ''}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`}
            filteredQuestions={filteredQuestions}
            onDeleteQuestion={handleDelete}
            onDifficultyChange={setSelectedDifficulty}
            selectedDifficulty={selectedDifficulty}
            selectedTopicLabel={selectedTopicLabel}
            subjectId={currentSubject.id}
            topics={topics}
          />
        </View>

        <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
          <Panel title="Distribución de notas">
            <GradeDistributionBars distribution={gradeDistribution} total={scorePerformanceRows.length} />
          </Panel>

          <View className="rounded-xl border border-border-active bg-surface-selected p-5">
            <View className="mb-3 flex-row items-center gap-3">
              <Ionicons name="qr-code-outline" size={24} color={tokens.brand.teacher} />
              <Text className="font-black text-text-primary">Código del curso</Text>
            </View>
            <Text className="text-[12px] leading-5 text-text-secondary">
              Comparte este código con tus alumnos para que se unan al curso.
            </Text>
            <View className="mt-4 flex-row items-center gap-3">
              <View className="rounded-lg bg-surface-default px-4 py-3">
                <Text className="font-mono font-black text-brand-teacher">{currentSubject.code}</Text>
              </View>
              <Pressable
                onPress={() => showAlert('Código del curso', currentSubject.code)}
                className="flex-row items-center gap-2 rounded-lg border border-border-active px-4 py-3"
              >
                <Text className="text-[12px] font-bold text-brand-teacher">Copiar</Text>
                <Ionicons name="copy-outline" size={15} color={tokens.brand.teacher} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary">
        <ActivityIndicator size="large" color={tokens.brand.teacher} />
        <Text className="mt-4 text-text-muted">Cargando curso...</Text>
      </View>
    );
  }

  if (!subject) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary px-6">
        <Ionicons name="alert-circle-outline" size={52} color={tokens.semantic.danger} />
        <Text className="mt-4 text-center text-xl font-black text-text-primary">No se encontró este curso</Text>
        <Pressable onPress={() => router.replace('/(teacher)/classes' as any)} className="mt-5 rounded-xl bg-brand-teacher px-5 py-3">
          <Text className="font-bold text-text-inverse">Volver a Cursos</Text>
        </Pressable>
      </View>
    );
  }

  const currentSubject = subject;
  const addQuestionHref = `/(teacher)/subject/add-question?subjectId=${currentSubject.id}${selectedClassroom?.id ? `&classroomId=${selectedClassroom.id}` : ''}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`;
  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            activeSection="classes"
            subjectsCount={subjectsCount}
            onSignOut={handleSignOut}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 14,
            paddingTop: isDesktop ? 22 : 18,
            paddingBottom: isDesktop ? 36 : MOBILE_BOTTOM_NAV_SPACER + 84,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.teacher} />}
          showsVerticalScrollIndicator={false}
        >
          <TeacherPageHeader
            backAction={{ label: 'Cursos', onPress: () => router.push('/(teacher)/classes' as any) }}
            isDesktop={isDesktop}
            title={currentSubject.name}
            subtitle={`${currentSubject.description || 'Curso sin descripción'} · Código: ${currentSubject.code} · ${classrooms.length} clase${classrooms.length === 1 ? '' : 's'} · Clase activa: ${selectedClassroom?.name || 'Sin clase'} · Creado ${formatDate(currentSubject.created_at)}`}
            titleNumberOfLines={2}
            subtitleNumberOfLines={3}
            leading={(
              <View className={`${isDesktop ? 'h-20 w-20' : 'h-16 w-16'} items-center justify-center rounded-2xl border border-border-active bg-surface-selected`}>
                <Ionicons name={iconForSubject(currentSubject.icon)} size={isDesktop ? 42 : 34} color={tokens.brand.teacher} />
              </View>
            )}
            actions={(
              <>
                <AppButton
                  accessibilityLabel="Abrir acciones del curso"
                  icon="ellipsis-horizontal"
                  iconOnly
                  variant="secondary"
                  onPress={handleClassMenu}
                />
                <AppButton
                  label={isDesktop ? 'Compartir código' : undefined}
                  accessibilityLabel="Compartir código del curso"
                  icon="share-social-outline"
                  iconOnly={!isDesktop}
                  variant="secondary"
                  onPress={() => showAlert('Código del curso', `Comparte este código con tus alumnos: ${currentSubject.code}`)}
                />
                <AppButton
                  label={isDesktop ? 'Editar curso' : undefined}
                  accessibilityLabel="Editar curso"
                  icon="create-outline"
                  iconOnly={!isDesktop}
                  role="teacher"
                  onPress={() => router.push(`/(teacher)/edit-subject?id=${currentSubject.id}` as any)}
                />
                {isDesktop ? (
                  <SubjectAddQuestionCTA href={addQuestionHref} />
                ) : null}
              </>
            )}
          />

          <View className="mb-5">
            <AppTabs
              accessibilityLabel="Secciones del curso"
              items={teacherSubjectTabItems.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.icon }))}
              onChange={setActiveTab}
              role="teacher"
              value={activeTab}
            />
          </View>

          {activeTab === 'summary' ? (
            <>
              <SubjectClassroomsSection
                classrooms={classrooms}
                creating={creatingClassroom}
                newClassroomName={newClassroomName}
                onCreate={handleCreateClassroom}
                onNameChange={setNewClassroomName}
                onSelect={(classroomId) => {
                  setSelectedClassroomId(classroomId);
                  setSelectedTopicId('all');
                }}
                selectedClassroomId={selectedClassroomId}
              />
              <View className={isDesktop ? 'mb-5 flex-row gap-4' : 'mb-5 flex-row gap-3'}>
                {isDesktop ? (
                  <>
                    <MetricCard semantic="success" label="Precisión media" value={`${averageAccuracy}%`} detail="Aciertos sobre respuestas estimadas" />
                    <MetricCard semantic="achievement" label="Nota media" value={averageGrade.toFixed(1)} suffix="/10" detail="Calculada por precisión" />
                    <MetricCard semantic="xp" label="XP media" value={`${averageXp.toLocaleString('es-ES')} pts`} detail="Puntos y bonus separados" />
                    <MetricCard icon="radio-button-on" label="Preguntas respondidas" value={`${answeredClassQuestions}/${possibleClassQuestions}`} color={tokens.semantic.info} detail="Respuestas sobre preguntas posibles" />
                    <MetricCard semantic="student" label="Participación" value={`${participation}%`} detail={INSUFFICIENT_TREND_DATA} />
                  </>
                ) : (
                  <>
                    <MetricCard semantic="student" label="Participación" value={`${participation}%`} detail="Alumnos con actividad" />
                    <MetricCard icon="radio-button-on" label="Respondidas" value={`${answeredClassQuestions}/${possibleClassQuestions}`} color={tokens.semantic.info} detail="Progreso de la clase" />
                  </>
                )}
              </View>
            </>
          ) : null}

          {activeTab === 'topics' ? (
            <SubjectTopicsSection
              creating={creatingTopic}
              newTopicAvailableUntil={newTopicAvailableUntil}
              newTopicDescription={newTopicDescription}
              newTopicDifficulty={newTopicDifficulty}
              newTopicTitle={newTopicTitle}
              onAvailableUntilChange={setNewTopicAvailableUntil}
              onCreate={handleCreateTopic}
              onDescriptionChange={setNewTopicDescription}
              onDifficultyChange={setNewTopicDifficulty}
              onOpenTopic={(topicId) => router.push(`/(teacher)/topic/${topicId}` as any)}
              onSelectTopic={setSelectedTopicId}
              onTitleChange={setNewTopicTitle}
              selectedClassroomName={selectedClassroom?.name}
              selectedTopicId={selectedTopicId}
              topicRows={topicRows}
            />
          ) : null}

          {renderTabContent(currentSubject)}
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="classes" /> : null}
      {!isDesktop ? <SubjectAddQuestionCTA href={addQuestionHref} sticky /> : null}
      <TeacherStudentImportModal
        visible={showStudentImportModal}
        subjectId={currentSubject.id}
        subjectName={currentSubject.name}
        classroomId={selectedClassroom?.id ?? null}
        classroomName={selectedClassroom?.name ?? null}
        onClose={() => setShowStudentImportModal(false)}
        onImported={fetchData}
        onViewInactiveStudents={() => {
          setShowStudentImportModal(false);
          setActiveTab('students');
          setStudentStatusFilter('no_activity');
          setStudentSortKey('last_activity');
        }}
      />
    </View>
  );
}

function MetricCard({ icon, semantic, label, value, suffix, color, detail }: {
  icon?: keyof typeof Ionicons.glyphMap
  semantic?: SemanticIconKey
  label: string
  value: string
  suffix?: string
  color?: string
  detail?: string
}) {
  return (
    <MobileMetricCard
      className="min-w-[190px] flex-1"
      color={color}
      detail={detail}
      icon={icon}
      semantic={semantic}
      label={label}
      suffix={suffix}
      value={value}
    />
  )
}


function ReportExportActions({
  onExportRanking,
  onExportWeeklySummary,
}: {
  onExportRanking: () => void
  onExportWeeklySummary: () => void
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="mb-3 flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-semantic-surface-info">
          <Ionicons name="download-outline" size={21} color={tokens.semantic.info} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-black text-text-primary">Exportación docente</Text>
          <Text className="mt-1 text-[12px] text-text-muted">Descarga datos del curso o genera un resumen semanal listo para revisar.</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-3">
        <Pressable
          onPress={onExportRanking}
          className="flex-row items-center gap-2 rounded-xl bg-brand-teacher px-4 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="podium-outline" size={16} color={tokens.text.inverse} />
          <Text className="text-[12px] font-black text-text-inverse">Exportar ranking/clase</Text>
        </Pressable>
        <Pressable
          onPress={onExportWeeklySummary}
          className="flex-row items-center gap-2 rounded-xl border border-semantic-info bg-semantic-surface-info px-4 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="document-text-outline" size={16} color={tokens.semantic.info} />
          <Text className="text-[12px] font-black text-semantic-info">Resumen semanal</Text>
        </Pressable>
      </View>
    </View>
  )
}

function ReportMetricCard({ icon, label, value, suffix, color, detail }: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  suffix?: string
  color: string
  detail?: string
}) {
  return (
    <MobileMetricCard
      className="min-w-[190px] flex-1"
      color={color}
      detail={detail}
      icon={icon}
      label={label}
      suffix={suffix}
      value={value}
    />
  )
}

function ActivityRow({
  icon,
  color,
  title,
  detail,
  meta,
  time,
  warning,
}: {
  icon: IconName
  color: string
  title: string
  detail: string
  meta: string
  time: string
  warning: boolean
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border-subtle py-3">
      <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}30` }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-text-primary">{title}</Text>
        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-[12px] text-text-secondary">{detail}</Text>
          {warning ? (
            <View className="rounded-md bg-semantic-surface-danger px-2 py-1">
              <Text className="text-[10px] font-bold text-semantic-danger">Necesita apoyo</Text>
            </View>
          ) : null}
        </View>
      </View>
      {meta ? <Text className="text-[12px] font-bold text-brand-teacher">{meta}</Text> : null}
      <Text className="text-[11px] text-text-muted">{time}</Text>
    </View>
  );
}

function InfoStack({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[110px]">
      <Text className="text-[12px] text-text-secondary">{label}</Text>
      <Text className="mt-1 text-[18px] font-black text-text-primary">{value}</Text>
    </View>
  );
}

function StudentReportRow({ student, index }: { student: StudentReport; index: number }) {
  const { tokens } = useAppTheme()
  const statusColor = student.hasActivity ? tokens.semantic.success : tokens.semantic.warning;
  const statusLabel = student.hasActivity ? 'Activo' : 'Pendiente';

  return (
    <View className="flex-row flex-wrap items-center gap-4 rounded-xl border border-border-default bg-surface-default p-4">
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-surface-selected">
        <Text className="font-black text-brand-teacher">{index + 1}</Text>
      </View>
      <View className="min-w-[180px] flex-1">
        <Text className="font-black text-text-primary" numberOfLines={1}>{student.name}</Text>
        <Text className="mt-1 text-[11px] text-text-muted">
          {student.lastActivity ? `Última actividad: ${formatDate(student.lastActivity)}` : 'Sin actividad registrada'}
        </Text>
      </View>
      <ReportStack label="Participación" value={`${student.participation}%`} color={statusColor} meta={statusLabel} />
      <ReportStack label="Nota media" value={student.hasActivity ? student.grade.toFixed(1) : '-'} color={tokens.semantic.warning} meta={student.hasActivity ? `${student.accuracyPercent}% precisión` : 'Sin nota'} />
      <ReportStack label="Correctas" value={String(student.correctAnswers)} color={tokens.semantic.success} meta={`${student.playedSessions} sesión${student.playedSessions === 1 ? '' : 'es'}`} />
      <ReportStack label="Falladas" value={String(student.failedAnswers)} color={tokens.semantic.danger} meta="estimadas" />
    </View>
  );
}

function ReportStack({ label, value, color, meta }: { label: string; value: string; color: string; meta: string }) {
  return (
    <View className="min-w-[100px]">
      <Text className="text-[11px] text-text-muted">{label}</Text>
      <Text className="mt-1 text-[18px] font-black" style={{ color }}>{value}</Text>
      <Text className="mt-1 text-[10px] font-semibold text-text-secondary">{meta}</Text>
    </View>
  );
}

function FailedQuestionRow({ question }: { question: FailedQuestionReport }) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-lg bg-semantic-surface-danger">
          <Ionicons name="close-circle-outline" size={20} color={tokens.semantic.danger} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-text-primary" numberOfLines={2}>{question.text}</Text>
          <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>{question.topic}</Text>
        </View>
        <View className="items-end">
          <Text className="text-[18px] font-black text-semantic-danger">{question.actualFailures}</Text>
          <Text className="text-[10px] font-semibold text-text-muted">fallos reales</Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-[11px] font-semibold text-text-secondary">
          {question.totalAttempts} intento{question.totalAttempts === 1 ? '' : 's'} registrados
        </Text>
        <Text className="text-[11px] font-black text-semantic-danger">{question.failureRate}% fallo</Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-surface-interactive">
        <View className="h-full rounded-full bg-semantic-danger" style={{ width: `${question.failureRate}%` }} />
      </View>
    </View>
  );
}

function EvolutionRow({ item, maxValue }: { item: EvolutionReport; maxValue: number }) {
  const progress = Math.min(100, Math.round((item.activityCount / maxValue) * 100));

  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="font-bold text-text-primary">{item.label}</Text>
        <Text className="text-[12px] font-semibold text-text-secondary">
          {item.activityCount} activos · {item.averageScore} puntos
        </Text>
      </View>
      <View className="h-3 overflow-hidden rounded-full bg-surface-interactive">
        <View className="h-full rounded-full bg-semantic-success" style={{ width: `${progress}%` }} />
      </View>
    </View>
  );
}

function ManualReviewRowCard({
  busy,
  onApprove,
  onReject,
  row,
}: {
  busy: boolean
  onApprove: () => void
  onReject: () => void
  row: ManualReviewRow
}) {
  const { tokens } = useAppTheme()
  const statusMeta = getManualReviewStatusMeta(row.status, tokens);
  const pending = row.status === 'pending';

  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="flex-row flex-wrap items-start gap-4">
        <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${statusMeta.color}24` }}>
          <Ionicons name={statusMeta.icon} size={21} color={statusMeta.color} />
        </View>
        <View className="min-w-[240px] flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-black text-text-primary">{row.studentName}</Text>
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: `${statusMeta.color}22` }}>
              <Text className="text-[10px] font-black uppercase" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
            </View>
            <Text className="text-[11px] font-semibold text-text-muted">{formatDate(row.attemptedAt)}</Text>
          </View>
          <Text className="mt-2 text-[13px] font-bold leading-5 text-text-secondary">{row.questionText}</Text>
          <Text className="mt-1 text-[11px] font-semibold text-text-muted">{row.topicName}</Text>
          <View className="mt-3 rounded-xl border border-border-default bg-surface-default p-3">
            <Text className="text-[11px] font-black uppercase tracking-[0.06em] text-text-muted">Respuesta del alumno</Text>
            <Text className="mt-2 text-[14px] leading-6 text-text-primary">{row.answerText}</Text>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <MiniInfo icon="star-outline" label={`${row.earnedPoints}/${row.possiblePoints} XP`} />
            {row.timeTaken !== null ? <MiniInfo icon="time-outline" label={`${row.timeTaken}s`} /> : null}
            {row.reviewedAt ? <MiniInfo icon="checkmark-done-outline" label={`Revisada ${formatDate(row.reviewedAt)}`} /> : null}
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Pressable
            onPress={onApprove}
            disabled={!pending || busy}
            className="flex-row items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: pending ? tokens.semantic.success : tokens.surface.interactive, opacity: busy ? 0.65 : 1 }}
          >
            {busy ? <ActivityIndicator color={tokens.text.inverse} size="small" /> : <Ionicons name="checkmark" size={14} color={tokens.text.inverse} />}
            <Text className="text-[12px] font-bold text-text-primary">Correcta</Text>
          </Pressable>
          <Pressable
            onPress={onReject}
            disabled={!pending || busy}
            className="flex-row items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: pending ? tokens.semantic.danger : tokens.surface.interactive, opacity: busy ? 0.65 : 1 }}
          >
            <Ionicons name="close" size={14} color={tokens.text.inverse} />
            <Text className="text-[12px] font-bold text-text-primary">Fallida</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MiniInfo({ icon, label }: { icon: IconName; label: string }) {
  const { tokens } = useAppTheme()
  return (
    <View className="flex-row items-center gap-1 rounded-lg bg-surface-interactive px-2 py-1">
      <Ionicons name={icon} size={12} color={tokens.text.secondary} />
      <Text className="text-[10px] font-bold text-text-secondary">{label}</Text>
    </View>
  );
}

function getManualReviewStatusMeta(status: string, tokens: ReturnType<typeof useAppTheme>['tokens']): { label: string; color: string; icon: IconName } {
  if (status === 'approved') return { label: 'Correcta', color: tokens.semantic.success, icon: 'checkmark-circle-outline' };
  if (status === 'rejected') return { label: 'Fallida', color: tokens.semantic.danger, icon: 'close-circle-outline' };
  if (status === 'pending') return { label: 'Pendiente', color: tokens.semantic.warning, icon: 'time-outline' };
  return { label: 'Sin revisión', color: tokens.text.muted, icon: 'ellipse-outline' };
}

function iconForSubject(icon: string | null): IconName {
  if (!icon) return 'book-outline';
  if (icon.includes('🧮') || icon.includes('➗')) return 'calculator-outline';
  if (icon.includes('⚽') || icon.includes('🏀')) return 'football-outline';
  if (icon.includes('🔬')) return 'flask-outline';
  if (icon.includes('🎨')) return 'color-palette-outline';
  return 'book-outline';
}

function formatDate(value?: string | null) {
  if (!value) return 'recientemente';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatTopicDeadline(value?: string | null) {
  if (!value) return 'Abierto';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Abierto';
  if (date.getTime() <= Date.now()) return 'Bloqueado';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
