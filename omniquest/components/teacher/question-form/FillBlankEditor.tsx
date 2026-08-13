import React from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import QuestionFormSection from './QuestionFormSection'
import QuestionInlineError from './QuestionInlineError'
import { QUESTION_ANSWER_MAX } from './types'
import { countFillBlankMarkers, getFillBlankAnswerSlots, isFillBlankMarker, splitFillBlankPrompt } from './utils'

export default function FillBlankEditor({ questionText, value, error, onChange }: { questionText: string; value: string; error?: string; onChange: (value: string) => void }) {
  const { tokens } = useAppTheme()
  const markerCount = countFillBlankMarkers(questionText)
  const answers = getFillBlankAnswerSlots(value, markerCount)
  const promptParts = splitFillBlankPrompt(questionText)
  const contextParts = questionText.split(/_{2,}|\[\[\s*blank\s*\]\]|\{\{\s*blank\s*\}\}/gi)
  let displayedBlank = 0

  const updateAnswer = (index: number, nextValue: string) => {
    const nextAnswers = [...answers]
    nextAnswers[index] = nextValue.replace(/[\r\n]+/g, ' ')
    onChange(nextAnswers.join('\n'))
  }

  return (
    <QuestionFormSection title="Completa los huecos" subtitle="Cada respuesta aparece junto al fragmento exacto del enunciado al que pertenece." icon="grid-outline">
      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Vista del enunciado</Text>
      <View className="flex-row flex-wrap items-center gap-1.5 rounded-xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
        {promptParts.filter(Boolean).map((part, index) => {
          if (!isFillBlankMarker(part)) return <Text key={`${index}:${part}`} className="text-[15px] leading-6" style={{ color: tokens.text.primary }}>{part}</Text>
          displayedBlank += 1
          return (
            <View key={`${index}:blank`} className="rounded-lg border px-2.5 py-1" style={{ borderColor: tokens.brand.teacher, backgroundColor: `${tokens.brand.teacher}20` }}>
              <Text className="text-[12px] font-black" style={{ color: tokens.brand.teacher }}>Hueco {displayedBlank}</Text>
            </View>
          )
        })}
      </View>

      {markerCount > 0 ? (
        <View className="mt-4 gap-3">
          {answers.map((answer, index) => {
            const context = buildBlankContext(contextParts[index] || '', contextParts[index + 1] || '', index)
            return (
              <View key={`fill-answer-${index}`} className="rounded-xl border p-4" style={{ borderColor: !answer.trim() && error ? tokens.semantic.danger : tokens.border.default, backgroundColor: tokens.surface.default }}>
                <View className="mb-3 flex-row items-start gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${tokens.brand.teacher}24` }}>
                    <Text className="text-[12px] font-black" style={{ color: tokens.brand.teacher }}>{index + 1}</Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12px] font-black uppercase tracking-[0.6px]" style={{ color: tokens.text.muted }}>Respuesta del hueco {index + 1}</Text>
                    <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>{context}</Text>
                  </View>
                </View>
                <TextInput
                  accessibilityLabel={`Respuesta del hueco ${index + 1}`}
                  className="min-h-12 rounded-xl border px-4 py-3 text-[15px]"
                  style={{ borderColor: !answer.trim() && error ? tokens.semantic.danger : tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }}
                  placeholder={`Escribe la respuesta ${index + 1}`}
                  placeholderTextColor={tokens.text.muted}
                  maxLength={QUESTION_ANSWER_MAX}
                  value={answer}
                  onChangeText={(nextValue) => updateAnswer(index, nextValue)}
                />
              </View>
            )
          })}
        </View>
      ) : (
        <View className="mt-4 items-center rounded-xl border border-dashed p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
          <Ionicons name="arrow-back-circle-outline" size={28} color={tokens.text.muted} />
          <Text className="mt-2 text-center text-[13px] font-bold" style={{ color: tokens.text.secondary }}>Vuelve al enunciado y crea al menos un hueco.</Text>
        </View>
      )}
      <QuestionInlineError message={error} />
    </QuestionFormSection>
  )
}

function buildBlankContext(before: string, after: string, index: number) {
  const left = before.replace(/\s+/g, ' ').trim()
  const right = after.replace(/\s+/g, ' ').trim()
  const shortLeft = left.length > 52 ? `…${left.slice(-52)}` : left
  const shortRight = right.length > 52 ? `${right.slice(0, 52)}…` : right
  return [shortLeft, `[Hueco ${index + 1}]`, shortRight].filter(Boolean).join(' ')
}
