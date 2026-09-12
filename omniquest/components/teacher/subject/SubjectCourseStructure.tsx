import React from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Classroom, TopicRow } from '../../../hooks/teacher/useTeacherSubjectDetail'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
import AppTabs from '../../ui/AppTabs'
import DateTimeCalendarField from '../../ui/DateTimeCalendarField'
import { SubjectPanel as Panel, type IconName } from './SubjectShared'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'

export function SubjectClassroomContextSelector({ classrooms, selectedClassroomId, onSelect, compact = false }: {
  classrooms: Classroom[]
  selectedClassroomId: number | null
  onSelect: (classroomId: number) => void
  compact?: boolean
}) {
  if (classrooms.length === 0) return null

  const dropdown = (
    <AppDropdown
      accessibilityLabel="Seleccionar clase activa"
      compact={compact}
      role="teacher"
      value={selectedClassroomId ?? classrooms[0].id}
      options={classrooms.map((classroom) => ({
        value: classroom.id,
        label: classroom.name,
        description: classroom.code ? `Código ${classroom.code}${classroom.academic_year ? ` · ${classroom.academic_year}` : ''}` : classroom.academic_year || undefined,
      }))}
      onChange={onSelect}
      style={compact ? { width: '100%' } : { minWidth: 220, flex: 1 }}
    />
  )

  return (
    <View className={`mb-4 rounded-2xl border border-border-default bg-surface-default ${compact ? 'p-3' : 'p-4'}`}>
      <View className={compact ? 'gap-3' : 'flex-row flex-wrap items-center gap-3'}>
        <View className="flex-row items-center gap-3" style={compact ? undefined : { minWidth: 230, flex: 1.1 }}>
          <View className={`${compact ? 'h-10 w-10' : 'h-11 w-11'} items-center justify-center rounded-xl bg-surface-selected`}>
            <Ionicons name="people-outline" size={compact ? 19 : 20} color="#38BDF8" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-black uppercase tracking-wide text-text-muted">Clase activa</Text>
            {!compact ? <Text className="mt-1 text-[12px] text-text-secondary">Este contexto se mantiene al cambiar entre Resumen, Temas, Preguntas, Alumnos y Analítica.</Text> : null}
          </View>
        </View>
        {dropdown}
      </View>
    </View>
  )
}

export function SubjectClassroomsSection({
  compact = false,
  creating,
  newClassroomName,
  onCreate,
  onNameChange,
}: {
  compact?: boolean
  creating: boolean
  newClassroomName: string
  onCreate: () => void
  onNameChange: (value: string) => void
}) {
  return (
    <Panel title="Clases del curso">
      <View className="border-t border-border-subtle pt-3">
        <Text className="mb-2 text-[12px] font-semibold text-text-secondary">Nueva clase dentro del curso</Text>
        <View className={compact ? 'gap-2' : 'flex-row items-center gap-2'}>
          <TextInput
            accessibilityLabel="Nombre de la nueva clase"
            className={compact ? "w-full rounded-xl border border-border-default bg-surface-default px-4 py-3 text-white" : "min-w-0 flex-1 rounded-xl border border-border-default bg-surface-default px-4 py-3 text-white"}
            placeholder="Ej. Grupo A, 1º DAM tarde..."
            placeholderTextColor="#60799C"
            value={newClassroomName}
            onChangeText={onNameChange}
          />
          <AppButton label="Crear clase" accessibilityLabel={creating ? 'Creando clase' : 'Crear clase'} icon="add" loading={creating} disabled={creating} role="teacher" variant="primary" fullWidth={compact} onPress={onCreate} />
        </View>
      </View>
    </Panel>
  )
}

export function SubjectTopicsSection({
  creating,
  newTopicAvailableUntil,
  newTopicDescription,
  newTopicTitle,
  onAvailableUntilChange,
  onCreate,
  onDescriptionChange,
  onOpenTopic,
  onSelectTopic,
  onTitleChange,
  selectedTopicId,
  selectedClassroomName,
  topicRows,
  isMobile = false,
}: {
  creating: boolean
  newTopicAvailableUntil: string
  newTopicDescription: string
  newTopicTitle: string
  onAvailableUntilChange: (value: string) => void
  onCreate: () => void
  onDescriptionChange: (value: string) => void
  onOpenTopic: (topicId: number) => void
  onSelectTopic: (topicId: number | 'all' | 'general') => void
  onTitleChange: (value: string) => void
  selectedTopicId: number | 'all' | 'general'
  selectedClassroomName?: string | null
  topicRows: TopicRow[]
  isMobile?: boolean
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
              icon: normalizeAcademicIcon(topic.icon, 'book-outline'),
            })),
          ]}
          mobileRail={isMobile}
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
          <AppButton
            label="Crear tema"
            accessibilityLabel={creating ? 'Creando tema' : 'Crear tema'}
            icon="add"
            loading={creating}
            disabled={creating}
            role="teacher"
            style={{ alignSelf: 'flex-end' }}
            onPress={onCreate}
          />
        </View>
      </View>
    </Panel>
  )
}
