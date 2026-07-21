import React, { useEffect, useState } from 'react'
import {
  BackHandler,
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
import OmniGuide from '../../../components/OmniGuide'
import { useGame } from '../../../hooks/useGame'
import { getDifficultyMeta, normalizeDifficulty } from '../../../lib/difficulty'
import type { Json } from '../../../types/database.types'
import { createShadowStyle } from '../../../lib/platformShadow'
import { useI18n } from '../../../lib/i18n'
import GameShell from '../../../components/student/game/GameShell'
import ResultState from '../../../components/student/game/GameResultState'
import { BottomHud, GameStatsBar, LivesBadge, TimerPill } from '../../../components/student/game/GameHud'
import QuestionMedia from '../../../components/questions/QuestionMedia'
import {
  AnswerFeedback,
  AnswerOption,
  MoveButton,
  PairConnectionChip,
  QuestionFeedbackCard,
  SubmitAnswerButton,
} from '../../../components/student/game/GameQuestionUi'

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
  media_type?: 'image' | 'audio' | 'video' | null
  media_url?: string | null
  media_alt_text?: string | null
  media_caption?: string | null
}


export default function PlayScreen() {
  const { id, topicId, topicName, review, classroomId, difficulty } = useLocalSearchParams<{ id: string; topicId?: string; topicName?: string; review?: string; classroomId?: string; difficulty?: string }>()
  const { width } = useWindowDimensions()
  const router = useRouter()
  const { t } = useI18n()
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
  const [pendingAction, setPendingAction] = useState<'hint' | 'skip' | 'exit' | null>(null)
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

  const requestExit = () => {
    if (game.status === 'playing') {
      setPendingAction('exit')
      return
    }
    router.back()
  }

  const confirmExit = async () => {
    setPendingAction(null)
    await game.abandonGame()
    router.back()
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (game.status !== 'playing') return false
      setPendingAction('exit')
      return true
    })

    return () => subscription.remove()
  }, [game.status])

  if (game.status === 'loading') {
    return (
      <GameShell>
        <View className="flex-1 items-center justify-center">
          <OmniGuide state="blink" size={116} />
          <Text className="mt-4 text-[#B8C7E0]">Omni está preparando la pregunta...</Text>
        </View>
      </GameShell>
    )
  }

  if (game.status === 'error') {
    return (
      <GameShell>
        <ResultState
          icon={game.isOffline ? 'cloud-offline-outline' : 'warning-outline'}
          iconColor={game.isOffline ? '#FBBF24' : '#FB7185'}
          omniState="error"
          title={game.isOffline ? 'No hay conexión' : 'No se pudo cargar la partida'}
          detail={game.isOffline
            ? 'Conéctate a Internet para iniciar una partida nueva. Las partidas ya iniciadas se recuperan automáticamente.'
            : game.loadError || 'Vuelve a intentarlo en unos segundos.'}
          action={t('common.retry')}
          onPress={game.retryLoadGame}
          secondaryAction={t('common.back')}
          onSecondaryPress={() => router.back()}
        />
      </GameShell>
    )
  }

  if (game.status === 'empty') {
    return (
      <GameShell>
        <ResultState
          icon="construct-outline"
          iconColor="#8FA7C7"
          omniState={reviewMode === 'failed' ? 'happy' : 'thinking'}
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
          omniState="error"
          title="Partida terminada"
          detail="Te has quedado sin vidas, pero ya tienes pistas claras para mejorar."
          score={game.score}
          summary={game.summary}
          action="Volver al curso"
          onPress={() => router.back()}
          secondaryAction={game.summary.reviewQuestions.length > 0 ? 'Repasar fallos' : undefined}
          onSecondaryPress={game.summary.reviewQuestions.length > 0 ? handleReviewMistakes : undefined}
          unlockedBadges={game.newlyUnlockedBadges}
          onDismissUnlockedBadge={game.dismissUnlockedBadge}
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
          omniState="happy"
          title="¡Partida completada!"
          detail="Buen cierre. Ya tienes claro qué reforzar."
          score={game.score}
          summary={game.summary}
          action="Volver al curso"
          onPress={() => router.back()}
          secondaryAction={game.summary.reviewQuestions.length > 0 ? 'Repasar fallos' : undefined}
          onSecondaryPress={game.summary.reviewQuestions.length > 0 ? handleReviewMistakes : undefined}
          unlockedBadges={game.newlyUnlockedBadges}
          onDismissUnlockedBadge={game.dismissUnlockedBadge}
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
          paddingHorizontal: isDesktop ? 46 : 16,
          paddingTop: isDesktop ? 38 : 18,
          paddingBottom: isDesktop ? 30 : 36,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityLabel={t('common.close')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={requestExit}
              className="h-12 w-12 items-center justify-center rounded-2xl border border-[#20375E] bg-[#08172E]"
              style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
            >
              <Ionicons name="close" size={26} color="#F4F7FB" />
            </Pressable>

            <View className="min-w-0 flex-1">
              <View className="flex-row items-center justify-between gap-3">
                <Text className={`${isDesktop ? 'text-[18px]' : 'text-[16px]'} font-black text-white`}>
                  Pregunta {game.currentIndex + 1} de {totalQuestions}
                </Text>
                <View className="flex-row items-center gap-2">
                  {isDesktop ? (
                    <View className="rounded-xl border border-[#223A62] bg-[#08172E] px-3 py-2">
                    <Text className="text-[13px] font-black text-[#A78BFA]">{game.score} pts</Text>
                    </View>
                  ) : null}
                  <LivesBadge lives={game.lives} />
                </View>
              </View>
              <View className="mt-3 h-3 overflow-hidden rounded-full bg-[#10213E]">
                <View
                  className="h-full rounded-full bg-[#6D5AF6]"
                  style={{ width: `${progressPercentage}%` }}
                />
              </View>
            </View>
          </View>

          {game.isOffline || game.pendingAnswer || game.resumedFromSnapshot ? (
            <GameConnectionBanner
              isOffline={game.isOffline}
              pending={Boolean(game.pendingAnswer)}
              resumed={game.resumedFromSnapshot}
              onRetry={game.retryPendingAnswer}
            />
          ) : null}

          {isDesktop ? <GameStatsBar points={pointsBase} streak={game.streak} position={position} category={category} lives={game.lives} /> : null}

          <View className={isDesktop ? 'mt-6 flex-1 items-center justify-center' : 'mt-5 flex-1 items-center justify-start'}>
            <View className="w-full" style={{ maxWidth: isDesktop ? 760 : 640 }}>
              <View className="items-center px-1">
                <TimerPill timeLeft={game.timeLeft} />
                <View className="mt-5 flex-row items-center gap-3">
                  <Ionicons name="sparkles" size={16} color="#8B5CF6" />
                  <Text className={`${isDesktop ? 'text-[22px]' : 'text-[19px]'} font-black text-[#A78BFA]`}>
                    Pregunta {game.currentIndex + 1}
                  </Text>
                  <Ionicons name="sparkles" size={16} color="#8B5CF6" />
                </View>
                <Text className={`${isDesktop ? 'text-[30px] leading-10' : 'text-[24px] leading-8'} mt-4 max-w-[720px] text-center font-black text-white`}>
                  {currentQuestion?.text}
                </Text>
                {currentQuestion?.media_type && currentQuestion.media_url ? (
                  <QuestionMedia
                    type={currentQuestion.media_type}
                    url={currentQuestion.media_url}
                    altText={currentQuestion.media_alt_text}
                    caption={currentQuestion.media_caption}
                    compact={!isDesktop}
                  />
                ) : null}
                <View className="mt-4 flex-row items-center gap-2 rounded-full bg-[#071426]/80 px-4 py-2">
                  <Ionicons name="star" size={18} color="#76A7FF" />
                  <Text className="text-[13px] font-semibold text-[#C7D6ED]">{getQuestionInstruction(questionType)}</Text>
                </View>

                {game.hintedAnswerId ? (
                  <View className="mt-3 w-full rounded-2xl border border-[#FBBF24] bg-[#2A210F]/90 p-4">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="bulb" size={18} color="#FBBF24" />
                      <Text className="font-black uppercase tracking-[0.04em] text-[#FBBF24]">Pista activa</Text>
                    </View>
                    <Text className="mt-2 text-[13px] text-[#F4E3B8]">
                      La respuesta se validará en el servidor y tendrá penalización si aciertas.
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                className={isDesktop ? 'mt-6 rounded-[26px] border border-[#183258] bg-[#061426]/88 p-2' : 'mt-6 rounded-[24px] border border-[#244A7C] bg-[#0A1B36]/78 p-2'}
                style={{
                  ...createShadowStyle({
                    color: '#2563EB',
                    opacity: isDesktop ? 0.18 : 0.12,
                    radius: isDesktop ? 28 : 18,
                    offsetY: isDesktop ? 18 : 10,
                    elevation: isDesktop ? 12 : 6,
                    web: isDesktop ? '0 18px 28px rgba(37, 99, 235, 0.16)' : '0 10px 22px rgba(37, 99, 235, 0.12)',
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
                    isSubmitting={game.isSubmitting || Boolean(game.pendingAnswer)}
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

          {!game.hasAnswered && !game.isSubmitting && !game.pendingAnswer && !game.feedback ? (
            <BottomHud onHint={handleHint} onSkip={handleSkip} />
          ) : null}
        </View>
      </ScrollView>
      <AppConfirmModal
        visible={pendingAction === 'exit'}
        variant="warning"
        showOmni
        omniState="thinking"
        title="¿Salir de la partida?"
        message="La partida se marcará como abandonada. Podrás iniciar otra cuando quieras, pero este intento quedará registrado."
        cancelLabel="Seguir jugando"
        confirmLabel="Salir"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void confirmExit()}
      />
      <AppConfirmModal
        visible={pendingAction === 'hint'}
        variant="info"
        showOmni
        omniState="thinking"
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
        showOmni
        omniState="thinking"
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
        showOmni
        omniState="thinking"
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

function GameConnectionBanner({
  isOffline,
  pending,
  resumed,
  onRetry,
}: {
  isOffline: boolean
  pending: boolean
  resumed: boolean
  onRetry: () => void
}) {
  const { t } = useI18n()
  const color = isOffline ? '#F59E0B' : pending ? '#60A5FA' : '#34D399'
  const icon = isOffline ? 'cloud-offline-outline' : pending ? 'sync-outline' : 'refresh-circle-outline'
  const title = isOffline ? t('offline.banner') : pending ? t('offline.pending') : t('offline.resumed')
  const detail = resumed && !pending && !isOffline ? t('offline.resumed.detail') : null

  return (
    <View
      accessibilityRole="alert"
      className="mt-4 flex-row items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: color, backgroundColor: `${color}18` }}
    >
      <Ionicons name={icon} size={22} color={color} />
      <View className="min-w-0 flex-1">
        <Text className="text-[12px] font-black" style={{ color }}>{title}</Text>
        {detail ? <Text className="mt-1 text-[11px] text-[#B8C7E0]">{detail}</Text> : null}
      </View>
      {pending ? (
        <Pressable
          accessibilityLabel={t('common.retry')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onRetry}
          className="min-h-[42px] flex-row items-center gap-2 rounded-xl px-3"
          style={({ pressed }) => ({ backgroundColor: `${color}25`, opacity: pressed ? 0.72 : 1 })}
        >
          <Ionicons name="refresh" size={17} color={color} />
          <Text className="text-[11px] font-black" style={{ color }}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  )
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
