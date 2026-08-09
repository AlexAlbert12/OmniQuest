import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { StudentHomeSubjectRow } from './types'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'

export default function StudentContinueCourse({
  row,
  onOpenCourse,
  onOpenAll,
}: {
  row: StudentHomeSubjectRow | null
  onOpenCourse: () => void
  onOpenAll: () => void
}) {
  const { tokens } = useAppTheme()

  if (!row) {
    return (
      <View className="rounded-[24px] flex-row justify-between items-center border border-border-default bg-surface-default p-5">
        <View className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-semantic-surface-info">
            <Ionicons name="school-outline" size={28} color={tokens.semantic.info} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[20px] font-black text-white">Continúa un curso</Text>
            <Text className="mt-1 text-[14px] leading-5 text-text-secondary">Todavía no tienes cursos activos.</Text>
          </View>
        </View>
        <AppButton label="Explorar mis cursos" icon="arrow-forward" iconPosition="right" role="student" onPress={onOpenAll}/>
      </View>
    )
  }

  const progress = row.progress?.percent ?? 0
  const failed = row.progress?.failedQuestions ?? 0
  const pending = row.progress?.pendingQuestions ?? 0
  const color = row.subject.theme_color || tokens.brand.student
  const actionLabel = failed > 0 ? 'Repasar curso' : progress > 0 ? 'Continuar curso' : 'Empezar curso'

  return (
    <View className="overflow-hidden rounded-[24px] border border-border-default bg-surface-default p-5">
      <View
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          right: -70,
          top: -70,
          width: 190,
          height: 190,
          borderRadius: 999,
          backgroundColor: withAlpha(color, '1F'),
        }}
      />
      <View className="relative flex-row flex-wrap items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-[20px]" style={{ backgroundColor: withAlpha(color, '29') }}>
          <Ionicons name={normalizeAcademicIcon(row.subject.icon, 'book-outline')} size={30} color={color} />
        </View>
        <View className="min-w-[190px] flex-1">
          <Text className="text-[12px] font-black uppercase tracking-[1.2px] text-text-muted">Continuar curso</Text>
          <Text maxFontSizeMultiplier={2} className="mt-1 text-[21px] font-black text-white">{row.subject.name}</Text>
          <Text maxFontSizeMultiplier={2} className="mt-1 text-[13px] leading-5 text-text-secondary">
            {failed > 0
              ? `${failed} ${failed === 1 ? 'fallo pendiente' : 'fallos pendientes'}`
              : pending > 0
                ? `${pending} ${pending === 1 ? 'pregunta por practicar' : 'preguntas por practicar'}`
                : 'Puedes repetir temas para mejorar tu puntuación.'}
          </Text>
          <View className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-interactive">
            <View className="h-full rounded-full" style={{ width: `${Math.max(progress > 0 ? 4 : 0, progress)}%`, backgroundColor: color }} />
          </View>
          <View className="mt-2 flex-row items-center justify-between gap-3">
            <Text className="text-[12px] font-black" style={{ color }}>{progress}% completado</Text>
            <Text className="text-[12px] text-text-muted">{row.subject.classroom_name || 'Curso'}</Text>
          </View>
        </View>
        <View className="gap-2">
          <AppButton label={actionLabel} icon="play" role="student" onPress={onOpenCourse} />
          <AppButton label="Ver todos" variant="ghost" size="sm" icon="albums-outline" onPress={onOpenAll} />
        </View>
      </View>
    </View>
  )
}
