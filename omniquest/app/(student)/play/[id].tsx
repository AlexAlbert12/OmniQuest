import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AppConfirmModal from '../../../components/AppConfirmModal'
import { useGame } from '../../../hooks/useGame'
import { getDifficultyMeta, normalizeDifficulty } from '../../../lib/difficulty'
import StudentHeaderAvatar from '../../../components/student/StudentHeaderAvatar'
import type { Json } from '../../../types/database.types'
import { createShadowStyle } from '../../../lib/platformShadow'

type Answer = {
  id: number
  text: string
}

type QuestionType = 'multiple_choice' | 'true_false' | 'open_answer' | 'fill_blank' | 'ordering' | 'match_pairs' | 'drag_drop'

type StructuredAnswerPayload = {
  answerText?: string
  payload?: Json
}

type PairOptionToken = {
  key: string
  text: string
}

type Question = {
  id: number
  text: string
  type?: string | null
  points_base?: number | null
  category?: string | null
  subject?: string | null
  explanation?: string | null
  answers: Answer[]
  pair_options?: string[]
  blank_count?: number | null
}

const answerLetters = ['A', 'B', 'C', 'D', 'E', 'F']

export default function PlayScreen() {
  const { id, topicId, topicName, review, classroomId, difficulty } = useLocalSearchParams<{ id: string; topicId?: string; topicName?: string; review?: string; classroomId?: string; difficulty?: string }>()
  const { width } = useWindowDimensions()
  const router = useRouter()
  const reviewMode = Array.isArray(review) ? review[0] : review
  const selectedClassroomId = Array.isArray(classroomId) ? classroomId[0] : classroomId
  const selectedDifficulty = Array.isArray(difficulty) ? difficulty[0] : difficulty
  const normalizedDifficulty = normalizeDifficulty(selectedDifficulty)
  const difficultyMeta = normalizedDifficulty ? getDifficultyMeta(normalizedDifficulty) : null
  const game = useGame(
    id as string,
    Array.isArray(topicId) ? topicId[0] : topicId,
    reviewMode,
    selectedClassroomId,
    selectedDifficulty,
  )
  const [pendingAction, setPendingAction] = useState<'hint' | 'skip' | null>(null)
  const [feedbackDialog, setFeedbackDialog] = useState<{ title: string; message: string } | null>(null)

  const isDesktop = width >= 1024
  const selectedTopicName = Array.isArray(topicName) ? topicName[0] : topicName
  const playRouteParams = {
    id: id as string,
    ...(topicId ? { topicId: Array.isArray(topicId) ? topicId[0] : topicId } : {}),
    ...(selectedTopicName ? { topicName: selectedTopicName } : {}),
    ...(selectedClassroomId ? { classroomId: selectedClassroomId } : {}),
    ...(selectedDifficulty ? { difficulty: selectedDifficulty } : {}),
  }
  const handleReviewMistakes = () => {
    router.replace({
      pathname: '/(student)/play/[id]',
      params: { ...playRouteParams, review: 'failed' },
    } as any)
  }

  if (game.status === 'loading') {
    return (
      <GameShell>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text className="mt-4 text-[#B8C7E0]">Preparando la pregunta...</Text>
        </View>
      </GameShell>
    )
  }

  if (game.status === 'empty') {
    return (
      <GameShell>
        <ResultState
          icon="construct-outline"
          iconColor="#8FA7C7"
          title={reviewMode === 'failed' ? 'Sin fallos pendientes' : 'Todavía no hay preguntas'}
          detail={reviewMode === 'failed'
            ? 'No tienes preguntas falladas para repasar en este tema.'
            : 'El profesor aún no ha añadido preguntas a este tema.'}
          action="Volver al inicio"
          onPress={() => router.back()}
        />
      </GameShell>
    )
  }

  if (game.status === 'gameOver') {
    return (
      <GameShell>
        <ResultState
          icon="skull-outline"
          iconColor="#FB7185"
          title="Partida terminada"
          detail="Te has quedado sin vidas, pero ya tienes pistas claras para mejorar."
          score={game.score}
          summary={game.summary}
          topicLabel={selectedTopicName || 'Tema actual'}
          action="Volver al curso"
          onPress={() => router.back()}
          secondaryAction={game.summary.reviewQuestions.length > 0 ? 'Repasar fallos' : undefined}
          onSecondaryPress={game.summary.reviewQuestions.length > 0 ? handleReviewMistakes : undefined}
        />
      </GameShell>
    )
  }

  if (game.status === 'finished') {
    return (
      <GameShell>
        <ResultState
          icon="trophy"
          iconColor="#FBBF24"
          title="Partida completada"
          detail="Buen cierre. Revisa tu XP, precisión y los fallos que conviene reforzar."
          score={game.score}
          summary={game.summary}
          topicLabel={selectedTopicName || 'Tema actual'}
          action="Volver al curso"
          onPress={() => router.back()}
          secondaryAction={game.summary.reviewQuestions.length > 0 ? 'Repasar fallos' : undefined}
          onSecondaryPress={game.summary.reviewQuestions.length > 0 ? handleReviewMistakes : undefined}
        />
      </GameShell>
    )
  }

  const currentQuestion = game.currentQuestion as Question | undefined
  const questionType = getQuestionType(currentQuestion?.type)
  const totalQuestions = Math.max(game.questions.length, 1)
  const progressPercentage = ((game.currentIndex + 1) / totalQuestions) * 100
  const pointsBase = currentQuestion?.points_base ?? 150
  const baseCategory = selectedTopicName || currentQuestion?.category || currentQuestion?.subject || 'Tema'
  const category = difficultyMeta ? `${baseCategory} · ${difficultyMeta.label}` : baseCategory
  const position = `${Math.min(game.currentIndex + 3, 24)}/24`

  const handleHint = () => {
    if (!currentQuestion) return
    setPendingAction('hint')
  }

  const confirmHint = () => {
    const used = game.useHint()
    if (!used) {
      setPendingAction(null)
      setFeedbackDialog({
        title: 'Pista no disponible',
        message: 'No puedes usar la pista en este momento.',
      })
      return
    }

    setPendingAction(null)
  }

  const handleSkip = () => {
    if (!currentQuestion) return
    setPendingAction('skip')
  }

  const confirmSkip = () => {
    game.skipQuestion()
    setPendingAction(null)
  }

  return (
    <GameShell>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: isDesktop ? 46 : 18,
          paddingTop: isDesktop ? 38 : 22,
          paddingBottom: isDesktop ? 30 : 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={() => router.back()}
              className="h-14 w-14 items-center justify-center rounded-full border border-[#20375E] bg-[#0D1D3B]"
              style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
            >
              <Ionicons name="close" size={30} color="#F4F7FB" />
            </Pressable>

            <View className="min-w-0 flex-1">
              <View className="mb-3 flex-row items-center justify-between gap-4">
                <Text className="text-[18px] font-black text-white">
                  Pregunta {game.currentIndex + 1} de {totalQuestions}
                </Text>
                <View className="flex-row items-center gap-3">
                  <Text className="text-[18px] font-black text-[#9B6CFF]">{game.score} pts</Text>
                  <LivesBadge lives={game.lives} />
                  <StudentHeaderAvatar />
                </View>
              </View>
              <View className="h-3 overflow-hidden rounded-full bg-[#10213E]">
                <View
                  className="h-full rounded-full bg-[#9B6CFF]"
                  style={{ width: `${progressPercentage}%` }}
                />
              </View>
            </View>
          </View>

          <GameStatsBar points={pointsBase} streak={game.streak} position={position} category={category} lives={game.lives} />

          <View className="mt-6 flex-1 items-center justify-center">
            <View className="w-full" style={{ maxWidth: 920 }}>
              <View className="items-center">
                <TimerPill timeLeft={game.timeLeft} />
                <View className="mt-5 flex-row items-center gap-4">
                  <Ionicons name="sparkles" size={18} color="#6D5AF6" />
                  <Text className="text-[22px] font-black text-[#9B6CFF]">
                    Pregunta {game.currentIndex + 1}
                  </Text>
                  <Ionicons name="sparkles" size={18} color="#6D5AF6" />
                </View>
                <Text className="mt-4 max-w-[820px] text-center text-[30px] font-black leading-10 text-white">
                  {currentQuestion?.text}
                </Text>
                <View className="mt-4 flex-row items-center gap-2">
                  <Ionicons name="star" size={20} color="#76A7FF" />
                  <Text className="text-[15px] text-[#C7D6ED]">{getQuestionInstruction(questionType)}</Text>
                </View>

                {game.hintedAnswerId ? (
                  <View className="mt-3 rounded-2xl border border-[#FBBF24] bg-[#2A210F]/90 p-4">
                    <Text className="font-black uppercase tracking-[0.04em] text-[#FBBF24]">Pista activa</Text>
                    <Text className="mt-2 text-[13px] text-[#F4E3B8]">
                      La respuesta se validará en el servidor y tendrá penalización si aciertas.
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                className="mt-6 rounded-[24px] bg-[#061426]/80 p-2"
                style={{
                  ...createShadowStyle({
                    color: '#020817',
                    opacity: 0.48,
                    radius: 28,
                    offsetY: 18,
                    elevation: 12,
                    web: '0 18px 28px rgba(2, 8, 23, 0.32)',
                  }),
                }}
              >
                {currentQuestion ? (
                  <QuestionInteraction
                    question={currentQuestion}
                    questionType={questionType}
                    selectedAnswerId={game.selectedAnswerId}
                    correctAnswerId={game.correctAnswerId}
                    hintedAnswerId={game.hintedAnswerId}
                    hasAnswered={game.hasAnswered}
                    isSubmitting={game.isSubmitting}
                    answerStatus={game.answerStatus}
                    onChoiceAnswer={game.submitAnswer}
                    onStructuredAnswer={game.submitStructuredAnswer}
                  />
                ) : null}
              </View>

              {game.feedback ? (
                <QuestionFeedbackCard feedback={game.feedback} streak={game.streak} onContinue={game.continueAfterFeedback} />
              ) : null}
            </View>
          </View>

          {!game.hasAnswered && !game.isSubmitting && !game.feedback ? (
            <BottomHud
              onHint={handleHint}
              onSkip={handleSkip}
            />
          ) : null}
        </View>
      </ScrollView>
      <AppConfirmModal
        visible={pendingAction === 'hint'}
        variant="info"
        title="¿Usar pista?"
        message="Se marcará una ayuda en la pregunta actual. Si aciertas, el servidor aplicará la penalización de puntos."
        cancelLabel="Cancelar"
        confirmLabel="Usar pista"
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmHint}
      />
      <AppConfirmModal
        visible={pendingAction === 'skip'}
        variant="warning"
        title="¿Saltar pregunta?"
        message="Vas a saltar esta pregunta y perderás 20 puntos. La pregunta quedará como no superada."
        cancelLabel="Cancelar"
        confirmLabel="Saltar pregunta"
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmSkip}
      />
      <AppConfirmModal
        visible={Boolean(feedbackDialog)}
        variant="info"
        title={feedbackDialog?.title ?? ''}
        message={feedbackDialog?.message ?? ''}
        cancelLabel="Cerrar"
        confirmLabel="Entendido"
        onCancel={() => setFeedbackDialog(null)}
        onConfirm={() => setFeedbackDialog(null)}
      />
    </GameShell>
  )
}

function QuestionInteraction({
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
  question: Question
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
  question: Question
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onSubmit: (payload: StructuredAnswerPayload) => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue('')
  }, [question.id])

  const handleSubmit = () => {
    if (hasAnswered || isSubmitting || !value.trim()) return
    onSubmit({ answerText: value.trim() })
  }

  return (
    <View className="gap-4 rounded-[22px] border border-[#1E355C] bg-[#0A1A34] p-5">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#18275A]">
          <Ionicons name="chatbox-ellipses-outline" size={21} color="#A78BFA" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black text-white">Escribe tu respuesta</Text>
          <Text className="mt-1 text-[12px] text-[#AFC2DB]">
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
        placeholderTextColor="#7388A7"
        className={`min-h-[74px] rounded-2xl border px-5 py-4 text-[18px] font-semibold text-white ${
          hasAnswered ? 'border-[#28456B] bg-[#071426]' : 'border-[#314E78] bg-[#081A37]'
        }`}
      />

      <AnswerFeedback
        status={answerStatus}
        correctTitle="Respuesta correcta"
        incorrectTitle="Respuesta incorrecta"
        incorrectDetail="Revisa el contenido y vuelve a intentarlo en la siguiente partida."
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
  question: Question
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onSubmit: (payload: StructuredAnswerPayload) => void
}) {
  const blankCount = getBlankCount(question)
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
    onSubmit({ answerText: values.map((value) => value.trim()).join(', ') })
  }

  return (
    <View className="gap-4 rounded-[22px] border border-[#1E355C] bg-[#0A1A34] p-5">
      <View className="flex-row items-start gap-3 rounded-2xl border border-[#28456B] bg-[#081A37] p-4">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#18275A]">
          <Ionicons name="text-outline" size={21} color="#60A5FA" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black text-white">Completa los huecos en orden</Text>
          <Text className="mt-1 text-[12px] leading-5 text-[#AFC2DB]">
            Escribe una respuesta por hueco. El servidor corregirá mayúsculas y espacios extra automáticamente.
          </Text>
        </View>
        <View className="rounded-full border border-[#2A456A] bg-[#0D1D3B] px-3 py-1">
          <Text className="text-[12px] font-black text-[#A78BFA]">{completedCount}/{blankCount}</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-2 rounded-2xl border border-[#243E65] bg-[#061426] p-4">
        {markerCount > 0 ? (
          promptParts.map((part, index) => (
            <React.Fragment key={`${part}-${index}`}>
              {part ? <Text className="text-[16px] font-semibold text-[#DDE7F4]">{part}</Text> : null}
              {index < promptParts.length - 1 ? <BlankPlaceholder index={index} /> : null}
            </React.Fragment>
          ))
        ) : (
          <>
            <Text className="text-[16px] font-semibold text-[#DDE7F4]">{question.text.trim()}</Text>
            <BlankPlaceholder index={0} />
          </>
        )}
      </View>

      {markerCount === 0 ? (
        <View className="rounded-2xl border border-[#3A315A] bg-[#141A3E] p-4">
          <Text className="text-[13px] font-bold text-[#D8CCFF]">
            Completa el hueco indicado. En próximas preguntas verás el espacio dentro del enunciado cuando esté marcado con ____.
          </Text>
        </View>
      ) : null}

      <View className="gap-3">
        {values.map((value, index) => {
          const filled = value.trim().length > 0
          const borderColor = !hasAnswered
            ? filled
              ? '#60A5FA'
              : '#314E78'
            : answerStatus === 'correct'
              ? '#34D399'
              : '#FB7185'

          return (
            <View key={index} className="rounded-2xl border bg-[#081A37] p-4" style={{ borderColor }}>
              <Text className="text-[11px] font-black uppercase tracking-[0.04em] text-[#8FA7C7]">
                Hueco {index + 1}
              </Text>
              <TextInput
                value={value}
                onChangeText={(nextValue) => updateValue(index, nextValue)}
                editable={!hasAnswered && !isSubmitting}
                placeholder={`Respuesta del hueco ${index + 1}`}
                placeholderTextColor="#7388A7"
                className="mt-2 min-h-[46px] text-[18px] font-black text-white"
              />
            </View>
          )
        })}
      </View>

      <AnswerFeedback
        status={answerStatus}
        correctTitle="Huecos correctos"
        incorrectTitle="Algún hueco no coincide"
        incorrectDetail="Comprueba que has escrito todos los huecos y que están en el mismo orden que en el enunciado."
      />

      {!hasAnswered ? (
        <SubmitAnswerButton disabled={isSubmitting || !isReady} onPress={handleSubmit} />
      ) : null}
    </View>
  )
}

function BlankPlaceholder({ index }: { index: number }) {
  return (
    <View className="rounded-xl border border-[#3A4F83] bg-[#111E45] px-4 py-2">
      <Text className="text-[15px] font-black tracking-[0.08em] text-[#A78BFA]">______</Text>
      <Text className="mt-1 text-center text-[10px] font-black uppercase tracking-[0.05em] text-[#8FA7C7]">
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
  question: Question
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onSubmit: (payload: StructuredAnswerPayload) => void
}) {
  const [orderedAnswers, setOrderedAnswers] = useState<Answer[]>(question.answers)

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
    onSubmit({ payload: { answer_ids: orderedAnswers.map((answer) => answer.id) } })
  }

  return (
    <View className="gap-3 rounded-[22px] border border-[#1E355C] bg-[#0A1A34] p-5">
      <Text className="text-[13px] font-bold text-[#AFC2DB]">Ordena los elementos de arriba a abajo.</Text>
      {orderedAnswers.map((answer, index) => {
        const rowColor = !hasAnswered ? '#1E355C' : answerStatus === 'correct' ? '#34D399' : '#FB7185'

        return (
          <View
            key={answer.id}
            className="flex-row items-center gap-3 rounded-2xl border bg-[#081A37] p-3"
            style={{ borderColor: rowColor }}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[#18275A]">
              <Text className="font-black text-white">{index + 1}</Text>
            </View>
            <Text className="min-w-0 flex-1 text-[17px] font-semibold text-white">{answer.text}</Text>
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
  question: Question
  questionType: 'match_pairs' | 'drag_drop'
  hasAnswered: boolean
  isSubmitting: boolean
  answerStatus: 'correct' | 'incorrect' | null
  onSubmit: (payload: StructuredAnswerPayload) => void
}) {
  const { width } = useWindowDimensions()
  const isTwoColumns = width >= 820
  const labels = getPairingLabels(questionType)
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
    onSubmit({
      payload: {
        pairs: leftAnswers.map((answer, index) => ({
          left: answer.text,
          right: selections[index]?.text || '',
        })),
      },
    })
  }

  return (
    <View className="gap-4 rounded-[22px] border border-[#1E355C] bg-[#0A1A34] p-5">
      <View className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#28456B] bg-[#081A37] p-4">
        <View className="min-w-0 flex-1 flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-[#18275A]">
            <Ionicons name={labels.icon} size={22} color={labels.accent} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-black text-white">{labels.title}</Text>
            <Text className="mt-1 text-[12px] leading-5 text-[#AFC2DB]">{labels.detail}</Text>
          </View>
        </View>
        <View className="rounded-full border border-[#2A456A] bg-[#0D1D3B] px-3 py-1">
          <Text className="text-[12px] font-black text-[#A78BFA]">{completedCount}/{leftAnswers.length}</Text>
        </View>
      </View>

      <View className="gap-4" style={{ flexDirection: isTwoColumns ? 'row' : 'column' }}>
        <View style={{ flex: 1 }}>
          <Text className="mb-3 text-[12px] font-black uppercase tracking-[0.06em] text-[#8FA7C7]">
            1. Elige {labels.leftLabel.toLowerCase()}
          </Text>
          <View className="gap-3">
            {leftAnswers.map((answer, index) => {
              const selected = selections[index]
              const active = activeIndex === index && !hasAnswered
              const borderColor = hasAnswered
                ? answerStatus === 'correct'
                  ? '#34D399'
                  : '#FB7185'
                : active
                  ? '#8B5CF6'
                  : selected
                    ? '#43D991'
                    : '#28456B'

              return (
                <Pressable
                  key={`${answer.id}-${index}`}
                  onPress={() => !hasAnswered && !isSubmitting && setActiveIndex(index)}
                  disabled={hasAnswered || isSubmitting}
                  className="rounded-2xl border bg-[#0D1D3B] p-4"
                  style={({ pressed }) => ({ borderColor, opacity: pressed ? 0.86 : 1 })}
                >
                  <View className="flex-row items-start gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: active ? '#6D5AF6' : selected ? '#145B45' : '#18275A' }}
                    >
                      <Text className="font-black text-white">{index + 1}</Text>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[11px] font-black uppercase tracking-[0.04em] text-[#8FA7C7]">
                        {labels.leftLabel}
                      </Text>
                      <Text className="mt-1 text-[17px] font-black text-white">{answer.text}</Text>
                      {selected ? (
                        <PairConnectionChip left={answer.text} right={selected.text} />
                      ) : (
                        <View className="mt-3 rounded-xl border border-[#243E65] bg-[#061426] px-3 py-2">
                          <Text className="text-[11px] font-black uppercase tracking-[0.04em] text-[#8FA7C7]">
                            {labels.rightLabel}
                          </Text>
                          <Text className="mt-1 text-[15px] font-black text-[#AFC2DB]">
                            Selecciona {labels.rightLabel.toLowerCase()} en la columna derecha
                          </Text>
                        </View>
                      )}
                    </View>
                    {selected && !hasAnswered && !isSubmitting ? (
                      <Pressable
                        onPress={() => clearSelection(index)}
                        className="h-9 w-9 items-center justify-center rounded-full border border-[#2A456A] bg-[#081A37]"
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar selección de ${answer.text}`}
                      >
                        <Ionicons name="close" size={17} color="#DDE7F4" />
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text className="mb-3 text-[12px] font-black uppercase tracking-[0.06em] text-[#8FA7C7]">
            2. Toca {labels.rightLabel.toLowerCase()}
          </Text>
          <View className="gap-3 rounded-2xl border border-[#1E355C] bg-[#061426] p-3">
            {options.length > 0 ? options.map((option, index) => {
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
                    borderColor: usedByCurrent ? '#8B5CF6' : usedByOther ? '#145B45' : '#314E78',
                    backgroundColor: usedByCurrent ? '#17164C' : usedByOther ? '#0F3B39' : '#111E45',
                    opacity: pressed ? 0.86 : 1,
                  })}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-[#0D1D3B]">
                      <Ionicons
                        name={usedByCurrent ? 'radio-button-on' : usedByOther ? 'checkmark-circle' : 'ellipse-outline'}
                        size={19}
                        color={usedByCurrent ? '#A78BFA' : usedByOther ? '#43D991' : '#8FA7C7'}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[16px] font-black text-white">{option.text}</Text>
                      {usedByOther ? (
                        <Text className="mt-1 text-[11px] font-bold text-[#A7F3D0]">
                          Usada con {labels.leftLabel.toLowerCase()} {ownerIndex + 1}. Tócala para moverla.
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              )
            }) : (
              <View className="rounded-xl border border-[#7A4A29] bg-[#3B2518] p-4">
                <Text className="text-[13px] font-semibold text-[#F6CFAE]">
                  Esta pregunta no tiene opciones de pareja configuradas. Revisa la pregunta desde el panel del profesor.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {selectedConnections.length > 0 ? (
        <View className="rounded-2xl border border-[#243E65] bg-[#061426] p-4">
          <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-[#8FA7C7]">Relaciones elegidas</Text>
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
        <View className="rounded-2xl border border-[#2A456A] bg-[#081A37] p-4">
          <Text className="text-[13px] font-semibold text-[#B8C7E0]">
            Completa todas las relaciones para activar el botón de comprobar.
          </Text>
        </View>
      ) : null}

      <AnswerFeedback
        status={answerStatus}
        correctTitle="Relaciones correctas"
        incorrectTitle="Alguna relación no coincide"
        incorrectDetail="Vuelve a fijarte en cada origen y destino. En este tipo la respuesta solo cuenta si todas las relaciones son correctas."
      />

      {!hasAnswered ? (
        <SubmitAnswerButton disabled={isSubmitting || !isReady} onPress={handleSubmit} />
      ) : null}
    </View>
  )
}

function SubmitAnswerButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="mt-1 flex-row items-center justify-center gap-2 rounded-2xl bg-[#5A46D8] px-6 py-4"
      style={({ pressed }) => ({ opacity: disabled ? 0.55 : pressed ? 0.84 : 1 })}
    >
      <Text className="text-[16px] font-black text-white">Comprobar</Text>
      <Ionicons name="checkmark-circle" size={19} color="#FFFFFF" />
    </Pressable>
  )
}

function PairConnectionChip({
  compact = false,
  left,
  right,
}: {
  compact?: boolean
  left: string
  right: string
}) {
  return (
    <View
      className={`flex-row items-center rounded-xl border border-[#145B45] bg-[#082B2B] ${
        compact ? 'px-3 py-2' : 'mt-3 px-4 py-3'
      }`}
      style={{ gap: compact ? 7 : 10 }}
    >
      <Text className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-black text-white`} numberOfLines={1}>
        {left}
      </Text>
      <Ionicons name="arrow-forward" size={compact ? 14 : 17} color="#43D991" />
      <Text className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-black text-[#A7F3D0]`} numberOfLines={1}>
        {right}
      </Text>
    </View>
  )
}

function QuestionFeedbackCard({
  feedback,
  onContinue,
  streak,
}: {
  feedback: {
    status: 'correct' | 'incorrect' | 'pending'
    earnedPoints: number
    correctAnswerText: string | null
    explanation: string | null
  }
  onContinue: () => void
  streak: number
}) {
  const isCorrect = feedback.status === 'correct'
  const isPending = feedback.status === 'pending'
  const color = isPending ? '#F6A64A' : isCorrect ? '#34D399' : '#FB7185'
  const title = isPending ? 'Enviado para revisión' : isCorrect ? 'Correcto' : 'Incorrecto'
  const pulse = useRef(new Animated.Value(0)).current
  const streakBonus = isCorrect && streak >= 3

  useEffect(() => {
    if (!isCorrect) return

    pulse.setValue(0)
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [isCorrect, pulse])

  const iconScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  })
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.52],
  })

  return (
    <View className="mt-5 rounded-[24px] border bg-[#09162C] p-5" style={{ borderColor: color }}>
      <View className="flex-row flex-wrap items-center justify-between gap-4">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <Animated.View
            className="absolute left-0 h-12 w-12 rounded-full"
            style={{ backgroundColor: color, opacity: glowOpacity, transform: [{ scale: iconScale }] }}
          />
          <Animated.View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: `${color}24`, transform: [{ scale: iconScale }] }}
          >
            <Ionicons name={isPending ? 'time-outline' : isCorrect ? 'checkmark-circle' : 'close-circle'} size={27} color={color} />
          </Animated.View>
          <View className="min-w-0 flex-1">
            <Text className="text-[20px] font-black text-white">{title}</Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <Text className="text-[13px] font-bold" style={{ color }}>
                {isPending ? 'Tu profesor corregirá esta respuesta' : `+${feedback.earnedPoints} XP`}
              </Text>
              {isCorrect ? (
                <View className="flex-row items-center gap-1 rounded-full bg-[#2A210F] px-2 py-1">
                  <Ionicons name="flame" size={12} color="#FF7B45" />
                  <Text className="text-[11px] font-black text-[#FFB38A]">
                    Racha {streak}{streakBonus ? ' · bonus' : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <Pressable
          onPress={onContinue}
          className="flex-row items-center justify-center gap-2 rounded-2xl px-5 py-3"
          style={({ pressed }) => ({ backgroundColor: color, opacity: pressed ? 0.82 : 1 })}
        >
          <Text className="font-black text-white">Continuar</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      {!isCorrect && !isPending && feedback.correctAnswerText ? (
        <View className="mt-4 rounded-2xl border border-[#243E65] bg-[#061426] p-4">
          <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-[#8FA7C7]">Respuesta correcta</Text>
          <Text className="mt-2 text-[15px] font-bold leading-6 text-white">{feedback.correctAnswerText}</Text>
        </View>
      ) : null}

      {feedback.explanation ? (
        <View className="mt-4 rounded-2xl border border-[#243E65] bg-[#0D1D3B] p-4">
          <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-[#8FA7C7]">Explicación</Text>
          <Text className="mt-2 text-[14px] leading-6 text-[#DDE7F4]">{feedback.explanation}</Text>
        </View>
      ) : null}
    </View>
  )
}

function MoveButton({
  icon,
  disabled,
  onPress,
}: {
  icon: 'chevron-up' | 'chevron-down'
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="h-10 w-10 items-center justify-center rounded-xl border border-[#28456B] bg-[#0D1D3B]"
      style={({ pressed }) => ({ opacity: disabled ? 0.35 : pressed ? 0.78 : 1 })}
    >
      <Ionicons name={icon} size={18} color="#DDE7F4" />
    </Pressable>
  )
}

function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 overflow-hidden bg-[#031026]">
      <View className="absolute inset-0 bg-[#050B22]" />
      <View className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-[#132E72]/35" />
      <View className="absolute right-[-110px] top-[180px] h-96 w-96 rounded-full bg-[#2D155F]/45" />
      <View className="absolute bottom-[-160px] left-[18%] h-96 w-96 rounded-full bg-[#071D48]/70" />
      <View className="absolute right-24 top-28 h-2 w-2 rounded-full bg-[#7C5CFF]" />
      <View className="absolute right-[21%] top-14 h-1.5 w-1.5 rounded-full bg-[#5364F5]" />
      <View className="absolute left-[8%] top-40 h-1.5 w-1.5 rounded-full bg-[#7C5CFF]" />
      <View className="absolute right-[12%] top-56 h-24 w-24 rounded-full bg-[#202B91]/70" />
      <View className="absolute right-[9%] top-72 h-9 w-9 rounded-full bg-[#29175F]" />
      <View className="absolute bottom-56 right-[5%] h-72 w-72 rounded-full bg-[#130D5B]/40" />
      <View
        className="absolute right-[9%] top-[235px] h-8 w-32 rounded-full border border-[#3F36A8]"
        style={{ transform: [{ rotate: '-18deg' }] }}
      />
      {children}
    </View>
  )
}

function TimerPill({ timeLeft }: { timeLeft: number }) {
  const isLow = timeLeft <= 5

  return (
    <View
      className={`flex-row items-center rounded-2xl border px-5 py-3 ${
        isLow ? 'border-[#FB7185] bg-[#3A1129]' : 'border-[#6D5AF6] bg-[#0D1738]'
      }`}
    >
      <Ionicons name="timer-outline" size={22} color={isLow ? '#FB7185' : '#8B5CF6'} />
      <Text className={`ml-2 text-[22px] font-black ${isLow ? 'text-[#FDA4AF]' : 'text-white'}`}>
        00:{timeLeft.toString().padStart(2, '0')}
      </Text>
    </View>
  )
}

function LivesBadge({ lives }: { lives: number }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-[#2A456A] bg-[#0D1D3B] px-3 py-2">
      {[...Array(3)].map((_, index) => (
        <Ionicons
          key={index}
          name={index < lives ? 'heart' : 'heart-outline'}
          size={18}
          color="#FF647C"
        />
      ))}
    </View>
  )
}

function GameStatsBar({
  points,
  streak,
  position,
  category,
  lives,
}: {
  points: number
  streak: number
  position: string
  category: string
  lives: number
}) {
  const hasStreakBonus = streak >= 3

  return (
    <View className="mt-5 flex-row flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#172A4A] bg-[#07162E]/88 px-4 py-3">
      <GameStatPill icon="flash" color="#FBBF24" label={`${points} XP`} />
      <GameStatPill icon="flame" color="#FF7B45" label={hasStreakBonus ? `Racha ${streak} · bonus` : `Racha ${streak}`} />
      <GameStatPill icon="podium-outline" color="#9B6CFF" label={`Posición ${position}`} />
      <GameStatPill icon="heart" color="#FF647C" label={`${lives} vidas`} />
      <GameStatPill icon="albums-outline" color="#60A5FA" label={category} />
    </View>
  )
}

function GameStatPill({
  icon,
  color,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  label: string
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-[#1A3155] bg-[#0D1D3B] px-3 py-2">
      <Ionicons name={icon} size={17} color={color} />
      <Text className="text-[12px] font-bold text-white">{label}</Text>
    </View>
  )
}

function AnswerOption({
  answer,
  index,
  selectedAnswerId,
  correctAnswerId,
  hintedAnswerId,
  hasAnswered,
  isSubmitting,
  onPress,
}: {
  answer: Answer
  index: number
  selectedAnswerId: number | null
  correctAnswerId: number | null
  hintedAnswerId: number | null
  hasAnswered: boolean
  isSubmitting: boolean
  onPress: () => void
}) {
  const isSelected = selectedAnswerId === answer.id
  const isCorrectAnswer = correctAnswerId === answer.id

  let borderColor = '#1E355C'
  let backgroundColor = '#0A1A34'
  let textColor = '#FFFFFF'
  let badgeColor = '#3B68F0'

  const isHinted = hintedAnswerId === answer.id
  if (isHinted) {
    borderColor = '#FBBF24'
    backgroundColor = '#2A210F'
    badgeColor = '#FBBF24'
  }

  if (!hasAnswered && index === 0 && !isHinted) {
    borderColor = '#8B5CF6'
    backgroundColor = '#16164E'
    badgeColor = '#6D5AF6'
  }

  if (hasAnswered) {
    if (isCorrectAnswer) {
      borderColor = '#34D399'
      backgroundColor = '#0D2D27'
      textColor = '#A7F3D0'
      badgeColor = '#22C55E'
    } else if (isSelected) {
      borderColor = '#FB7185'
      backgroundColor = '#341525'
      textColor = '#FDA4AF'
      badgeColor = '#F43F5E'
    } else {
      borderColor = '#142541'
      backgroundColor = '#071426'
      textColor = '#697B99'
      badgeColor = '#334155'
    }
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={hasAnswered || isSubmitting}
      className="min-h-[86px] flex-row items-center rounded-2xl border-2 px-8 py-4"
      style={({ pressed }) => ({
        borderColor,
        backgroundColor,
        opacity: pressed ? 0.84 : 1,
      })}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: badgeColor }}
      >
        <Text className="text-[18px] font-black text-white">{answerLetters[index] || '?'}</Text>
      </View>
      <Text className="ml-6 min-w-0 flex-1 text-[21px] font-semibold" style={{ color: textColor }}>
      {answer.text}
      </Text>
      {hasAnswered && isCorrectAnswer ? <Ionicons name="checkmark-circle" size={26} color="#34D399" /> : null}
      {hasAnswered && isSelected && !isCorrectAnswer ? <Ionicons name="close-circle" size={26} color="#FB7185" /> : null}
    </Pressable>
  )
}

function BottomHud({
  onHint,
  onSkip,
}: {
  onHint: () => void
  onSkip: () => void
}) {
  return (
    <View className="mt-6 rounded-3xl border border-[#172A4A] bg-[#08172E]/95 px-5 py-4">
      <View className="flex-row flex-wrap items-center justify-center gap-4">
        <HudAction icon="bulb" title="Pista" detail="-10 pts" color="#FBBF24" onPress={onHint} />

        <View className="min-w-[220px] flex-row items-center justify-center gap-3 rounded-2xl border border-[#10213E] bg-[#071426] px-5 py-4">
          <Ionicons name="checkmark-circle-outline" size={22} color="#43D991" />
          <Text className="text-center font-bold text-[#DDE7F4]">Comprueba desde la tarjeta de respuesta</Text>
        </View>

        <HudAction icon="chevron-forward" title="Saltar" detail="-20 pts" color="#A78BFA" onPress={onSkip} />
      </View>
    </View>
  )
}

function HudAction({
  icon,
  title,
  detail,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  detail: string
  color: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[150px] flex-row items-center justify-center gap-3 rounded-2xl border border-[#1A3155] bg-[#0D1D3B] px-5 py-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#10213E]">
        <Ionicons name={icon} size={23} color={color} />
      </View>
      <View>
        <Text className="text-[16px] font-black text-white">{title}</Text>
        <Text className="mt-1 text-[13px] font-bold" style={{ color }}>
          {detail}
        </Text>
      </View>
    </Pressable>
  )
}

function ResultState({
  icon,
  iconColor,
  title,
  detail,
  score,
  summary,
  topicLabel,
  action,
  onPress,
  secondaryAction,
  onSecondaryPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  title: string
  detail: string
  score?: number
  summary?: {
    questionsTotal: number
    answered: number
    correct: number
    incorrect: number
    xp: number
    timeSeconds: number
    reviewQuestions: { id: number; text: string }[]
  }
  topicLabel?: string
  action: string
  onPress: () => void
  secondaryAction?: string
  onSecondaryPress?: () => void
}) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        alignItems: 'center',
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-[760px] items-center rounded-3xl border border-[#1A3155] bg-[#09162C]/95 p-8">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-[#10213E]">
          <Ionicons name={icon} size={58} color={iconColor} />
        </View>
        <Text className="mt-5 text-center text-[30px] font-black text-white">{title}</Text>
        <Text className="mt-3 max-w-[420px] text-center text-[15px] leading-6 text-[#B8C7E0]">{detail}</Text>

        {summary ? (
          <GameSummaryPanel summary={summary} fallbackScore={score} topicLabel={topicLabel} />
        ) : typeof score === 'number' ? (
          <View className="my-7 w-full rounded-2xl border border-[#172A4A] bg-[#0D1D3B] p-5">
            <Text className="text-center text-[12px] font-bold uppercase text-[#8FA7C7]">Puntuación final</Text>
            <Text className="mt-2 text-center text-[46px] font-black text-[#9B6CFF]">{score}</Text>
          </View>
        ) : null}

        <View className="w-full flex-row flex-wrap justify-center gap-3">
          {secondaryAction && onSecondaryPress ? (
            <Pressable
              onPress={onSecondaryPress}
              className="min-w-[220px] flex-row items-center justify-center gap-2 rounded-2xl bg-[#FB7185] px-7 py-4"
              style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            >
              <Ionicons name="refresh" size={17} color="#FFFFFF" />
              <Text className="text-center text-[16px] font-black text-white">{secondaryAction}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onPress}
            className="min-w-[220px] flex-row items-center justify-center gap-2 rounded-2xl bg-[#5A46D8] px-7 py-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Text className="text-center text-[16px] font-black text-white">{action}</Text>
            <Ionicons name="arrow-back" size={17} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function GameSummaryPanel({
  fallbackScore,
  summary,
  topicLabel,
}: {
  fallbackScore?: number
  summary: {
    questionsTotal: number
    answered: number
    correct: number
    incorrect: number
    xp: number
    timeSeconds: number
    reviewQuestions: { id: number; text: string }[]
  }
  topicLabel?: string
}) {
  const answered = Math.max(summary.answered, summary.correct + summary.incorrect)
  const precision = answered > 0 ? Math.round((summary.correct / answered) * 100) : 0
  const xp = summary.xp || fallbackScore || 0
  const totalQuestions = summary.questionsTotal || answered
  const reviewCount = summary.reviewQuestions.length

  return (
    <View className="my-7 w-full rounded-2xl border border-[#172A4A] bg-[#0D1D3B] p-5">
      <Text className="text-center text-[12px] font-bold uppercase text-[#8FA7C7]">Resumen de la partida</Text>
      <Text className="mt-2 text-center text-[42px] font-black text-white">
        {summary.correct}/{totalQuestions} correctas
      </Text>
      <Text className="mt-1 text-center text-[28px] font-black text-[#9B6CFF]">+{xp} XP</Text>

      <View className="mt-4 flex-row flex-wrap justify-center gap-2">
        <View className="rounded-full bg-[#10213E] px-3 py-2">
          <Text className="text-[12px] font-black text-[#DDE7F4]">
            {reviewCount} {reviewCount === 1 ? 'fallo para repasar' : 'fallos para repasar'}
          </Text>
        </View>
        <View className="rounded-full bg-[#10213E] px-3 py-2">
          <Text className="text-[12px] font-black text-[#DDE7F4]">Mejor tema: {topicLabel || 'Tema actual'}</Text>
        </View>
      </View>

      <View className="mt-5 flex-row flex-wrap gap-3">
        <SummaryMetric icon="help-circle-outline" label="Preguntas" value={String(totalQuestions)} color="#60A5FA" />
        <SummaryMetric icon="checkmark-circle" label="Correctas" value={String(summary.correct)} color="#34D399" />
        <SummaryMetric icon="close-circle" label="Incorrectas" value={String(summary.incorrect)} color="#FB7185" />
        <SummaryMetric icon="analytics" label="Precisión" value={`${precision}%`} color="#FBBF24" />
        <SummaryMetric icon="timer-outline" label="Tiempo total" value={formatDuration(summary.timeSeconds)} color="#A78BFA" />
        <SummaryMetric icon="refresh" label="A repasar" value={String(summary.reviewQuestions.length)} color="#F97316" />
      </View>

      <View className="mt-5 rounded-2xl border border-[#243E65] bg-[#061426] p-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="refresh" size={17} color="#F97316" />
          <Text className="font-black text-white">Preguntas a repasar</Text>
        </View>
        {summary.reviewQuestions.length > 0 ? (
          <View className="mt-3 gap-2">
            {summary.reviewQuestions.slice(0, 3).map((question) => (
              <View key={question.id} className="rounded-xl bg-[#0D1D3B] px-3 py-2">
                <Text className="text-[13px] font-semibold leading-5 text-[#DDE7F4]" numberOfLines={2}>
                  {question.text}
                </Text>
              </View>
            ))}
            {summary.reviewQuestions.length > 3 ? (
              <Text className="text-[12px] font-bold text-[#8FA7C7]">
                +{summary.reviewQuestions.length - 3} más para repasar
              </Text>
            ) : null}
          </View>
        ) : (
          <Text className="mt-2 text-[13px] text-[#8FA7C7]">No tienes preguntas pendientes de repaso en esta partida.</Text>
        )}
      </View>
    </View>
  )
}

function SummaryMetric({
  color,
  icon,
  label,
  value,
}: {
  color: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  return (
    <View className="min-w-[130px] flex-1 rounded-2xl border border-[#243E65] bg-[#081A37] p-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={16} color={color} />
        <Text className="text-[11px] font-black uppercase tracking-[0.04em] text-[#8FA7C7]">{label}</Text>
      </View>
      <Text className="mt-2 text-[20px] font-black text-white">{value}</Text>
    </View>
  )
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function getQuestionType(typeValue: string | null | undefined): QuestionType {
  const normalized = (typeValue || '').toLowerCase()
  if (normalized === 'true_false') return 'true_false'
  if (normalized === 'open_answer') return 'open_answer'
  if (normalized === 'fill_blank') return 'fill_blank'
  if (normalized === 'ordering') return 'ordering'
  if (normalized === 'match_pairs') return 'match_pairs'
  if (normalized === 'drag_drop') return 'drag_drop'
  return 'multiple_choice'
}

function getQuestionInstruction(type: QuestionType) {
  if (type === 'open_answer') return 'Escribe la respuesta correcta'
  if (type === 'fill_blank') return 'Completa cada hueco en orden'
  if (type === 'ordering') return 'Ordena los elementos'
  if (type === 'match_pairs') return 'Toca un origen y después su pareja'
  if (type === 'drag_drop') return 'Asigna cada elemento a su destino'
  return 'Elige la opción correcta'
}

function isChoiceQuestion(type: QuestionType) {
  return type === 'multiple_choice' || type === 'true_false'
}

function AnswerFeedback({
  status,
  correctTitle,
  incorrectTitle,
  incorrectDetail,
}: {
  status: 'correct' | 'incorrect' | null
  correctTitle: string
  incorrectTitle: string
  incorrectDetail: string
}) {
  if (!status) return null

  const isCorrect = status === 'correct'
  const feedbackColor = isCorrect ? '#34D399' : '#FB7185'

  return (
    <View className="rounded-2xl border px-4 py-3" style={{ borderColor: feedbackColor, backgroundColor: `${feedbackColor}1F` }}>
      <View className="flex-row items-center gap-2">
        <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={19} color={feedbackColor} />
        <Text className="font-black" style={{ color: feedbackColor }}>
          {isCorrect ? correctTitle : incorrectTitle}
        </Text>
      </View>
      {!isCorrect ? <Text className="mt-1 text-[13px] text-[#DDE7F4]">{incorrectDetail}</Text> : null}
    </View>
  )
}

function getBlankCount(question: Question) {
  const databaseCount = Number(question.blank_count || 0)
  const markerCount = countBlankMarkers(question.text)
  return Math.max(1, Math.min(8, databaseCount || markerCount || 1))
}

function countBlankMarkers(text: string) {
  return (text.match(/_{2,}|\[\[blank\]\]|\{\{blank\}\}/gi) || []).length
}

function splitFillPrompt(text: string) {
  return text.split(/_{2,}|\[\[blank\]\]|\{\{blank\}\}/gi)
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

function getPairingLabels(type: 'match_pairs' | 'drag_drop') {
  if (type === 'drag_drop') {
    return {
      title: 'Asigna cada elemento a su destino',
      detail: 'Primero toca una tarjeta de la izquierda y después el destino correcto. Puedes cambiar cualquier relación antes de comprobar.',
      leftLabel: 'Elemento',
      rightLabel: 'Destino',
      icon: 'move' as keyof typeof Ionicons.glyphMap,
      accent: '#A78BFA',
    }
  }

  return {
    title: 'Une cada origen con su pareja',
    detail: 'Toca un origen y luego elige su pareja. Cada opción solo puede quedar asociada a un origen.',
    leftLabel: 'Origen',
    rightLabel: 'Pareja',
    icon: 'git-compare' as keyof typeof Ionicons.glyphMap,
    accent: '#F6A64A',
  }
}
