import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

export default function StudentHomeSummary({
  progressPercent,
  attemptCount,
  failedQuestions,
  accuracyPercent,
  isDesktop,
  onOpenProgress,
}: {
  progressPercent: number
  attemptCount: number
  failedQuestions: number
  accuracyPercent: number
  isDesktop: boolean
  onOpenProgress: () => void
}) {
  const { tokens } = useAppTheme()
  const metrics = [
    { label: 'Avance', value: `${progressPercent}%`, icon: 'analytics-outline' as const, color: tokens.semantic.success },
    { label: 'Preguntas', value: String(attemptCount), icon: 'help-circle-outline' as const, color: tokens.brand.student },
    { label: 'Para repasar', value: String(failedQuestions), icon: 'refresh-circle' as const, color: tokens.semantic.warning },
    { label: 'Precisión', value: attemptCount > 0 ? `${accuracyPercent}%` : '\u2014', icon: 'speedometer-outline' as const, color: tokens.semantic.info },
  ]

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <View>
          <Text className="text-[20px] font-black text-white">Resumen</Text>
          <Text className="mt-1 text-[13px] text-text-muted">Solo lo esencial de tu progreso.</Text>
        </View>
        <AppPressable
          accessibilityLabel="Abrir progreso detallado"
          accessibilityHint="Muestra estadísticas, cursos y actividad completa"
          onPress={onOpenProgress}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
        >
          <Text className="text-[13px] font-black text-brand-student">Ver detalle</Text>
        </AppPressable>
      </View>
      <View className="flex-row flex-wrap gap-3">
        {metrics.map((metric) => (
          <View
            key={metric.label}
            className="min-w-[140px] flex-1 rounded-[20px] border border-border-subtle bg-surface-raised px-4"
            style={{ paddingVertical: isDesktop ? 13 : 16 }}
          >
            <View
              className="items-center justify-center"
              style={{
                width: isDesktop ? 34 : 40,
                height: isDesktop ? 34 : 40,
                borderRadius: isDesktop ? 10 : 12,
                backgroundColor: withAlpha(metric.color, '24'),
              }}
            >
              <Ionicons name={metric.icon} size={isDesktop ? 19 : 21} color={metric.color} />
            </View>
            <Text
              maxFontSizeMultiplier={2}
              className="font-black text-text-primary"
              style={{ marginTop: isDesktop ? 7 : 12, fontSize: isDesktop ? 22 : 24, lineHeight: isDesktop ? 26 : 29 }}
            >
              {metric.value}
            </Text>
            <Text maxFontSizeMultiplier={2} className="mt-0.5 text-[12px] font-bold text-text-muted">{metric.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
