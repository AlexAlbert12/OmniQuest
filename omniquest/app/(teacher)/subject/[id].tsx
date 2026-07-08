import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { difficultyOptions, type DifficultyLevel } from '../../../lib/difficulty';
import {
  type EvolutionReport,
  type StudentReport,
} from '../../../lib/teacherSubjectAnalytics';
import TeacherSidebar from '../../../components/teacher/TeacherSidebar';
import TeacherStudentImportModal from '../../../components/teacher/TeacherStudentImportModal';
import { GradeDistributionBars, SubjectPanel as Panel, type IconName } from '../../../components/teacher/subject/SubjectShared';
import { SubjectQuestionsPanel, SubjectQuestionsTab } from '../../../components/teacher/subject/SubjectQuestionsTab';
import { SubjectStudentsTab } from '../../../components/teacher/subject/SubjectStudentsTab';
import {
  teacherSubjectTabItems,
  useTeacherSubjectDetail,
  type FailedQuestionReport,
  type ManualReviewRow,
  type Subject,
} from '../../../hooks/teacher/useTeacherSubjectDetail';

const INSUFFICIENT_TREND_DATA = 'Datos disponibles cuando haya actividad suficiente'

export default function SubjectDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

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
                  <View key={String(topic.id)} className="flex-row items-center justify-between border-b border-[#13284A] py-3">
                    <View className="min-w-0 flex-1 pr-3">
                      <Text className="font-semibold text-white">{topic.title}</Text>
                      <Text className="mt-1 text-[11px] text-[#8FA7C7]">{topic.questionsCount} preguntas</Text>
                    </View>
                    <Text className="text-[12px] font-bold text-[#A78BFA]">{topic.playedCount} jugados</Text>
                  </View>
                ))
              ) : (
                <Text className="text-[12px] text-[#8FA7C7]">Aún no hay temas para analizar actividad.</Text>
              )}
            </Panel>
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

    if (activeTab === 'reports') {
      return (
        <View className="gap-5">
          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <ReportMetricCard icon="people" label="Alumnos evaluados" value={`${reportSummary.answered}/${reportSummary.enrolled}`} color="#38BDF8" detail={`${reportSummary.participation}% participación`} />
            <ReportMetricCard icon="shield-checkmark" label="Nota media" value={reportSummary.averageGrade.toFixed(1)} suffix="/10" color="#F59E0B" detail={`${reportSummary.averageAccuracy}% precisión media`} />
            <ReportMetricCard icon="close-circle" label="Preguntas falladas" value={String(reportSummary.failedAnswers)} color="#F43F5E" detail={`${reportSummary.correctAnswers} correctas registradas`} />
            <ReportMetricCard icon="star" label="XP media" value={`${averageXp.toLocaleString('es-ES')}`} color="#3B82F6" detail="puntos con bonus aparte" />
          </View>

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
                  <Text className="text-[12px] text-[#8FA7C7]">Aún no hay alumnos inscritos para generar métricas.</Text>
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
                  <Text className="text-[12px] text-[#8FA7C7]">No hay fallos registrados en attempt_history todavía.</Text>
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
          <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
            <ReportMetricCard
              icon="time"
              label="Pendientes"
              value={String(manualReviewPendingCount)}
              color="#F59E0B"
              detail="Respuestas abiertas sin corregir"
            />
            <ReportMetricCard
              icon="checkmark-done"
              label="Revisadas"
              value={String(manualReviewReviewedCount)}
              color="#34D399"
              detail="Marcadas como correctas o fallidas"
            />
            <ReportMetricCard
              icon="chatbox-ellipses"
              label="Total abiertas"
              value={String(manualReviewRows.length)}
              color="#38BDF8"
              detail="Últimas respuestas recibidas"
            />
          </View>

          <Panel title="Corrección de respuestas abiertas">
            {manualReviewRows.length === 0 ? (
              <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
                <Ionicons name="chatbox-ellipses-outline" size={44} color="#64748B" />
                <Text className="mt-3 text-center font-bold text-white">No hay respuestas abiertas para revisar</Text>
                <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">
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
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Text className="font-bold text-white">Editar información del curso</Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab('students')}
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Text className="font-bold text-white">Gestionar alumnos</Text>
                </Pressable>
                <Pressable
                  onPress={() => showAlert('Código del curso', currentSubject.code)}
                  className="rounded-xl border border-[#6D5AF6] bg-[#1A1E55] px-4 py-3"
                >
                  <Text className="font-bold text-[#D8B4FE]">Ver código de acceso</Text>
                </Pressable>
              </View>
            </Panel>
          </View>

          <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
            <Panel title="Temas disponibles">
              {topicRows.length > 0 ? (
                topicRows.map((topic) => (
                  <View key={String(topic.id)} className="border-b border-[#13284A] py-3">
                    <Text className="font-semibold text-white">{topic.title}</Text>
                    <Text className="mt-1 text-[11px] text-[#8FA7C7]">{topic.questionsCount} preguntas</Text>
                  </View>
                ))
              ) : (
                <Text className="text-[12px] text-[#8FA7C7]">Sin temas todavía.</Text>
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
                  className="rounded-xl bg-[#5A46D8] px-4 py-3"
                >
                  <Text className="text-center font-bold text-white">Editar curso</Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab('students')}
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                >
                  <Text className="text-center font-bold text-white">Gestionar estudiantes</Text>
                </Pressable>
                <Pressable
                  onPress={() => showAlert('Código del curso', `Comparte este código con tus alumnos: ${currentSubject.code}`)}
                  className="rounded-xl border border-[#6D5AF6] bg-[#1A1E55] px-4 py-3"
                >
                  <Text className="text-center font-bold text-[#D8B4FE]">Compartir código</Text>
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
            onAction={() => setActiveTab('activities')}
          >
            {recentActivity.map((item, index) => (
              <ActivityRow key={`${item.title}-${index}`} {...item} />
            ))}
          </Panel>

          <View className="rounded-xl border border-[#183052] bg-[#07162D] p-5">
            <View className="flex-row flex-wrap items-center gap-4">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#B91C4C33]">
                <Ionicons name="radio-button-on" size={27} color="#F43F5E" />
              </View>
              <View className="min-w-[220px] flex-1">
                <Text className="text-[12px] font-semibold text-[#B7C4D7]">Última pregunta creada</Text>
                <Text className="mt-1 text-[20px] font-black text-white">{latestQuestion?.text || 'Crea la primera pregunta'}</Text>
              </View>
              <InfoStack label="Progreso de la clase" value={`${progress}%`} />
              <InfoStack label="Participación" value={`${scores.length} / ${Math.max(enrollments.length, 1)}`} />
              <Link
                href={`/(teacher)/subject/add-question?subjectId=${currentSubject.id}${selectedClassroom?.id ? `&classroomId=${selectedClassroom.id}` : ''}${typeof selectedTopicId === 'number' ? `&topicId=${selectedTopicId}` : ''}${selectedDifficulty !== 'all' ? `&difficulty=${selectedDifficulty}` : ''}`}
                asChild
              >
                <Pressable className="rounded-xl bg-[#1A1E55] px-5 py-3">
                  <Text className="text-[12px] font-bold text-white">Nueva pregunta</Text>
                </Pressable>
              </Link>
            </View>
            <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#13294C]">
              <View className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${Math.min(progress, 100)}%` }} />
            </View>
            <Text className="mt-3 text-[12px] text-[#8FA7C7]">
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

          <View className="rounded-xl border border-[#4733B7] bg-[#1A1E55] p-5">
            <View className="mb-3 flex-row items-center gap-3">
              <Ionicons name="qr-code-outline" size={24} color="#D8B4FE" />
              <Text className="font-black text-white">Código del curso</Text>
            </View>
            <Text className="text-[12px] leading-5 text-[#C4D0E3]">
              Comparte este código con tus alumnos para que se unan al curso.
            </Text>
            <View className="mt-4 flex-row items-center gap-3">
              <View className="rounded-lg bg-[#07162D] px-4 py-3">
                <Text className="font-mono font-black text-[#A78BFA]">{currentSubject.code}</Text>
              </View>
              <Pressable
                onPress={() => showAlert('Código del curso', currentSubject.code)}
                className="flex-row items-center gap-2 rounded-lg border border-[#6D5AF6] px-4 py-3"
              >
                <Text className="text-[12px] font-bold text-[#C4B5FD]">Copiar</Text>
                <Ionicons name="copy-outline" size={15} color="#C4B5FD" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando curso...</Text>
      </View>
    );
  }

  if (!subject) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126] px-6">
        <Ionicons name="alert-circle-outline" size={52} color="#F87171" />
        <Text className="mt-4 text-center text-xl font-black text-white">No se encontró este curso</Text>
        <Pressable onPress={() => router.replace('/(teacher)/classes' as any)} className="mt-5 rounded-xl bg-[#5A46D8] px-5 py-3">
          <Text className="font-bold text-white">Volver a Cursos</Text>
        </Pressable>
      </View>
    );
  }

  const currentSubject = subject;
  return (
    <View className="flex-1 bg-[#061126]">
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
            paddingBottom: isDesktop ? 36 : 56,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-5 flex-row flex-wrap items-center justify-between gap-4">
            <Pressable onPress={() => router.push('/(teacher)/classes' as any)} className="flex-row items-center gap-2">
              <Ionicons name="arrow-back" size={18} color="#8FA7C7" />
              <Text className="font-semibold text-[#8FA7C7]">Cursos</Text>
            </Pressable>

            <View className="flex-row flex-wrap items-center gap-3">
              <Pressable onPress={handleClassMenu} className="rounded-xl border border-[#20375E] bg-[#09162C] p-3">
                <Ionicons name="ellipsis-horizontal" size={19} color="#C4D0E3" />
              </Pressable>
              <Pressable
                onPress={() => showAlert('Código del curso', `Comparte este código con tus alumnos: ${currentSubject.code}`)}
                className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
              >
                <Ionicons name="share-social-outline" size={16} color="#AFC2DB" />
                <Text className="text-[12px] font-bold text-[#DCE7F8]">Compartir código</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/(teacher)/edit-subject?id=${currentSubject.id}` as any)}
                className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-5 py-3"
              >
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <Text className="text-[12px] font-bold text-white">Editar curso</Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-6 flex-row flex-wrap items-center gap-4">
            <View className={`${isDesktop ? 'h-20 w-20' : 'h-16 w-16'} items-center justify-center rounded-2xl border border-[#6D5AF6] bg-[#2A1C61]`}>
              <Ionicons name={iconForSubject(currentSubject.icon)} size={isDesktop ? 42 : 34} color="#D8B4FE" />
            </View>
            <View className="min-w-[230px] flex-1">
              <View className="flex-row items-center gap-2">
                <Text className={`${isDesktop ? 'text-[26px]' : 'text-[24px]'} min-w-0 flex-1 font-black text-white`} numberOfLines={2}>{currentSubject.name}</Text>
                <Ionicons name="pencil-outline" size={16} color="#8FA7C7" />
              </View>
              <Text className="mt-1 text-[13px] font-semibold text-[#B7C4D7]">
                {currentSubject.description || 'Curso sin descripción'} · Código del curso:{' '}
                <Text className="font-mono text-[#A78BFA]">{currentSubject.code}</Text>
              </Text>
              <Text className="mt-1 text-[12px] text-[#8FA7C7]">
                {classrooms.length} clase{classrooms.length === 1 ? '' : 's'} · Clase activa: {selectedClassroom?.name || 'Sin clase'} · Creado {formatDate(currentSubject.created_at)}
              </Text>
            </View>
          </View>

          <Panel title="Clases del curso">
            <ScrollView
              horizontal={!isWide}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, flexWrap: isWide ? 'wrap' : 'nowrap', paddingRight: isWide ? 0 : 8 }}
            >
              {classrooms.map((classroom) => {
                const active = classroom.id === selectedClassroomId;
                return (
                  <Pressable
                    key={classroom.id}
                    onPress={() => {
                      setSelectedClassroomId(classroom.id);
                      setSelectedTopicId('all');
                    }}
                    className="flex-row items-center gap-2 rounded-xl px-4 py-3"
                    style={({ pressed }) => ({
                      borderWidth: 1,
                      borderColor: active ? '#8B5CF6' : '#20375E',
                      backgroundColor: active ? '#211B58' : '#09162C',
                      opacity: pressed ? 0.82 : 1,
                    })}
                  >
                    <Ionicons name={active ? 'radio-button-on' : 'ellipse-outline'} size={16} color={active ? '#C4B5FD' : '#8FA7C7'} />
                    <Text className={`text-[12px] font-black ${active ? 'text-[#C4B5FD]' : 'text-[#B7C4D7]'}`}>{classroom.name}</Text>
                    {classroom.code ? <Text className="font-mono text-[11px] text-[#8FA7C7]">{classroom.code}</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="mt-4 flex-row flex-wrap items-end gap-3 border-t border-[#13284A] pt-4">
              <View className="min-w-[240px] flex-1">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Nueva clase dentro del curso</Text>
                <TextInput
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3 text-white"
                  placeholder="Ej. Grupo A, 1º DAM tarde..."
                  placeholderTextColor="#60799C"
                  value={newClassroomName}
                  onChangeText={setNewClassroomName}
                />
              </View>
              <Pressable
                onPress={handleCreateClassroom}
                disabled={creatingClassroom}
                className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-5 py-3"
                style={({ pressed }) => ({ opacity: creatingClassroom ? 0.65 : pressed ? 0.82 : 1 })}
              >
                {creatingClassroom ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={16} color="#FFFFFF" />}
                <Text className="text-[12px] font-bold text-white">{creatingClassroom ? 'Creando...' : 'Crear clase'}</Text>
              </Pressable>
            </View>
          </Panel>

          <View className={isWide ? 'mb-5 flex-row gap-4' : 'mb-5 gap-4'}>
            <MetricCard icon="checkmark-circle" label="Precisión media" value={`${averageAccuracy}%`} color="#34D399" detail="Aciertos sobre respuestas estimadas" />
            <MetricCard icon="shield-checkmark" label="Nota media" value={`${averageGrade.toFixed(1)}`} suffix="/10" color="#F59E0B" detail="Calculada por precisión" />
            <MetricCard icon="star" label="XP media" value={`${averageXp.toLocaleString('es-ES')} pts`} color="#3B82F6" detail="Puntos y bonus separados" />
            <MetricCard icon="radio-button-on" label="Preguntas respondidas" value={`${answeredClassQuestions}/${possibleClassQuestions}`} color="#F43F5E" detail="Respuestas sobre preguntas posibles" />
            <MetricCard icon="trending-up" label="Participación" value={`${participation}%`} color="#8B5CF6" detail={INSUFFICIENT_TREND_DATA} />
          </View>

          <Panel title={`Temas de ${selectedClassroom?.name || 'la clase activa'}`}>
            <ScrollView
              horizontal={!isWide}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, flexWrap: isWide ? 'wrap' : 'nowrap', paddingRight: isWide ? 0 : 8 }}
              className="mb-4"
            >
              <TopicFilterChip
                label="Todos"
                icon="albums-outline"
                active={selectedTopicId === 'all'}
                onPress={() => setSelectedTopicId('all')}
              />
              {topicRows.map((topic) => (
                <TopicFilterChip
                  key={topic.id}
                  label={topic.title}
                  icon={topic.icon && topic.icon.includes('-outline') ? topic.icon as IconName : 'book-outline'}
                  active={selectedTopicId === topic.id}
                  onPress={() => setSelectedTopicId(topic.id)}
                />
              ))}
            </ScrollView>

            <View style={{ gap: 12 }}>
              {topicRows.length === 0 ? (
                <View className="rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-5">
                  <Text className="font-bold text-white">Todavía no hay temas</Text>
                  <Text className="mt-1 text-[12px] text-[#8FA7C7]">Crea el primer tema para agrupar las preguntas de esta clase.</Text>
                </View>
              ) : (
                topicRows.map((topic) => (
                  <TopicSummaryRow
                    key={topic.id}
                    topic={topic}
                    active={selectedTopicId === topic.id}
                    onPress={() => {
                      if (typeof topic.id === 'number') {
                        router.push(`/(teacher)/topic/${topic.id}` as any);
                      } else {
                        setSelectedTopicId(topic.id);
                      }
                    }}
                  />
                ))
              )}
            </View>

            <View className="mt-5 flex-row flex-wrap items-end gap-3 border-t border-[#13284A] pt-4">
              <View className="min-w-[220px] flex-1">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Nuevo tema</Text>
                <TextInput
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3 text-white"
                  placeholder="Ej. Ecuaciones de primer grado"
                  placeholderTextColor="#60799C"
                  value={newTopicTitle}
                  onChangeText={setNewTopicTitle}
                />
              </View>
              <View className="min-w-[240px] flex-1">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Descripción</Text>
                <TextInput
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3 text-white"
                  placeholder="Opcional"
                  placeholderTextColor="#60799C"
                  value={newTopicDescription}
                  onChangeText={setNewTopicDescription}
                />
              </View>
              <View className="min-w-[240px] flex-1">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Límite opcional</Text>
                <TextInput
                  className="rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3 text-white"
                  placeholder="2026-07-01 18:30"
                  placeholderTextColor="#60799C"
                  value={newTopicAvailableUntil}
                  onChangeText={setNewTopicAvailableUntil}
                />
                <Text className="mt-1 text-[10px] text-[#8FA7C7]">Vacío = siempre abierto.</Text>
              </View>
              <View className="min-w-[220px]">
                <Text className="mb-2 text-[12px] font-semibold text-[#B7C4D7]">Dificultad inicial</Text>
                <View className="flex-row flex-wrap gap-2">
                  {difficultyOptions.map((option) => {
                    const active = newTopicDifficulty === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setNewTopicDifficulty(option.value)}
                        className="rounded-lg border px-3 py-2"
                        style={{
                          borderColor: active ? option.color : '#20375E',
                          backgroundColor: active ? `${option.color}30` : '#09162C',
                        }}
                      >
                        <Text className="text-[12px] font-bold" style={{ color: active ? '#FFFFFF' : '#AFC2DB' }}>
                          {option.shortLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Pressable
                onPress={handleCreateTopic}
                disabled={creatingTopic}
                className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-5 py-3"
                style={({ pressed }) => ({ opacity: creatingTopic ? 0.65 : pressed ? 0.82 : 1 })}
              >
                {creatingTopic ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={16} color="#FFFFFF" />}
                <Text className="text-[12px] font-bold text-white">{creatingTopic ? 'Creando...' : 'Crear tema'}</Text>
              </Pressable>
            </View>
          </Panel>

          <View className="mb-5 rounded-xl border border-[#183052] bg-[#07162D] p-2">
            <ScrollView
              horizontal={!isWide}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, flexWrap: isWide ? 'wrap' : 'nowrap', paddingRight: isWide ? 0 : 8 }}
            >
              {teacherSubjectTabItems.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <Pressable key={tab.label} onPress={() => setActiveTab(tab.key)}>
                  <View className={`flex-row items-center gap-2 rounded-lg px-4 py-3 ${isActive ? 'border-b-2 border-[#8B5CF6]' : ''}`}>
                    <Ionicons name={isActive ? tab.icon.replace('-outline', '') as IconName : tab.icon} size={15} color={isActive ? '#A78BFA' : '#AFC2DB'} />
                    <Text className={`text-[12px] font-bold ${isActive ? 'text-[#A78BFA]' : 'text-[#B7C4D7]'}`}>{tab.label}</Text>
                  </View>
                </Pressable>
              );
              })}
            </ScrollView>
          </View>

          {renderTabContent(currentSubject)}
        </ScrollView>
      </View>
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

function MetricCard({
  icon,
  label,
  value,
  suffix,
  color,
  detail,
}: {
  icon: IconName
  label: string
  value: string
  suffix?: string
  color: string
  detail?: string
}) {
  return (
    <View className="min-w-[155px] flex-1 rounded-xl border border-[#183052] bg-[#07162D] p-4">
      <View className="mb-3 flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}26` }}
        >
          <Ionicons name={icon} size={21} color={color} />
        </View>

        <Text className="flex-1 text-[12px] font-semibold text-[#B7C4D7]">
          {label}
        </Text>
      </View>

      <Text className="text-[24px] font-black text-white">
        {value}{' '}
        {suffix ? (
          <Text className="text-[12px] text-[#B7C4D7]">
            {suffix}
          </Text>
        ) : null}
      </Text>

      {detail ? (
        <View className="mt-3 flex-row items-center gap-1">
          <Ionicons name="information-circle-outline" size={13} color="#8FA7C7" />
          <Text className="flex-1 text-[11px] font-semibold text-[#8FA7C7]">
            {detail}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function ReportMetricCard({
  icon,
  label,
  value,
  suffix,
  color,
  detail,
}: {
  icon: IconName
  label: string
  value: string
  suffix?: string
  color: string
  detail: string
}) {
  return (
    <View className="min-w-[180px] flex-1 rounded-xl border border-[#183052] bg-[#07162D] p-4">
      <View className="mb-3 flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `${color}26` }}>
          <Ionicons name={icon} size={21} color={color} />
        </View>
        <Text className="min-w-0 flex-1 text-[12px] font-semibold text-[#B7C4D7]">{label}</Text>
      </View>
      <Text className="text-[25px] font-black text-white">
        {value} {suffix ? <Text className="text-[12px] text-[#B7C4D7]">{suffix}</Text> : null}
      </Text>
      <Text className="mt-2 text-[11px] font-semibold text-[#8FA7C7]">{detail}</Text>
    </View>
  );
}

function TopicFilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string
  icon: IconName
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-2 rounded-lg px-4 py-3 ${active ? 'bg-[#4F46E5]' : 'border border-[#20375E] bg-[#09162C]'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : '#AFC2DB'} />
      <Text className={`text-[12px] font-bold ${active ? 'text-white' : 'text-[#DDE7F4]'}`}>{label}</Text>
    </Pressable>
  );
}

function TopicSummaryRow({
  topic,
  active,
  onPress,
}: {
  topic: {
    id: number | 'general'
    title: string
    description: string | null
    icon: string | null
    availableUntil: string | null
    questionsCount: number
    playedCount: number
    averageScore: number
  }
  active: boolean
  onPress: () => void
}) {
  const icon = topic.icon && topic.icon.includes('-outline') ? topic.icon as IconName : 'book-outline';

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row flex-wrap items-center gap-4 rounded-xl border p-4 ${active ? 'border-[#6D5AF6] bg-[#1A1E55]' : 'border-[#183052] bg-[#09162C]'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
    >
      <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#13284A]">
        {topic.icon && !topic.icon.includes('-outline') ? (
          <Text className="text-[22px]">{topic.icon}</Text>
        ) : (
          <Ionicons name={icon} size={24} color="#A78BFA" />
        )}
      </View>
      <View className="min-w-[220px] flex-1">
        <Text className="font-black text-white">{topic.title}</Text>
        <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>
          {topic.description || 'Tema de la clase'}
        </Text>
      </View>
      <InfoStack label="Preguntas" value={String(topic.questionsCount)} />
      <InfoStack label="Jugados" value={String(topic.playedCount)} />
      <InfoStack label="XP media" value={`${topic.averageScore}`} />
      <InfoStack label="Acceso" value={formatTopicDeadline(topic.availableUntil)} />
    </Pressable>
  );
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
    <View className="flex-row items-center gap-3 border-b border-[#13284A] py-3">
      <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}30` }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-[12px] text-[#B7C4D7]">{detail}</Text>
          {warning ? (
            <View className="rounded-md bg-[#7F1D1D] px-2 py-1">
              <Text className="text-[10px] font-bold text-[#FCA5A5]">Necesita apoyo</Text>
            </View>
          ) : null}
        </View>
      </View>
      {meta ? <Text className="text-[12px] font-bold text-[#A78BFA]">{meta}</Text> : null}
      <Text className="text-[11px] text-[#8FA7C7]">{time}</Text>
    </View>
  );
}

function InfoStack({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[110px]">
      <Text className="text-[12px] text-[#B7C4D7]">{label}</Text>
      <Text className="mt-1 text-[18px] font-black text-white">{value}</Text>
    </View>
  );
}

function StudentReportRow({ student, index }: { student: StudentReport; index: number }) {
  const statusColor = student.hasActivity ? '#34D399' : '#F59E0B';
  const statusLabel = student.hasActivity ? 'Activo' : 'Pendiente';

  return (
    <View className="flex-row flex-wrap items-center gap-4 rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#1A1E55]">
        <Text className="font-black text-[#A78BFA]">{index + 1}</Text>
      </View>
      <View className="min-w-[180px] flex-1">
        <Text className="font-black text-white" numberOfLines={1}>{student.name}</Text>
        <Text className="mt-1 text-[11px] text-[#8FA7C7]">
          {student.lastActivity ? `Última actividad: ${formatDate(student.lastActivity)}` : 'Sin actividad registrada'}
        </Text>
      </View>
      <ReportStack label="Participación" value={`${student.participation}%`} color={statusColor} meta={statusLabel} />
      <ReportStack label="Nota media" value={student.hasActivity ? student.grade.toFixed(1) : '-'} color="#F59E0B" meta={student.hasActivity ? `${student.accuracyPercent}% precisión` : 'Sin nota'} />
      <ReportStack label="Correctas" value={String(student.correctAnswers)} color="#34D399" meta={`${student.playedSessions} sesión${student.playedSessions === 1 ? '' : 'es'}`} />
      <ReportStack label="Falladas" value={String(student.failedAnswers)} color="#F43F5E" meta="estimadas" />
    </View>
  );
}

function ReportStack({ label, value, color, meta }: { label: string; value: string; color: string; meta: string }) {
  return (
    <View className="min-w-[100px]">
      <Text className="text-[11px] text-[#8FA7C7]">{label}</Text>
      <Text className="mt-1 text-[18px] font-black" style={{ color }}>{value}</Text>
      <Text className="mt-1 text-[10px] font-semibold text-[#B7C4D7]">{meta}</Text>
    </View>
  );
}

function FailedQuestionRow({ question }: { question: FailedQuestionReport }) {
  return (
    <View className="rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#3B1020]">
          <Ionicons name="close-circle-outline" size={20} color="#FB7185" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-white" numberOfLines={2}>{question.text}</Text>
          <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>{question.topic}</Text>
        </View>
        <View className="items-end">
          <Text className="text-[18px] font-black text-[#FB7185]">{question.actualFailures}</Text>
          <Text className="text-[10px] font-semibold text-[#8FA7C7]">fallos reales</Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-[11px] font-semibold text-[#B7C4D7]">
          {question.totalAttempts} intento{question.totalAttempts === 1 ? '' : 's'} registrados
        </Text>
        <Text className="text-[11px] font-black text-[#FB7185]">{question.failureRate}% fallo</Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13284A]">
        <View className="h-full rounded-full bg-[#FB7185]" style={{ width: `${question.failureRate}%` }} />
      </View>
    </View>
  );
}

function EvolutionRow({ item, maxValue }: { item: EvolutionReport; maxValue: number }) {
  const progress = Math.min(100, Math.round((item.activityCount / maxValue) * 100));

  return (
    <View className="rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="font-bold text-white">{item.label}</Text>
        <Text className="text-[12px] font-semibold text-[#C4D0E3]">
          {item.activityCount} activos · {item.averageScore} puntos
        </Text>
      </View>
      <View className="h-3 overflow-hidden rounded-full bg-[#13284A]">
        <View className="h-full rounded-full bg-[#34D399]" style={{ width: `${progress}%` }} />
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
  const statusMeta = getManualReviewStatusMeta(row.status);
  const pending = row.status === 'pending';

  return (
    <View className="rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-start gap-4">
        <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${statusMeta.color}24` }}>
          <Ionicons name={statusMeta.icon} size={21} color={statusMeta.color} />
        </View>
        <View className="min-w-[240px] flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-black text-white">{row.studentName}</Text>
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: `${statusMeta.color}22` }}>
              <Text className="text-[10px] font-black uppercase" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
            </View>
            <Text className="text-[11px] font-semibold text-[#8FA7C7]">{formatDate(row.attemptedAt)}</Text>
          </View>
          <Text className="mt-2 text-[13px] font-bold leading-5 text-[#DDE7F4]">{row.questionText}</Text>
          <Text className="mt-1 text-[11px] font-semibold text-[#8FA7C7]">{row.topicName}</Text>
          <View className="mt-3 rounded-xl border border-[#243E65] bg-[#07162D] p-3">
            <Text className="text-[11px] font-black uppercase tracking-[0.06em] text-[#8FA7C7]">Respuesta del alumno</Text>
            <Text className="mt-2 text-[14px] leading-6 text-white">{row.answerText}</Text>
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
            style={{ backgroundColor: pending ? '#047857' : '#123044', opacity: busy ? 0.65 : 1 }}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            <Text className="text-[12px] font-bold text-white">Correcta</Text>
          </Pressable>
          <Pressable
            onPress={onReject}
            disabled={!pending || busy}
            className="flex-row items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: pending ? '#BE123C' : '#123044', opacity: busy ? 0.65 : 1 }}
          >
            <Ionicons name="close" size={14} color="#FFFFFF" />
            <Text className="text-[12px] font-bold text-white">Fallida</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MiniInfo({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-lg bg-[#102544] px-2 py-1">
      <Ionicons name={icon} size={12} color="#AFC2DB" />
      <Text className="text-[10px] font-bold text-[#C4D0E3]">{label}</Text>
    </View>
  );
}

function getManualReviewStatusMeta(status: string): { label: string; color: string; icon: IconName } {
  if (status === 'approved') return { label: 'Correcta', color: '#34D399', icon: 'checkmark-circle-outline' };
  if (status === 'rejected') return { label: 'Fallida', color: '#FB7185', icon: 'close-circle-outline' };
  if (status === 'pending') return { label: 'Pendiente', color: '#F59E0B', icon: 'time-outline' };
  return { label: 'Sin revisión', color: '#8FA7C7', icon: 'ellipse-outline' };
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

function formatRelative(value: string | null | undefined, index: number) {
  if (!value) return index === 0 ? 'Hace 2h' : index === 1 ? 'Hace 4h' : 'Ayer';
  const date = new Date(value);
  const diffHours = Math.max(1, Math.round((Date.now() - date.getTime()) / 3600000));
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffHours < 48) return 'Ayer';
  return `Hace ${Math.round(diffHours / 24)} días`;
}
