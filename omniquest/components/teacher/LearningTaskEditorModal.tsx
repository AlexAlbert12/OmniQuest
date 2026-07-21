import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import {
  parseDateTimeInput,
  taskPriorityOptions,
  taskStatusOptions,
  toDateTimeInputValue,
  type LearningTask,
  type LearningTaskPriority,
  type LearningTaskStatus,
} from '../../lib/learningTasks'

type SubjectOption = { id: number; name: string; theme_color: string | null }
type ClassroomOption = { id: number; subject_id: number; name: string }
type TopicOption = { id: number; subject_id: number; classroom_id: number; title: string }

type LearningTaskEditorModalProps = {
  visible: boolean
  task?: LearningTask | null
  defaultDate?: Date | null
  subjects: SubjectOption[]
  classrooms: ClassroomOption[]
  topics: TopicOption[]
  onClose: () => void
  onSaved: () => void
}

export default function LearningTaskEditorModal({
  visible,
  task,
  defaultDate,
  subjects,
  classrooms,
  topics,
  onClose,
  onSaved,
}: LearningTaskEditorModalProps) {
  const { colors, accentColor } = useAppTheme()
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [classroomId, setClassroomId] = useState<number | null>(null)
  const [topicId, setTopicId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [status, setStatus] = useState<LearningTaskStatus>('draft')
  const [priority, setPriority] = useState<LearningTaskPriority>('normal')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    const initialSubject = task?.subject_id ?? subjects[0]?.id ?? null
    const initialClassroom = task?.classroom_id
      ?? classrooms.find((item) => item.subject_id === initialSubject)?.id
      ?? null
    const baseDueDate = defaultDate ? new Date(defaultDate) : new Date(Date.now() + 24 * 60 * 60 * 1000)
    baseDueDate.setHours(23, 59, 0, 0)

    setSubjectId(initialSubject)
    setClassroomId(initialClassroom)
    setTopicId(task?.topic_id ?? null)
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setStartsAt(task?.starts_at ? toDateTimeInputValue(task.starts_at) : '')
    setDueAt(task?.due_at ? toDateTimeInputValue(task.due_at) : toDateTimeInputValue(baseDueDate))
    setStatus(task?.status ?? 'draft')
    setPriority(task?.priority ?? 'normal')
    setErrorMessage(null)
  }, [classrooms, defaultDate, subjects, task, visible])

  const visibleClassrooms = useMemo(
    () => classrooms.filter((item) => item.subject_id === subjectId),
    [classrooms, subjectId]
  )
  const visibleTopics = useMemo(
    () => topics.filter((item) => item.subject_id === subjectId && item.classroom_id === classroomId),
    [classroomId, subjectId, topics]
  )

  const selectSubject = (nextSubjectId: number) => {
    setSubjectId(nextSubjectId)
    const nextClassroomId = classrooms.find((item) => item.subject_id === nextSubjectId)?.id ?? null
    setClassroomId(nextClassroomId)
    setTopicId(null)
  }

  const selectClassroom = (nextClassroomId: number) => {
    setClassroomId(nextClassroomId)
    setTopicId(null)
  }

  const save = async () => {
    setErrorMessage(null)
    const parsedStartsAt = startsAt.trim() ? parseDateTimeInput(startsAt) : null
    const parsedDueAt = parseDateTimeInput(dueAt)

    if (!subjectId || !classroomId) {
      setErrorMessage('Selecciona un curso y una clase.')
      return
    }
    if (!title.trim()) {
      setErrorMessage('Escribe un título para la tarea.')
      return
    }
    if (!parsedDueAt) {
      setErrorMessage('Usa el formato AAAA-MM-DD HH:mm para la fecha límite.')
      return
    }
    if (startsAt.trim() && !parsedStartsAt) {
      setErrorMessage('La fecha de inicio no tiene un formato válido.')
      return
    }
    if (parsedStartsAt && parsedDueAt <= parsedStartsAt) {
      setErrorMessage('La fecha límite debe ser posterior a la fecha de inicio.')
      return
    }

    setSaving(true)
    try {
      const { error } = await (supabase.rpc as any)('save_learning_task', {
        p_task_id: task?.id ?? null,
        p_subject_id: subjectId,
        p_classroom_id: classroomId,
        p_topic_id: topicId,
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_starts_at: parsedStartsAt?.toISOString() ?? null,
        p_due_at: parsedDueAt.toISOString(),
        p_status: status,
        p_priority: priority,
      })
      if (error) throw error
      onSaved()
      onClose()
    } catch (error: any) {
      setErrorMessage(error?.message || 'No se pudo guardar la tarea.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={saving ? undefined : onClose}
      statusBarTranslucent
    >
      <Pressable
        accessibilityLabel="Cerrar editor de tarea"
        accessibilityRole="button"
        disabled={saving}
        onPress={onClose}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={() => undefined}
          style={[
            styles.panel,
            {
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              ...(Platform.OS === 'web' ? ({ boxShadow: '0 28px 80px rgba(0,0,0,0.48)' } as any) : {}),
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{task ? 'Editar tarea' : 'Nueva tarea'}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Planifica qué debe completar la clase y cuándo.</Text>
            </View>
            <Pressable
              accessibilityLabel="Cerrar"
              accessibilityRole="button"
              hitSlop={8}
              disabled={saving}
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <FieldLabel label="Curso" />
            <View style={styles.chips}>
              {subjects.map((subject) => {
                const active = subject.id === subjectId
                const color = subject.theme_color || accentColor
                return (
                  <ChoiceChip key={subject.id} active={active} color={color} label={subject.name} onPress={() => selectSubject(subject.id)} />
                )
              })}
            </View>

            <FieldLabel label="Clase" />
            <View style={styles.chips}>
              {visibleClassrooms.map((classroom) => (
                <ChoiceChip
                  key={classroom.id}
                  active={classroom.id === classroomId}
                  color={accentColor}
                  label={classroom.name}
                  onPress={() => selectClassroom(classroom.id)}
                />
              ))}
            </View>

            <FieldLabel label="Tema opcional" />
            <View style={styles.chips}>
              <ChoiceChip active={topicId === null} color={accentColor} label="Cualquier tema" onPress={() => setTopicId(null)} />
              {visibleTopics.map((topic) => (
                <ChoiceChip key={topic.id} active={topic.id === topicId} color={accentColor} label={topic.title} onPress={() => setTopicId(topic.id)} />
              ))}
            </View>

            <FieldLabel label="Título" />
            <TextInput
              accessibilityLabel="Título de la tarea"
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Completar el tema de fracciones"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            />

            <FieldLabel label="Descripción" />
            <TextInput
              accessibilityLabel="Descripción de la tarea"
              value={description}
              onChangeText={setDescription}
              placeholder="Indicaciones, objetivos o material que deben revisar."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            />

            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <FieldLabel label="Disponible desde (opcional)" />
                <TextInput
                  accessibilityLabel="Fecha de inicio"
                  value={startsAt}
                  onChangeText={setStartsAt}
                  placeholder="AAAA-MM-DD HH:mm"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                />
              </View>
              <View style={styles.column}>
                <FieldLabel label="Fecha límite" />
                <TextInput
                  accessibilityLabel="Fecha límite"
                  value={dueAt}
                  onChangeText={setDueAt}
                  placeholder="AAAA-MM-DD HH:mm"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                />
              </View>
            </View>
            <Text style={[styles.hint, { color: colors.textMuted }]}>Formato: 2026-07-30 23:59. Las fechas se guardan con la zona horaria del dispositivo.</Text>

            <FieldLabel label="Prioridad" />
            <View style={styles.chips}>
              {taskPriorityOptions.map((option) => (
                <ChoiceChip key={option.value} active={option.value === priority} color={option.color} label={option.label} onPress={() => setPriority(option.value)} />
              ))}
            </View>

            <FieldLabel label="Estado" />
            <View style={styles.chips}>
              {taskStatusOptions.map((option) => (
                <ChoiceChip key={option.value} active={option.value === status} color={accentColor} label={option.label} onPress={() => setStatus(option.value)} />
              ))}
            </View>
            {status === 'published' ? (
              <View style={[styles.infoBox, { borderColor: withAlpha('#38BDF8', '70'), backgroundColor: withAlpha('#38BDF8', '14') }]}>
                <Ionicons name="notifications-outline" size={19} color="#38BDF8" />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>Al publicar, los alumnos inscritos recibirán una notificación y verán la tarea en su planificación.</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={[styles.errorBox, { borderColor: withAlpha(colors.danger, '90'), backgroundColor: withAlpha(colors.danger, '14') }]}>
                <Ionicons name="alert-circle" size={19} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.72 : 1 }]}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => void save()}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: accentColor, opacity: saving ? 0.55 : pressed ? 0.78 : 1 }]}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="save-outline" size={19} color="#FFFFFF" />}
              <Text style={styles.primaryText}>{task ? 'Guardar cambios' : 'Crear tarea'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function FieldLabel({ label }: { label: string }) {
  const { colors } = useAppTheme()
  return <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
}

function ChoiceChip({ active, color, label, onPress }: { active: boolean; color: string; label: string; onPress: () => void }) {
  const { colors } = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: active ? color : colors.border,
          backgroundColor: active ? withAlpha(color, '22') : colors.surfaceMuted,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? color : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(1, 6, 17, 0.82)' },
  panel: { width: '100%', maxWidth: 820, maxHeight: '94%', overflow: 'hidden', borderWidth: 1, borderRadius: 26 },
  header: { padding: 18, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { minWidth: 0, flex: 1 },
  headerTitle: { fontSize: 21, fontWeight: '900' },
  headerSubtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  closeButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 24 },
  label: { marginTop: 16, marginBottom: 8, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, maxWidth: '100%', borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '800' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontWeight: '600' },
  textArea: { minHeight: 100 },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  column: { minWidth: 230, flex: 1 },
  hint: { marginTop: 7, fontSize: 11, lineHeight: 16 },
  infoBox: { marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  infoText: { minWidth: 0, flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  errorBox: { marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { minWidth: 0, flex: 1, fontSize: 12, fontWeight: '800' },
  footer: { padding: 16, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  secondaryButton: { minHeight: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 13, fontWeight: '900' },
  primaryButton: { minHeight: 46, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
})
