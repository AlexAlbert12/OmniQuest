import React from 'react'
import { View } from 'react-native'
import type { AnswerItem } from './types'
import ChoiceAnswerRow from './ChoiceAnswerRow'
import QuestionFormSection from './QuestionFormSection'

export default function TrueFalseEditor({
  answers,
  onMarkCorrect,
}: {
  answers: AnswerItem[]
  onMarkCorrect: (index: number) => void
}) {
  return (
    <QuestionFormSection
      title="Respuesta correcta"
      subtitle="Selecciona si la afirmación debe considerarse verdadera o falsa."
      icon="checkmark-done-outline"
    >
      <View className="gap-3">
        {answers.slice(0, 2).map((answer, index) => (
          <ChoiceAnswerRow
            key={index}
            index={index}
            text={answer.text}
            correct={answer.isCorrect}
            editable={false}
            onMarkCorrect={() => onMarkCorrect(index)}
          />
        ))}
      </View>
    </QuestionFormSection>
  )
}
