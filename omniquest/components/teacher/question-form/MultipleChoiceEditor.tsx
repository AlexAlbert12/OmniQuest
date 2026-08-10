import React from 'react'
import { Text, View } from 'react-native'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import type { AnswerItem } from './types'
import ChoiceAnswerRow from './ChoiceAnswerRow'
import QuestionFormSection from './QuestionFormSection'
import QuestionInlineError from './QuestionInlineError'

export default function MultipleChoiceEditor({ answers, optionsCount, error, onOptionsCountChange, onChangeAnswer, onMarkCorrect }: { answers: AnswerItem[]; optionsCount: number; error?: string; onOptionsCountChange: (count: number) => void; onChangeAnswer: (text: string, index: number) => void; onMarkCorrect: (index: number) => void }) {
  const { tokens } = useAppTheme()
  return (
    <QuestionFormSection title="Opciones de respuesta" subtitle="Completa las opciones y marca una única respuesta correcta." icon="list-outline">
      <Text className="text-[12px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.text.muted }}>Número de opciones</Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {[2, 3, 4, 5, 6].map((count) => {
          const active = optionsCount === count
          return <AppPressable key={count} accessibilityLabel={`${count} opciones`} accessibilityState={{ selected: active }} onPress={() => onOptionsCountChange(count)} className="h-10 min-w-[46px] items-center justify-center rounded-xl border px-3" style={{ borderColor: active ? tokens.brand.teacher : tokens.border.default, backgroundColor: active ? tokens.brand.teacher : tokens.surface.interactive }}><Text className="font-black" style={{ color: active ? '#FFFFFF' : tokens.text.secondary }}>{count}</Text></AppPressable>
        })}
      </View>
      <View className="mt-4 gap-3">
        {answers.map((answer, index) => <ChoiceAnswerRow key={index} index={index} text={answer.text} correct={answer.isCorrect} invalid={Boolean(error && !answer.text.trim())} onMarkCorrect={() => onMarkCorrect(index)} onChangeText={(value) => onChangeAnswer(value, index)} />)}
      </View>
      <QuestionInlineError message={error} />
    </QuestionFormSection>
  )
}
