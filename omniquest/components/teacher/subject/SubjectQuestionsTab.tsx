import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { difficultyOptions, getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty';
import { SubjectPanel } from './SubjectShared';
import AppButton from '../../ui/AppButton';
import AppTabs from '../../ui/AppTabs';

type Question = {
  id: number
  text: string
  points_base: number | null
  difficulty?: number | null
  topic_id: number | null
  classroom_id?: number | null
  answers?: { text: string; is_correct: boolean }[]
}

type Topic = {
  id: number
  title: string
}

type TopicFilter = number | 'all' | 'general'

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
}) {
  return `/(teacher)/subject/add-question?subjectId=${subjectId}${classroomId ? `&classroomId=${classroomId}` : ''}${typeof topicId === 'number' ? `&topicId=${topicId}` : ''}${difficulty !== 'all' ? `&difficulty=${difficulty}` : ''}`;
}

export function SubjectQuestionsTab({
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
  filteredQuestions: Question[]
  questionsCount: number
  topics: Topic[]
  isDesktop: boolean
  onDifficultyChange: (value: DifficultyLevel | 'all') => void
  onDeleteQuestion: (questionId: number) => void
}) {
  const router = useRouter();
  const addQuestionHref = buildQuestionHref({
    classroomId: selectedClassroomId,
    difficulty: selectedDifficulty,
    subjectId,
    topicId: selectedTopicId,
  });

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
            <AppButton
              label="Nueva pregunta"
              accessibilityLabel="Crear nueva pregunta"
              icon="add"
              role="teacher"
              fullWidth
              onPress={() => router.push(addQuestionHref as any)}
            />
          </View>
          <Text className="text-[12px] text-[#8FA7C7]">
            Total preguntas: <Text className="font-bold text-white">{questionsCount}</Text>
          </Text>
        </SubjectPanel>
      </View>
    </View>
  );
}

export function SubjectQuestionsPanel({
  addQuestionHref,
  filteredQuestions,
  onDeleteQuestion,
  onDifficultyChange,
  selectedDifficulty,
  selectedTopicLabel,
  subjectId,
  topics,
}: {
  addQuestionHref: string
  subjectId: number
  selectedDifficulty: DifficultyLevel | 'all'
  selectedTopicLabel: string
  filteredQuestions: Question[]
  topics: Topic[]
  onDifficultyChange: (value: DifficultyLevel | 'all') => void
  onDeleteQuestion: (questionId: number) => void
}) {
  const router = useRouter();

  return (
    <SubjectPanel title={`Preguntas: ${selectedTopicLabel}`}>
      <DifficultyFilterBar selected={selectedDifficulty} onChange={onDifficultyChange} />
      {filteredQuestions.length === 0 ? (
        <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
          <Ionicons name="help-circle-outline" size={44} color="#64748B" />
          <Text className="mt-3 text-center font-bold text-white">No hay preguntas todavía</Text>
          <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Añade tu primera pregunta para activar este tema.</Text>
          <View className="mt-5">
            <AppButton
              label="Crear pregunta"
              accessibilityLabel="Crear primera pregunta"
              icon="add"
              role="teacher"
              onPress={() => router.push(addQuestionHref as any)}
            />
          </View>
        </View>
      ) : (
        <View className="gap-3">
          {filteredQuestions.map((question, index) => (
            <QuestionRow
              key={question.id}
              question={question}
              index={filteredQuestions.length - index}
              subjectId={subjectId}
              topicName={question.topic_id ? topics.find((topic) => topic.id === question.topic_id)?.title : 'Tema general'}
              onDelete={() => onDeleteQuestion(question.id)}
            />
          ))}
        </View>
      )}
    </SubjectPanel>
  );
}

function DifficultyFilterBar({
  onChange,
  selected,
}: {
  selected: DifficultyLevel | 'all'
  onChange: (value: DifficultyLevel | 'all') => void
}) {
  return (
    <View className="mb-4">
      <AppTabs
        accessibilityLabel="Filtrar preguntas por dificultad"
        compact
        items={[
          { key: 'all' as const, label: 'Todas' },
          ...difficultyOptions.map((option) => ({ key: option.value, label: option.label })),
        ]}
        onChange={onChange}
        role="teacher"
        value={selected}
      />
    </View>
  )
}

function QuestionRow({
  question,
  index,
  subjectId,
  topicName,
  onDelete,
}: {
  question: Question
  index: number
  subjectId: number
  topicName?: string
  onDelete: () => void
}) {
  const answer = question.answers?.find((item) => item.is_correct)?.text || 'Sin respuesta marcada';
  const difficulty = getDifficultyMeta(question.difficulty || 1);
  const router = useRouter();
  const editHref = `/(teacher)/subject/edit-question?questionId=${question.id}&subjectId=${subjectId}${question.classroom_id ? `&classroomId=${question.classroom_id}` : ''}${question.topic_id ? `&topicId=${question.topic_id}` : ''}&difficulty=${question.difficulty || 1}`;

  return (
    <View className="rounded-xl border border-[#183052] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg bg-[#1A1E55]">
          <Text className="font-black text-[#A78BFA]">{index}</Text>
        </View>
        <View className="min-w-[220px] flex-1">
          <Text className="font-black text-white">{question.text}</Text>
          <Text className="mt-2 text-[12px] text-[#34D399]">✓ {answer}</Text>
          {topicName ? <Text className="mt-1 text-[11px] font-semibold text-[#8FA7C7]">{topicName}</Text> : null}
          <Text className="mt-1 text-[11px] font-black" style={{ color: difficulty.color }}>{difficulty.label}</Text>
        </View>
        <View className="rounded-lg bg-[#13284A] px-3 py-2">
          <Text className="text-[11px] font-black text-[#C4D0E3]">{question.points_base ?? 0} pts</Text>
        </View>
        <AppButton
          accessibilityLabel={`Editar pregunta: ${question.text}`}
          icon="create-outline"
          iconOnly
          size="sm"
          variant="secondary"
          onPress={() => router.push(editHref as any)}
        />
        <AppButton
          accessibilityLabel={`Eliminar pregunta: ${question.text}`}
          icon="trash-outline"
          iconOnly
          size="sm"
          variant="danger"
          onPress={onDelete}
        />
      </View>
    </View>
  );
}
