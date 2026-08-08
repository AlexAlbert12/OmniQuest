import React, { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'
import type { DesignColorTokens } from '../../../lib/designTokens'
import {
  buildFillBlankSubmission,
  buildOpenAnswerSubmission,
  buildOrderingSubmission,
  buildPairingSubmission,
  countBlankMarkers,
  getBlankCount,
  isChoiceQuestion,
  splitFillPrompt,
  type QuestionType,
} from '../../../lib/gameQuestionLogic'
import {
  AnswerOption,
  MoveButton,
  PairConnectionChip,
  SubmitAnswerButton,
} from './GameQuestionUi'
import type { GameAnswer, GameQuestion, PairOptionToken, StructuredAnswerPayload } from './types'

export default function GameQuestionRenderer({
  question,
  questionType,
  selectedAnswerId,
  correctAnswerId,
  hintedAnswerId,
  hasAnswered,
  isSubmitting,
  answerStatus,
  onChoiceAnswer,
  onStructuredAnswer,
}: {
  question: GameQuestion
  questionType: QuestionType
  selectedAnswerId: number | null
  correctAnswerId: number | null
  hintedAnswerId: number | null
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onChoiceAnswer: (answerId: number) => void
  onStructuredAnswer: (payload: StructuredAnswerPayload) => void
}) {
  if (isChoiceQuestion(questionType)) {
    return (
      <View style={{ gap: 12 }}>
        {question.answers.map((answer, index) => (
          <AnswerOption
            key={answer.id}
            answer={answer}
            index={index}
            selectedAnswerId={selectedAnswerId}
            correctAnswerId={correctAnswerId}
            hintedAnswerId={hintedAnswerId}
            hasAnswered={hasAnswered}
            isSubmitting={isSubmitting}
            onPress={() => onChoiceAnswer(answer.id)}
          />
        ))}
      </View>
    )
  }

  if (questionType === 'open_answer') {
    return (
      <TextAnswerQuestion
        key={question.id}
        question={question}
        hasAnswered={hasAnswered}
        isSubmitting={isSubmitting}
        answerStatus={answerStatus}
        onSubmit={onStructuredAnswer}
      />
    )
  }

  if (questionType === 'fill_blank') {
    return (
      <FillBlankQuestion
        key={question.id}
        question={question}
        hasAnswered={hasAnswered}
        isSubmitting={isSubmitting}
        answerStatus={answerStatus}
        onSubmit={onStructuredAnswer}
      />
    )
  }

  if (questionType === 'ordering') {
    return (
      <OrderingQuestion
        key={question.id}
        question={question}
        hasAnswered={hasAnswered}
        isSubmitting={isSubmitting}
        answerStatus={answerStatus}
        onSubmit={onStructuredAnswer}
      />
    )
  }

  if (questionType !== 'match_pairs' && questionType !== 'drag_drop') {
    return null
  }

  return (
    <PairingQuestion
      key={question.id}
      question={question}
      questionType={questionType}
      hasAnswered={hasAnswered}
      isSubmitting={isSubmitting}
      answerStatus={answerStatus}
      onSubmit={onStructuredAnswer}
    />
  )
}

function TextAnswerQuestion({
  question,
  hasAnswered,
  isSubmitting,
  answerStatus,
  onSubmit,
}: {
  question: GameQuestion
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onSubmit: (payload: StructuredAnswerPayload) => void
}) {
  const [value, setValue] = useState('')
  const { tokens } = useAppTheme()

  useEffect(() => {
    setValue('')
  }, [question.id])

  const handleSubmit = () => {
    if (hasAnswered || isSubmitting || !value.trim()) return
    onSubmit(buildOpenAnswerSubmission(value))
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-interactive">
          <Ionicons name="chatbox-ellipses-outline" size={21} color={tokens.brand.student} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black text-text-primary">Escribe tu respuesta</Text>
          <Text className="mt-1 text-[12px] text-text-secondary">
            Se corregirá con las respuestas aceptadas por el profesor. No importan mayúsculas ni espacios extra.
          </Text>
        </View>
      </View>

      <TextInput
        value={value}
        onChangeText={setValue}
        editable={!hasAnswered && !isSubmitting}
        multiline
        textAlignVertical="top"
        placeholder="Tu respuesta"
        placeholderTextColor={tokens.text.muted}
        className={`min-h-[74px] rounded-2xl border px-5 py-4 text-[18px] font-semibold text-text-primary ${
          hasAnswered ? 'border-border-default bg-background-primary' : 'border-border-active bg-surface-default'
        }`}
      />


      {!hasAnswered ? (
        <SubmitAnswerButton disabled={isSubmitting || !value.trim()} onPress={handleSubmit} />
      ) : null}
    </View>
  )
}

function FillBlankQuestion({
  question,
  hasAnswered,
  isSubmitting,
  answerStatus,
  onSubmit,
}: {
  question: GameQuestion
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onSubmit: (payload: StructuredAnswerPayload) => void
}) {
  const blankCount = getBlankCount(question)
  const { tokens } = useAppTheme()
  const [values, setValues] = useState<string[]>(() => Array.from({ length: blankCount }, () => ''))
  const promptParts = splitFillPrompt(question.text)
  const markerCount = countBlankMarkers(question.text)

  useEffect(() => {
    setValues(Array.from({ length: blankCount }, () => ''))
  }, [blankCount, question.id])

  const updateValue = (index: number, value: string) => {
    setValues((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  const completedCount = values.filter((value) => value.trim()).length
  const isReady = completedCount === blankCount

  const handleSubmit = () => {
    if (hasAnswered || isSubmitting || !isReady) return
    onSubmit(buildFillBlankSubmission(values))
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-interactive">
          <Ionicons name="text-outline" size={21} color={tokens.semantic.info} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black text-text-primary">Completa los huecos en orden</Text>
          <Text className="mt-1 text-[12px] leading-5 text-text-secondary">Escribe una respuesta por hueco y respeta el orden del enunciado.</Text>
        </View>
        <View className="rounded-full bg-surface-raised px-3 py-1">
          <Text className="text-[12px] font-black text-brand-student">{completedCount}/{blankCount}</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-2 rounded-2xl border border-border-subtle bg-background-primary p-3">
        {markerCount > 0 ? (
          promptParts.map((part, index) => (
            <React.Fragment key={`${part}-${index}`}>
              {part ? <Text className="text-[16px] font-semibold text-text-secondary">{part}</Text> : null}
              {index < promptParts.length - 1 ? <BlankPlaceholder index={index} /> : null}
            </React.Fragment>
          ))
        ) : (
          <>
            <Text className="text-[16px] font-semibold text-text-secondary">{question.text.trim()}</Text>
            <BlankPlaceholder index={0} />
          </>
        )}
      </View>

      {markerCount === 0 ? (
        <View className="flex-row items-center gap-2 px-1">
          <Ionicons name="information-circle-outline" size={16} color={tokens.semantic.info} />
          <Text className="text-[12px] font-semibold text-text-secondary">Completa el hueco marcado con ___.</Text>
        </View>
      ) : null}

      <View className="gap-3">
        {values.map((value, index) => {
          const filled = value.trim().length > 0
          const borderColor = !hasAnswered
            ? filled
              ? tokens.semantic.info
              : tokens.border.default
            : answerStatus === 'correct'
              ? tokens.semantic.success
              : tokens.semantic.danger

          return (
            <View key={index} className="rounded-2xl border bg-surface-raised px-4 py-3" style={{ borderColor }}>
              <Text className="text-[11px] font-black uppercase tracking-[0.04em] text-text-muted">
                Hueco {index + 1}
              </Text>
              <TextInput
                value={value}
                onChangeText={(nextValue) => updateValue(index, nextValue)}
                editable={!hasAnswered && !isSubmitting}
                placeholder={`Respuesta del hueco ${index + 1}`}
                placeholderTextColor={tokens.text.muted}
                className="mt-2 min-h-[46px] text-[18px] font-black text-text-primary"
              />
            </View>
          )
        })}
      </View>


      {!hasAnswered ? (
        <SubmitAnswerButton disabled={isSubmitting || !isReady} onPress={handleSubmit} />
      ) : null}
    </View>
  )
}

function BlankPlaceholder({ index }: { index: number }) {
  return (
    <View className="rounded-xl border border-border-active bg-surface-raised px-4 py-2">
      <Text className="text-[15px] font-black tracking-[0.08em] text-brand-student">______</Text>
      <Text className="mt-1 text-center text-[10px] font-black uppercase tracking-[0.05em] text-text-muted">
        Hueco {index + 1}
      </Text>
    </View>
  )
}

function OrderingQuestion({
  question,
  hasAnswered,
  isSubmitting,
  answerStatus,
  onSubmit,
}: {
  question: GameQuestion
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onSubmit: (payload: StructuredAnswerPayload) => void
}) {
  const [orderedAnswers, setOrderedAnswers] = useState<GameAnswer[]>(question.answers)
  const { tokens } = useAppTheme()

  useEffect(() => {
    setOrderedAnswers(question.answers)
  }, [question.id, question.answers])

  const moveAnswer = (index: number, direction: -1 | 1) => {
    if (hasAnswered || isSubmitting) return
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= orderedAnswers.length) return

    const nextAnswers = [...orderedAnswers]
    const current = nextAnswers[index]
    nextAnswers[index] = nextAnswers[nextIndex]
    nextAnswers[nextIndex] = current
    setOrderedAnswers(nextAnswers)
  }

  const handleSubmit = () => {
    if (hasAnswered || isSubmitting) return
    onSubmit(buildOrderingSubmission(orderedAnswers.map((answer) => answer.id)))
  }

  return (
    <View className="gap-3">
      <Text className="text-[13px] font-bold text-text-secondary">Ordena los elementos de arriba a abajo.</Text>
      {orderedAnswers.map((answer, index) => {
        const rowColor = !hasAnswered ? tokens.border.default : answerStatus === 'correct' ? tokens.semantic.success : tokens.semantic.danger

        return (
          <View
            key={answer.id}
            className="flex-row items-center gap-3 rounded-2xl border bg-surface-default p-3"
            style={{ borderColor: rowColor }}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-interactive">
              <Text className="font-black text-text-primary">{index + 1}</Text>
            </View>
            <Text className="min-w-0 flex-1 text-[17px] font-semibold text-text-primary">{answer.text}</Text>
            <View className="flex-row gap-2">
              <MoveButton icon="chevron-up" disabled={hasAnswered || isSubmitting || index === 0} onPress={() => moveAnswer(index, -1)} />
              <MoveButton icon="chevron-down" disabled={hasAnswered || isSubmitting || index === orderedAnswers.length - 1} onPress={() => moveAnswer(index, 1)} />
            </View>
          </View>
        )
      })}

      {!hasAnswered ? (
        <SubmitAnswerButton disabled={isSubmitting || orderedAnswers.length < 2} onPress={handleSubmit} />
      ) : null}
    </View>
  )
}

function PairingQuestion({
  question,
  questionType,
  hasAnswered,
  isSubmitting,
  answerStatus,
  onSubmit,
}: {
  question: GameQuestion
  questionType: 'match_pairs' | 'drag_drop'
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onSubmit: (payload: StructuredAnswerPayload) => void
}) {
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isTwoColumns = width >= 820
  const labels = getPairingLabels(questionType, tokens)
  const leftAnswers = question.answers
  const options = normalizePairOptions(question.pair_options || [])
  const [selections, setSelections] = useState<Record<number, PairOptionToken>>({})
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setSelections({})
    setActiveIndex(0)
  }, [question.id])

  const completedCount = leftAnswers.filter((_, index) => Boolean(selections[index])).length
  const isReady = leftAnswers.length > 0 && completedCount === leftAnswers.length
  const selectedConnections = leftAnswers
    .map((answer, index) => ({ left: answer.text, right: selections[index]?.text, index }))
    .filter((connection) => Boolean(connection.right))

  const assignOption = (option: PairOptionToken) => {
    if (hasAnswered || isSubmitting || leftAnswers.length === 0) return

    const targetIndex = Math.max(0, Math.min(activeIndex, leftAnswers.length - 1))
    setSelections((current) => {
      const nextSelections: Record<number, PairOptionToken> = {}

      Object.entries(current).forEach(([key, value]) => {
        const numericKey = Number(key)
        const currentValue = value as PairOptionToken
        if (numericKey !== targetIndex && currentValue.key !== option.key) {
          nextSelections[numericKey] = currentValue
        }
      })

      nextSelections[targetIndex] = option
      const nextActive = getFirstIncompleteIndex(leftAnswers.length, nextSelections, targetIndex)
      setActiveIndex(nextActive)
      return nextSelections
    })
  }

  const clearSelection = (index: number) => {
    if (hasAnswered || isSubmitting) return
    setSelections((current) => {
      const nextSelections = { ...current }
      delete nextSelections[index]
      return nextSelections
    })
    setActiveIndex(index)
  }

  const handleSubmit = () => {
    if (hasAnswered || isSubmitting || !isReady) return
    onSubmit(buildPairingSubmission(
      leftAnswers.map((answer, index) => ({
        left: answer.text,
        right: selections[index]?.text || '',
      })),
    ))
  }

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-start gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-interactive">
            <Ionicons name={labels.icon} size={22} color={labels.accent} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-black text-text-primary">{labels.title}</Text>
            <Text className="mt-1 text-[12px] leading-5 text-text-secondary">{labels.detail}</Text>
          </View>
        </View>
        <View className="rounded-full bg-surface-raised px-3 py-1">
          <Text className="text-[12px] font-black text-brand-student">{completedCount}/{leftAnswers.length}</Text>
        </View>
      </View>

      <View className="gap-4" style={{ flexDirection: isTwoColumns ? 'row' : 'column' }}>
        <View style={{ flex: 1 }}>
          <Text className="mb-3 text-[12px] font-black uppercase tracking-[0.06em] text-text-muted">
            1. Elige {labels.leftLabel.toLowerCase()}
          </Text>
          <View className="gap-3">
            {leftAnswers.map((answer, index) => {
              const selected = selections[index]
              const active = activeIndex === index && !hasAnswered
              const borderColor = hasAnswered
                ? answerStatus === 'correct'
                  ? tokens.semantic.success
                  : tokens.semantic.danger
                : active
                  ? tokens.brand.student
                  : selected
                    ? tokens.semantic.success
                    : tokens.border.default

              return (
                <Pressable
                  key={`${answer.id}-${index}`}
                  onPress={() => !hasAnswered && !isSubmitting && setActiveIndex(index)}
                  disabled={hasAnswered || isSubmitting}
                  className="rounded-2xl border bg-surface-raised p-4"
                  style={({ pressed }) => ({ borderColor, opacity: pressed ? 0.86 : 1 })}
                >
                  <View className="flex-row items-start gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: active ? tokens.brand.student : selected ? tokens.semanticSurface.success : tokens.surface.interactive }}
                    >
                      <Text className="font-black text-text-primary">{index + 1}</Text>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[11px] font-black uppercase tracking-[0.04em] text-text-muted">
                        {labels.leftLabel}
                      </Text>
                      <Text className="mt-1 text-[17px] font-black text-text-primary">{answer.text}</Text>
                      {selected ? (
                        <PairConnectionChip left={answer.text} right={selected.text} />
                      ) : (
                        <View className="mt-2 flex-row items-center gap-2">
                          <Ionicons name="arrow-forward" size={14} color={tokens.text.muted} />
                          <Text className="text-[12px] font-semibold text-text-secondary">Elige {labels.rightLabel.toLowerCase()} en la columna derecha</Text>
                        </View>
                      )}
                    </View>
                    {selected && !hasAnswered && !isSubmitting ? (
                      <Pressable
                        onPress={() => clearSelection(index)}
                        className="h-9 w-9 items-center justify-center rounded-full border border-border-default bg-surface-default"
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar selección de ${answer.text}`}
                      >
                        <Ionicons name="close" size={17} color={tokens.text.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text className="mb-3 text-[12px] font-black uppercase tracking-[0.06em] text-text-muted">
            2. Toca {labels.rightLabel.toLowerCase()}
          </Text>
          <View className="gap-3">
            {options.length > 0 ? options.map((option) => {
              const ownerIndex = findOptionOwner(selections, option.key)
              const usedByCurrent = ownerIndex === activeIndex
              const usedByOther = ownerIndex !== null && ownerIndex !== activeIndex

              return (
                <Pressable
                  key={option.key}
                  onPress={() => assignOption(option)}
                  disabled={hasAnswered || isSubmitting}
                  className="rounded-2xl border px-4 py-3"
                  style={({ pressed }) => ({
                    borderColor: usedByCurrent ? tokens.brand.student : usedByOther ? tokens.semantic.success : tokens.border.default,
                    backgroundColor: usedByCurrent ? tokens.surface.selected : usedByOther ? tokens.semanticSurface.success : tokens.surface.raised,
                    opacity: pressed ? 0.86 : 1,
                  })}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-raised">
                      <Ionicons
                        name={usedByCurrent ? 'radio-button-on' : usedByOther ? 'checkmark-circle' : 'ellipse-outline'}
                        size={19}
                        color={usedByCurrent ? tokens.brand.student : usedByOther ? tokens.semantic.success : tokens.text.muted}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[16px] font-black text-text-primary">{option.text}</Text>
                      {usedByOther ? (
                        <Text className="mt-1 text-[11px] font-bold text-semantic-success">
                          Usada con {labels.leftLabel.toLowerCase()} {ownerIndex + 1}. Tócala para moverla.
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              )
            }) : (
              <View className="rounded-xl border border-semantic-warning bg-semantic-surface-warning p-4">
                <Text className="text-[13px] font-semibold text-text-secondary">
                  Esta pregunta no tiene opciones de pareja configuradas. Revisa la pregunta desde el panel del profesor.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {selectedConnections.length > 0 ? (
        <View className="pt-1">
          <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-text-muted">Relaciones elegidas</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {selectedConnections.map((connection) => (
              <PairConnectionChip
                key={`${connection.left}-${connection.index}`}
                left={connection.left}
                right={connection.right || ''}
                compact
              />
            ))}
          </View>
        </View>
      ) : null}

      {!hasAnswered && !isSubmitting && !isReady ? (
        <Text className="text-center text-[12px] font-semibold text-text-muted">Completa todas las relaciones para activar Comprobar.</Text>
      ) : null}


      {!hasAnswered ? (
        <SubmitAnswerButton disabled={isSubmitting || !isReady} onPress={handleSubmit} />
      ) : null}
    </View>
  )
}


function normalizePairOptions(options: string[]): PairOptionToken[] {
  return options
    .map((option, index) => ({ key: `${index}-${String(option || '').trim()}`, text: String(option || '').trim() }))
    .filter((option) => option.text.length > 0)
}

function getFirstIncompleteIndex(total: number, selections: Record<number, unknown>, fallbackIndex: number) {
  for (let index = 0; index < total; index += 1) {
    if (!selections[index]) return index
  }
  return Math.max(0, Math.min(fallbackIndex, Math.max(0, total - 1)))
}

function findOptionOwner(selections: Record<number, PairOptionToken>, optionKey: string) {
  const owner = Object.entries(selections).find(([, value]) => value.key === optionKey)
  return owner ? Number(owner[0]) : null
}

function getPairingLabels(type: 'match_pairs' | 'drag_drop', tokens: DesignColorTokens) {
  if (type === 'drag_drop') {
    return {
      title: 'Asigna cada elemento a su destino',
      detail: 'Primero toca una tarjeta de la izquierda y después el destino correcto. Puedes cambiar cualquier relación antes de comprobar.',
      leftLabel: 'Elemento',
      rightLabel: 'Destino',
      icon: 'move' as keyof typeof Ionicons.glyphMap,
      accent: tokens.brand.student,
    }
  }

  return {
    title: 'Une cada origen con su pareja',
    detail: 'Toca un origen y luego elige su pareja. Cada opción solo puede quedar asociada a un origen.',
    leftLabel: 'Origen',
    rightLabel: 'Pareja',
    icon: 'git-compare' as keyof typeof Ionicons.glyphMap,
    accent: tokens.gamification.xp,
  }
}
