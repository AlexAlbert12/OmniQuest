import React, { useCallback, useMemo } from 'react'
import { Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { difficultyOptions, getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty'
import { SubjectPanel } from './SubjectShared'
import AppButton from '../../ui/AppButton'
import AppTabs from '../../ui/AppTabs'
import VirtualizedStack from '../../ui/VirtualizedStack'

export type QuestionListItemDto = {
  id: number
  text: string
  points_base: number | null
  difficulty?: number | null
  topic_id: number | null
  classroom_id?: number | null
  answers?: { text: string; is_correct: boolean }[]
}

export type QuestionTopicDto = {
  id: number
  title: string
}

type TopicFilter = number | 'all' | 'general'

const questionKeyExtractor = (question: QuestionListItemDto) => String(question.id)

function buildQuestionHref({
  classroomId,
  difficulty,
  subjectId,
  topicId,
}: {
  subjectId: number
  classroomId?: number | null
  topicId: TopicFilter
  difficulty: DifficultyLevel | 'all'
}): Href {
  const params: Record<string, string> = { subjectId: String(subjectId) }
  if (classroomId) params.classroomId = String(classroomId)
  if (typeof topicId === 'number') params.topicId = String(topicId)
  if (difficulty !== 'all') params.difficulty = String(difficulty)
  return { pathname: '/(teacher)/subject/add-question', params } as Href
}

export const SubjectQuestionsTab = React.memo(function SubjectQuestionsTab({
  filteredQuestions,
  isDesktop,
  onDeleteQuestion,
  onDifficultyChange,
  questionsCount,
  selectedClassroomId,
  selectedDifficulty,
  selectedTopicId,
  selectedTopicLabel,
  subjectId,
  topics,
}: {
  subjectId: number
  selectedClassroomId?: number | null
  selectedTopicId: TopicFilter
  selectedDifficulty: DifficultyLevel | 'all'
  selectedTopicLabel: string
  filteredQuestions: QuestionListItemDto[]
  questionsCount: number
  topics: QuestionTopicDto[]
  isDesktop: boolean
  onDifficultyChange: (value: DifficultyLevel | 'all') => void
  onDeleteQuestion: (questionId: number) => void
}) {
  const router = useRouter()
  const addQuestionHref = useMemo(() => buildQuestionHref({
    classroomId: selectedClassroomId,
    difficulty: selectedDifficulty,
    subjectId,
    topicId: selectedTopicId,
  }), [selectedClassroomId, selectedDifficulty, selectedTopicId, subjectId])
  const openAddQuestion = useCallback(() => router.push(addQuestionHref), [addQuestionHref, router])

  return (
    <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
      <View className={isDesktop ? 'flex-[1.45] gap-5' : 'gap-5'}>
        <SubjectQuestionsPanel
          addQuestionHref={addQuestionHref}
          filteredQuestions={filteredQuestions}
          onDeleteQuestion={onDeleteQuestion}
          onDifficultyChange={onDifficultyChange}
          selectedDifficulty={selectedDifficulty}
          selectedTopicLabel={selectedTopicLabel}
          subjectId={subjectId}
          topics={topics}
        />
      </View>

      <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
        <SubjectPanel title="Gestión rápida">
          <View className="mb-3">
            <AppButton label="Nueva pregunta" accessibilityLabel="Crear nueva pregunta" icon="add" role="teacher" fullWidth onPress={openAddQuestion} />
          </View>
          <Text className="text-[12px] text-text-muted">
            Total preguntas: <Text className="font-bold text-white">{questionsCount}</Text>
          </Text>
        </SubjectPanel>
      </View>
    </View>
  )
})

export const SubjectQuestionsPanel = React.memo(function SubjectQuestionsPanel({
  addQuestionHref,
  filteredQuestions,
  onDeleteQuestion,
  onDifficultyChange,
  selectedDifficulty,
  selectedTopicLabel,
  subjectId,
  topics,
}: {
  addQuestionHref: Href
  subjectId: number
  selectedDifficulty: DifficultyLevel | 'all'
  selectedTopicLabel: string
  filteredQuestions: QuestionListItemDto[]
  topics: QuestionTopicDto[]
  onDifficultyChange: (value: DifficultyLevel | 'all') => void
  onDeleteQuestion: (questionId: number) => void
}) {
  const router = useRouter()
  const topicNames = useMemo(() => new Map(topics.map((topic) => [topic.id, topic.title])), [topics])
  const openAddQuestion = useCallback(() => router.push(addQuestionHref), [addQuestionHref, router])
  const renderQuestion = useCallback((question: QuestionListItemDto, index: number) => (
    <QuestionRow
      question={question}
      index={filteredQuestions.length - index}
      subjectId={subjectId}
      topicName={question.topic_id ? topicNames.get(question.topic_id) : 'Tema general'}
      onDeleteQuestion={onDeleteQuestion}
    />
  ), [filteredQuestions.length, onDeleteQuestion, subjectId, topicNames])

  return (
    <SubjectPanel title={`Preguntas: ${selectedTopicLabel}`}>
      <DifficultyFilterBar selected={selectedDifficulty} onChange={onDifficultyChange} />
      {filteredQuestions.length === 0 ? (
        <View className="items-center rounded-xl border border-dashed border-border-default bg-surface-default p-8">
          <Ionicons name="help-circle-outline" size={44} color="#64748B" />
          <Text className="mt-3 text-center font-bold text-white">No hay preguntas todavía</Text>
          <Text className="mt-1 text-center text-[12px] text-text-muted">Añade tu primera pregunta para activar este tema.</Text>
          <View className="mt-5">
            <AppButton label="Crear pregunta" accessibilityLabel="Crear primera pregunta" icon="add" role="teacher" onPress={openAddQuestion} />
          </View>
        </View>
      ) : (
        <VirtualizedStack
          data={filteredQuestions}
          keyExtractor={questionKeyExtractor}
          renderItem={renderQuestion}
          accessibilityLabel="Preguntas del curso"
        />
      )}
    </SubjectPanel>
  )
})

const DifficultyFilterBar = React.memo(function DifficultyFilterBar({
  onChange,
  selected,
}: {
  selected: DifficultyLevel | 'all'
  onChange: (value: DifficultyLevel | 'all') => void
}) {
  const items = useMemo(() => [
    { key: 'all' as const, label: 'Todas' },
    ...difficultyOptions.map((option) => ({ key: option.value, label: option.label })),
  ], [])

  return (
    <View className="mb-4">
      <AppTabs accessibilityLabel="Filtrar preguntas por dificultad" compact items={items} onChange={onChange} role="teacher" value={selected} />
    </View>
  )
})

const QuestionRow = React.memo(function QuestionRow({
  question,
  index,
  subjectId,
  topicName,
  onDeleteQuestion,
}: {
  question: QuestionListItemDto
  index: number
  subjectId: number
  topicName?: string
  onDeleteQuestion: (questionId: number) => void
}) {
  const router = useRouter()
  const answer = question.answers?.find((item) => item.is_correct)?.text || 'Sin respuesta marcada'
  const difficulty = getDifficultyMeta(question.difficulty || 1)
  const editHref = useMemo(() => ({
    pathname: '/(teacher)/subject/edit-question',
    params: {
      questionId: String(question.id),
      subjectId: String(subjectId),
      ...(question.classroom_id ? { classroomId: String(question.classroom_id) } : {}),
      ...(question.topic_id ? { topicId: String(question.topic_id) } : {}),
      difficulty: String(question.difficulty || 1),
    },
  } as Href), [question.classroom_id, question.difficulty, question.id, question.topic_id, subjectId])
  const openEditor = useCallback(() => router.push(editHref), [editHref, router])
  const deleteQuestion = useCallback(() => onDeleteQuestion(question.id), [onDeleteQuestion, question.id])

  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="flex-row flex-wrap items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-interactive">
          <Text className="font-black text-brand-teacher">{index}</Text>
        </View>
        <View className="min-w-[220px] flex-1">
          <Text className="font-black text-white">{question.text}</Text>
          <Text className="mt-2 text-[12px] text-semantic-success">✓ {answer}</Text>
          {topicName ? <Text className="mt-1 text-[11px] font-semibold text-text-muted">{topicName}</Text> : null}
          <Text className="mt-1 text-[11px] font-black" style={{ color: difficulty.color }}>{difficulty.label}</Text>
        </View>
        <View className="rounded-lg bg-surface-interactive px-3 py-2">
          <Text className="text-[11px] font-black text-text-secondary">{question.points_base ?? 0} pts</Text>
        </View>
        <AppButton accessibilityLabel={`Editar pregunta: ${question.text}`} icon="create-outline" iconOnly size="sm" variant="secondary" onPress={openEditor} />
        <AppButton accessibilityLabel={`Eliminar pregunta: ${question.text}`} icon="trash-outline" iconOnly size="sm" variant="danger" onPress={deleteQuestion} />
      </View>
    </View>
  )
})
