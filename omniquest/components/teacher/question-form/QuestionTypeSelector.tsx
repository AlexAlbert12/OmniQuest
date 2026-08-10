import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import { questionTypes, type QuestionTypeId } from './types'
import QuestionFormSection from './QuestionFormSection'

export default function QuestionTypeSelector({ selectedType, columns, isDesktop, onSelect }: { selectedType: QuestionTypeId; columns: number; isDesktop: boolean; onSelect: (type: QuestionTypeId, supported: boolean) => void }) {
  const { tokens } = useAppTheme()
  return (
    <QuestionFormSection title="Selecciona el tipo de pregunta" subtitle="Elige la interacción que mejor representa lo que quieres evaluar." icon="apps-outline">
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
                className={`${isDesktop ? 'min-h-[156px] p-4' : 'min-h-[122px] p-3.5'} rounded-2xl border`}
                style={({ pressed }) => ({ borderColor: active ? type.accent : tokens.border.default, backgroundColor: active ? withAlpha(type.accent, '20') : tokens.surface.interactive, opacity: !type.supported ? 0.45 : pressed ? 0.8 : 1 })}
              >
                {active ? <View className="absolute right-3 top-3 h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: type.accent }}><Ionicons name="checkmark" size={16} color={tokens.text.onAccent} /></View> : null}
                <View className={`${isDesktop ? 'h-12 w-12' : 'h-10 w-10'} items-center justify-center rounded-xl`} style={{ backgroundColor: withAlpha(type.accent, '26') }}>
                  <Ionicons name={type.icon} size={isDesktop ? 23 : 20} color={type.accent} />
                </View>
                <View className="mt-2.5 flex-row flex-wrap items-center gap-2">
                  <Text className={`${isDesktop ? 'text-[18px]' : 'text-[16px]'} font-black`} style={{ color: tokens.text.primary }}>{type.title}</Text>
                  {type.id === 'open' ? <View className="rounded-full px-2 py-1" style={{ backgroundColor: withAlpha(tokens.semantic.warning, '20') }}><Text className="text-[10px] font-black" style={{ color: tokens.semantic.warning }}>Puede requerir revisión</Text></View> : null}
                </View>
                <Text className={`${isDesktop ? 'mt-2 text-[13px] leading-5' : 'mt-1.5 text-[12px] leading-[18px]'}`} style={{ color: tokens.text.secondary }}>{type.detail}</Text>
              </AppPressable>
            </View>
          )
        })}
      </View>
    </QuestionFormSection>
  )
}
