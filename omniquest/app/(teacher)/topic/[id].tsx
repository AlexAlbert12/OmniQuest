import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import TeacherSidebar from '../../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../../components/teacher/TeacherPageHeader'
import TeacherTopicOverview, { TeacherTopicAddQuestionCTA } from '../../../components/teacher/topic/TeacherTopicOverview'
import AppButton from '../../../components/ui/AppButton'
import AppPressable from '../../../components/ui/AppPressable'
import AppBackButton from '../../../components/ui/AppBackButton'
import AppTabs from '../../../components/ui/AppTabs'
import PaginationControls from '../../../components/ui/PaginationControls'
import AppConfirmModal from '../../../components/AppConfirmModal'
import AppStatusBanner from '../../../components/ui/AppStatusBanner'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout'
import { useResponsiveLayout } from '../../../lib/responsive'
import { getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty'
import { useAppTheme } from '../../../lib/appTheme'
import { useTeacherTopicDetail, type VisibilityFilter } from '../../../hooks/teacher/useTeacherTopicDetail'
import type { TeacherTopicQuestion } from '../../../lib/teacherServerData'
import { signOutCurrentDeviceSession } from '../../../lib/pushNotifications'
import OmniLoadingScreen from '../../../components/ui/OmniLoadingScreen'
import { useAppFeedback } from '../../../hooks/useAppFeedback'

const difficultyItems: { key: DifficultyLevel | 'all'; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 1, label: 'Fácil' },
  { key: 2, label: 'Media' },
  { key: 3, label: 'Difícil' },
]

const visibilityItems: { key: VisibilityFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'visible', label: 'Visibles' },
  { key: 'archived', label: 'Archivadas' },
]

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const topicIdValue = Array.isArray(id) ? id[0] : id
  const topicId = topicIdValue && /^\d+$/.test(topicIdValue) ? Number(topicIdValue) : null
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const [topicAction, setTopicAction] = useState<'archive' | 'restore' | 'delete' | null>(null)
  const [topicBusy, setTopicBusy] = useState(false)
  const [questionAction, setQuestionAction] = useState<{ question: TeacherTopicQuestion; action: 'archive' | 'restore' | 'delete' } | null>(null)
  const [questionBusy, setQuestionBusy] = useState(false)
  const detail = useTeacherTopicDetail(topicId)
  const feedback = useAppFeedback()
  const isDesktop = responsive.isDesktop

  const summary = detail.summary
  const topic = summary?.topic
  const subject = summary?.subject
  const addQuestionHref = topic && subject
    ? `/(teacher)/subject/add-question?subjectId=${subject.id}&classroomId=${topic.classroomId ?? ''}&topicId=${topic.id}${detail.difficulty !== 'all' ? `&difficulty=${detail.difficulty}` : ''}`
    : ''

  const availabilityLabel = useMemo(() => formatTopicAvailability(topic?.active, topic?.availableUntil), [topic?.active, topic?.availableUntil])
  const difficultyLabel = summary
    ? getDifficultyMeta(Math.max(1, Math.min(3, summary.summary.averageDifficulty || 1))).label
    : 'Sin definir'

  const handleSignOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as never)
  }

  const handleTopicAction = async () => {
    if (!topicAction || !subject) return
    setTopicBusy(true)
    try {
      if (topicAction === 'archive') {
        await detail.archiveTopic()
        feedback.success('Tema archivado', 'El tema se conserva y puedes restaurarlo desde Temas > Archivados.')
      } else if (topicAction === 'restore') {
        await detail.restoreTopic()
        feedback.success('Tema restaurado', 'El tema vuelve a estar disponible. Las preguntas archivadas individualmente siguen archivadas.')
      } else {
        await detail.deleteTopic()
        feedback.success('Tema eliminado', 'El tema se ha eliminado definitivamente.')
      }
      setTopicAction(null)
      router.replace({ pathname: '/(teacher)/subject/[id]', params: { id: String(subject.id), tab: 'topics', ...(topic.classroomId ? { classroomId: String(topic.classroomId) } : {}) } } as never)
    } catch (error) {
      feedback.error(topicAction === 'archive' ? 'No se pudo archivar el tema' : topicAction === 'restore' ? 'No se pudo restaurar el tema' : 'No se pudo eliminar el tema', error instanceof Error ? error : 'Inténtalo de nuevo.')
    } finally {
      setTopicBusy(false)
    }
  }

  const handleQuestionAction = async () => {
    if (!questionAction) return
    setQuestionBusy(true)
    try {
      if (questionAction.action === 'archive') {
        await detail.setQuestionArchived(questionAction.question.id, true)
        feedback.success('Pregunta archivada', 'La pregunta conserva sus resultados e histórico.')
      } else if (questionAction.action === 'restore') {
        await detail.setQuestionArchived(questionAction.question.id, false)
        feedback.success('Pregunta restaurada', 'La pregunta vuelve a estar disponible para nuevas partidas.')
      } else {
        await detail.deleteQuestion(questionAction.question.id)
        feedback.success('Pregunta eliminada', 'La pregunta se ha eliminado definitivamente.')
      }
      setQuestionAction(null)
    } catch (error) {
      feedback.error(questionAction.action === 'archive' ? 'No se pudo archivar la pregunta' : questionAction.action === 'restore' ? 'No se pudo restaurar la pregunta' : 'No se pudo eliminar la pregunta', error instanceof Error ? error : 'Inténtalo de nuevo.')
    } finally {
      setQuestionBusy(false)
    }
  }

  if (detail.loadingSummary && !summary) {
    return <LoadingState />
  }

  if (detail.error && !summary) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: tokens.background.primary }}>
        <AppStatusBanner variant="danger" title="No se pudo cargar el tema" message={detail.error} />
        <AppBackButton label="Volver a cursos" style={{ marginTop: 18 }} onPress={() => router.replace('/(teacher)/classes' as never)} />
      </View>
    )
  }

  if (!topic || !subject || !summary) return <LoadingState />

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar activeSection="classes" subjectsCount={summary.subjectsCount} onSignOut={handleSignOut} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 14,
            paddingTop: isDesktop ? 22 : 18,
            paddingBottom: isDesktop ? 36 : MOBILE_BOTTOM_NAV_SPACER + 88,
          }}
          refreshControl={<RefreshControl refreshing={detail.refreshing} onRefresh={detail.refresh} tintColor={tokens.brand.teacher} />}
          showsVerticalScrollIndicator={false}
        >
          <TeacherPageHeader
            backAction={{ label: subject.name, onPress: () => router.push(`/(teacher)/subject/${subject.id}` as never) }}
            isDesktop={isDesktop}
            title={topic.title}
            titleNumberOfLines={2}
            leading={(
              <View className="h-20 w-20 items-center justify-center rounded-2xl border" style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.selected }}>
                <Ionicons name={normalizeAcademicIcon(topic.icon, 'book-outline')} size={42} color={tokens.brand.teacher} />
              </View>
            )}
            actions={(
              <View className="flex-row flex-wrap gap-2">
                {topic.active ? (
                  <>
                    <AppButton
                      label={isDesktop ? 'Editar' : ''}
                      accessibilityLabel="Editar tema"
                      icon="create-outline"
                      variant="secondary"
                      onPress={() => router.push(`/(teacher)/edit-topic?id=${topic.id}` as never)}
                    />
                    <AppButton
                      label={isDesktop ? 'Archivar' : ''}
                      accessibilityLabel="Archivar tema"
                      accessibilityHint="Conserva preguntas e histórico y permite restaurar el tema más adelante"
                      icon="archive-outline"
                      variant="danger"
                      onPress={() => setTopicAction('archive')}
                    />
                    {isDesktop && addQuestionHref ? <TeacherTopicAddQuestionCTA href={addQuestionHref} isDesktop /> : null}
                  </>
                ) : (
                  <>
                    <AppButton
                      label={isDesktop ? 'Restaurar' : ''}
                      accessibilityLabel="Restaurar tema"
                      icon="refresh-outline"
                      variant="secondary"
                      onPress={() => setTopicAction('restore')}
                    />
                    <AppButton
                      label={isDesktop ? 'Eliminar definitivamente' : ''}
                      accessibilityLabel="Eliminar tema definitivamente"
                      accessibilityHint="Solo se eliminará si no contiene histórico académico"
                      icon="trash-outline"
                      variant="danger"
                      onPress={() => setTopicAction('delete')}
                    />
                  </>
                )}
              </View>
            )}
          />

          <TeacherTopicOverview
            availability={availabilityLabel}
            difficulty={difficultyLabel}
            averageXp={summary.summary.averageXp}
            attemptsCount={summary.summary.attemptsCount}
            participation={summary.summary.participation}
            questionsCount={summary.summary.questionsCount}
          />

          {detail.error ? <View style={{ marginBottom: 16 }}><AppStatusBanner variant="warning" title="Actualización incompleta" message={detail.error} /></View> : null}

          <View className="rounded-2xl border p-4 md:p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
            <View className="flex-row flex-wrap items-end justify-between gap-3">
              <View className="min-w-[220px] flex-1">
                <Text className="text-[20px] font-black" style={{ color: tokens.text.primary }}>Preguntas del tema</Text>
                <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>
                  Se cargan {detail.pageSize} preguntas por página para mantener la pantalla rápida.
                </Text>
              </View>
              <Text className="text-[12px] font-black" style={{ color: tokens.brand.teacher }}>{detail.total} en total</Text>
            </View>

            <View className="mt-4 flex-row flex-wrap gap-3">
              <View className="min-h-12 min-w-[260px] flex-1 flex-row items-center rounded-xl border px-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
                <TextInput
                  accessibilityLabel="Buscar preguntas del tema"
                  className="min-w-0 flex-1"
                  style={{ color: tokens.text.primary }}
                  placeholder="Buscar por enunciado..."
                  placeholderTextColor={tokens.text.muted}
                  value={detail.search}
                  onChangeText={detail.setSearch}
                />
                <Ionicons name="search-outline" size={19} color={tokens.text.muted} />
              </View>
            </View>

            <View className="mt-4 gap-3">
              <View>
                <Text className="mb-2 text-[10px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Dificultad</Text>
                <AppTabs
                  compact
                  role="teacher"
                  accessibilityLabel="Filtrar preguntas por dificultad"
                  items={difficultyItems}
                  value={detail.difficulty}
                  onChange={detail.setDifficulty}
                />
              </View>
              <View>
                <Text className="mb-2 text-[10px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Visibilidad</Text>
                <AppTabs
                  compact
                  role="teacher"
                  accessibilityLabel="Filtrar preguntas por visibilidad"
                  items={visibilityItems}
                  value={detail.visibility}
                  onChange={detail.setVisibility}
                />
              </View>
            </View>

            {detail.loadingQuestions ? (
              <View className="items-center py-10">
                <ActivityIndicator color={tokens.brand.teacher} />
                <Text className="mt-3 text-[13px]" style={{ color: tokens.text.muted }}>Cargando página de preguntas...</Text>
              </View>
            ) : detail.questions.length === 0 ? (
              <View className="mt-5 items-center rounded-xl border border-dashed p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
                <Ionicons name={detail.visibility === 'archived' ? 'archive-outline' : 'help-circle-outline'} size={44} color={tokens.text.muted} />
                <Text className="mt-3 text-center font-bold" style={{ color: tokens.text.primary }}>
                  {detail.visibility === 'archived' ? 'No hay preguntas archivadas' : 'No hay preguntas con estos filtros'}
                </Text>
                <Text className="mt-1 text-center text-[12px]" style={{ color: tokens.text.muted }}>
                  {detail.visibility === 'archived' ? 'Las preguntas que archives aparecerán aquí.' : 'Cambia los filtros o añade una nueva pregunta.'}
                </Text>
                {topic.active && detail.visibility !== 'archived' && addQuestionHref ? <AppButton label="Añadir pregunta" icon="add" role="teacher" style={{ marginTop: 18 }} onPress={() => router.push(addQuestionHref as never)} /> : null}
              </View>
            ) : (
              <View className="mt-5 gap-3">
                {detail.questions.map((question, index) => (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    number={detail.page * detail.pageSize + index + 1}
                    onOpen={() => router.push(`/(teacher)/question-report/${question.id}` as never)}
                    onEdit={() => router.push(buildEditQuestionHref(question, subject.id, topic.classroomId, topic.id) as never)}
                    parentTopicActive={topic.active}
                    onArchive={() => setQuestionAction({ question, action: 'archive' })}
                    onRestore={() => setQuestionAction({ question, action: 'restore' })}
                    onDelete={() => setQuestionAction({ question, action: 'delete' })}
                  />
                ))}
              </View>
            )}

            <PaginationControls
              page={detail.page}
              pageSize={detail.pageSize}
              total={detail.total}
              onPrevious={() => detail.setPage(Math.max(0, detail.page - 1))}
              onNext={() => detail.setPage(Math.min(detail.pageCount - 1, detail.page + 1))}
            />
          </View>
        </ScrollView>
      </View>

      {!isDesktop ? <TeacherBottomNav active="classes" /> : null}
      {!isDesktop && topic.active && addQuestionHref ? <TeacherTopicAddQuestionCTA href={addQuestionHref} isDesktop={false} /> : null}

      <AppConfirmModal
        visible={Boolean(topicAction)}
        busy={topicBusy}
        title={topicAction === 'archive' ? 'Archivar tema' : topicAction === 'restore' ? 'Restaurar tema' : 'Eliminar tema definitivamente'}
        message={topicAction === 'archive'
          ? 'El tema dejará de estar disponible para los alumnos, pero conservará sus preguntas e histórico. Podrás restaurarlo posteriormente.'
          : topicAction === 'restore'
            ? 'El tema volverá a estar disponible. Las preguntas archivadas individualmente permanecerán archivadas.'
            : 'Esta acción eliminará permanentemente el tema y sus preguntas que no tengan histórico asociado. No podrás recuperarlo.'}
        confirmLabel={topicAction === 'archive' ? 'Archivar tema' : topicAction === 'restore' ? 'Restaurar' : 'Eliminar definitivamente'}
        variant={topicAction === 'restore' ? 'info' : 'danger'}
        onCancel={() => setTopicAction(null)}
        onConfirm={() => { void handleTopicAction() }}
      />
      <AppConfirmModal
        visible={Boolean(questionAction)}
        busy={questionBusy}
        title={questionAction?.action === 'archive' ? 'Archivar pregunta' : questionAction?.action === 'restore' ? 'Restaurar pregunta' : 'Eliminar pregunta definitivamente'}
        message={questionAction?.action === 'archive'
          ? 'La pregunta dejará de utilizarse en nuevas partidas, pero conservará sus resultados e histórico. Podrás restaurarla posteriormente.'
          : questionAction?.action === 'restore'
            ? 'La pregunta volverá a estar disponible para nuevas partidas.'
            : 'Esta acción eliminará permanentemente la pregunta y no podrás recuperarla. Solo puede eliminarse si no forma parte del histórico de ningún alumno.'}
        confirmLabel={questionAction?.action === 'archive' ? 'Archivar' : questionAction?.action === 'restore' ? 'Restaurar' : 'Eliminar definitivamente'}
        variant={questionAction?.action === 'restore' ? 'info' : 'danger'}
        onCancel={() => setQuestionAction(null)}
        onConfirm={() => { void handleQuestionAction() }}
      />
    </SafeAreaView>
  )
}

function LoadingState() { return <OmniLoadingScreen /> }

function QuestionRow({ question, number, parentTopicActive, onOpen, onEdit, onArchive, onRestore, onDelete }: {
  question: TeacherTopicQuestion
  number: number
  parentTopicActive: boolean
  onOpen: () => void
  onEdit: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const { tokens } = useAppTheme()
  const difficulty = getDifficultyMeta(question.difficulty || 1)
  const archived = question.active === false
  return (
    <View className="flex-row flex-wrap items-center gap-4 rounded-xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir informe de la pregunta: ${question.text}`}
        accessibilityHint="Muestra el diagnóstico, las respuestas y los alumnos afectados"
        onPress={onOpen}
        className="min-w-[260px] flex-1 flex-row items-center gap-4 rounded-lg"
        style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
      >
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: tokens.surface.interactive }}>
          <Text className="font-bold" style={{ color: tokens.brand.teacher }}>#{number}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="min-w-0 flex-1 font-semibold" style={{ color: tokens.text.primary }}>{question.text}</Text>
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: archived ? tokens.surface.interactive : tokens.semanticSurface.success }}>
              <Text className="text-[10px] font-black" style={{ color: archived ? tokens.text.muted : tokens.semantic.success }}>
                {archived ? 'ARCHIVADA' : 'VISIBLE'}
              </Text>
            </View>
          </View>
          <Text className="mt-2 text-[12px]" style={{ color: tokens.text.muted }}>
            {question.pointsBase || 0} puntos · {question.answersCount} respuesta{question.answersCount === 1 ? '' : 's'} · {question.attemptsCount} intento{question.attemptsCount === 1 ? '' : 's'}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-3">
            <Text className="text-[11px] font-black" style={{ color: difficulty.color }}>{difficulty.label}</Text>
            {question.correctAnswer ? <Text className="text-[11px]" style={{ color: tokens.text.secondary }}>Correcta: {question.correctAnswer}</Text> : null}
            {question.accuracyPercent !== null ? <Text className="text-[11px]" style={{ color: tokens.semantic.info }}>Precisión: {question.accuracyPercent}%</Text> : null}
          </View>
        </View>
      </AppPressable>
      <View className="flex-row flex-wrap gap-2">
        {!archived ? (
          <>
            <AppButton label="Editar" accessibilityLabel={`Editar pregunta: ${question.text}`} icon="create-outline" variant="secondary" onPress={onEdit} />
            <AppButton label="Archivar" accessibilityLabel={`Archivar pregunta: ${question.text}`} accessibilityHint="Conserva los resultados y el histórico" icon="archive-outline" variant="danger" onPress={onArchive} />
          </>
        ) : (
          <>
            <AppButton label="Restaurar" accessibilityLabel={`Restaurar pregunta: ${question.text}`} accessibilityHint={parentTopicActive ? 'Vuelve a habilitar la pregunta' : 'Restaura primero el tema para poder habilitar esta pregunta'} icon="refresh-outline" variant="secondary" disabled={!parentTopicActive} onPress={onRestore} />
            <AppButton label="Eliminar definitivamente" accessibilityLabel={`Eliminar pregunta definitivamente: ${question.text}`} accessibilityHint="Solo se eliminará si no forma parte del histórico de ningún alumno" icon="trash-outline" variant="danger" onPress={onDelete} />
          </>
        )}
      </View>
    </View>
  )
}

function buildEditQuestionHref(question: TeacherTopicQuestion, subjectId: number, classroomId: number | null, topicId: number) {
  return `/(teacher)/subject/edit-question?questionId=${question.id}&subjectId=${subjectId}${classroomId ? `&classroomId=${classroomId}` : ''}&topicId=${topicId}&difficulty=${question.difficulty || 1}`
}

function formatTopicAvailability(active?: boolean, value?: string | null) {
  if (!active) return 'Archivado'
  if (!value) return 'Sin fecha límite'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha límite'
  if (date.getTime() <= Date.now()) return 'Fecha límite vencida'
  return `Disponible hasta ${new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`
}
