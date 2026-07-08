import React from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { difficultyOptions, getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty';
import { SubjectPanel } from './SubjectShared';

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
          <Link href={addQuestionHref as any} asChild>
            <Pressable className="mb-3 rounded-xl bg-[#5A46D8] px-4 py-3">
              <Text className="text-center font-bold text-white">Nueva pregunta</Text>
            </Pressable>
          </Link>
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
  return (
    <SubjectPanel title={`Preguntas: ${selectedTopicLabel}`}>
      <DifficultyFilterBar selected={selectedDifficulty} onChange={onDifficultyChange} />
      {filteredQuestions.length === 0 ? (
        <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
          <Ionicons name="help-circle-outline" size={44} color="#64748B" />
          <Text className="mt-3 text-center font-bold text-white">No hay preguntas todavía</Text>
          <Text className="mt-1 text-center text-[12px] text-[#8FA7C7]">Añade tu primera pregunta para activar este tema.</Text>
          <Link href={addQuestionHref as any} asChild>
            <Pressable className="mt-5 rounded-xl bg-[#5A46D8] px-5 py-3">
              <Text className="font-bold text-white">Crear pregunta</Text>
            </Pressable>
          </Link>
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
  const { width } = useWindowDimensions();
  const isPhone = width < 640;

  return (
    <ScrollView
      horizontal={isPhone}
      showsHorizontalScrollIndicator={false}
      className="mb-4"
      contentContainerStyle={{ gap: 8, flexWrap: isPhone ? 'nowrap' : 'wrap', paddingRight: isPhone ? 8 : 0 }}
    >
      <Pressable
        onPress={() => onChange('all')}
        className="rounded-lg border px-3 py-2"
        style={{
          borderColor: selected === 'all' ? '#8B5CF6' : '#20375E',
          backgroundColor: selected === 'all' ? '#312E8126' : '#09162C',
        }}
      >
        <Text className="text-[12px] font-bold" style={{ color: selected === 'all' ? '#D8B4FE' : '#AFC2DB' }}>Todas</Text>
      </Pressable>
      {difficultyOptions.map((option) => {
        const active = selected === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: active ? option.color : '#20375E', backgroundColor: active ? `${option.color}26` : '#09162C' }}
          >
            <Text className="text-[12px] font-bold" style={{ color: active ? '#FFFFFF' : '#AFC2DB' }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
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
        <Link href={`/(teacher)/subject/edit-question?questionId=${question.id}&subjectId=${subjectId}${question.classroom_id ? `&classroomId=${question.classroom_id}` : ''}${question.topic_id ? `&topicId=${question.topic_id}` : ''}&difficulty=${question.difficulty || 1}` as any} asChild>
          <Pressable className="rounded-lg border border-[#4F46E5] bg-[#312E8126] p-2">
            <Ionicons name="create-outline" size={18} color="#A78BFA" />
          </Pressable>
        </Link>
        <Pressable onPress={onDelete} className="rounded-lg border border-[#BE123C] bg-[#7F1D1D33] p-2">
          <Ionicons name="trash-outline" size={18} color="#FB7185" />
        </Pressable>
      </View>
    </View>
  );
}
