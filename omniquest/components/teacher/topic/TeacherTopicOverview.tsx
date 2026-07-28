import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'

type IconName = keyof typeof Ionicons.glyphMap

export default function TeacherTopicOverview({
  availability,
  difficulty,
  averageXp,
  attemptsCount,
  participation,
  questionsCount,
}: {
  availability: string
  difficulty: string
  averageXp: number
  attemptsCount: number
  participation: number
  questionsCount: number
}) {
  const [showSecondaryMetrics, setShowSecondaryMetrics] = useState(false)

  return (
    <View className="mb-5 rounded-2xl border border-border-default bg-surface-default p-4">
      <Text className="mb-3 text-[12px] font-black uppercase tracking-wide text-text-muted">Tema en un vistazo</Text>
      <View className="flex-row flex-wrap gap-3">
        <TopicFact icon="help-circle-outline" label="Preguntas" value={String(questionsCount)} color="#A78BFA" />
        <TopicFact icon="speedometer-outline" label="Dificultad" value={difficulty} color="#F59E0B" />
        <TopicFact icon="calendar-outline" label="Disponibilidad" value={availability} color="#38BDF8" />
        <TopicFact icon="trophy-outline" label="Resultados" value={`${averageXp.toLocaleString('es-ES')} XP media`} color="#34D399" />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showSecondaryMetrics }}
        onPress={() => setShowSecondaryMetrics((visible) => !visible)}
        className="mt-4 flex-row items-center justify-between border-t border-border-default pt-4"
      >
        <Text className="text-[13px] font-black text-brand-teacher">Métricas secundarias</Text>
        <Ionicons name={showSecondaryMetrics ? 'chevron-up' : 'chevron-down'} size={18} color="#B9A7FF" />
      </Pressable>

      {showSecondaryMetrics ? (
        <View className="mt-3 flex-row gap-3">
          <SecondaryMetric label="Intentos registrados" value={String(attemptsCount)} />
          <SecondaryMetric label="Participación" value={`${participation}%`} />
        </View>
      ) : null}
    </View>
  )
}

export function TeacherTopicAddQuestionCTA({ href, isDesktop }: { href: string; isDesktop: boolean }) {
  return (
    <View
      className={isDesktop ? '' : 'absolute bottom-[82px] left-4 right-4'}
      style={!isDesktop ? { shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 12 } : undefined}
    >
      <Link href={href as any} asChild>
        <Pressable
          accessibilityLabel="Añadir pregunta al tema"
          accessibilityRole="button"
          className={`${isDesktop ? 'h-12 rounded-xl px-4' : 'h-14 rounded-2xl px-5'} flex-row items-center justify-center gap-2 border border-border-active bg-brand-teacher`}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text className="text-[13px] font-black text-white">Añadir pregunta al tema</Text>
        </Pressable>
      </Link>
    </View>
  )
}

function TopicFact({ color, icon, label, value }: { color: string; icon: IconName; label: string; value: string }) {
  return (
    <View className="min-w-[145px] flex-1 rounded-xl border border-border-default bg-surface-default p-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={16} color={color} />
        <Text className="text-[11px] font-bold uppercase text-text-muted">{label}</Text>
      </View>
      <Text className="mt-2 text-[15px] font-black text-white" numberOfLines={2}>{value}</Text>
    </View>
  )
}

function SecondaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-xl bg-surface-raised p-3">
      <Text className="text-[11px] text-text-muted">{label}</Text>
      <Text className="mt-1 text-[20px] font-black text-white">{value}</Text>
    </View>
  )
}
