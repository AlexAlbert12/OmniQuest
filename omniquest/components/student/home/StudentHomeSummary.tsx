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
    { label: 'Para repasar', value: String(failedQuestions), icon: 'refresh-circle-outline' as const, color: tokens.semantic.warning },
    { label: 'Precisión', value: attemptCount > 0 ? `${accuracyPercent}%` : '\u2014', icon: 'speedometer-outline' as const, color: tokens.semantic.info },
  ]

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="text-[20px] font-black text-white">Resumen</Text>
        <AppPressable
          accessibilityLabel="Abrir progreso detallado"
          accessibilityHint="Muestra estadísticas, cursos y actividad completa"
          onPress={onOpenProgress}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
        >
          <Text className="text-[13px] font-black text-brand-student">Ver detalle</Text>
        </AppPressable>
      </View>
      <View className={`flex-row ${isDesktop ? 'gap-3' : 'gap-2'}`}>
        {metrics.map((metric) => (
          <View
            key={metric.label}
            className={`min-w-0 flex-1 border border-border-subtle bg-surface-raised ${isDesktop ? 'rounded-[20px] px-4' : 'items-center justify-center rounded-2xl px-1.5'}`}
            style={{ paddingVertical: isDesktop ? 10 : 7 }}
          >
            <View className={`w-full flex-row items-center justify-center ${isDesktop ? 'gap-3' : 'gap-2'}`}>
              <View
                className="shrink-0 items-center justify-center"
                style={{
                  width: isDesktop ? 34 : 28,
                  height: isDesktop ? 34 : 28,
                  borderRadius: isDesktop ? 10 : 9,
                  backgroundColor: withAlpha(metric.color, '24'),
                }}
              >
                <Ionicons name={metric.icon} size={isDesktop ? 19 : 16} color={metric.color} />
              </View>
              {isDesktop ? <Text maxFontSizeMultiplier={1.4} className="min-w-0 text-[12px] font-bold text-text-muted" numberOfLines={1}>{metric.label}</Text> : null}
              <Text
                maxFontSizeMultiplier={2}
                className={`${isDesktop ? '' : 'flex-1'} min-w-0 font-black text-text-primary`}
                style={{ fontSize: isDesktop ? 22 : 17, lineHeight: isDesktop ? 26 : 20, textAlign: 'center' }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {metric.value}
              </Text>
            </View>
            {!isDesktop ? <Text maxFontSizeMultiplier={1.4} className="mt-0.5 text-center text-[9px] font-bold leading-3 text-text-muted" numberOfLines={2}>{metric.label}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  )
}
