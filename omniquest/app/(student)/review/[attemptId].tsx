import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import GameShell from '../../../components/student/game/GameShell'
import OmniLoadingScreen from '../../../components/ui/OmniLoadingScreen'
import AppButton from '../../../components/ui/AppButton'
import AppBackButton from '../../../components/ui/AppBackButton'
import AppStatusBanner from '../../../components/ui/AppStatusBanner'
import OmniGuide from '../../../components/OmniGuide'
import { getQuestionTypeLabel, getSubmittedAnswerText } from '../../../components/student/activity/utils'
import { getDifficultyMeta, normalizeDifficulty } from '../../../lib/difficulty'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import { useI18n } from '../../../lib/i18n'
import {
  fetchGameAttemptReview,
  type GameAttemptReview,
  type GameAttemptReviewMistake,
} from '../../../lib/studentSecureData'
import { withAlpha } from '../../../lib/color'

export default function StudentGameReviewScreen() {
  const params = useLocalSearchParams<{
    attemptId: string
    subjectId?: string
    classroomId?: string
    topicId?: string
    topicName?: string
    difficulty?: string
  }>()
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const { formatDate } = useI18n()
  const [review, setReview] = useState<GameAttemptReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const attemptId = firstParam(params.attemptId)
  const subjectId = parseOptionalNumber(firstParam(params.subjectId))
  const classroomId = parseOptionalNumber(firstParam(params.classroomId))
  const topicIdParam = firstParam(params.topicId)
  const topicId = topicIdParam && topicIdParam !== 'general' ? parseOptionalNumber(topicIdParam) : null
  const topicName = firstParam(params.topicName)
  const difficulty = normalizeDifficulty(firstParam(params.difficulty))
  const isGeneralTopic = topicIdParam === 'general'
  const isDesktop = responsive.isDesktop

  const loadReview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchGameAttemptReview({
        attemptId: attemptId && attemptId !== 'latest' ? attemptId : null,
        subjectId,
        classroomId,
        topicId,
        generalTopic: isGeneralTopic,
        difficulty,
      })
      setReview(result)
    } catch (cause) {
      console.error('Error loading game review:', cause)
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la revisión de la partida.')
    } finally {
      setLoading(false)
    }
  }, [attemptId, classroomId, difficulty, isGeneralTopic, subjectId, topicId])

  useEffect(() => {
    void loadReview()
  }, [loadReview])

  const replayParams = useMemo(() => ({
    id: String(review?.subject_id || subjectId || ''),
    topicId: review?.topic_id === null || isGeneralTopic ? 'general' : String(review?.topic_id || topicId || ''),
    topicName: review?.topic_title || topicName || 'Tema general',
    ...(review?.classroom_id || classroomId ? { classroomId: String(review?.classroom_id || classroomId) } : {}),
    ...(review?.difficulty || difficulty ? { difficulty: String(review?.difficulty || difficulty) } : {}),
  }), [classroomId, difficulty, isGeneralTopic, review, subjectId, topicId, topicName])

  const replayTopic = () => {
    router.replace({ pathname: '/(student)/play/[id]', params: replayParams } as any)
  }

  if (loading) return <OmniLoadingScreen message="Preparando la revisión de tu partida..." />

  if (error) {
    return (
      <ReviewState
        icon="cloud-offline-outline"
        title="No se pudo cargar la revisión"
        detail={error}
        actionLabel="Reintentar"
        onAction={() => void loadReview()}
        onBack={() => router.back()}
      />
    )
  }

  if (!review) {
    return (
      <ReviewState
        icon="document-text-outline"
        title="No hay una partida con fallos"
        detail="Juega el tema completo y, cuando tengas algún fallo, podrás revisar aquí tu respuesta y la solución correcta."
        actionLabel="Volver al curso"
        onAction={() => router.back()}
      />
    )
  }

  const difficultyMeta = review.difficulty ? getDifficultyMeta(normalizeDifficulty(review.difficulty) || 1) : null
  const topicTitle = review.topic_title || topicName || 'Tema general'
  const evaluatedTotal = Math.max(0, review.evaluated_total)
  const accuracy = evaluatedTotal > 0 ? Math.round((review.correct_total / evaluatedTotal) * 100) : null

  return (
    <GameShell>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: isDesktop ? 28 : 16, paddingTop: 24, paddingBottom: 44 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <AppBackButton label="Volver" size="sm" onPress={() => router.back()} />
            <View
              className="flex-row items-center gap-2 rounded-full border px-3 py-2"
              style={{ borderColor: withAlpha(tokens.semantic.info, '88'), backgroundColor: tokens.semanticSurface.info }}
            >
              <Ionicons name="eye-outline" size={17} color={tokens.semantic.info} />
              <Text className="text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: tokens.semantic.info }}>Solo lectura</Text>
            </View>
          </View>

          <View
            className="mt-5 overflow-hidden rounded-[28px] border p-5"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}
          >
            <View className={`${isDesktop ? 'flex-row items-center' : 'items-center'} gap-5`}>
              <View className="h-24 w-24 items-center justify-center rounded-3xl" style={{ backgroundColor: withAlpha(tokens.brand.student, '1F') }}>
                <OmniGuide state="thinking" size={76} />
              </View>
              <View className={`${isDesktop ? 'items-start' : 'items-center'} min-w-0 flex-1`}>
                <Text className="text-[12px] font-black uppercase tracking-[0.1em]" style={{ color: tokens.brand.student }}>Revisión de partida</Text>
                <Text className={`${isDesktop ? 'text-left' : 'text-center'} mt-1 text-[28px] font-black text-white`}>{topicTitle}</Text>
                <Text className={`${isDesktop ? 'text-left' : 'text-center'} mt-2 text-[13px] leading-5 text-text-secondary`}>
                  Consulta los resultados ya evaluados de esta partida. Las respuestas pendientes pueden actualizar la puntuación cuando el profesor las revise. Esta pantalla es de solo lectura.
                </Text>
                <View className="mt-3 flex-row flex-wrap items-center gap-2">
                  {review.subject_name ? <MetaPill icon="book-outline" label={review.subject_name} color={tokens.semantic.info} /> : null}
                  {difficultyMeta ? <MetaPill icon="layers-outline" label={difficultyMeta.label} color={difficultyMeta.color} /> : null}
                  <MetaPill icon="calendar-outline" label={formatDate(review.finished_at || review.started_at, { dateStyle: 'medium', timeStyle: 'short' })} color={tokens.text.muted} />
                </View>
              </View>
            </View>

            <View className="mt-5 flex-row flex-wrap gap-3">
              <SummaryMetric icon="close-circle" label="Fallos" value={review.incorrect_total} color={tokens.semantic.danger} />
              <SummaryMetric icon="checkmark-circle" label="Aciertos" value={review.correct_total} color={tokens.semantic.success} />
              <SummaryMetric icon="analytics" label={review.pending_total > 0 ? 'Precisión provisional' : 'Precisión'} value={accuracy == null ? 'Pendiente' : `${accuracy}%`} color={tokens.brand.student} />
              {review.pending_total > 0 ? <SummaryMetric icon="time-outline" label="Pendientes" value={review.pending_total} color={tokens.semantic.warning} /> : null}
              <SummaryMetric icon="flash" label={review.pending_total > 0 ? 'XP hasta ahora' : 'XP'} value={review.total_score} color={tokens.gamification.xp} />
            </View>
          </View>

          {review.pending_total > 0 ? (
            <View className="mt-4">
              <AppStatusBanner
                variant="warning"
                title={`${review.pending_total} ${review.pending_total === 1 ? 'respuesta pendiente' : 'respuestas pendientes'} de revisión`}
                message="Tu resultado, la precisión y el XP pueden actualizarse cuando el profesor complete la revisión manual."
              />
            </View>
          ) : null}

          {review.mistakes.length === 0 && review.pending_total === 0 ? (
            <View className="mt-4">
              <AppStatusBanner
                variant="success"
                title="Partida sin fallos"
                message="Todas las respuestas evaluadas de esta partida son correctas."
              />
            </View>
          ) : null}

          {review.mistakes.length === 0 && review.pending_total > 0 ? (
            <View className="mt-6 rounded-3xl border border-border-default bg-surface-raised p-5">
              <Text className="text-[16px] font-black text-white">No hay fallos evaluados</Text>
              <Text className="mt-2 text-[13px] leading-5 text-text-secondary">Las respuestas que siguen pendientes todavía no se consideran correctas ni incorrectas.</Text>
            </View>
          ) : null}

          <View className="mt-6 gap-4">
            {review.mistakes.map((mistake, index) => (
              <MistakeReviewCard key={mistake.attempt.id} mistake={mistake} index={index} total={review.mistakes.length} />
            ))}
          </View>

          <View
            className="mt-6 flex-row flex-wrap items-center gap-4 rounded-3xl border p-5"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}
          >
            <View className="min-w-[220px] flex-1">
              <Text className="text-[17px] font-black text-white">¿Quieres intentarlo otra vez?</Text>
              <Text className="mt-1 text-[13px] leading-5 text-text-secondary">La nueva partida empezará desde el principio con todas sus preguntas.</Text>
            </View>
            <AppButton label="Jugar tema de nuevo" icon="refresh" role="student" onPress={replayTopic} />
          </View>
        </View>
      </ScrollView>
    </GameShell>
  )
}

function MistakeReviewCard({ mistake, index, total }: { mistake: GameAttemptReviewMistake; index: number; total: number }) {
  const { tokens } = useAppTheme()
  const question = normalizeRelation(mistake.attempt.questions)
  const submittedAnswer = mistake.submittedAnswerDisplay || getSubmittedAnswerText(mistake.attempt, [])
  const correctAnswer = mistake.feedback.correct_answer_text?.trim() || 'La solución todavía no está disponible.'

  return (
    <View className="overflow-hidden rounded-3xl border" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderBottomColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tokens.semanticSurface.danger }}>
            <Text className="font-black" style={{ color: tokens.semantic.danger }}>{index + 1}</Text>
          </View>
          <View>
            <Text className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: tokens.semantic.danger }}>Fallo {index + 1} de {total}</Text>
            <Text className="mt-0.5 text-[11px] text-text-muted">{getQuestionTypeLabel(question?.type)}</Text>
          </View>
        </View>
        {mistake.attempt.hint_used ? <MetaPill icon="bulb" label="Usaste una pista" color={tokens.gamification.xp} /> : null}
      </View>

      <View className="p-5">
        <Text className="text-[19px] font-black leading-7 text-white">{question?.text || 'Pregunta'}</Text>

        <View className="mt-5 gap-3">
          <AnswerReviewBlock
            icon="close-circle"
            label="Tu respuesta"
            value={submittedAnswer}
            color={tokens.semantic.danger}
            background={tokens.semanticSurface.danger}
          />
          <AnswerReviewBlock
            icon="checkmark-circle"
            label="Respuesta correcta"
            value={correctAnswer}
            color={tokens.semantic.success}
            background={tokens.semanticSurface.success}
          />
        </View>

        {mistake.feedback.explanation ? (
          <View className="mt-3 rounded-2xl border p-4" style={{ borderColor: withAlpha(tokens.semantic.info, '70'), backgroundColor: tokens.semanticSurface.info }}>
            <View className="flex-row items-center gap-2">
              <Ionicons name="school-outline" size={18} color={tokens.semantic.info} />
              <Text className="text-[12px] font-black uppercase tracking-[0.06em]" style={{ color: tokens.semantic.info }}>Explicación</Text>
            </View>
            <Text className="mt-2 text-[13px] leading-6 text-text-secondary">{mistake.feedback.explanation}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function AnswerReviewBlock({ icon, label, value, color, background }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string; background: string }) {
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: withAlpha(color, '99'), backgroundColor: background }}>
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={19} color={color} />
        <Text className="text-[12px] font-black uppercase tracking-[0.06em]" style={{ color }}>{label}</Text>
      </View>
      <Text selectable className="mt-2 text-[15px] font-bold leading-6 text-white">{value}</Text>
    </View>
  )
}

function SummaryMetric({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; color: string }) {
  const { tokens } = useAppTheme()
  return (
    <View className="min-w-[130px] flex-1 rounded-2xl border p-3" style={{ borderColor: withAlpha(color, '66'), backgroundColor: tokens.surface.raised }}>
      <View className="flex-row items-center gap-2"><Ionicons name={icon} size={17} color={color} /><Text className="text-[11px] font-bold text-text-muted">{label}</Text></View>
      <Text className="mt-2 text-[21px] font-black" style={{ color }}>{value}</Text>
    </View>
  )
}

function MetaPill({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: withAlpha(color, '66'), backgroundColor: withAlpha(color, '14') }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text className="text-[11px] font-bold" style={{ color }}>{label}</Text>
    </View>
  )
}

function ReviewState({ icon, title, detail, actionLabel, onAction, onBack }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; actionLabel: string; onAction: () => void; onBack?: () => void }) {
  const { tokens } = useAppTheme()
  return (
    <GameShell>
      <View className="flex-1 items-center justify-center px-5 py-10">
        <View className="w-full max-w-[560px] items-center rounded-[28px] border bg-surface-default p-7" style={{ borderColor: tokens.border.default }}>
          <View className="h-20 w-20 items-center justify-center rounded-3xl" style={{ backgroundColor: tokens.semanticSurface.info }}><Ionicons name={icon} size={38} color={tokens.semantic.info} /></View>
          <Text className="mt-5 text-center text-[25px] font-black text-white">{title}</Text>
          <Text className="mt-2 text-center text-[14px] leading-6 text-text-secondary">{detail}</Text>
          <View className="mt-6 w-full gap-3">
            <AppButton fullWidth label={actionLabel} role="student" onPress={onAction} />
            {onBack ? <AppBackButton fullWidth label="Volver" onPress={onBack} /> : null}
          </View>
        </View>
      </View>
    </GameShell>
  )
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function parseOptionalNumber(value?: string) {
  const parsed = Number(value)
  return value && Number.isFinite(parsed) ? parsed : null
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}
