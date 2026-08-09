import React from 'react'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { GalaxyTopicItem } from '../galaxy/StudentGalaxyMap'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'

function TopicPlanet({
  item,
  accentColor,
  style,
}: {
  item: GalaxyTopicItem
  accentColor?: string
  style?: StyleProp<ViewStyle>
}) {
  const { tokens } = useAppTheme()
  const disabled = item.state === 'locked' || item.state === 'empty'
  const color = accentColor || item.color || tokens.brand.student
  const icon = disabled && !item.icon ? 'lock-closed-outline' : normalizeAcademicIcon(item.icon, disabled ? 'lock-closed-outline' : 'play-outline')

  return (
    <AppPressable
      testID={item.testID}
      accessibilityLabel={`${item.title}. ${getTopicStateLabel(item.state)}. ${item.progress}% completado. ${item.questionsCount} ${item.questionsCount === 1 ? 'pregunta' : 'preguntas'}.`}
      accessibilityHint={disabled ? 'Este tema todavía no está disponible' : item.actionLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={item.onPress}
      style={({ pressed }) => [
        {
          minHeight: 92,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: item.state === 'active' ? tokens.border.active : tokens.border.default,
          backgroundColor: tokens.surface.default,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: disabled ? 0.56 : pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(color, '24') }}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text maxFontSizeMultiplier={2} className="text-[15px] font-black text-white">{item.title}</Text>
        <Text maxFontSizeMultiplier={2} className="mt-1 text-[12px] text-text-secondary">
          {getTopicStateLabel(item.state)} · {item.questionsCount} pregunta{item.questionsCount === 1 ? '' : 's'}
        </Text>
        <Text maxFontSizeMultiplier={2} className="mt-1 text-[12px] font-black" style={{ color: item.failedQuestions > 0 ? tokens.semantic.warning : color }}>
          {item.failedQuestions > 0 ? `${item.failedQuestions} para repasar` : `${item.progress}% completado`}
        </Text>
      </View>
      <Ionicons name={disabled ? 'lock-closed' : 'chevron-forward'} size={20} color={tokens.text.muted} />
    </AppPressable>
  )
}

export default React.memo(TopicPlanet)

function getTopicStateLabel(state: GalaxyTopicItem['state']) {
  if (state === 'completed') return 'Completado'
  if (state === 'active') return 'Siguiente misión'
  if (state === 'available') return 'Disponible'
  if (state === 'locked') return 'Bloqueado'
  return 'Sin preguntas'
}

