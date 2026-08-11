import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
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
      title={topic ? `¿Qué quieres hacer? · ${topic.title}` : 'Elige una opción'}
      description="Revisa una partida anterior sin responder de nuevo, o empieza una partida completa desde el principio."
      scrollable
    >
      {topic ? (
        <View className="gap-3">
          {topic.difficulties.map((stats) => {
            const meta = getDifficultyMeta(stats.difficulty)
            const hasPlayed = stats.answeredQuestions > 0
            return (
              <View
                key={stats.difficulty}
                style={{
                  minHeight: 88,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: withAlpha(meta.color, '88'),
                  backgroundColor: withAlpha(meta.color, '18'),
                  padding: 14,
                }}
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(meta.color, '24') }}>
                    <Ionicons name="layers-outline" size={22} color={meta.color} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text maxFontSizeMultiplier={2} className="text-[16px] font-black text-white">{meta.label}</Text>
                    <Text maxFontSizeMultiplier={2} className="mt-1 text-[12px] leading-5 text-text-secondary">
                      {stats.questionsCount} preguntas · {stats.answeredQuestions} respondidas · {stats.failedQuestions} falladas
                    </Text>
                  </View>
                </View>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  {hasPlayed ? (
                    <AppButton
                      label={stats.failedQuestions > 0 ? 'Revisar fallos' : 'Sin fallos que revisar'}
                      accessibilityHint={stats.failedQuestions > 0 ? `Abre la revisión de solo lectura de dificultad ${meta.label}` : undefined}
                      disabled={stats.failedQuestions === 0}
                      variant="secondary"
                      size="sm"
                      icon="eye-outline"
                      onPress={() => onChoose(stats.difficulty, true)}
                      style={{ flexGrow: 1 }}
                    />
                  ) : null}
                  <AppButton
                    label={hasPlayed ? 'Jugar de nuevo' : 'Empezar partida'}
                    accessibilityHint={`Inicia una partida completa de dificultad ${meta.label}`}
                    role="student"
                    size="sm"
                    icon={hasPlayed ? 'refresh' : 'play'}
                    onPress={() => onChoose(stats.difficulty, false)}
                    style={{ flexGrow: 1 }}
                  />
                </View>
              </View>
            )
          })}

          <View className="mt-2 rounded-2xl border border-border-default bg-surface-raised p-4">
            <Text className="text-[12px] font-black uppercase tracking-[1px]" style={{ color }}>Cómo funciona</Text>
            <Text maxFontSizeMultiplier={2} className="mt-1 text-[13px] leading-5 text-text-secondary">
              La revisión es una muestra de tus fallos: verás tu respuesta y debajo la solución correcta. No podrás jugar ni cambiar respuestas desde esa pantalla.
            </Text>
          </View>
        </View>
      ) : null}
    </AppBottomSheet>
  )
}
