import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import OmniGuide, { type OmniSize, type OmniState } from '../../OmniGuide'
import AnimatedXpCounter from '../../gamification/AnimatedXpCounter'
import BadgeUnlockModal from '../../gamification/BadgeUnlockModal'
import type { StudentBadge } from '../../../lib/studentBadges'
import { useAppTheme } from '../../../lib/appTheme'
import AppBackButton from '../../ui/AppBackButton'
import AppButton from '../../ui/AppButton'

type GameSummary = {
  questionsTotal: number
  answered: number
  correct: number
  incorrect: number
  xp: number
  timeSeconds: number
  reviewQuestions: { id: number; text: string }[]
}

export default function ResultState({
  icon,
  iconColor,
  omniSize = 100,
  omniState,
  title,
  detail,
  score,
  summary,
  action,
  onPress,
  secondaryAction,
  onSecondaryPress,
  unlockedBadges = [],
  onDismissUnlockedBadge,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  omniSize?: OmniSize | number
  omniState?: OmniState
  title: string
  detail: string
  score?: number
  summary?: GameSummary
  action: string
  onPress: () => void
  secondaryAction?: string
  onSecondaryPress?: () => void
  unlockedBadges?: StudentBadge[]
  onDismissUnlockedBadge?: () => void
}) {
  const actionIsBack = action.toLocaleLowerCase().startsWith('volver')
  const secondaryActionIsBack = secondaryAction?.toLocaleLowerCase().startsWith('volver')

  return (
    <>
      <ScrollView
      className="flex-1"
      contentContainerStyle={{
        alignItems: 'center',
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 18,
        paddingVertical: 28,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-[540px] overflow-hidden rounded-[32px] border border-border-default bg-surface-default p-5">
        <View className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-surface-selected" />
        <View className="absolute left-[-60px] top-20 h-40 w-40 rounded-full bg-semantic-surface-info" />

        <View className="items-center">
          {omniState ? (
            <OmniGuide state={omniState} size={omniSize} autoBlink={omniState === 'normal'} />
          ) : (
            <View className="h-32 w-32 items-center justify-center rounded-full" style={{ backgroundColor: `${iconColor}20` }}>
              <Ionicons name={icon} size={78} color={iconColor} />
            </View>
          )}
          <Text className="mt-5 text-center text-[34px] font-black leading-[40px] text-white">{title}</Text>
          <Text className="mt-2 max-w-[360px] text-center text-[15px] leading-6 text-text-secondary">{detail}</Text>
        </View>

        {summary ? (
          <GameSummaryPanel summary={summary} fallbackScore={score} />
        ) : typeof score === 'number' ? (
          <View className="my-6 rounded-[26px] border border-border-subtle bg-surface-raised p-5">
            <Text className="text-center text-[12px] font-black uppercase tracking-[0.08em] text-text-muted">Puntuación final</Text>
            <Text className="mt-2 text-center text-[48px] font-black text-brand-student">{score}</Text>
          </View>
        ) : null}

        <View className="gap-3">
          {secondaryAction && onSecondaryPress ? (
            secondaryActionIsBack ? (
              <AppBackButton fullWidth label={secondaryAction} size="lg" onPress={onSecondaryPress} />
            ) : (
              <AppButton fullWidth icon="refresh" label={secondaryAction} role="student" size="lg" onPress={onSecondaryPress} />
            )
          ) : null}
          {actionIsBack ? (
            <AppBackButton fullWidth label={action} size="lg" onPress={onPress} />
          ) : (
            <AppButton fullWidth icon="home" label={action} role="student" size="lg" variant="secondary" onPress={onPress} />
          )}
        </View>
      </View>
      </ScrollView>
      <BadgeUnlockModal
        badge={unlockedBadges[0] || null}
        visible={unlockedBadges.length > 0}
        onClose={onDismissUnlockedBadge || (() => undefined)}
      />
    </>
  )
}

function GameSummaryPanel({
  fallbackScore,
  summary,
}: {
  fallbackScore?: number
  summary: GameSummary
}) {
  const answered = Math.max(summary.answered, summary.correct + summary.incorrect)
  const { tokens } = useAppTheme()
  const precision = answered > 0 ? Math.round((summary.correct / answered) * 100) : 0
  const xp = summary.xp || fallbackScore || 0
  const totalQuestions = summary.questionsTotal || answered
  const reviewCount = summary.reviewQuestions.length
  const circleColor = precision >= 70 ? tokens.brand.student : tokens.gamification.performanceLow

  return (
    <View className="my-6">
      <View className="rounded-[28px] border border-border-default bg-surface-raised p-5">
        <Text className="text-center text-[12px] font-black uppercase tracking-[0.08em] text-text-muted">Resultado principal</Text>
        <View className="mt-5 items-center">
          <View
            className="h-32 w-32 items-center justify-center rounded-full bg-background-primary"
            style={{ borderColor: circleColor, borderWidth: 10 }}
          >
            <Text className="text-[38px] font-black text-white">{summary.correct}/{totalQuestions}</Text>
            <Text className="text-[14px] font-bold text-text-secondary">correctas</Text>
          </View>
          <AnimatedXpCounter
            value={xp}
            prefix="+"
            suffix=" XP"
            accessibilityLabel={`${xp} puntos de experiencia ganados`}
            style={{ marginTop: 16, color: '#FFFFFF', fontSize: 32, fontWeight: '900' }}
          />
        </View>

        <View className="mt-5 gap-2">
          <SummaryRow icon="analytics" label="Precisión" value={`${precision}%`} color="#FBBF24" />
          <SummaryRow icon="timer-outline" label="Tiempo" value={formatDuration(summary.timeSeconds)} color="#A78BFA" />
          <SummaryRow icon="refresh" label="A repasar" value={String(reviewCount)} color="#F97316" />
        </View>
      </View>
    </View>
  )
}

function SummaryRow({
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
    <View className="flex-row items-center gap-3 rounded-2xl border border-border-active bg-surface-default px-4 py-3">
      <Ionicons name={icon} size={17} color={color} />
      <Text className="min-w-0 flex-1 text-[12px] font-black uppercase tracking-[0.04em] text-text-secondary">{label}</Text>
      <Text className="text-[16px] font-black text-white">{value}</Text>
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
