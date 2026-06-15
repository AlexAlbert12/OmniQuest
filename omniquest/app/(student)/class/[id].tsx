import React, { useCallback, useMemo, useState } from 'react'
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
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'
import NotificationBadge from '../../../components/NotificationBadge'
import StudentHeaderAvatar from '../../../components/student/StudentHeaderAvatar'

type Subject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

type Topic = {
  id: number | 'general'
  title: string
  description: string | null
  icon: string | null
  sort_order: number
  questionsCount: number
  bestScore?: number
}

export default function StudentClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  const subjectId = Array.isArray(id) ? id[0] : id
  const isDesktop = width >= 1024
  const color = subject?.theme_color || '#6574FF'

  const totals = useMemo(() => {
    const questions = topics.reduce((total, topic) => total + topic.questionsCount, 0)
    const completed = topics.filter((topic) => typeof topic.bestScore === 'number').length
    const scores = topics.map((topic) => topic.bestScore).filter((score): score is number => typeof score === 'number')
    const average = scores.length > 0 ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0

    return { questions, completed, average }
  }, [topics])

  const fetchClass = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return

      const [subjectResult, topicsResult, questionsResult, topicScoresResult, subjectScoreResult] = await Promise.all([
        supabase.from('subjects').select('id, name, description, icon, theme_color').eq('id', subjectId).single(),
        supabase
          .from('subject_topics')
          .select('id, title, description, icon, sort_order')
          .eq('subject_id', subjectId)
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('questions').select('id, topic_id').eq('subject_id', subjectId),
        supabase.from('topic_scores').select('topic_id, max_score').eq('student_id', userId).eq('subject_id', subjectId),
        supabase.from('subject_scores').select('max_score').eq('student_id', userId).eq('subject_id', subjectId).maybeSingle(),
      ])

      if (subjectResult.error) throw subjectResult.error
      if (topicsResult.error) throw topicsResult.error
      if (questionsResult.error) throw questionsResult.error
      if (topicScoresResult.error) throw topicScoresResult.error
      if (subjectScoreResult.error) throw subjectScoreResult.error

      const questions = questionsResult.data || []
      const scoresByTopic = new Map<number, number>()
      topicScoresResult.data?.forEach((score) => {
        if (score.topic_id !== null) scoresByTopic.set(Number(score.topic_id), score.max_score ?? 0)
      })

      const nextTopics: Topic[] = (topicsResult.data || []).map((topic) => ({
        id: Number(topic.id),
        title: topic.title,
        description: topic.description,
        icon: topic.icon,
        sort_order: topic.sort_order ?? 1,
        questionsCount: questions.filter((question) => Number(question.topic_id) === Number(topic.id)).length,
        bestScore: scoresByTopic.get(Number(topic.id)),
      }))

      const generalQuestions = questions.filter((question) => question.topic_id === null).length
      if (generalQuestions > 0) {
        nextTopics.unshift({
          id: 'general',
          title: 'Tema general',
          description: 'Preguntas creadas antes de organizar la clase por temas.',
          icon: 'layers-outline',
          sort_order: 0,
          questionsCount: generalQuestions,
          bestScore: subjectScoreResult.data?.max_score ?? undefined,
        })
      }

      setSubject(subjectResult.data as Subject)
      setTopics(nextTopics)
    } catch (error: any) {
      console.error('Error cargando temas:', error.message)
      showAlert('No se pudo cargar la clase', 'Inténtalo de nuevo en unos segundos.')
    } finally {
      setLoading(false)
    }
  }, [subjectId])

  useFocusEffect(
    useCallback(() => {
      fetchClass()
    }, [fetchClass])
  )

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando temas...</Text>
      </View>
    )
  }

  if (!subject) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126] px-6">
        <Ionicons name="alert-circle-outline" size={52} color="#FB7185" />
        <Text className="mt-4 text-center text-xl font-black text-white">No se encontró esta clase</Text>
        <Pressable onPress={() => router.replace('/(student)/classes' as any)} className="mt-5 rounded-xl bg-[#5865F2] px-5 py-3">
          <Text className="font-bold text-white">Volver a clases</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: isDesktop ? 34 : 18,
          paddingTop: isDesktop ? 28 : 18,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-center justify-between gap-3">
          <Pressable onPress={() => router.back()} className="flex-row items-center gap-2">
            <Ionicons name="arrow-back" size={18} color="#8FA7C7" />
            <Text className="font-semibold text-[#8FA7C7]">Mis Clases</Text>
          </Pressable>
          <View className="flex-row items-center gap-3">
            <NotificationBadge />
            <StudentHeaderAvatar />
          </View>
        </View>

        <View className="mb-6 flex-row flex-wrap items-center gap-4">
          <View className="h-20 w-20 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}26` }}>
            {subject.icon ? <Text className="text-[36px]">{subject.icon}</Text> : <Ionicons name="book" size={38} color={color} />}
          </View>
          <View className="min-w-[240px] flex-1">
            <Text className="text-[30px] font-black text-white">{subject.name}</Text>
            <Text className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#AFC2DB]">
              {subject.description || 'Elige un tema para empezar a responder preguntas.'}
            </Text>
          </View>
        </View>

        <View className={isDesktop ? 'mb-5 flex-row gap-4' : 'mb-5 gap-4'}>
          <SummaryCard icon="albums" label="Temas" value={String(topics.length)} color={color} />
          <SummaryCard icon="help-circle" label="Preguntas" value={String(totals.questions)} color="#58B5FF" />
          <SummaryCard icon="checkmark-circle" label="Completados" value={String(totals.completed)} color="#43D991" />
          <SummaryCard icon="star" label="Media" value={totals.average > 0 ? `${totals.average} XP` : '0 XP'} color="#F6A64A" />
        </View>

        <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
          <Text className="mb-4 text-[18px] font-black text-white">Elige un tema</Text>

          {topics.length === 0 ? (
            <View className="items-center rounded-xl border border-dashed border-[#20375E] bg-[#0A1A34] px-4 py-8">
              <Ionicons name="albums-outline" size={42} color="#60799C" />
              <Text className="mt-3 text-center font-bold text-white">Aún no hay temas disponibles</Text>
              <Text className="mt-1 text-center text-[12px] leading-5 text-[#8FA7C7]">
                Tu profesor añadirá temas con preguntas para esta clase.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {topics.map((topic, index) => (
                <TopicRow key={topic.id} subjectId={subject.id} topic={topic} index={index} color={color} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  color: string
}) {
  return (
    <View className="min-w-[170px] flex-1 flex-row items-center gap-4 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View>
        <Text className="text-[22px] font-black text-white">{value}</Text>
        <Text className="text-[12px] text-[#8FA7C7]">{label}</Text>
      </View>
    </View>
  )
}

function TopicRow({ subjectId, topic, index, color }: { subjectId: number; topic: Topic; index: number; color: string }) {
  const isCompleted = typeof topic.bestScore === 'number'
  const topicColor = ['#6574FF', '#43D991', '#F6A64A', '#58B5FF'][index % 4] || color
  const disabled = topic.questionsCount === 0

  const href = {
    pathname: '/(student)/play/[id]',
    params: {
      id: String(subjectId),
      topicId: String(topic.id),
      topicName: topic.title,
    },
  }

  const content = (
    <View className={`flex-row flex-wrap items-center gap-4 rounded-xl border p-4 ${disabled ? 'border-[#172A4A] bg-[#07162E]' : 'border-[#20375E] bg-[#0B1A32]'}`}>
      <View className="h-14 w-14 items-center justify-center rounded-xl" style={{ backgroundColor: `${topicColor}26` }}>
        {topic.icon && topic.icon.includes('-outline') ? (
          <Ionicons name={topic.icon as keyof typeof Ionicons.glyphMap} size={27} color={topicColor} />
        ) : topic.icon ? (
          <Text className="text-2xl">{topic.icon}</Text>
        ) : (
          <Ionicons name="albums-outline" size={27} color={topicColor} />
        )}
      </View>
      <View className="min-w-[220px] flex-1">
        <Text className="text-[17px] font-black text-white">{topic.title}</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>
          {topic.description || `${topic.questionsCount} pregunta${topic.questionsCount === 1 ? '' : 's'} disponible${topic.questionsCount === 1 ? '' : 's'}`}
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <Badge icon="help-circle-outline" label={`${topic.questionsCount} preguntas`} color="#58B5FF" />
          <Badge icon="star-outline" label={isCompleted ? `${topic.bestScore} XP` : 'Sin jugar'} color={isCompleted ? '#B9A7FF' : '#8FA7C7'} />
        </View>
      </View>
      <View className={`flex-row items-center gap-2 rounded-lg px-4 py-3 ${disabled ? 'bg-[#172A4A]' : 'bg-[#4F46E5]'}`}>
        <Ionicons name={isCompleted ? 'refresh' : 'play'} size={15} color="#FFFFFF" />
        <Text className="font-bold text-white">{disabled ? 'Sin preguntas' : isCompleted ? 'Repetir' : 'Jugar'}</Text>
      </View>
    </View>
  )

  if (disabled) {
    return <View style={{ opacity: 0.72 }}>{content}</View>
  }

  return (
    <Link href={href as any} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}>{content}</Pressable>
    </Link>
  )
}

function Badge({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-md bg-[#122544] px-2 py-1">
      <Ionicons name={icon} size={12} color={color} />
      <Text className="text-[10px] font-bold text-[#C9D6EA]">{label}</Text>
    </View>
  )
}
