import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

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
  summary?: GameSummary
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
  summary: GameSummary
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
