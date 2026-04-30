import React from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useGame } from '../../../hooks/useGame'

type Answer = {
  id: number
  text: string
  is_correct?: boolean
}

const answerLetters = ['A', 'B', 'C', 'D', 'E', 'F']

export default function PlayScreen() {
  const { id, topicId, topicName } = useLocalSearchParams<{ id: string; topicId?: string; topicName?: string }>()
  const { width } = useWindowDimensions()
  const router = useRouter()
  const game = useGame(id as string, Array.isArray(topicId) ? topicId[0] : topicId)

  const isDesktop = width >= 1024
  const isWide = width >= 760

  const showComingSoon = (feature: string) => {
    const title = 'Próximamente'
    const message = `${feature} estará disponible en una próxima iteración.`

    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  if (game.status === 'loading') {
    return (
      <GameShell>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text className="mt-4 text-[#B8C7E0]">Preparando la pregunta...</Text>
        </View>
      </GameShell>
    )
  }

  if (game.status === 'empty') {
    return (
      <GameShell>
        <ResultState
          icon="construct-outline"
          iconColor="#8FA7C7"
          title="Todavía no hay preguntas"
          detail="El profesor aún no ha añadido preguntas a este tema."
          action="Volver al inicio"
          onPress={() => router.back()}
        />
      </GameShell>
    )
  }

  if (game.status === 'gameOver') {
    return (
      <GameShell>
        <ResultState
          icon="skull-outline"
          iconColor="#FB7185"
          title="GAME OVER"
          detail="Te has quedado sin vidas. Vuelve a intentarlo y recupera la racha."
          score={game.score}
          action="Salir al menú"
          onPress={() => router.back()}
        />
      </GameShell>
    )
  }

  if (game.status === 'finished') {
    return (
      <GameShell>
        <ResultState
          icon="trophy"
          iconColor="#FBBF24"
          title="Preguntas completadas"
          detail="Has superado todas las preguntas de este tema."
          score={game.score}
          action="Volver al inicio"
          onPress={() => router.back()}
        />
      </GameShell>
    )
  }

  const currentQuestion = game.currentQuestion
  const totalQuestions = Math.max(game.questions.length, 1)
  const progressPercentage = ((game.currentIndex + 1) / totalQuestions) * 100
  const pointsBase = currentQuestion?.points_base ?? 150
  const levelProgress = Math.min(100, Math.max(18, ((game.score % 3000) / 3000) * 100))
  const displayLevel = Math.max(1, Math.floor(game.score / 300) + 8)
  const nextLevelTotal = 3000
  const nextLevelPoints = Math.min(nextLevelTotal, Math.max(2450, game.score + 450))
  const selectedTopicName = Array.isArray(topicName) ? topicName[0] : topicName
  const category = selectedTopicName || currentQuestion?.category || currentQuestion?.subject || 'Tema'

  return (
    <GameShell>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: isDesktop ? 46 : 18,
          paddingTop: isDesktop ? 38 : 22,
          paddingBottom: isDesktop ? 30 : 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={() => router.back()}
              className="h-14 w-14 items-center justify-center rounded-full border border-[#20375E] bg-[#0D1D3B]"
              style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
            >
              <Ionicons name="close" size={30} color="#F4F7FB" />
            </Pressable>

            <View className="min-w-0 flex-1">
              <View className="mb-3 flex-row items-center justify-between gap-4">
                <Text className="text-[18px] font-black text-white">
                  Pregunta {game.currentIndex + 1} de {totalQuestions}
                </Text>
                <View className="flex-row items-center gap-4">
                  <Text className="text-[18px] font-black text-[#9B6CFF]">{game.score} pts</Text>
                  <View className="hidden flex-row items-center gap-2 md:flex">
                    {[...Array(3)].map((_, index) => (
                      <Ionicons
                        key={index}
                        name={index < game.lives ? 'heart' : 'heart-outline'}
                        size={31}
                        color="#FF647C"
                      />
                    ))}
                  </View>
                </View>
              </View>
              <View className="h-3 overflow-hidden rounded-full bg-[#10213E]">
                <View
                  className="h-full rounded-full bg-[#9B6CFF]"
                  style={{ width: `${progressPercentage}%` }}
                />
              </View>
            </View>
          </View>

          <View className={isWide ? 'mt-8 flex-1 flex-row gap-8' : 'mt-6 flex-1 gap-5'}>
            {isWide ? (
              <StatsRail
                points={pointsBase}
                streak={game.streak}
                position={`${Math.min(game.currentIndex + 3, 24)}/24`}
                category={category}
              />
            ) : null}

            <View className="min-w-0 flex-1">
              <View className="items-center">
                <TimerPill timeLeft={game.timeLeft} />
                <View className="mt-7 flex-row items-center gap-4">
                  <Ionicons name="sparkles" size={18} color="#6D5AF6" />
                  <Text className="text-[22px] font-black text-[#9B6CFF]">
                    Pregunta {game.currentIndex + 1}
                  </Text>
                  <Ionicons name="sparkles" size={18} color="#6D5AF6" />
                </View>
                <Text className="mt-5 max-w-[820px] text-center text-[30px] font-black leading-10 text-white">
                  {currentQuestion?.text}
                </Text>
                <View className="mt-4 flex-row items-center gap-2">
                  <Ionicons name="star" size={20} color="#76A7FF" />
                  <Text className="text-[15px] text-[#C7D6ED]">Elige la opción correcta</Text>
                </View>
              </View>

              {!isWide ? (
                <View className="mt-6">
                  <CompactStats
                    points={pointsBase}
                    streak={game.streak}
                    lives={game.lives}
                    category={category}
                  />
                </View>
              ) : null}

              <View
                className="mt-8 rounded-[24px] bg-[#061426]/80 p-2"
                style={{
                  shadowColor: '#020817',
                  shadowOpacity: 0.48,
                  shadowRadius: 28,
                  shadowOffset: { width: 0, height: 18 },
                  elevation: 12,
                }}
              >
                <View style={{ gap: 12 }}>
                  {currentQuestion?.answers.map((answer: Answer, index: number) => (
                    <AnswerOption
                      key={answer.id}
                      answer={answer}
                      index={index}
                      selectedAnswerId={game.selectedAnswerId}
                      onPress={() => game.submitAnswer(answer.id)}
                    />
                  ))}
                </View>
              </View>
            </View>
          </View>

          <BottomHud
            level={displayLevel}
            levelProgress={levelProgress}
            points={nextLevelPoints}
            total={nextLevelTotal}
            onHint={() => showComingSoon('Las pistas')}
            onSkip={() => showComingSoon('Saltar pregunta')}
          />
        </View>
      </ScrollView>
    </GameShell>
  )
}

function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 overflow-hidden bg-[#031026]">
      <View className="absolute inset-0 bg-[#050B22]" />
      <View className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-[#132E72]/35" />
      <View className="absolute right-[-110px] top-[180px] h-96 w-96 rounded-full bg-[#2D155F]/45" />
      <View className="absolute bottom-[-160px] left-[18%] h-96 w-96 rounded-full bg-[#071D48]/70" />
      <View className="absolute right-24 top-28 h-2 w-2 rounded-full bg-[#7C5CFF]" />
      <View className="absolute right-[21%] top-14 h-1.5 w-1.5 rounded-full bg-[#5364F5]" />
      <View className="absolute left-[8%] top-40 h-1.5 w-1.5 rounded-full bg-[#7C5CFF]" />
      <View className="absolute right-[12%] top-56 h-24 w-24 rounded-full bg-[#202B91]/70" />
      <View className="absolute right-[9%] top-72 h-9 w-9 rounded-full bg-[#29175F]" />
      <View className="absolute bottom-56 right-[5%] h-72 w-72 rounded-full bg-[#130D5B]/40" />
      <View
        className="absolute right-[9%] top-[235px] h-8 w-32 rounded-full border border-[#3F36A8]"
        style={{ transform: [{ rotate: '-18deg' }] }}
      />
      {children}
    </View>
  )
}

function TimerPill({ timeLeft }: { timeLeft: number }) {
  const isLow = timeLeft <= 5

  return (
    <View
      className={`flex-row items-center rounded-2xl border px-5 py-3 ${
        isLow ? 'border-[#FB7185] bg-[#3A1129]' : 'border-[#6D5AF6] bg-[#0D1738]'
      }`}
    >
      <Ionicons name="timer-outline" size={22} color={isLow ? '#FB7185' : '#8B5CF6'} />
      <Text className={`ml-2 text-[22px] font-black ${isLow ? 'text-[#FDA4AF]' : 'text-white'}`}>
        00:{timeLeft.toString().padStart(2, '0')}
      </Text>
    </View>
  )
}

function StatsRail({
  points,
  streak,
  position,
  category,
}: {
  points: number
  streak: number
  position: string
  category: string
}) {
  return (
    <View className="mt-20 w-48 rounded-3xl border border-[#1E355C] bg-[#09182F]/90 px-7 py-8">
      <View className="items-center">
        <View className="h-28 w-28 items-center justify-center rounded-full border-[7px] border-[#6D5AF6] bg-[#111D45]">
          <Ionicons name="flash" size={46} color="#FBBF24" />
        </View>
        <Text className="mt-4 text-[30px] font-black text-[#9B6CFF]">{points}</Text>
        <Text className="text-[18px] font-black text-[#9B6CFF]">XP</Text>
      </View>

      <RailDivider />
      <RailMetric label="Racha" value={String(Math.max(streak, 7))} icon="flame" iconColor="#FF7B45" />
      <RailDivider />
      <RailMetric label="Posición" value={position} valueColor="#9B6CFF" />
      <RailDivider />
      <RailMetric label="Categoría" value={category} icon="football" iconColor="#9B6CFF" compact />
    </View>
  )
}

function RailMetric({
  label,
  value,
  icon,
  iconColor,
  valueColor = '#FFFFFF',
  compact = false,
}: {
  label: string
  value: string
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  valueColor?: string
  compact?: boolean
}) {
  return (
    <View className="items-center">
      <Text className="text-[15px] text-[#95A6C4]">{label}</Text>
      <View className="mt-2 flex-row items-center gap-2">
        {icon ? <Ionicons name={icon} size={compact ? 22 : 26} color={iconColor || '#FFFFFF'} /> : null}
        <Text className="text-[26px] font-black" style={{ color: valueColor }}>
          {value}
        </Text>
      </View>
    </View>
  )
}

function RailDivider() {
  return <View className="my-6 h-px bg-[#1A3155]" />
}

function CompactStats({
  points,
  streak,
  lives,
  category,
}: {
  points: number
  streak: number
  lives: number
  category: string
}) {
  return (
    <View className="flex-row flex-wrap justify-center gap-3">
      <MiniStat icon="flash" color="#FBBF24" label={`${points} XP`} />
      <MiniStat icon="flame" color="#FF7B45" label={`Racha ${Math.max(streak, 7)}`} />
      <MiniStat icon="heart" color="#FF647C" label={`${lives} vidas`} />
      <MiniStat icon="football" color="#9B6CFF" label={category} />
    </View>
  )
}

function MiniStat({
  icon,
  color,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  label: string
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-[#1A3155] bg-[#0D1D3B] px-3 py-2">
      <Ionicons name={icon} size={17} color={color} />
      <Text className="text-[12px] font-bold text-white">{label}</Text>
    </View>
  )
}

function AnswerOption({
  answer,
  index,
  selectedAnswerId,
  onPress,
}: {
  answer: Answer
  index: number
  selectedAnswerId: number | null
  onPress: () => void
}) {
  const isSelected = selectedAnswerId === answer.id
  const hasAnswered = selectedAnswerId !== null

  let borderColor = '#1E355C'
  let backgroundColor = '#0A1A34'
  let textColor = '#FFFFFF'
  let badgeColor = '#3B68F0'

  if (!hasAnswered && index === 0) {
    borderColor = '#8B5CF6'
    backgroundColor = '#16164E'
    badgeColor = '#6D5AF6'
  }

  if (hasAnswered) {
    if (answer.is_correct) {
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
      disabled={hasAnswered}
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
      {hasAnswered && answer.is_correct ? <Ionicons name="checkmark-circle" size={26} color="#34D399" /> : null}
      {hasAnswered && isSelected && !answer.is_correct ? <Ionicons name="close-circle" size={26} color="#FB7185" /> : null}
    </Pressable>
  )
}

function BottomHud({
  level,
  levelProgress,
  points,
  total,
  onHint,
  onSkip,
}: {
  level: number
  levelProgress: number
  points: number
  total: number
  onHint: () => void
  onSkip: () => void
}) {
  return (
    <View className="mt-8 rounded-3xl border border-[#172A4A] bg-[#08172E]/95 px-5 py-4">
      <View className="flex-row flex-wrap items-center justify-between gap-5">
        <HudAction icon="bulb" title="Pista" detail="-10 pts" color="#FBBF24" onPress={onHint} />

        <View className="min-w-[260px] flex-1 flex-row items-center justify-center gap-4 rounded-2xl border border-[#10213E] bg-[#071426] px-5 py-4">
          <View className="h-12 w-12 items-center justify-center rounded-xl border-2 border-[#7C5CFF] bg-[#1B2058]">
            <Text className="text-[10px] font-bold text-[#B9A7FF]">Nivel</Text>
            <Text className="text-[14px] font-black text-[#B9A7FF]">{level}</Text>
          </View>
          <Text className="font-bold text-white">Nivel {level}</Text>
          <View className="h-3 min-w-[120px] flex-1 overflow-hidden rounded-full bg-[#10213E]">
            <View className="h-full rounded-full bg-[#7C5CFF]" style={{ width: `${levelProgress}%` }} />
          </View>
          <Text className="font-black text-[#B9A7FF]">
            {points.toLocaleString()} / {total.toLocaleString()} XP
          </Text>
        </View>

        <HudAction icon="chevron-forward" title="Saltar" detail="-20 pts" color="#A78BFA" onPress={onSkip} />
      </View>
    </View>
  )
}

function HudAction({
  icon,
  title,
  detail,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  detail: string
  color: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[150px] flex-row items-center justify-center gap-3 rounded-2xl border border-[#1A3155] bg-[#0D1D3B] px-5 py-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#10213E]">
        <Ionicons name={icon} size={23} color={color} />
      </View>
      <View>
        <Text className="text-[16px] font-black text-white">{title}</Text>
        <Text className="mt-1 text-[13px] font-bold" style={{ color }}>
          {detail}
        </Text>
      </View>
    </Pressable>
  )
}

function ResultState({
  icon,
  iconColor,
  title,
  detail,
  score,
  action,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  title: string
  detail: string
  score?: number
  action: string
  onPress: () => void
}) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="items-center rounded-3xl border border-[#1A3155] bg-[#09162C]/95 p-8">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-[#10213E]">
          <Ionicons name={icon} size={58} color={iconColor} />
        </View>
        <Text className="mt-5 text-center text-[30px] font-black text-white">{title}</Text>
        <Text className="mt-3 max-w-[420px] text-center text-[15px] leading-6 text-[#B8C7E0]">{detail}</Text>

        {typeof score === 'number' ? (
          <View className="my-7 w-full rounded-2xl border border-[#172A4A] bg-[#0D1D3B] p-5">
            <Text className="text-center text-[12px] font-bold uppercase text-[#8FA7C7]">Puntuación final</Text>
            <Text className="mt-2 text-center text-[46px] font-black text-[#9B6CFF]">{score}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onPress}
          className="min-w-[220px] rounded-2xl bg-[#5A46D8] px-7 py-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Text className="text-center text-[16px] font-black text-white">{action}</Text>
        </Pressable>
      </View>
    </View>
  )
}
