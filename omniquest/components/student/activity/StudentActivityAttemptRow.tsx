import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import AppPressable from '../../ui/AppPressable'
import MobileMetricCard from '../../ui/mobile/MobileMetricCard'
import QuestionMedia from '../../questions/QuestionMedia'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { ActivityAttempt } from './types'
import {
  formatAttemptDate,
  formatAttemptTime,
  formatTimeTaken,
  getQuestionAnswers,
  getQuestionTypeLabel,
  getSubmittedAnswerText,
  normalizeSingleRelation,
} from './utils'

export type StudentActivityAttemptRowProps = {
  attempt: ActivityAttempt
  isExpanded: boolean
  isDetailLoading: boolean
  onToggle: () => void
  onPractice: () => void
}

export default React.memo(function StudentActivityAttemptRow({
  attempt,
  isExpanded,
  isDetailLoading,
  onToggle,
  onPractice,
}: StudentActivityAttemptRowProps) {
  const { tokens } = useAppTheme()
  const question = normalizeSingleRelation(attempt.questions)
  const subject = normalizeSingleRelation(question?.subjects)
  const topic = normalizeSingleRelation(question?.subject_topics)
  const answers = getQuestionAnswers(question)
  const questionText = question?.text || 'Pregunta eliminada'
  const topicTitle = topic?.title || 'Práctica libre'
  const subjectName = subject?.name || 'Curso no disponible'
  const submittedAnswer = getSubmittedAnswerText(attempt, answers)
  const explanation = question?.explanation?.trim() || 'Vuelve a practicar este contenido para reforzar el concepto.'
  const earnedPoints = Math.max(0, Number(attempt.earned_points ?? (attempt.is_correct ? 10 : 0)))
  const reviewStatus = getStudentReviewStatus(attempt.manual_review_status, attempt.is_correct, tokens)
  const reviewComments = Array.isArray(attempt.review_comments) ? attempt.review_comments : []

  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl border"
      style={{
        borderColor: isExpanded ? tokens.border.active : tokens.border.default,
        backgroundColor: tokens.surface.default,
      }}
    >
      <AppPressable
        accessibilityLabel={`${reviewStatus.label}. ${questionText}`}
        accessibilityHint={isExpanded ? 'Contrae el detalle del intento' : 'Carga y muestra el feedback de este intento'}
        accessibilityState={{ expanded: isExpanded }}
        onPress={onToggle}
        className="min-h-[76px] flex-row items-center gap-4 p-4"
      >
        <View
          className="h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: withAlpha(reviewStatus.color, '20') }}
        >
          <Ionicons name={reviewStatus.icon} size={26} color={reviewStatus.color} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="mb-1 flex-row flex-wrap items-center gap-2">
            <Text maxFontSizeMultiplier={2} className="text-[15px] font-black" style={{ color: tokens.text.primary }}>
              {reviewStatus.label}
            </Text>
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tokens.surface.interactive }}>
              <Text maxFontSizeMultiplier={2} className="text-[11px] font-black" style={{ color: tokens.semantic.info }}>
                {getQuestionTypeLabel(question?.type)}
              </Text>
            </View>
          </View>
          <Text maxFontSizeMultiplier={2} className="text-[13px] leading-5" style={{ color: tokens.text.secondary }} numberOfLines={2}>
            {questionText}
          </Text>
          <Text maxFontSizeMultiplier={2} className="mt-1 text-[12px] font-semibold" style={{ color: tokens.text.muted }} numberOfLines={2}>
            {subjectName} · {topicTitle}
          </Text>
        </View>

        <View className="items-end gap-1">
          <Text maxFontSizeMultiplier={2} className="text-[12px]" style={{ color: tokens.text.muted }}>{formatAttemptTime(attempt.attempted_at)}</Text>
          <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: withAlpha(reviewStatus.color, '20') }}>
            <Text maxFontSizeMultiplier={2} className="text-[12px] font-black" style={{ color: reviewStatus.color }}>
              {earnedPoints > 0 ? `+${earnedPoints} XP` : '0 XP'}
            </Text>
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={tokens.brand.student} />
        </View>
      </AppPressable>

      {isExpanded ? (
        <View className="border-t p-4" style={{ borderColor: tokens.border.default }}>
          {isDetailLoading ? (
            <View className="items-center py-5" accessibilityRole="progressbar" accessibilityLabel="Cargando feedback del intento">
              <ActivityIndicator color={tokens.brand.student} />
              <Text maxFontSizeMultiplier={2} className="mt-2 text-[12px] font-semibold" style={{ color: tokens.text.muted }}>
                Cargando comentarios y feedback…
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              <DetailBlock icon="help-circle" label="Pregunta" value={questionText} />
              {question?.media_type ? (
                <QuestionMedia
                  questionId={question.id}
                  type={question.media_type}
                  altText={question.media_alt_text}
                  caption={question.media_caption}
                  compact
                />
              ) : null}
              <DetailBlock icon="person-circle" label="Tu respuesta" value={submittedAnswer} highlightColor={reviewStatus.color} />

              {reviewStatus.waiting ? (
                <View className="rounded-2xl border p-4" style={{ borderColor: withAlpha(reviewStatus.color, '70'), backgroundColor: withAlpha(reviewStatus.color, '12') }}>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name={reviewStatus.icon} size={20} color={reviewStatus.color} />
                    <Text maxFontSizeMultiplier={2} className="text-[13px] font-black" style={{ color: reviewStatus.color }}>{reviewStatus.label}</Text>
                  </View>
                  <Text maxFontSizeMultiplier={2} className="mt-2 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>{reviewStatus.description}</Text>
                </View>
              ) : (
                <>
                  <DetailBlock
                    icon="bulb"
                    label="Feedback de aprendizaje"
                    value={explanation}
                    highlightColor={attempt.is_correct ? tokens.semantic.success : tokens.semantic.warning}
                  />
                  <View className="flex-row items-start gap-3 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
                    <Ionicons name="shield-checkmark" size={18} color={tokens.semantic.info} />
                    <Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>
                      El historial no reconstruye el banco de respuestas. Practica el tema para volver a comprobar el contenido en su contexto.
                    </Text>
                  </View>
                </>
              )}

              {reviewComments.length > 0 ? (
                <View className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.disabled }}>
                  <View className="mb-3 flex-row items-center gap-2">
                    <Ionicons name="chatbubble-ellipses" size={18} color={tokens.brand.student} />
                    <Text maxFontSizeMultiplier={2} className="text-[13px] font-black" style={{ color: tokens.text.secondary }}>Comentarios del profesor</Text>
                  </View>
                  <View className="gap-3">
                    {reviewComments.map((comment) => (
                      <View key={comment.id} className="rounded-xl p-3" style={{ backgroundColor: tokens.surface.raised }}>
                        <View className="flex-row items-center justify-between gap-3">
                          <Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[11px] font-black" style={{ color: tokens.brand.student }} numberOfLines={2}>{comment.author_name || 'Profesor'}</Text>
                          <Text maxFontSizeMultiplier={2} className="text-[10px]" style={{ color: tokens.text.muted }}>{formatAttemptDate(comment.created_at)}</Text>
                        </View>
                        <Text maxFontSizeMultiplier={2} className="mt-2 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>{comment.body}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : attempt.review_notes ? (
                <DetailBlock icon="chatbubble-ellipses" label="Comentario del profesor" value={attempt.review_notes} highlightColor={tokens.brand.student} />
              ) : null}

              <View className="flex-row flex-wrap gap-3">
                <MiniMetric icon="timer" label="Tiempo empleado" value={formatTimeTaken(attempt.time_taken_seconds)} />
                <MiniMetric icon="flash" label="XP ganado" value={`${earnedPoints} XP`} />
                <MiniMetric icon="school" label="Curso" value={subjectName} />
                <MiniMetric icon="pricetag" label="Tema" value={topicTitle} />
                {attempt.hint_used ? <MiniMetric icon="bulb" label="Pista" value="Usada" /> : null}
                {attempt.was_skipped ? <MiniMetric icon="play-skip-forward" label="Estado" value="Saltada" /> : null}
              </View>

              <AppButton
                label={`Practicar ${topicTitle}`}
                accessibilityHint="Abre el curso para iniciar una nueva práctica, sin mostrar las soluciones anteriores"
                icon="play-circle"
                role="student"
                onPress={onPractice}
              />
            </View>
          )}
        </View>
      ) : null}
    </View>
  )
})

function getStudentReviewStatus(
  status: string | null | undefined,
  isCorrect: boolean,
  tokens: ReturnType<typeof useAppTheme>['tokens'],
) {
  const normalized = status || 'not_required'
  if (normalized === 'pending') return { label: 'Pendiente de revisión', color: tokens.semantic.warning, icon: 'time' as const, waiting: true, description: 'Tu profesor todavía tiene que revisar esta respuesta abierta.' }
  if (normalized === 'in_review') return { label: 'En revisión', color: tokens.semantic.info, icon: 'eye' as const, waiting: true, description: 'Tu profesor está revisando la respuesta. El feedback aparecerá cuando termine.' }
  if (normalized === 'needs_changes') return { label: 'Necesita cambios', color: tokens.brand.student, icon: 'refresh-circle' as const, waiting: true, description: 'Consulta los comentarios del profesor y vuelve a practicar este tema.' }
  if (normalized === 'approved') return { label: 'Respuesta aprobada', color: tokens.semantic.success, icon: 'checkmark-circle' as const, waiting: false, description: '' }
  if (normalized === 'rejected') return { label: 'Respuesta revisada', color: tokens.semantic.danger, icon: 'close-circle' as const, waiting: false, description: '' }
  return isCorrect
    ? { label: 'Respuesta correcta', color: tokens.semantic.success, icon: 'checkmark-circle' as const, waiting: false, description: '' }
    : { label: 'Respuesta incorrecta', color: tokens.semantic.danger, icon: 'close-circle' as const, waiting: false, description: '' }
}

function DetailBlock({
  icon,
  label,
  value,
  highlightColor,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  highlightColor?: string
}) {
  const { tokens } = useAppTheme()
  const foreground = highlightColor || tokens.text.primary
  return (
    <View className="rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
      <View className="mb-2 flex-row items-center gap-2">
        <Ionicons name={icon} size={15} color={highlightColor || tokens.text.muted} />
        <Text maxFontSizeMultiplier={2} className="text-[11px] font-black uppercase tracking-wide" style={{ color: tokens.text.muted }}>{label}</Text>
      </View>
      <Text maxFontSizeMultiplier={2} className="text-[13px] leading-5" style={{ color: foreground }}>{value || 'Sin información'}</Text>
    </View>
  )
}

function MiniMetric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { tokens } = useAppTheme()
  return (
    <MobileMetricCard
      className="min-w-[150px] flex-1 rounded-xl"
      color={tokens.brand.student}
      compact
      icon={icon}
      label={label}
      value={value || 'Sin información'}
    />
  )
}
