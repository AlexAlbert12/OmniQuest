import React from 'react'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import { useResponsiveLayout } from '../../../lib/responsive'
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
  const responsive = useResponsiveLayout()
  const title = topic ? buildMissionTitle(topic, position) : 'Has completado el curso'
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
            minHeight: 58,
            paddingHorizontal: 10,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
          },
          style,
        ]}
      >
        <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(tokens.brand.student, '29') }}>
          <Ionicons name="rocket" size={19} color={tokens.brand.student} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-brand-student">Siguiente misión</Text>
          <Text maxFontSizeMultiplier={2} numberOfLines={1} className="mt-0.5 text-[13px] font-black text-white">{title}</Text>
        </View>
        <AppButton label="Continuar" accessibilityHint={`Abre ${title}`} icon="play" role="student" size="sm" variant="primary" onPress={onContinue} />
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
        <AppButton
          fullWidth={responsive.isMobile}
          label={buildMissionActionLabel(topic, position)}
          accessibilityHint={`Abre ${title}`}
          icon="play"
          role="student"
          variant="primary"
          onPress={onContinue}
          style={responsive.isMobile ? undefined : { minWidth: 190 }}
        />
      ) : null}
    </View>
  )
}

function buildMissionTitle(topic: StudentCourseTopic, position: number | null) {
  const title = topic.title.trim()
  if (topic.id === 'general' || !position) return title
  const ordinal = `Tema ${position}`
  const normalizedTitle = normalizeTopicLabel(title)
  const normalizedOrdinal = normalizeTopicLabel(ordinal)
  if (
    normalizedTitle === normalizedOrdinal
    || normalizedTitle.startsWith(`${normalizedOrdinal} `)
    || normalizedTitle.startsWith(`${normalizedOrdinal}:`)
    || normalizedTitle.startsWith(`${normalizedOrdinal} ·`)
    || normalizedTitle.startsWith(`${normalizedOrdinal} -`)
  ) return title
  return `${ordinal} · ${title}`
}

function buildMissionActionLabel(topic: StudentCourseTopic, position: number | null) {
  if (topic.id === 'general' || !position) return 'Continuar'
  return `Continuar con Tema ${position}`
}

function normalizeTopicLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-ES')
}
