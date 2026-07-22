import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import { questionTypes, type QuestionTypeId } from './types'
import QuestionFormSection from './QuestionFormSection'

export default function QuestionTypeSelector({
  selectedType,
  columns,
  onSelect,
}: {
  selectedType: QuestionTypeId
  columns: number
  onSelect: (type: QuestionTypeId, supported: boolean) => void
}) {
  const { tokens } = useAppTheme()
  return (
    <QuestionFormSection
      title="Selecciona el tipo de pregunta"
      subtitle="Elige la interacción que mejor representa lo que quieres evaluar."
      icon="apps-outline"
    >
      <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
        {questionTypes.map((type) => {
          const active = selectedType === type.id
          return (
            <View key={type.id} style={{ width: `${100 / columns}%` as `${number}%`, paddingHorizontal: 6, paddingBottom: 12 }}>
              <AppPressable
                accessibilityLabel={`${type.title}. ${type.detail}`}
                accessibilityState={{ selected: active, disabled: !type.supported }}
                disabled={!type.supported}
                onPress={() => onSelect(type.id, type.supported)}
                className="min-h-[156px] rounded-2xl border p-4"
                style={({ pressed }) => ({
                  borderColor: active ? type.accent : tokens.border.default,
                  backgroundColor: active ? withAlpha(type.accent, '20') : tokens.surface.interactive,
                  opacity: !type.supported ? 0.45 : pressed ? 0.8 : 1,
                })}
              >
                {active ? (
                  <View className="absolute right-3 top-3 h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: type.accent }}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                ) : null}
                <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(type.accent, '26') }}>
                  <Ionicons name={type.icon} size={23} color={type.accent} />
                </View>
                <Text className="mt-3 text-[18px] font-black" style={{ color: tokens.text.primary }}>{type.title}</Text>
                <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>{type.detail}</Text>
              </AppPressable>
            </View>
          )
        })}
      </View>
    </QuestionFormSection>
  )
}
