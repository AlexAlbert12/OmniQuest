import React, { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import { questionWizardSteps, type QuestionWizardStep } from './types'

export default function QuestionWizardNavigation({ activeStep, isDesktop, onSelect }: { activeStep: QuestionWizardStep; isDesktop: boolean; onSelect: (step: QuestionWizardStep) => void }) {
  const { tokens } = useAppTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const active = useMemo(() => questionWizardSteps.find((step) => step.number === activeStep) || questionWizardSteps[0], [activeStep])

  if (!isDesktop) {
    const progressWidth: `${number}%` = `${(activeStep / questionWizardSteps.length) * 100}%`
    return (
      <>
        <AppPressable
          accessibilityLabel={`Paso ${activeStep} de ${questionWizardSteps.length}: ${active.label}`}
          accessibilityHint="Abre la lista completa de pasos"
          accessibilityState={{ expanded: mobileOpen }}
          onPress={() => setMobileOpen(true)}
          className="rounded-2xl border px-4 py-3"
          style={({ pressed }) => ({ borderColor: tokens.border.active, backgroundColor: pressed ? tokens.surface.selected : tokens.surface.interactive })}
        >
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(tokens.brand.teacher, '24') }}>
              <Ionicons name={active.icon} size={20} color={tokens.brand.teacher} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[11px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.brand.teacher }}>{`Paso ${activeStep} de ${questionWizardSteps.length}`}</Text>
              <Text className="mt-0.5 text-[16px] font-black" style={{ color: tokens.text.primary }}>{active.label}</Text>
              <View className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: tokens.surface.raised }}>
                <View className="h-full rounded-full" style={{ width: progressWidth, backgroundColor: tokens.brand.teacher }} />
              </View>
            </View>
            <Ionicons name="chevron-down" size={18} color={tokens.text.muted} />
          </View>
        </AppPressable>
        <AppBottomSheet visible={mobileOpen} onClose={() => setMobileOpen(false)} title="Pasos de la pregunta">
          <View className="gap-2">
            {questionWizardSteps.map((step) => {
              const selected = step.number === activeStep
              const complete = step.number < activeStep
              return (
                <AppPressable
                  key={step.number}
                  accessibilityLabel={`Paso ${step.number}: ${step.label}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => { onSelect(step.number); setMobileOpen(false) }}
                  className="min-h-[54px] flex-row items-center gap-3 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: selected ? tokens.brand.teacher : tokens.border.default, backgroundColor: selected ? withAlpha(tokens.brand.teacher, '22') : tokens.surface.raised }}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: complete ? tokens.semantic.success : selected ? tokens.brand.teacher : tokens.surface.interactive }}>
                    <Ionicons name={complete ? 'checkmark' : step.icon} size={17} color={complete || selected ? tokens.text.onAccent : tokens.text.muted} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[10px] font-black uppercase tracking-[0.5px]" style={{ color: selected ? tokens.brand.teacher : tokens.text.muted }}>{`Paso ${step.number}`}</Text>
                    <Text className="mt-0.5 text-[14px] font-black" style={{ color: tokens.text.primary }}>{step.label}</Text>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color={tokens.brand.teacher} /> : null}
                </AppPressable>
              )
            })}
          </View>
        </AppBottomSheet>
      </>
    )
  }

  return (
    <View className="flex-row gap-2">
      {questionWizardSteps.map((step) => {
        const selected = step.number === activeStep
        const complete = step.number < activeStep
        return (
          <AppPressable
            key={step.number}
            accessibilityLabel={`Paso ${step.number}: ${step.label}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(step.number)}
            className="min-w-[112px] flex-1 flex-row items-center gap-2 rounded-xl border px-3 py-3"
            style={{ borderColor: selected ? tokens.brand.teacher : tokens.border.default, backgroundColor: selected ? withAlpha(tokens.brand.teacher, '24') : tokens.surface.interactive }}
          >
            <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: complete ? tokens.semantic.success : selected ? tokens.brand.teacher : tokens.surface.raised }}>
              <Ionicons name={complete ? 'checkmark' : step.icon} size={16} color={complete || selected ? tokens.text.onAccent : tokens.text.muted} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[10px] font-black uppercase tracking-[0.5px]" style={{ color: selected ? tokens.brand.teacher : tokens.text.muted }}>{`Paso ${step.number}`}</Text>
              <Text numberOfLines={1} className="mt-0.5 text-[12px] font-black" style={{ color: selected ? tokens.text.primary : tokens.text.secondary }}>{step.label}</Text>
            </View>
          </AppPressable>
        )
      })}
    </View>
  )
}
