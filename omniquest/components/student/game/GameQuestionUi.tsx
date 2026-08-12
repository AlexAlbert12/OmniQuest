import React, { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import OmniGuide from '../../OmniGuide'
import AnswerFeedbackMotion from '../../gamification/AnswerFeedbackMotion'
import CelebrationParticles from '../../gamification/CelebrationParticles'
import XpGainBurst from '../../gamification/XpGainBurst'
import { USE_NATIVE_ANIMATION_DRIVER } from '../../../lib/animation'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

const answerLetters = ['A', 'B', 'C', 'D', 'E', 'F']

type Answer = {
  id: number
  text: string
}

export function SubmitAnswerButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Comprobar respuesta"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={6}
      onPress={onPress}
      disabled={disabled}
      className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-student px-6 py-4"
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
      className={`flex-row items-center rounded-xl border border-border-active bg-semantic-surface-success ${
        compact ? 'px-3 py-2' : 'mt-3 px-4 py-3'
      }`}
      style={{ gap: compact ? 7 : 10 }}
    >
      <Text className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-black text-white`} numberOfLines={1}>
        {left}
      </Text>
      <Ionicons name="arrow-forward" size={compact ? 14 : 17} color="#43D991" />
      <Text className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-black text-text-secondary`} numberOfLines={1}>
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
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isDesktop = width >= 1024
  const isPending = feedback.status === 'pending'
  const color = isPending ? tokens.semantic.warning : isCorrect ? tokens.semantic.success : tokens.gamification.performanceLow
  const title = isPending ? 'Pendiente de revisión' : isCorrect ? '¡Correcto!' : 'Incorrecto'
  const subtitle = isPending
    ? 'Tu profesor corregirá esta respuesta.'
    : isCorrect
      ? `¡Muy bien! Has ganado ${feedback.earnedPoints} XP.`
      : 'Casi. Guarda esta pregunta para repasarla después.'
  const pulse = useRef(new Animated.Value(0)).current
  const streakBonus = isCorrect && streak >= 3

  useEffect(() => {
    pulse.setValue(0)
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
      }),
    ]).start()
  }, [feedback.status, pulse])

  const iconScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  })

  return (
    <AnswerFeedbackMotion status={feedback.status} style={{ marginTop: isDesktop ? 20 : 16 }}>
      <View
        className="overflow-hidden rounded-[28px] bg-surface-default"
        style={{ borderColor: `${color}88`, borderWidth: 1.5, padding: isDesktop ? 20 : 16 }}
      >
        <View className="absolute -right-10 -top-12 h-36 w-36 rounded-full" style={{ backgroundColor: `${color}18` }} />
        {isCorrect ? <CelebrationParticles color={color} /> : null}
        {isCorrect && feedback.earnedPoints > 0 ? (
          <XpGainBurst amount={feedback.earnedPoints} visible />
        ) : null}
      <View className="items-center">
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <OmniGuide state={isPending ? 'thinking' : isCorrect ? 'happy' : 'error'} size={isDesktop ? 96 : 82} />
        </Animated.View>
        <Text className={`${isDesktop ? 'mt-4 text-[28px]' : 'mt-2 text-[25px]'} text-center font-black text-white`}>{title}</Text>
        <Text className={`mt-2 text-center text-[14px] ${isDesktop ? 'leading-6' : 'leading-5'} text-text-secondary`}>{subtitle}</Text>

        <View className={`${isDesktop ? 'mt-5 p-4' : 'mt-4 px-4 py-3'} w-full rounded-2xl border border-border-subtle bg-background-primary`}>
          <View className="flex-row items-center justify-center gap-2">
            <Ionicons name={isPending ? 'hourglass-outline' : isCorrect ? 'flash' : 'refresh'} size={isDesktop ? 24 : 21} color={color} />
            <Text className={`${isDesktop ? 'text-[26px]' : 'text-[22px]'} font-black text-white`}>
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
        <View className={`${isDesktop ? 'mt-4 p-4' : 'mt-3 px-4 py-3'} rounded-2xl border border-border-subtle bg-background-primary`}>
          <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-text-muted">Respuesta correcta</Text>
          <Text className="mt-2 text-[15px] font-bold leading-6 text-white">{feedback.correctAnswerText}</Text>
        </View>
      ) : null}

      {feedback.explanation ? (
        <View className={`${isDesktop ? 'mt-4 p-4' : 'mt-3 px-4 py-3'} rounded-2xl border border-border-subtle bg-surface-raised`}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="bulb" size={17} color="#FBBF24" />
            <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-gamification-xp">Explicación</Text>
          </View>
          <Text className="mt-2 text-[14px] leading-6 text-text-secondary">{feedback.explanation}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityLabel="Siguiente pregunta"
        accessibilityRole="button"
        hitSlop={6}
        onPress={onContinue}
        className={`${isDesktop ? 'mt-5 py-4' : 'mt-4 py-3'} min-h-12 flex-row items-center justify-center gap-2 rounded-2xl px-5`}
        style={({ pressed }) => ({ backgroundColor: isCorrect ? tokens.brand.student : color, opacity: pressed ? 0.82 : 1 })}
      >
        <Text className="text-[16px] font-black text-white">Siguiente pregunta</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </Pressable>
      </View>
    </AnswerFeedbackMotion>
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
      accessibilityLabel={icon === 'chevron-up' ? 'Mover hacia arriba' : 'Mover hacia abajo'}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={8}
      onPress={onPress}
      disabled={disabled}
      className="h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-surface-raised"
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
  const { tokens } = useAppTheme()

  let borderColor = withAlpha(tokens.brand.student, '80')
  let backgroundColor = '#0D1F3D'
  let textColor = '#F8FAFC'
  let badgeColor = '#1A3260'
  let badgeBorderColor = '#3A5E8F'

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
      borderColor = tokens.border.active
      backgroundColor = tokens.surface.default
      textColor = tokens.text.muted
      badgeColor = tokens.surface.interactive
      badgeBorderColor = tokens.border.active
    }
  }

  return (
    <Pressable
      accessibilityLabel={`Opción ${answerLetters[index] || index + 1}: ${answer.text}`}
      accessibilityRole="radio"
      accessibilityState={{
        selected: isSelected,
        disabled: hasAnswered || isSubmitting,
        checked: hasAnswered ? isCorrectAnswer : undefined,
      }}
      hitSlop={4}
      onPress={onPress}
      disabled={hasAnswered || isSubmitting}
      className="min-h-[70px] flex-row items-center rounded-2xl px-4 py-3"
      style={({ pressed }) => ({
        borderColor,
        backgroundColor,
        borderWidth: isSelected || isHinted || (hasAnswered && (isCorrectAnswer || isSelected)) ? 2 : 1.5,
        opacity: pressed ? 0.84 : 1,
      })}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: badgeColor, borderColor: badgeBorderColor, borderWidth: 1.5 }}
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
    <View
      className="rounded-2xl px-4 py-3"
      style={{ borderColor: feedbackColor, borderWidth: 1.5, backgroundColor: `${feedbackColor}1F` }}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={19} color={feedbackColor} />
        <Text className="font-black" style={{ color: feedbackColor }}>
          {isCorrect ? correctTitle : incorrectTitle}
        </Text>
      </View>
      {!isCorrect ? <Text className="mt-1 text-[13px] text-text-secondary">{incorrectDetail}</Text> : null}
    </View>
  )
}
