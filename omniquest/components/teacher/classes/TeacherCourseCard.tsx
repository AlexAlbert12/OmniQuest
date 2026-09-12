import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { withAlpha } from '../../../lib/color'
import type { TeacherCourse, TeacherCourseAnalytics } from './types'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'
import AppPressable from '../../ui/AppPressable'
import AppButton from '../../ui/AppButton'

const ATTENTION_BADGE_BACKGROUND = '#B77900'

export default function TeacherCourseCard({
  analytics,
  course,
  density,
  onRestore,
  restoring = false,
}: {
  analytics: TeacherCourseAnalytics
  course: TeacherCourse
  density: 'compact' | 'comfortable'
  onRestore?: () => void
  restoring?: boolean
}) {
  const router = useRouter()
  const compact = density === 'compact'
  const color = course.theme_color || '#8B5CF6'
  const participation = analytics.enrolledCount > 0
    ? Math.round((analytics.activeStudentsCount / analytics.enrolledCount) * 100)
    : 0
  const needsAttention = analytics.enrolledCount > 0 && participation < 40

  if (course.is_archived) {
    return (
      <ArchivedTeacherCourseCard
        color={color}
        compact={compact}
        course={course}
        onRestore={onRestore}
        restoring={restoring}
      />
    )
  }

  return (
    <AppPressable
      accessibilityLabel={`Abrir curso ${course.name}`}
      accessibilityHint="Abre el detalle, las clases y el contenido del curso"
      accessibilityRole="button"
      onPress={() => router.push(`/(teacher)/subject/${course.id}` as any)}
      className={compact
        ? 'flex-row items-start gap-4 overflow-hidden rounded-2xl border border-border-default bg-surface-default p-4'
        : 'min-h-16 flex-row items-center gap-4 border-b border-border-default px-4 py-3'}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <CourseIcon color={color} compact={compact} course={course} />
      <View className={`min-w-0 ${compact ? 'flex-1' : 'flex-[1.5]'}`}>
        <Text className={`${compact ? 'text-[18px] leading-6' : 'text-[14px] leading-5'} font-black text-white`} numberOfLines={2}>{course.name}</Text>
        {compact ? (
          <>
          <Text className="mt-1 text-[13px] leading-5 text-text-secondary" numberOfLines={2}>
            {analytics.enrolledCount} alumnos · {analytics.questionsCount} preguntas
          </Text>
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <Text className={`text-[12px] font-black ${needsAttention ? 'text-gamification-badge' : 'text-text-secondary'}`}>{participation}% participación</Text>
            {needsAttention ? (
              <View className="rounded-full px-2 py-1" style={{ backgroundColor: ATTENTION_BADGE_BACKGROUND }}>
                <Text className="text-[10px] font-black text-white">Necesita atención</Text>
              </View>
            ) : null}
          </View>
          </>
        ) : (
          <Text className="mt-1 text-[12px] text-text-muted" numberOfLines={2}>{course.description || `Código ${course.code}`}</Text>
        )}
      </View>
      {!compact ? <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.enrolledCount}</Text> : null}
      {!compact ? <Text className="w-20 text-center text-[12px] font-bold text-text-secondary">{analytics.questionsCount}</Text> : null}
      {!compact ? (
        <View className="w-28 items-center">
          <View className={`rounded-full px-3 py-1 ${needsAttention ? 'bg-semantic-surface-warning' : 'bg-semantic-surface-success'}`}>
            <Text className={`text-[11px] font-black ${needsAttention ? 'text-gamification-badge' : 'text-text-secondary'}`}>{participation}%</Text>
          </View>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={compact ? 20 : 18} color="#AFC2DB" />
    </AppPressable>
  )
}

function ArchivedTeacherCourseCard({
  color,
  compact,
  course,
  onRestore,
  restoring,
}: {
  color: string
  compact: boolean
  course: TeacherCourse
  onRestore?: () => void
  restoring: boolean
}) {
  const archivedDate = formatCourseDate(course.archived_at)
  const retentionDate = formatCourseDate(course.retention_until)
  const restoreButton = (
    <AppButton
      accessibilityLabel={`Restaurar curso ${course.name}`}
      accessibilityHint="Devuelve el curso a la lista de cursos activos"
      disabled={!onRestore}
      fullWidth
      icon="refresh-outline"
      label="Restaurar"
      loading={restoring}
      onPress={() => onRestore?.()}
      role="teacher"
      size={compact ? 'md' : 'sm'}
    />
  )

  if (compact) {
    return (
      <View className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised p-4">
        <View className="flex-row items-start gap-4">
          <CourseIcon color={color} compact course={course} />
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="min-w-0 flex-shrink text-[18px] font-black leading-6 text-text-primary">{course.name}</Text>
              <ArchivedPill />
            </View>
            <Text className="mt-2 text-[12px] leading-5 text-text-secondary">
              {archivedDate ? `Archivado el ${archivedDate}` : 'Fecha de archivo no disponible'}
            </Text>
          </View>
        </View>
        {course.archive_reason ? <Text className="mt-3 text-[12px] leading-5 text-text-muted">{course.archive_reason}</Text> : null}
        {retentionDate ? <Text className="mt-1 text-[11px] leading-4 text-text-muted">Conservación hasta {retentionDate}</Text> : null}
        <View className="mt-4">{restoreButton}</View>
      </View>
    )
  }

  return (
    <View className="min-h-16 flex-row items-center gap-4 border-b border-border-default bg-surface-raised px-4 py-3">
      <CourseIcon color={color} compact={false} course={course} />
      <View className="min-w-0 flex-[1.5]">
        <Text className="text-[14px] font-black leading-5 text-text-primary">{course.name}</Text>
        <View className="mt-1 self-start"><ArchivedPill /></View>
      </View>
      <Text className="w-28 text-center text-[12px] font-bold leading-5 text-text-secondary">
        {archivedDate || 'No disponible'}
      </Text>
      <View className="min-w-0 flex-1">
        <Text className="text-[12px] leading-5 text-text-secondary">{course.archive_reason || 'Motivo no disponible'}</Text>
        {retentionDate ? <Text className="mt-1 text-[11px] leading-4 text-text-muted">Conservación hasta {retentionDate}</Text> : null}
      </View>
      <View className="w-28">{restoreButton}</View>
    </View>
  )
}

function CourseIcon({ color, compact, course }: { color: string; compact: boolean; course: TeacherCourse }) {
  return (
    <View
      className={`${compact ? 'h-14 w-14 rounded-2xl' : 'h-10 w-10 rounded-xl'} shrink-0 items-center justify-center`}
      style={{ backgroundColor: withAlpha(color, '26') }}
    >
      <Ionicons name={normalizeAcademicIcon(course.icon, 'book-outline')} size={compact ? 27 : 20} color={color} />
    </View>
  )
}

function ArchivedPill() {
  return (
    <View className="rounded-full border border-semantic-warning bg-semantic-surface-warning px-2.5 py-1">
      <Text className="text-[10px] font-black uppercase text-semantic-warning">Archivado</Text>
    </View>
  )
}

function formatCourseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
