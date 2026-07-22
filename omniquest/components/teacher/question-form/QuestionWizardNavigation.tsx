import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import { questionWizardSteps, type QuestionWizardStep } from './types'

export default function QuestionWizardNavigation({
  activeStep,
  isDesktop,
  onSelect,
}: {
  activeStep: QuestionWizardStep
  isDesktop: boolean
  onSelect: (step: QuestionWizardStep) => void
}) {
  const { tokens } = useAppTheme()
  const content = questionWizardSteps.map((step) => {
    const active = step.number === activeStep
    const complete = step.number < activeStep
    return (
      <AppPressable
        key={step.number}
        accessibilityLabel={`Paso ${step.number}: ${step.label}`}
        accessibilityState={{ selected: active }}
        onPress={() => onSelect(step.number)}
        className="min-w-[112px] flex-1 flex-row items-center gap-2 rounded-xl border px-3 py-3"
        style={{
          borderColor: active ? tokens.brand.teacher : tokens.border.default,
          backgroundColor: active ? withAlpha(tokens.brand.teacher, '24') : tokens.surface.interactive,
        }}
      >
        <View
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: complete ? tokens.semantic.success : active ? tokens.brand.teacher : tokens.surface.raised }}
        >
          <Ionicons
            name={complete ? 'checkmark' : step.icon}
            size={16}
            color={complete || active ? '#FFFFFF' : tokens.text.muted}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[10px] font-black uppercase tracking-[0.5px]" style={{ color: active ? tokens.brand.teacher : tokens.text.muted }}>Paso {step.number}</Text>
          <Text numberOfLines={1} className="mt-0.5 text-[12px] font-black" style={{ color: active ? tokens.text.primary : tokens.text.secondary }}>
            {isDesktop ? step.label : step.shortLabel}
          </Text>
        </View>
      </AppPressable>
    )
  })

  if (isDesktop) return <View className="flex-row gap-2">{content}</View>
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
      {content}
    </ScrollView>
  )
}
