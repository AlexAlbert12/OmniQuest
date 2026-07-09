import React, { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const answerLetters = ['A', 'B', 'C', 'D', 'E', 'F']

type Answer = {
  id: number
  text: string
}

export function SubmitAnswerButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl bg-[#6D5AF6] px-6 py-4"
      style={({ pressed }) => ({ opacity: disabled ? 0.52 : pressed ? 0.84 : 1 })}
    >
      <Text className="text-[16px] font-black text-white">Comprobar</Text>
      <Ionicons name="checkmark-circle" size={19} color="#FFFFFF" />
    </Pressable>
  )
}

export function PairConnectionChip({
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

export function QuestionFeedbackCard({
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
  const title = isPending ? 'En revisión' : isCorrect ? '¡Correcto!' : 'Incorrecto'
  const subtitle = isPending
    ? 'Tu profesor corregirá esta respuesta.'
    : isCorrect
      ? 'Has respondido correctamente.'
      : 'Guarda esta pista para repasar después.'
  const pulse = useRef(new Animated.Value(0)).current
  const streakBonus = isCorrect && streak >= 3

  useEffect(() => {
    pulse.setValue(0)
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 380,
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
  }, [feedback.status, pulse])

  const iconScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  })

  return (
    <View className="mt-5 overflow-hidden rounded-[28px] border bg-[#09162C] p-5" style={{ borderColor: `${color}88` }}>
      <View className="absolute -right-10 -top-12 h-36 w-36 rounded-full" style={{ backgroundColor: `${color}18` }} />
      <View className="items-center">
        <Animated.View
          className="h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}22`, transform: [{ scale: iconScale }] }}
        >
          <Ionicons name={isPending ? 'time-outline' : isCorrect ? 'checkmark-circle' : 'close-circle'} size={44} color={color} />
        </Animated.View>
        <Text className="mt-4 text-center text-[28px] font-black text-white">{title}</Text>
        <Text className="mt-2 text-center text-[14px] leading-6 text-[#C9D7EA]">{subtitle}</Text>

        <View className="mt-5 w-full rounded-2xl border border-[#173055] bg-[#071426] p-4">
          <View className="flex-row items-center justify-center gap-2">
            <Ionicons name={isPending ? 'hourglass-outline' : isCorrect ? 'flash' : 'refresh'} size={24} color={color} />
            <Text className="text-[26px] font-black text-white">
              {isPending ? 'Pendiente' : isCorrect ? `+${feedback.earnedPoints} XP` : 'A repasar'}
            </Text>
          </View>
          {isCorrect ? (
            <Text className="mt-2 text-center text-[13px] font-black" style={{ color }}>
              Racha {streak}{streakBonus ? ' · bonus' : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {!isCorrect && !isPending && feedback.correctAnswerText ? (
        <View className="mt-4 rounded-2xl border border-[#243E65] bg-[#061426] p-4">
          <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-[#8FA7C7]">Respuesta correcta</Text>
          <Text className="mt-2 text-[15px] font-bold leading-6 text-white">{feedback.correctAnswerText}</Text>
        </View>
      ) : null}

      {feedback.explanation ? (
        <View className="mt-4 rounded-2xl border border-[#243E65] bg-[#0D1D3B] p-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="bulb" size={17} color="#FBBF24" />
            <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-[#FBBF24]">Explicación</Text>
          </View>
          <Text className="mt-2 text-[14px] leading-6 text-[#DDE7F4]">{feedback.explanation}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={onContinue}
        className="mt-5 flex-row items-center justify-center gap-2 rounded-2xl px-5 py-4"
        style={({ pressed }) => ({ backgroundColor: isCorrect ? '#6D5AF6' : color, opacity: pressed ? 0.82 : 1 })}
      >
        <Text className="text-[16px] font-black text-white">Siguiente pregunta</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  )
}

export function MoveButton({
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

export function AnswerOption({
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
  const isHinted = hintedAnswerId === answer.id

  let borderColor = '#1E355C'
  let backgroundColor = '#08172E'
  let textColor = '#F8FAFC'
  let badgeColor = '#18275A'
  let badgeBorderColor = '#2A456A'

  if (isHinted) {
    borderColor = '#FBBF24'
    backgroundColor = '#2A210F'
    badgeColor = '#FBBF2424'
    badgeBorderColor = '#FBBF24'
  }

  if (isSelected && !hasAnswered) {
    borderColor = '#8B5CF6'
    backgroundColor = '#16164E'
    badgeColor = '#6D5AF6'
    badgeBorderColor = '#A78BFA'
  }

  if (hasAnswered) {
    if (isCorrectAnswer) {
      borderColor = '#34D399'
      backgroundColor = '#0D2D27'
      textColor = '#A7F3D0'
      badgeColor = '#22C55E'
      badgeBorderColor = '#A7F3D0'
    } else if (isSelected) {
      borderColor = '#FB7185'
      backgroundColor = '#341525'
      textColor = '#FDA4AF'
      badgeColor = '#F43F5E'
      badgeBorderColor = '#FDA4AF'
    } else {
      borderColor = '#142541'
      backgroundColor = '#071426'
      textColor = '#697B99'
      badgeColor = '#111E3C'
      badgeBorderColor = '#273A5E'
    }
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={hasAnswered || isSubmitting}
      className="min-h-[70px] flex-row items-center rounded-2xl border px-4 py-3"
      style={({ pressed }) => ({
        borderColor,
        backgroundColor,
        opacity: pressed ? 0.84 : 1,
      })}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full border"
        style={{ backgroundColor: badgeColor, borderColor: badgeBorderColor }}
      >
        <Text className="text-[15px] font-black text-white">{answerLetters[index] || '?'}</Text>
      </View>
      <Text className="ml-4 min-w-0 flex-1 text-[17px] font-bold leading-6" style={{ color: textColor }}>
        {answer.text}
      </Text>
      {hasAnswered && isCorrectAnswer ? <Ionicons name="checkmark-circle" size={24} color="#34D399" /> : null}
      {hasAnswered && isSelected && !isCorrectAnswer ? <Ionicons name="close-circle" size={24} color="#FB7185" /> : null}
      {!hasAnswered && isSelected ? <Ionicons name="radio-button-on" size={22} color="#A78BFA" /> : null}
      {!hasAnswered && !isSelected ? <Ionicons name="radio-button-off" size={22} color="#52627E" /> : null}
    </Pressable>
  )
}

export function AnswerFeedback({
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
