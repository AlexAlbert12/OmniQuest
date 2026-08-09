import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { withAlpha } from '../../../lib/color'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'
import { formatCount } from '../../../lib/formatCount'
import type {
  TeacherDashboardSummary,
  TeacherRecentActivity,
} from '../../../lib/teacherServerData'

export function TeacherRecentCourses({ courses }: { courses: TeacherDashboardSummary['recentCourses'] }) {
  const router = useRouter()

  if (courses.length === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Crear el primer curso"
        onPress={() => router.push('/(teacher)/create-subject' as never)}
        className="items-center rounded-2xl border border-dashed border-border-active bg-surface-default p-8"
      >
        <Ionicons name="add-circle-outline" size={42} color="#A78BFA" />
        <Text className="mt-3 text-[18px] font-black text-text-primary">Crea tu primer curso</Text>
        <Text className="mt-2 text-center text-[13px] text-text-secondary">Empieza con el contenido y añade las clases cuando lo necesites.</Text>
      </Pressable>
    )
  }

  return (
    <View className="gap-3">
      {courses.map((course) => {
        const color = course.themeColor || '#8B5CF6'
        return (
          <Pressable
            key={course.id}
            accessibilityRole="button"
            accessibilityLabel={`Abrir curso ${course.name}`}
            onPress={() => router.push(`/(teacher)/subject/${course.id}` as never)}
            className="flex-row items-center gap-4 rounded-2xl border border-border-default bg-surface-default p-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(color, '28') }}>
              <Ionicons name={normalizeAcademicIcon(course.icon, 'book-outline')} size={23} color={color} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-black text-text-primary" numberOfLines={2}>{course.name}</Text>
              <Text className="mt-1 text-[12px] text-text-secondary">
                {formatCount(course.enrolledCount, 'alumno', 'alumnos')} · {formatCount(course.questionsCount, 'pregunta', 'preguntas')} · {formatCount(course.classroomCount, 'clase', 'clases')}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-[15px] font-black text-brand-teacher">{course.averageScore} XP</Text>
              <Text className="mt-1 text-[11px] text-text-muted">Media</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8FA7C7" />
          </Pressable>
        )
      })}
    </View>
  )
}

export function TeacherRecentActivityList({ items }: { items: TeacherRecentActivity[] }) {
  if (items.length === 0) {
    return <EmptyState icon="time-outline" text="Aún no hay actividad reciente en tus cursos." />
  }

  return (
    <View className="gap-3">
      {items.map((item) => {
        const enrollment = item.type === 'enrollment'
        const pendingReview = item.type === 'attempt' && item.isCorrect == null
        const incorrect = item.type === 'attempt' && item.isCorrect === false
        const color = enrollment ? '#38BDF8' : pendingReview ? '#F59E0B' : incorrect ? '#FB7185' : '#34D399'
        const icon = enrollment ? 'person-add-outline' : pendingReview ? 'time-outline' : incorrect ? 'close' : 'checkmark'
        const title = enrollment
          ? `${item.studentName} se unió a ${item.subjectName}`
          : `${item.studentName} ${item.isCorrect === true ? 'acertó' : 'respondió'} en ${item.subjectName}`
        const detail = enrollment ? item.classroomName || 'Nueva inscripción' : item.questionText || 'Pregunta completada'
        return (
          <View key={item.id} className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '25') }}>
              <Ionicons name={icon} size={18} color={color} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-bold text-text-primary" numberOfLines={2}>{title}</Text>
              <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>{detail}</Text>
            </View>
            <Text className="text-[11px] text-text-muted">{formatRelative(item.eventAt)}</Text>
          </View>
        )
      })}
    </View>
  )
}

export function TeacherProblemQuestions({ questions }: { questions: TeacherDashboardSummary['problematicQuestions'] }) {
  const router = useRouter()
  if (questions.length === 0) return <EmptyState icon="checkmark-circle-outline" text="No hay preguntas problemáticas detectadas." />

  return (
    <View className="gap-3">
      {questions.slice(0, 4).map((question) => (
        <View key={question.id} className="rounded-xl border border-border-default bg-surface-raised p-3">
          <Text className="font-bold text-text-primary" numberOfLines={2}>{question.text}</Text>
          <Text className="mt-1 text-[11px] text-semantic-danger">
            {question.failures} fallos · {question.failureRate}% · {question.subjectName}
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar ${question.text}`}
              onPress={() => router.push(`/(teacher)/subject/edit-question?id=${question.id}&subjectId=${question.subjectId}` as never)}
              className="rounded-lg border border-border-active bg-surface-selected px-3 py-2"
            >
              <Text className="text-[11px] font-black text-brand-teacher">Editar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver informe de ${question.text}`}
              onPress={() => router.push(`/(teacher)/question-report/${question.id}` as never)}
              className="rounded-lg border border-border-default px-3 py-2"
            >
              <Text className="text-[11px] font-black text-text-secondary">Ver intentos</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  )
}

export function TeacherDashboardPanel({ title, actionLabel, onAction, children }: {
  title: string
  actionLabel?: string
  onAction?: () => void
  children: React.ReactNode
}) {
  return (
    <View className="rounded-2xl border border-border-default bg-surface-default p-5">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[18px] font-black text-text-primary">{title}</Text>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
            <Text className="text-[12px] font-black text-brand-teacher">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}

function EmptyState({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-border-default bg-surface-raised px-4 py-6">
      <Ionicons name={icon} size={34} color="#8FA7C7" />
      <Text className="mt-2 text-center text-[12px] text-text-muted">{text}</Text>
    </View>
  )
}

function formatRelative(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Ayer' : `Hace ${days} días`
}
