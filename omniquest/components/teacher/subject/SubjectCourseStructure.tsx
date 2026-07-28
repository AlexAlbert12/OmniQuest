import React from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { difficultyOptions, type DifficultyLevel } from '../../../lib/difficulty'
import type { Classroom, TopicRow } from '../../../hooks/teacher/useTeacherSubjectDetail'
import AppButton from '../../ui/AppButton'
import AppTabs from '../../ui/AppTabs'
import DateTimeCalendarField from '../../ui/DateTimeCalendarField'
import { SubjectPanel as Panel, type IconName } from './SubjectShared'

export function SubjectClassroomsSection({
  classrooms,
  creating,
  newClassroomName,
  onCreate,
  onNameChange,
  onSelect,
  selectedClassroomId,
}: {
  classrooms: Classroom[]
  creating: boolean
  newClassroomName: string
  onCreate: () => void
  onNameChange: (value: string) => void
  onSelect: (classroomId: number) => void
  selectedClassroomId: number | null
}) {
  return (
    <Panel title="Clases del curso">
      {classrooms.length > 0 ? (
        <AppTabs
          accessibilityLabel="Clases del curso"
          items={classrooms.map((classroom) => ({
            key: classroom.id,
            label: classroom.code ? `${classroom.name} · ${classroom.code}` : classroom.name,
            icon: 'people-outline' as IconName,
          }))}
          onChange={onSelect}
          role="teacher"
          value={selectedClassroomId ?? classrooms[0].id}
        />
      ) : (
        <View className="rounded-xl border border-dashed border-border-default bg-surface-default p-4">
          <Text className="text-[12px] text-text-muted">Todavía no hay clases en este curso.</Text>
        </View>
      )}

      <View className="mt-4 flex-row flex-wrap items-end gap-3 border-t border-border-subtle pt-4">
        <View className="min-w-[240px] flex-1">
          <Text className="mb-2 text-[12px] font-semibold text-text-secondary">Nueva clase dentro del curso</Text>
          <TextInput
            accessibilityLabel="Nombre de la nueva clase"
            className="rounded-xl border border-border-default bg-surface-default px-4 py-3 text-white"
            placeholder="Ej. Grupo A, 1º DAM tarde..."
            placeholderTextColor="#60799C"
            value={newClassroomName}
            onChangeText={onNameChange}
          />
        </View>
        <AppButton
          label="Crear clase"
          accessibilityLabel={creating ? 'Creando clase' : 'Crear clase'}
          icon="add"
          loading={creating}
          disabled={creating}
          role="teacher"
          onPress={onCreate}
        />
      </View>
    </Panel>
  )
}

export function SubjectTopicsSection({
  creating,
  newTopicAvailableUntil,
  newTopicDescription,
  newTopicDifficulty,
  newTopicTitle,
  onAvailableUntilChange,
  onCreate,
  onDescriptionChange,
  onDifficultyChange,
  onOpenTopic,
  onSelectTopic,
  onTitleChange,
  selectedTopicId,
  selectedClassroomName,
  topicRows,
}: {
  creating: boolean
  newTopicAvailableUntil: string
  newTopicDescription: string
  newTopicDifficulty: DifficultyLevel
  newTopicTitle: string
  onAvailableUntilChange: (value: string) => void
  onCreate: () => void
  onDescriptionChange: (value: string) => void
  onDifficultyChange: (value: DifficultyLevel) => void
  onOpenTopic: (topicId: number) => void
  onSelectTopic: (topicId: number | 'all' | 'general') => void
  onTitleChange: (value: string) => void
  selectedTopicId: number | 'all' | 'general'
  selectedClassroomName?: string | null
  topicRows: TopicRow[]
}) {
  return (
    <Panel title={`Temas de ${selectedClassroomName || 'la clase activa'}`}>
      <View className="mb-4">
        <AppTabs
          accessibilityLabel="Filtrar temas"
          compact
          items={[
            { key: 'all' as const, label: 'Todos', icon: 'albums-outline' as IconName },
            ...topicRows.map((topic) => ({
              key: topic.id,
              label: topic.title,
              icon: topic.icon && topic.icon.includes('-outline') ? topic.icon as IconName : 'book-outline' as IconName,
            })),
          ]}
          onChange={onSelectTopic}
          role="teacher"
          value={selectedTopicId}
        />
      </View>

      <View className="gap-3">
        {topicRows.length === 0 ? (
          <View className="rounded-xl border border-dashed border-border-default bg-surface-default p-5">
            <Text className="font-bold text-white">Todavía no hay temas</Text>
            <Text className="mt-1 text-[12px] text-text-muted">Crea el primer tema para agrupar las preguntas de esta clase.</Text>
          </View>
        ) : topicRows.map((topic) => (
          <Pressable
            key={String(topic.id)}
            accessibilityRole="button"
            onPress={() => typeof topic.id === 'number' ? onOpenTopic(topic.id) : onSelectTopic(topic.id)}
            className="flex-row items-center gap-3 rounded-xl border border-border-default bg-surface-default p-4"
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface-selected">
              <Ionicons name="book-outline" size={21} color="#D8B4FE" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-black text-white" numberOfLines={1}>{topic.title}</Text>
              <Text className="mt-1 text-[12px] text-text-muted">
                {topic.questionsCount} preguntas · {topic.playedCount} resultados · {topic.averageScore} XP media
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8FA7C7" />
          </Pressable>
        ))}
      </View>

      <View className="mt-5 gap-3 border-t border-border-subtle pt-4">
        <Text className="text-[12px] font-black uppercase tracking-wide text-text-secondary">Crear tema</Text>
        <View className="flex-row flex-wrap items-end gap-3">
          <View className="min-w-[220px] flex-1">
            <TextInput
              accessibilityLabel="Título del nuevo tema"
              className="rounded-xl border border-border-default bg-surface-default px-4 py-3 text-white"
              placeholder="Ej. Ecuaciones de primer grado"
              placeholderTextColor="#60799C"
              value={newTopicTitle}
              onChangeText={onTitleChange}
            />
          </View>
          <View className="min-w-[220px] flex-1">
            <TextInput
              accessibilityLabel="Descripción del nuevo tema"
              className="rounded-xl border border-border-default bg-surface-default px-4 py-3 text-white"
              placeholder="Descripción opcional"
              placeholderTextColor="#60799C"
              value={newTopicDescription}
              onChangeText={onDescriptionChange}
            />
          </View>
        </View>
        <View className="flex-row flex-wrap items-end gap-3">
          <View className="min-w-[280px] flex-[1.2]">
            <DateTimeCalendarField value={newTopicAvailableUntil} onChange={onAvailableUntilChange} />
          </View>
          <View className="min-w-[240px] flex-1">
            <Text className="mb-2 text-[12px] font-semibold text-text-secondary">Dificultad inicial</Text>
            <AppTabs
              accessibilityLabel="Dificultad inicial"
              compact
              fill
              items={difficultyOptions.map((option) => ({ key: option.value, label: option.shortLabel }))}
              onChange={onDifficultyChange}
              role="teacher"
              value={newTopicDifficulty}
            />
          </View>
          <AppButton
            label="Crear tema"
            accessibilityLabel={creating ? 'Creando tema' : 'Crear tema'}
            icon="add"
            loading={creating}
            disabled={creating}
            role="teacher"
            onPress={onCreate}
          />
        </View>
      </View>
    </Panel>
  )
}

export function SubjectAddQuestionCTA({ href, sticky = false }: { href: string; sticky?: boolean }) {
  return (
    <View
      className={sticky ? 'absolute bottom-[82px] left-4 right-4' : ''}
      style={sticky ? { shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 12 } : undefined}
    >
      <Link href={href as any} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Añadir pregunta"
          accessibilityHint="Abre el formulario para crear una pregunta en este curso"
          className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl border border-border-active bg-brand-teacher px-5 py-3"
        >
          <Ionicons name="add" size={21} color="#FFFFFF" />
          <Text className="text-[15px] font-black text-white">Añadir pregunta</Text>
        </Pressable>
      </Link>
    </View>
  )
}
