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
import { supabase } from '../../../lib/supabase'
import { useTeacherTopicDetail, type VisibilityFilter } from '../../../hooks/teacher/useTeacherTopicDetail'
import type { TeacherTopicQuestion } from '../../../lib/teacherServerData'
import { signOutCurrentDeviceSession } from '../../../lib/pushNotifications'
import OmniLoadingScreen from '../../../components/ui/OmniLoadingScreen'

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
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<TeacherTopicQuestion | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const detail = useTeacherTopicDetail(topicId)
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

  const handleArchive = async () => {
    setArchiveBusy(true)
    try {
      await detail.archiveTopic()
      setArchiveOpen(false)
      router.replace(`/(teacher)/subject/${subject?.id}` as never)
    } finally {
      setArchiveBusy(false)
    }
  }

  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return
    setDeleteBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('teacher-delete-question', {
        body: { questionId: questionToDelete.id },
      })
      if (error) throw error
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error)
      detail.removeQuestion(questionToDelete.id)
      setQuestionToDelete(null)
    } finally {
      setDeleteBusy(false)
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
                  icon="archive-outline"
                  variant="danger"
                  disabled={!topic.active}
                  onPress={() => setArchiveOpen(true)}
                />
                {isDesktop && addQuestionHref ? <TeacherTopicAddQuestionCTA href={addQuestionHref} isDesktop /> : null}
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
                <Ionicons name="help-circle-outline" size={44} color={tokens.text.muted} />
                <Text className="mt-3 text-center font-bold" style={{ color: tokens.text.primary }}>No hay preguntas con estos filtros</Text>
                <Text className="mt-1 text-center text-[12px]" style={{ color: tokens.text.muted }}>Cambia los filtros o añade una nueva pregunta.</Text>
                {addQuestionHref ? <AppButton label="Añadir pregunta" icon="add" role="teacher" style={{ marginTop: 18 }} onPress={() => router.push(addQuestionHref as never)} /> : null}
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
                    onDelete={() => setQuestionToDelete(question)}
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
      {!isDesktop && addQuestionHref ? <TeacherTopicAddQuestionCTA href={addQuestionHref} isDesktop={false} /> : null}

      <AppConfirmModal
        visible={archiveOpen}
        busy={archiveBusy}
        title="Archivar tema"
        message="El tema y sus preguntas dejarán de estar disponibles para el alumnado. Los resultados históricos se conservarán."
        confirmLabel="Archivar tema"
        variant="danger"
        onCancel={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
      />
      <AppConfirmModal
        visible={Boolean(questionToDelete)}
        busy={deleteBusy}
        title="Eliminar pregunta"
        message={`Se eliminará “${questionToDelete?.text || 'esta pregunta'}” y no podrá recuperarse.`}
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={() => setQuestionToDelete(null)}
        onConfirm={handleDeleteQuestion}
      />
    </SafeAreaView>
  )
}

function LoadingState() { return <OmniLoadingScreen /> }

function QuestionRow({ question, number, onOpen, onEdit, onDelete }: {
  question: TeacherTopicQuestion
  number: number
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { tokens } = useAppTheme()
  const difficulty = getDifficultyMeta(question.difficulty || 1)
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
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: question.active ? tokens.semanticSurface.success : tokens.surface.interactive }}>
              <Text className="text-[10px] font-black" style={{ color: question.active ? tokens.semantic.success : tokens.text.muted }}>
                {question.active ? 'VISIBLE' : 'ARCHIVADA'}
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
        <AppButton label="Editar" icon="create-outline" variant="secondary" onPress={onEdit} />
        <AppButton label="Eliminar" icon="trash-outline" variant="danger" onPress={onDelete} />
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
