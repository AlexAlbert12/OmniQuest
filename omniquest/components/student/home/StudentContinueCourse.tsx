import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { StudentHomeSubjectRow } from './types'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'

export default function StudentContinueCourse({
  row,
  compact = false,
  onPress,
}: {
  row: StudentHomeSubjectRow | null
  compact?: boolean
  onPress: () => void
}) {
  const { tokens } = useAppTheme()

  if (!row) {
    return (
      <AppPressable
        testID="student-continue-course"
        accessibilityLabel="Explorar mis cursos"
        accessibilityHint="Abre la pantalla de cursos"
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: compact ? 88 : 104,
          padding: compact ? 14 : 20,
          borderRadius: compact ? 20 : 24,
          borderWidth: 1,
          borderColor: tokens.border.default,
          backgroundColor: tokens.surface.default,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed ? 0.84 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-4">
          <View className={`${compact ? 'h-11 w-11 rounded-xl' : 'h-14 w-14 rounded-2xl'} items-center justify-center bg-semantic-surface-info`}>
            <Ionicons name="school-outline" size={compact ? 23 : 28} color={tokens.semantic.info} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className={`${compact ? 'text-[16px]' : 'text-[20px]'} font-black text-white`}>Continúa un curso</Text>
            <Text className={`mt-1 text-text-secondary ${compact ? 'text-[12px] leading-4' : 'text-[14px] leading-5'}`}>Todavía no tienes cursos activos.</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={tokens.brand.student} />
      </AppPressable>
    )
  }

  const progress = row.progress?.percent ?? 0
  const failed = row.progress?.failedQuestions ?? 0
  const pending = row.progress?.pendingQuestions ?? 0
  const color = tokens.brand.student
  return (
    <AppPressable
      testID="student-continue-course"
      accessibilityLabel={`Abrir curso ${row.subject.name}`}
      accessibilityHint="Abre el curso y continúa por la siguiente actividad"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 112 : 148,
        padding: compact ? 14 : 20,
        borderRadius: compact ? 20 : 24,
        borderWidth: 1,
        borderColor: withAlpha(color, compact ? '58' : '42'),
        backgroundColor: tokens.surface.default,
        overflow: 'hidden',
        justifyContent: 'center',
        opacity: pressed ? 0.84 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
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
      <View className={`relative flex-row items-center ${compact ? 'gap-3' : 'gap-4'}`}>
        <View className={`${compact ? 'h-11 w-11 rounded-xl' : 'h-16 w-16 rounded-[20px]'} items-center justify-center`} style={{ backgroundColor: withAlpha(color, '29') }}>
          <Ionicons name={normalizeAcademicIcon(row.subject.icon, 'book-outline')} size={compact ? 23 : 30} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className={`${compact ? 'text-[10px]' : 'text-[12px]'} font-black uppercase tracking-[1.2px] text-text-muted`}>Continuar curso</Text>
          <Text maxFontSizeMultiplier={2} numberOfLines={2} className={`mt-1 font-black text-white ${compact ? 'text-[17px] leading-5' : 'text-[21px]'}`}>{row.subject.name}</Text>
          <Text maxFontSizeMultiplier={2} className={`mt-1 text-text-secondary ${compact ? 'text-[11px] leading-4' : 'text-[13px] leading-5'}`}>
            {failed > 0
              ? `${failed} ${failed === 1 ? 'fallo pendiente' : 'fallos pendientes'}`
              : pending > 0
                ? `${pending} ${pending === 1 ? 'pregunta por practicar' : 'preguntas por practicar'}`
                : 'Puedes repetir temas para mejorar tu puntuación.'}
          </Text>
          <View className={`${compact ? 'mt-2 h-1.5' : 'mt-4 h-2.5'} overflow-hidden rounded-full bg-surface-interactive`}>
            <View className="h-full rounded-full" style={{ width: `${Math.max(progress > 0 ? 4 : 0, progress)}%`, backgroundColor: color }} />
          </View>
          <View className={`${compact ? 'mt-1.5' : 'mt-2'} flex-row items-center justify-between gap-3`}>
            <Text className={`${compact ? 'text-[10px]' : 'text-[12px]'} font-black`} style={{ color }}>{progress}% completado</Text>
            <Text className={`${compact ? 'text-[10px]' : 'text-[12px]'} text-text-muted`} numberOfLines={1}>{row.subject.classroom_name || 'Curso'}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={compact ? 18 : 21} color={color} />
      </View>
    </AppPressable>
  )
}
