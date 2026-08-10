import React from 'react'
import { View } from 'react-native'
import type { AnswerItem } from './types'
import ChoiceAnswerRow from './ChoiceAnswerRow'
import QuestionFormSection from './QuestionFormSection'
import QuestionInlineError from './QuestionInlineError'

export default function TrueFalseEditor({ answers, error, onMarkCorrect }: { answers: AnswerItem[]; error?: string; onMarkCorrect: (index: number) => void }) {
  return (
    <QuestionFormSection title="Respuesta correcta" subtitle="Selecciona si la afirmación debe considerarse verdadera o falsa." icon="checkmark-done-outline">
      <View className="gap-3">{answers.slice(0, 2).map((answer, index) => <ChoiceAnswerRow key={index} index={index} text={answer.text} correct={answer.isCorrect} editable={false} onMarkCorrect={() => onMarkCorrect(index)} />)}</View>
      <QuestionInlineError message={error} />
    </QuestionFormSection>
  )
}
