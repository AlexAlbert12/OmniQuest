import React, { useEffect, useState } from 'react'
import { BackHandler, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useGame } from '../../../hooks/useGame'
import { getDifficultyMeta, normalizeDifficulty } from '../../../lib/difficulty'
import { createShadowStyle } from '../../../lib/platformShadow'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import { getQuestionInstruction, normalizeQuestionType } from '../../../lib/gameQuestionLogic'
import GameShell from '../../../components/student/game/GameShell'
import GameErrorBoundary from '../../../components/student/game/GameErrorBoundary'
import GameStateView from '../../../components/student/game/GameStateView'
import GameHeader from '../../../components/student/game/GameHeader'
import GameSyncStatus from '../../../components/student/game/GameSyncStatus'
import GameDialogs, { type GamePendingAction } from '../../../components/student/game/GameDialogs'
import GameAchievementModal from '../../../components/student/game/GameAchievementModal'
import GameQuestionRenderer from '../../../components/student/game/GameQuestionRenderer'
import { BottomHud, GameStatsBar, TimerPill } from '../../../components/student/game/GameHud'
import { QuestionFeedbackCard } from '../../../components/student/game/GameQuestionUi'
import QuestionMedia from '../../../components/questions/QuestionMedia'
import type { GameQuestion } from '../../../components/student/game/types'

export default function PlayScreen() {
  const params = useLocalSearchParams()
  const [boundaryVersion, setBoundaryVersion] = useState(0)
  const boundaryKey = `${String(params.id || '')}:${boundaryVersion}`

  return (
    <GameErrorBoundary resetKey={boundaryKey} onReset={() => setBoundaryVersion((value) => value + 1)}>
      <PlayScreenContent key={boundaryKey} />
    </GameErrorBoundary>
  )
}

function PlayScreenContent() {
  const { id, topicId, topicName, classroomId, difficulty } = useLocalSearchParams<{
    id: string
    topicId?: string
    topicName?: string
    classroomId?: string
    difficulty?: string
  }>()
  const responsive = useResponsiveLayout()
  const router = useRouter()
  const { tokens } = useAppTheme()
  const [pendingAction, setPendingAction] = useState<GamePendingAction>(null)
  const [feedbackDialog, setFeedbackDialog] = useState<{ title: string; message: string } | null>(null)

  const selectedClassroomId = firstParam(classroomId)
  const selectedDifficulty = firstParam(difficulty)
  const selectedTopicId = firstParam(topicId)
  const selectedTopicName = firstParam(topicName)
  const normalizedDifficulty = normalizeDifficulty(selectedDifficulty)
  const difficultyMeta = normalizedDifficulty ? getDifficultyMeta(normalizedDifficulty) : null
  const isDesktop = responsive.isDesktop
  const game = useGame(String(id), selectedTopicId, selectedClassroomId, selectedDifficulty)

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (game.status !== 'playing') return false
      setPendingAction('exit')
      return true
    })
    return () => subscription.remove()
  }, [game.status])

  const handleReviewMistakes = () => {
    router.replace({
      pathname: '/(student)/review/[attemptId]',
      params: {
        attemptId: game.attemptId || 'latest',
        subjectId: String(id),
        ...(selectedTopicId ? { topicId: selectedTopicId } : {}),
        ...(selectedTopicName ? { topicName: selectedTopicName } : {}),
        ...(selectedClassroomId ? { classroomId: selectedClassroomId } : {}),
        ...(selectedDifficulty ? { difficulty: selectedDifficulty } : {}),
      },
    } as any)
  }

  const handleBack = () => router.back()
  const confirmExit = async () => {
    setPendingAction(null)
    await game.abandonGame()
    router.back()
  }

  if (game.status !== 'playing') {
    return (
      <>
        <GameStateView
          status={game.status}
          isOffline={game.isOffline}
          loadError={game.loadError}
          score={game.score}
          summary={game.summary}
          tokens={tokens}
          onRetry={game.retryLoadGame}
          onBack={handleBack}
          onReviewMistakes={handleReviewMistakes}
        />
        <GameAchievementModal badges={game.newlyUnlockedBadges} onDismiss={game.dismissUnlockedBadge} />
      </>
    )
  }

  const currentQuestion = game.currentQuestion as GameQuestion | undefined
  const questionType = normalizeQuestionType(currentQuestion?.type)
  const isComplexInteraction = questionType === 'fill_blank' || questionType === 'match_pairs' || questionType === 'drag_drop'
  const showQuestionDescriptor = questionType === 'multiple_choice' || questionType === 'true_false'
  const interactionMaxWidth = isDesktop ? (isComplexInteraction ? 840 : 720) : 640
  const totalQuestions = Math.max(game.questions.length, 1)
  const progressPercentage = ((game.currentIndex + 1) / totalQuestions) * 100
  const pointsBase = currentQuestion?.points_base ?? 150
  const baseCategory = selectedTopicName || currentQuestion?.category || currentQuestion?.subject || 'Tema'
  const category = difficultyMeta ? `${baseCategory} · ${difficultyMeta.label}` : baseCategory
  const position = `${Math.min(game.currentIndex + 3, 24)}/24`

  const confirmHint = () => {
    if (!game.useHint()) {
      setFeedbackDialog({ title: 'Pista no disponible', message: 'No puedes usar la pista en este momento.' })
    }
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
          <GameHeader
            current={game.currentIndex + 1}
            total={totalQuestions}
            progressPercentage={progressPercentage}
            score={game.score}
            lives={game.lives}
            isDesktop={isDesktop}
            onExit={() => setPendingAction('exit')}
          />

          <GameSyncStatus
            state={game.syncState}
            error={game.syncError}
            onRetry={game.retryPendingAnswer}
          />

          {isDesktop ? (
            <GameStatsBar points={pointsBase} streak={game.streak} position={position} category={category} />
          ) : null}

          <View className={isDesktop ? 'mt-6 flex-1 items-center justify-center' : 'mt-4 flex-1 items-center justify-start'}>
            <View className="w-full" style={{ maxWidth: interactionMaxWidth }}>
              <View className="items-center px-1">
                <TimerPill timeLeft={game.timeLeft} compact={!isDesktop} />
                {isDesktop ? (
                  <View className="mt-5 flex-row items-center gap-3">
                    <Ionicons name="sparkles" size={16} color={tokens.brand.student} />
                    <Text className="text-[22px] font-black text-brand-student">
                      Pregunta {game.currentIndex + 1}
                    </Text>
                    <Ionicons name="sparkles" size={16} color={tokens.brand.student} />
                  </View>
                ) : null}
                <Text className={`${isDesktop ? 'mt-4 text-[30px] leading-10' : 'mt-3 text-[24px] leading-8'} max-w-[720px] text-center font-black text-text-primary`}>
                  {currentQuestion?.text}
                </Text>
                {currentQuestion?.media_type ? (
                  <QuestionMedia
                    questionId={currentQuestion.id}
                    type={currentQuestion.media_type}
                    altText={currentQuestion.media_alt_text}
                    caption={currentQuestion.media_caption}
                    compact={!isDesktop}
                  />
                ) : null}
                {showQuestionDescriptor ? (
                  <View className={`${isDesktop ? 'mt-4' : 'mt-3'} flex-row items-center gap-2 rounded-full bg-surface-default px-4 py-2`}>
                    <Ionicons name="star" size={18} color={tokens.semantic.info} />
                    <Text className="text-[13px] font-semibold text-text-secondary">{getQuestionInstruction(questionType)}</Text>
                  </View>
                ) : null}

                {game.hintVisible && currentQuestion?.hint?.trim() ? (
                  <View className="mt-3 w-full flex-row items-start gap-2 rounded-xl bg-semantic-surface-warning px-3 py-3">
                    <Ionicons name="bulb" size={17} color={tokens.semantic.warning} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-[12px] font-black text-gamification-xp">Pista</Text>
                      <Text className="mt-1 text-[13px] leading-5 text-text-secondary">{currentQuestion.hint.trim()}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <View
                className={`${isDesktop ? 'mt-5 rounded-[26px] p-5' : 'mt-4 rounded-[24px] p-4'} border border-border-default bg-surface-default`}
                style={createShadowStyle({
                  color: tokens.brand.student,
                  opacity: isDesktop ? 0.18 : 0.12,
                  radius: isDesktop ? 28 : 18,
                  offsetY: isDesktop ? 18 : 10,
                  elevation: isDesktop ? 12 : 6,
                  web: isDesktop ? '0 18px 28px rgba(37, 99, 235, 0.16)' : '0 10px 22px rgba(37, 99, 235, 0.12)',
                })}
              >
                {currentQuestion ? (
                  <GameQuestionRenderer
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

          {!game.hasAnswered && !game.isSubmitting && !game.pendingAnswer && !game.feedback && !game.questionConflict ? (
            <BottomHud showHint={Boolean(currentQuestion?.hint?.trim())} onHint={() => setPendingAction('hint')} onSkip={() => setPendingAction('skip')} />
          ) : null}
        </View>
      </ScrollView>

      <GameDialogs
        pendingAction={pendingAction}
        feedbackDialog={feedbackDialog}
        conflict={game.questionConflict}
        onCancelAction={() => setPendingAction(null)}
        onConfirmExit={() => void confirmExit()}
        onConfirmHint={confirmHint}
        onConfirmSkip={() => { game.skipQuestion(); setPendingAction(null) }}
        onDismissFeedback={() => setFeedbackDialog(null)}
        onReloadConflict={() => void game.restartAfterConflict()}
        onExitConflict={() => void confirmExit()}
      />
      <GameAchievementModal badges={game.newlyUnlockedBadges} onDismiss={game.dismissUnlockedBadge} />
    </GameShell>
  )
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}
