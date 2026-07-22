import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { QuestionValidationIssue, QuestionWizardStep } from './types'

export default function QuestionValidationPanel({
  issues,
  onOpenStep,
}: {
  issues: QuestionValidationIssue[]
  onOpenStep: (step: QuestionWizardStep) => void
}) {
  const { tokens } = useAppTheme()
  const valid = issues.length === 0
  return (
    <View
      className="rounded-2xl border p-4"
      style={{
        borderColor: valid ? tokens.semantic.success : tokens.semantic.warning,
        backgroundColor: withAlpha(valid ? tokens.semantic.success : tokens.semantic.warning, '13'),
      }}
    >
      <View className="flex-row items-start gap-3">
        <Ionicons
          name={valid ? 'checkmark-circle' : 'warning'}
          size={24}
          color={valid ? tokens.semantic.success : tokens.semantic.warning}
        />
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black" style={{ color: tokens.text.primary }}>
            {valid ? 'Pregunta lista para guardar' : `${issues.length} detalle${issues.length === 1 ? '' : 's'} pendiente${issues.length === 1 ? '' : 's'}`}
          </Text>
          <Text className="mt-1 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>
            {valid ? 'La configuración cumple las reglas básicas del formulario.' : 'Corrige estos puntos antes de crear o actualizar la pregunta.'}
          </Text>
        </View>
      </View>
      {!valid ? (
        <View className="mt-3 gap-2">
          {issues.map((issue, index) => (
            <AppPressable
              key={`${issue.step}-${issue.field}-${index}`}
              accessibilityLabel={`${issue.field}: ${issue.message}. Abrir paso ${issue.step}`}
              onPress={() => onOpenStep(issue.step)}
              className="flex-row items-center gap-3 rounded-xl border px-3 py-3"
              style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}
            >
              <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(tokens.semantic.warning, '24') }}>
                <Text className="text-[12px] font-black" style={{ color: tokens.semantic.warning }}>{issue.step}</Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[12px] font-black" style={{ color: tokens.text.primary }}>{issue.field}</Text>
                <Text className="mt-0.5 text-[12px]" style={{ color: tokens.text.secondary }}>{issue.message}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={tokens.text.muted} />
            </AppPressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}
