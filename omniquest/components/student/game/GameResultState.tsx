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
        paddingHorizontal: 18,
        paddingVertical: 28,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-[540px] overflow-hidden rounded-[32px] border border-[#1A3155] bg-[#09162C]/95 p-5">
        <View className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#7C3AED]/20" />
        <View className="absolute left-[-60px] top-20 h-40 w-40 rounded-full bg-[#0EA5E9]/10" />

        <View className="items-center">
          <View className="h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: `${iconColor}20` }}>
            <Ionicons name={icon} size={58} color={iconColor} />
          </View>
          <Text className="mt-5 text-center text-[30px] font-black text-white">{title}</Text>
          <Text className="mt-2 max-w-[420px] text-center text-[15px] leading-6 text-[#C9D7EA]">{detail}</Text>
        </View>

        {summary ? (
          <GameSummaryPanel summary={summary} fallbackScore={score} topicLabel={topicLabel} />
        ) : typeof score === 'number' ? (
          <View className="my-6 rounded-[26px] border border-[#172A4A] bg-[#0D1D3B] p-5">
            <Text className="text-center text-[12px] font-black uppercase tracking-[0.08em] text-[#8FA7C7]">Puntuación final</Text>
            <Text className="mt-2 text-center text-[48px] font-black text-[#9B6CFF]">{score}</Text>
          </View>
        ) : null}

        <View className="gap-3">
          {secondaryAction && onSecondaryPress ? (
            <Pressable
              onPress={onSecondaryPress}
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-[#6D5AF6] px-7 py-4"
              style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text className="text-center text-[16px] font-black text-white">{secondaryAction}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onPress}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-[#243E65] bg-[#0D1D3B] px-7 py-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Ionicons name="home" size={17} color="#FFFFFF" />
            <Text className="text-center text-[16px] font-black text-white">{action}</Text>
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
  const circleColor = precision >= 70 ? '#8B5CF6' : '#FB7185'

  return (
    <View className="my-6">
      <View className="rounded-[28px] border border-[#172A4A] bg-[#0D1D3B] p-5">
        <Text className="text-center text-[12px] font-black uppercase tracking-[0.08em] text-[#8FA7C7]">Resultados de la partida</Text>
        <View className="mt-5 items-center">
          <View className="h-36 w-36 items-center justify-center rounded-full border-[10px] bg-[#070F26]" style={{ borderColor: circleColor }}>
            <Text className="text-[38px] font-black text-white">{summary.correct}/{totalQuestions}</Text>
            <Text className="text-[14px] font-bold text-[#C9D7EA]">correctas</Text>
          </View>
          <Text className="mt-4 text-[32px] font-black text-[#9B6CFF]">+{xp} XP</Text>
        </View>

        <View className="mt-5 gap-2">
          <SummaryRow icon="analytics" label="Precisión" value={`${precision}%`} color="#FBBF24" />
          <SummaryRow icon="timer-outline" label="Tiempo" value={formatDuration(summary.timeSeconds)} color="#A78BFA" />
          <SummaryRow icon="refresh" label="A repasar" value={String(reviewCount)} color="#F97316" />
        </View>
      </View>

      <View className="mt-4 rounded-[24px] border border-[#243E65] bg-[#061426] p-4">
        <View className="mb-3 flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <Ionicons name="refresh" size={17} color="#F97316" />
            <Text className="font-black text-white">Preguntas a repasar</Text>
          </View>
          <View className="rounded-full bg-[#10213E] px-3 py-1">
            <Text className="text-[12px] font-black text-[#DDE7F4]">{reviewCount}</Text>
          </View>
        </View>

        {summary.reviewQuestions.length > 0 ? (
          <View className="gap-2">
            {summary.reviewQuestions.slice(0, 3).map((question, index) => (
              <View key={question.id} className="flex-row items-start gap-3 rounded-xl border border-[#5B1830] bg-[#2A0B1B] px-3 py-3">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-[#FB7185]/20">
                  <Text className="text-[12px] font-black text-[#FB7185]">{index + 1}</Text>
                </View>
                <Text className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-[#FDE2E8]" numberOfLines={2}>
                  {question.text}
                </Text>
              </View>
            ))}
            {summary.reviewQuestions.length > 3 ? (
              <Text className="text-[12px] font-bold text-[#8FA7C7]">
                +{summary.reviewQuestions.length - 3} más para repasar · {topicLabel || 'Tema actual'}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text className="text-[13px] leading-5 text-[#8FA7C7]">No tienes preguntas pendientes de repaso en esta partida.</Text>
        )}
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
    <View className="flex-row items-center gap-3 rounded-2xl border border-[#243E65] bg-[#081A37] px-4 py-3">
      <Ionicons name={icon} size={17} color={color} />
      <Text className="min-w-0 flex-1 text-[12px] font-black uppercase tracking-[0.04em] text-[#AFC2DB]">{label}</Text>
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
