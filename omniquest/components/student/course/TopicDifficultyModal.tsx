import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
import AppPressable from '../../ui/AppPressable'
import { getDifficultyMeta, type DifficultyLevel } from '../../../lib/difficulty'
import { withAlpha } from '../../../lib/color'
import type { StudentCourseTopic } from './types'

export default function TopicDifficultyModal({
  color,
  topic,
  onClose,
  onChoose,
}: {
  color: string
  topic: StudentCourseTopic | null
  onClose: () => void
  onChoose: (difficulty: DifficultyLevel, reviewFailed: boolean) => void
}) {

  return (
    <AppBottomSheet
      visible={Boolean(topic)}
      onClose={onClose}
      title={topic ? `Dificultad · ${topic.title}` : 'Elige dificultad'}
      description="Jugarás únicamente las preguntas de la dificultad seleccionada."
      scrollable
    >
      {topic ? (
        <View className="gap-3">
          {topic.difficulties.map((stats) => {
            const meta = getDifficultyMeta(stats.difficulty)
            const pending = Math.max(0, stats.questionsCount - stats.answeredQuestions)
            const action = stats.answeredQuestions === 0 ? 'Empezar' : pending > 0 ? 'Continuar' : 'Repetir'
            return (
              <AppPressable
                accessibilityLabel={`${meta.label}. ${stats.questionsCount} preguntas. ${action}`}
                accessibilityHint={`Inicia el tema en dificultad ${meta.label}`}
                key={stats.difficulty}
                onPress={() => onChoose(stats.difficulty, false)}
                style={({ pressed }) => ({
                  minHeight: 88,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: withAlpha(meta.color, '88'),
                  backgroundColor: withAlpha(meta.color, '18'),
                  padding: 14,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <View className="flex-row flex-wrap items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(meta.color, '24') }}>
                    <Ionicons name="layers-outline" size={22} color={meta.color} />
                  </View>
                  <View className="min-w-[180px] flex-1">
                    <Text maxFontSizeMultiplier={2} className="text-[16px] font-black text-white">{meta.label}</Text>
                    <Text maxFontSizeMultiplier={2} className="mt-1 text-[12px] leading-5 text-text-secondary">
                      {stats.questionsCount} preguntas · {stats.answeredQuestions} respondidas · {stats.failedQuestions} falladas
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap items-center gap-2">
                    {stats.failedQuestions > 0 ? (
                      <AppButton
                        label="Repasar fallos"
                        accessibilityHint={`Repasa únicamente los fallos de dificultad ${meta.label}`}
                        variant="danger"
                        size="sm"
                        icon="refresh"
                        onPress={() => onChoose(stats.difficulty, true)}
                      />
                    ) : null}
                    <View className="min-h-10 justify-center rounded-xl px-4" style={{ backgroundColor: meta.color }}>
                      <Text maxFontSizeMultiplier={2} className="font-black" style={{ color: '#FFFFFF' }}>{action}</Text>
                    </View>
                  </View>
                </View>
              </AppPressable>
            )
          })}

          <View className="mt-2 rounded-2xl border border-border-default bg-surface-raised p-4">
            <Text className="text-[12px] font-black uppercase tracking-[1px]" style={{ color }}>Consejo</Text>
            <Text maxFontSizeMultiplier={2} className="mt-1 text-[13px] leading-5 text-text-secondary">
              Empieza por la dificultad recomendada y repasa los fallos antes de subir de nivel.
            </Text>
          </View>
        </View>
      ) : null}
    </AppBottomSheet>
  )
}
