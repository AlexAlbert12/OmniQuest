import React from 'react'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { StudentCourseTopic } from './types'

export default function CourseNextMission({
  topic,
  position,
  courseDescription,
  onContinue,
  compact = false,
  style,
}: {
  topic: StudentCourseTopic | null
  position: number | null
  courseDescription?: string | null
  onContinue?: () => void
  compact?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { tokens } = useAppTheme()
  const title = topic
    ? `Tema ${position ?? ''}${position ? ' · ' : ''}${topic.title}`
    : 'Has completado el curso'
  const description = topic?.description || courseDescription || 'Selecciona un planeta para iniciar una misión.'

  if (compact) {
    if (!topic || !onContinue) return null
    return (
      <View
        accessibilityLabel={`Siguiente misión: ${title}`}
        style={[
          {
            borderRadius: 18,
            borderWidth: 1,
            borderColor: tokens.border.active,
            backgroundColor: tokens.background.overlay,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          },
          style,
        ]}
      >
        <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(tokens.brand.student, '29') }}>
          <Ionicons name="rocket" size={22} color={tokens.brand.student} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-black uppercase tracking-[1px] text-brand-student">Siguiente misión</Text>
          <Text maxFontSizeMultiplier={2} numberOfLines={2} className="mt-1 text-[14px] font-black text-white">{title}</Text>
        </View>
        <AppButton label={`Continuar con Tema ${position ?? ''}`.trim()} icon="play" role="student" size="sm" onPress={onContinue} />
      </View>
    )
  }

  return (
    <View className="mb-7 flex-row flex-wrap items-center gap-4 rounded-[26px] border border-border-default bg-surface-disabled px-5 py-5">
      <View className="min-w-[220px] flex-1">
        <Text className="text-[12px] font-black uppercase tracking-[1.6px] text-brand-student">Ruta de aprendizaje</Text>
        <Text maxFontSizeMultiplier={2} className="mt-2 text-[24px] font-black leading-8 text-white">{title}</Text>
        <Text maxFontSizeMultiplier={2} className="mt-2 text-[14px] leading-6 text-text-secondary">{description}</Text>
      </View>
      <View className="h-16 w-16 items-center justify-center rounded-[20px] border border-brand-student bg-semantic-surface-info">
        <Ionicons name={topic ? 'book-outline' : 'checkmark-done'} size={30} color={tokens.brand.student} />
      </View>
      {topic && onContinue ? (
        <AppButton label={`Continuar con Tema ${position ?? ''}`.trim()} icon="play" role="student" onPress={onContinue} />
      ) : null}
    </View>
  )
}
