import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../ui/mobile/MobileMetricCard'
import AppPressable from '../../ui/AppPressable'
import OmniGuide from '../../OmniGuide'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type {
  StudentCourseFailedQuestion,
  StudentCourseRankingItem,
  StudentCourseRecentAttempt,
  StudentCourseTotals,
} from './types'

export default function CourseProgressPanel({
  totals,
  topicsCount,
  color,
  failedQuestions,
  classRanking,
  recentAttempts,
  rankingLabel,
  isDesktop,
  onOpenActivity,
  onOpenFailedQuestion,
}: {
  totals: StudentCourseTotals
  topicsCount: number
  color: string
  failedQuestions: StudentCourseFailedQuestion[]
  classRanking: StudentCourseRankingItem[]
  recentAttempts: StudentCourseRecentAttempt[]
  rankingLabel: string
  isDesktop: boolean
  onOpenActivity: () => void
  onOpenFailedQuestion: (question: StudentCourseFailedQuestion) => void
}) {
  const { tokens } = useAppTheme()

  return (
    <View className={isDesktop ? 'mt-6 rounded-[28px] border border-border-default bg-surface-default p-5' : 'mt-5 rounded-[24px] border border-border-default bg-surface-default p-4'}>
      <View className="mb-4">
        <Text className="text-[24px] font-black text-white">Progreso del curso</Text>
      </View>

      <View className={isDesktop ? 'flex-row gap-3' : 'flex-row gap-2'}>
        <MobileMetricCard compact={isDesktop} dense={!isDesktop} icon="planet" color={color} value={topicsCount} label="Temas" style={{ flex: 1, minWidth: isDesktop ? 130 : 0 }} />
        <MobileMetricCard compact={isDesktop} dense={!isDesktop} icon="checkmark-circle" color={tokens.semantic.success} value={`${totals.progress}%`} label="Avance" style={{ flex: 1, minWidth: isDesktop ? 130 : 0 }} />
        <MobileMetricCard compact={isDesktop} dense={!isDesktop} icon="flame" color={tokens.semantic.danger} value={totals.failed} label="Repasar" style={{ flex: 1, minWidth: isDesktop ? 130 : 0 }} />
        <MobileMetricCard compact={isDesktop} dense={!isDesktop} icon="diamond" color={tokens.semantic.info} value={totals.earnedXp} suffix=" XP" label="Experiencia" style={{ flex: 1, minWidth: isDesktop ? 130 : 0 }} />
      </View>

      <View className={isDesktop ? 'mt-6 flex-row items-start gap-5' : 'mt-3'}>
        <View className={isDesktop ? 'flex-1' : ''}>
          <SectionHeading title="Preguntas para repasar" actionLabel="Ver todas" onAction={onOpenActivity} marginTop={isDesktop ? 28 : 0} />
          {failedQuestions.length > 0 ? (
            <View className="gap-3">
              {failedQuestions.slice(0, 2).map((question) => (
                <FailedQuestionCard key={question.id} question={question} onPress={() => onOpenFailedQuestion(question)} />
              ))}
            </View>
          ) : (
            <EmptyBlock icon="checkmark-circle-outline" omniState="happy" title="Sin fallos pendientes" subtitle="Has superado todas tus misiones recientes." />
          )}
        </View>

        <View className={isDesktop ? 'flex-1' : 'mt-6'}>
          <SectionHeading title="Ranking de la clase" marginTop={isDesktop ? 28 : 0} />
          <View className="gap-2 rounded-2xl border border-border-default bg-surface-raised p-3">
            {classRanking.length > 0 ? (
              classRanking.slice(0, 3).map((row, index) => <RankingRow key={row.studentId} row={row} index={index} />)
            ) : (
              <EmptyBlock icon="trophy-outline" omniState="normal" title="Sin ranking todavía" subtitle="Completa una misión para aparecer en la clasificación." />
            )}
            <View className="mt-1 rounded-xl bg-surface-disabled px-3 py-2">
              <Text className="text-center text-[12px] font-black text-brand-student">{rankingLabel}</Text>
            </View>
          </View>
        </View>
      </View>

      <SectionHeading title="Últimos intentos" actionLabel="Ver todo" onAction={onOpenActivity} marginTop={isDesktop ? 28 : 24} />
      <View className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
        {recentAttempts.length > 0 ? (
          recentAttempts.slice(0, 3).map((attempt, index) => (
            <RecentAttemptRow key={attempt.id} attempt={attempt} isLast={index === Math.min(recentAttempts.length, 3) - 1} />
          ))
        ) : (
          <EmptyBlock icon="play-circle-outline" omniState="normal" title="Sin intentos recientes" subtitle="Selecciona un planeta para iniciar tu primera misión." />
        )}
      </View>
    </View>
  )
}

function SectionHeading({ title, actionLabel, onAction, marginTop = 28 }: { title: string; actionLabel?: string; onAction?: () => void; marginTop?: number }) {
  return (
    <View className="mb-3 flex-row items-center justify-between gap-3" style={{ marginTop }}>
      <Text maxFontSizeMultiplier={2} className="text-[20px] font-black text-white">{title}</Text>
      {actionLabel && onAction ? (
        <AppPressable accessibilityLabel={actionLabel} onPress={onAction} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
          <Text className="text-[13px] font-black text-brand-student">{actionLabel}</Text>
        </AppPressable>
      ) : null}
    </View>
  )
}

function RankingRow({ row, index }: { row: StudentCourseRankingItem; index: number }) {
  const { tokens } = useAppTheme()
  const medalColors = [tokens.gamification.xp, tokens.text.secondary, tokens.gamification.streak]
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-surface-default px-3 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-semantic-surface-info">
        {index < 3 ? <Ionicons name="medal" size={18} color={medalColors[index]} /> : <Text className="text-[13px] font-black text-text-secondary">{index + 1}</Text>}
      </View>
      <Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[14px] font-black text-white">{row.alias}</Text>
      <Text className="text-[13px] font-black text-brand-student">{row.points.toLocaleString()} XP</Text>
    </View>
  )
}

function RecentAttemptRow({ attempt, isLast }: { attempt: StudentCourseRecentAttempt; isLast: boolean }) {
  const { tokens } = useAppTheme()
  const meta = attempt.evaluationState === 'correct'
    ? { label: 'Respuesta correcta', color: tokens.semantic.success, icon: 'checkmark' as const }
    : attempt.evaluationState === 'incorrect'
      ? { label: 'Respuesta incorrecta', color: tokens.semantic.danger, icon: 'close' as const }
      : attempt.evaluationState === 'needs_changes'
        ? { label: 'Necesita cambios', color: tokens.brand.student, icon: 'refresh' as const }
        : { label: 'Pendiente de revisión', color: tokens.semantic.warning, icon: 'time-outline' as const }
  return (
    <View className={`flex-row items-center gap-3 p-4 ${isLast ? '' : 'border-b border-border-subtle'}`}>
      <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(meta.color, '26') }}>
        <Ionicons name={meta.icon} size={26} color={meta.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text maxFontSizeMultiplier={2} className="text-[14px] font-black text-white">{meta.label}</Text>
        <Text maxFontSizeMultiplier={2} numberOfLines={2} className="mt-1 text-[12px] text-text-secondary">{attempt.topicTitle} · {attempt.questionText}</Text>
      </View>
      <Text className="text-[12px] text-text-muted">{formatRecentAttemptDate(attempt.attemptedAt)}</Text>
    </View>
  )
}

function FailedQuestionCard({ question, onPress }: { question: StudentCourseFailedQuestion; onPress: () => void }) {
  const { tokens } = useAppTheme()
  return (
    <AppPressable
      accessibilityLabel={`Repasar pregunta: ${question.text}`}
      accessibilityHint={`Abre el tema ${question.topicTitle} en modo repaso`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 78,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: withAlpha(tokens.semantic.danger, 'A0'),
        backgroundColor: tokens.semanticSurface.danger,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-semantic-surface-danger">
        <Ionicons name="close" size={24} color={tokens.semantic.danger} />
      </View>
      <View className="min-w-0 flex-1">
        <Text maxFontSizeMultiplier={2} numberOfLines={2} className="text-[14px] font-black text-white">{question.text}</Text>
        <Text maxFontSizeMultiplier={2} className="mt-1 text-[12px] font-bold text-semantic-danger">{question.topicTitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={tokens.text.secondary} />
    </AppPressable>
  )
}

function EmptyBlock({ icon, omniState, subtitle, title }: { icon: keyof typeof Ionicons.glyphMap; omniState?: 'happy' | 'normal'; subtitle: string; title: string }) {
  const { tokens } = useAppTheme()
  return (
    <View className="items-center rounded-2xl border border-dashed border-border-default bg-surface-raised px-4 py-7">
      {omniState ? <OmniGuide state={omniState} size={70} autoBlink={omniState === 'normal'} /> : <Ionicons name={icon} size={30} color={tokens.text.muted} />}
      <Text maxFontSizeMultiplier={2} className="mt-3 text-center text-[15px] font-black text-white">{title}</Text>
      <Text maxFontSizeMultiplier={2} className="mt-1 text-center text-[13px] leading-5 text-text-muted">{subtitle}</Text>
    </View>
  )
}

function formatRecentAttemptDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Reciente'
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
