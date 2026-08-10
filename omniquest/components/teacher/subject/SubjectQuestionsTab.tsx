import React, { useCallback, useMemo } from 'react'
import { Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { difficultyOptions, getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty'
import { SubjectPanel } from './SubjectShared'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
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

function buildQuestionHref({ classroomId, difficulty, subjectId, topicId }: {
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
  onDeleteQuestion,
  onDifficultyChange,
  onTopicChange,
  selectedClassroomId,
  selectedDifficulty,
  selectedTopicId,
  subjectId,
  topics,
}: {
  subjectId: number
  selectedClassroomId?: number | null
  selectedTopicId: TopicFilter
  selectedDifficulty: DifficultyLevel | 'all'
  filteredQuestions: QuestionListItemDto[]
  topics: QuestionTopicDto[]
  onDifficultyChange: (value: DifficultyLevel | 'all') => void
  onTopicChange: (value: TopicFilter) => void
  onDeleteQuestion: (questionId: number) => void
}) {
  const addQuestionHref = useMemo(() => buildQuestionHref({ classroomId: selectedClassroomId, difficulty: selectedDifficulty, subjectId, topicId: selectedTopicId }), [selectedClassroomId, selectedDifficulty, selectedTopicId, subjectId])
  return (
    <SubjectQuestionsPanel
      addQuestionHref={addQuestionHref}
      filteredQuestions={filteredQuestions}
      onDeleteQuestion={onDeleteQuestion}
      onDifficultyChange={onDifficultyChange}
      onTopicChange={onTopicChange}
      selectedDifficulty={selectedDifficulty}
      selectedTopicId={selectedTopicId}
      subjectId={subjectId}
      topics={topics}
    />
  )
})

export const SubjectQuestionsPanel = React.memo(function SubjectQuestionsPanel({
  addQuestionHref,
  filteredQuestions,
  onDeleteQuestion,
  onDifficultyChange,
  onTopicChange,
  selectedDifficulty,
  selectedTopicId,
  subjectId,
  topics,
}: {
  addQuestionHref: Href
  subjectId: number
  selectedDifficulty: DifficultyLevel | 'all'
  selectedTopicId: TopicFilter
  filteredQuestions: QuestionListItemDto[]
  topics: QuestionTopicDto[]
  onDifficultyChange: (value: DifficultyLevel | 'all') => void
  onTopicChange: (value: TopicFilter) => void
  onDeleteQuestion: (questionId: number) => void
}) {
  const router = useRouter()
  const topicNames = useMemo(() => new Map(topics.map((topic) => [topic.id, topic.title])), [topics])
  const topicOptions = useMemo(() => [
    { value: 'all' as const, label: 'Todos los temas', icon: 'albums-outline' as const },
    { value: 'general' as const, label: 'Tema general', icon: 'folder-open-outline' as const },
    ...topics.map((topic) => ({ value: topic.id, label: topic.title, icon: 'book-outline' as const })),
  ], [topics])
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
    <SubjectPanel
      title="Preguntas"
      headerAction={<AppButton label="Añadir pregunta" accessibilityLabel="Añadir pregunta" icon="add" size="sm" role="teacher" onPress={openAddQuestion} />}
    >
      <View className="mb-4 gap-3">
        <AppDropdown<TopicFilter>
          accessibilityLabel="Filtrar preguntas por tema"
          label="Tema"
          options={topicOptions}
          value={selectedTopicId}
          onChange={onTopicChange}
        />
        <DifficultyFilterBar selected={selectedDifficulty} onChange={onDifficultyChange} />
      </View>

      {filteredQuestions.length === 0 ? (
        <View className="items-center rounded-xl border border-dashed border-border-default bg-surface-default p-8">
          <Ionicons name="help-circle-outline" size={44} color="#64748B" />
          <Text className="mt-3 text-center font-bold text-white">No hay preguntas todavía</Text>
          <Text className="mt-1 text-center text-[12px] text-text-muted">Usa “Añadir pregunta” para crear la primera pregunta con los filtros actuales.</Text>
        </View>
      ) : (
        <VirtualizedStack data={filteredQuestions} keyExtractor={questionKeyExtractor} renderItem={renderQuestion} accessibilityLabel="Preguntas del curso" />
      )}
    </SubjectPanel>
  )
})

const DifficultyFilterBar = React.memo(function DifficultyFilterBar({ onChange, selected }: {
  selected: DifficultyLevel | 'all'
  onChange: (value: DifficultyLevel | 'all') => void
}) {
  const items = useMemo(() => [{ key: 'all' as const, label: 'Todas' }, ...difficultyOptions.map((option) => ({ key: option.value, label: option.label }))], [])
  return <AppTabs accessibilityLabel="Filtrar preguntas por dificultad" compact items={items} onChange={onChange} role="teacher" value={selected} />
})

const QuestionRow = React.memo(function QuestionRow({ question, index, subjectId, topicName, onDeleteQuestion }: {
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
      questionId: String(question.id), subjectId: String(subjectId),
      ...(question.classroom_id ? { classroomId: String(question.classroom_id) } : {}),
      ...(question.topic_id ? { topicId: String(question.topic_id) } : {}), difficulty: String(question.difficulty || 1),
    },
  } as Href), [question.classroom_id, question.difficulty, question.id, question.topic_id, subjectId])
  const openEditor = useCallback(() => router.push(editHref), [editHref, router])
  const deleteQuestion = useCallback(() => onDeleteQuestion(question.id), [onDeleteQuestion, question.id])

  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="flex-row flex-wrap items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-interactive"><Text className="font-black text-brand-teacher">{index}</Text></View>
        <View className="min-w-[220px] flex-1">
          <Text className="font-black text-white">{question.text}</Text>
          <Text className="mt-2 text-[12px] text-semantic-success">✓ {answer}</Text>
          {topicName ? <Text className="mt-1 text-[11px] font-semibold text-text-muted">{topicName}</Text> : null}
          <Text className="mt-1 text-[11px] font-black" style={{ color: difficulty.color }}>{difficulty.label}</Text>
        </View>
        <View className="rounded-lg bg-surface-interactive px-3 py-2"><Text className="text-[11px] font-black text-text-secondary">{question.points_base ?? 0} pts</Text></View>
        <AppButton accessibilityLabel={`Editar pregunta: ${question.text}`} icon="create-outline" iconOnly size="sm" variant="secondary" onPress={openEditor} />
        <AppButton accessibilityLabel={`Eliminar pregunta: ${question.text}`} icon="trash-outline" iconOnly size="sm" variant="danger" onPress={deleteQuestion} />
      </View>
    </View>
  )
})
