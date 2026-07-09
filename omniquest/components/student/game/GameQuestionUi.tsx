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
      className="mt-1 flex-row items-center justify-center gap-2 rounded-2xl bg-[#5A46D8] px-6 py-4"
      style={({ pressed }) => ({ opacity: disabled ? 0.55 : pressed ? 0.84 : 1 })}
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
