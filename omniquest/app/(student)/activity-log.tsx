import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import OmniGuide from '../../components/OmniGuide'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/student/StudentSidebar'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'

type ActivityFilter = 'all' | 'correct' | 'incorrect'

type AttemptAnswer = {
  id: number
  text: string | null
  is_correct: boolean | null
  sort_order: number | null
}

type AttemptSubject = {
  id: number
  name: string | null
}

type AttemptTopic = {
  id: number
  title: string | null
}

type AttemptQuestion = {
  id: number
  text: string | null
  type: string | null
  explanation: string | null
  subject_id: number | null
  topic_id: number | null
  subjects?: AttemptSubject | AttemptSubject[] | null
  subject_topics?: AttemptTopic | AttemptTopic[] | null
  answers?: AttemptAnswer[] | null
}

type AttemptRow = {
  id: number
  answer_id: number | null
  is_correct: boolean
  time_taken_seconds: number | null
  attempted_at: string
  submitted_answer_text: string | null
  submitted_answer_payload: any | null
  earned_points: number | null
  hint_used: boolean | null
  was_skipped: boolean | null
  questions: AttemptQuestion | AttemptQuestion[] | null
}

type FilterOption = {
  id: string
  label: string
  count: number
}

export default function ActivityLogScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const isDesktop = width >= 1024

  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ActivityFilter>('all')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all')
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null)

  const fetchActivityData = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return

      const [profileResult, historyResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, points').eq('id', userId).single(),
        supabase
          .from('attempt_history')
          .select(`
            id,
            answer_id,
            is_correct,
            time_taken_seconds,
            attempted_at,
            submitted_answer_text,
            submitted_answer_payload,
            earned_points,
            hint_used,
            was_skipped,
            questions (
              id,
              text,
              type,
              explanation,
              subject_id,
              topic_id,
              subjects ( id, name ),
              subject_topics ( id, title ),
              answers ( id, text, is_correct, sort_order )
            )
          `)
          .eq('student_id', userId)
          .order('attempted_at', { ascending: false })
          .limit(100),
      ])

      if (profileResult.data) setProfile(profileResult.data)
      if (historyResult.data) setAttempts(historyResult.data as unknown as AttemptRow[])
    } catch (error) {
      console.error('Error al cargar el historial de actividad:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchActivityData()
  }, [fetchActivityData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchActivityData()
  }

  const subjectOptions = useMemo(() => buildSubjectOptions(attempts), [attempts])
  const topicOptions = useMemo(() => buildTopicOptions(attempts, selectedSubjectId), [attempts, selectedSubjectId])

  useEffect(() => {
    if (selectedTopicId === 'all') return
    if (!topicOptions.some((option) => option.id === selectedTopicId)) {
      setSelectedTopicId('all')
    }
  }, [selectedTopicId, topicOptions])

  const filteredAttempts = useMemo(() => {
    const normalizedSearch = normalizeForSearch(searchQuery)

    return attempts.filter((attempt) => {
      const question = normalizeSingleRelation(attempt.questions)
      const subject = normalizeSingleRelation(question?.subjects)
      const topic = normalizeSingleRelation(question?.subject_topics)
      const answers = getQuestionAnswers(question)
      const questionText = question?.text || 'Pregunta eliminada'
      const submittedAnswer = getSubmittedAnswerText(attempt, question, answers)
      const correctAnswer = getCorrectAnswerText(question, answers)

      if (statusFilter === 'correct' && !attempt.is_correct) return false
      if (statusFilter === 'incorrect' && attempt.is_correct) return false
      if (selectedSubjectId !== 'all' && String(subject?.id ?? question?.subject_id ?? '') !== selectedSubjectId) return false
      if (selectedTopicId !== 'all' && String(topic?.id ?? question?.topic_id ?? 'general') !== selectedTopicId) return false

      if (!normalizedSearch) return true

      const searchableText = normalizeForSearch([
        questionText,
        subject?.name,
        topic?.title,
        submittedAnswer,
        correctAnswer,
        question?.explanation,
      ].filter(Boolean).join(' '))

      return searchableText.includes(normalizedSearch)
    })
  }, [attempts, searchQuery, selectedSubjectId, selectedTopicId, statusFilter])

  const statusFilters = useMemo(
    () => [
      { id: 'all' as ActivityFilter, label: 'Todas', count: attempts.length, icon: 'list' as keyof typeof Ionicons.glyphMap },
      {
        id: 'correct' as ActivityFilter,
        label: 'Correctas',
        count: attempts.filter((attempt) => attempt.is_correct).length,
        icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
      },
      {
        id: 'incorrect' as ActivityFilter,
        label: 'Incorrectas',
        count: attempts.filter((attempt) => !attempt.is_correct).length,
        icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
      },
    ],
    [attempts]
  )

  const points = profile?.points || 0
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)

  const renderAttemptItem = ({ item }: { item: AttemptRow }) => (
    <AttemptCard
      item={item}
      isExpanded={expandedAttemptId === item.id}
      onToggle={() => setExpandedAttemptId((current) => (current === item.id ? null : item.id))}
    />
  )

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop && profile ? (
          <StudentSidebar
            activeSection="home"
            alias={profile.alias || 'Estudiante'}
            avatar={profile.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={() => supabase.auth.signOut()}
          />
        ) : null}

        <View className="flex-1 px-4 pt-6 md:px-8 lg:pt-8">
          <StudentPageHeader
            backAction={{ label: 'Volver', onPress: () => router.back() }}
            icon="time-outline"
            isDesktop={isDesktop}
            title="Historial de actividad"
            mobileTitle="Actividad"
            subtitle="Revisa tus respuestas, detecta errores y aprende de cada intento."
          />

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#8B5CF6" />
            </View>
          ) : (
            <FlatList
              data={filteredAttempts}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderAttemptItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListHeaderComponent={
                <ActivityFilters
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  statusFilters={statusFilters}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  subjectOptions={subjectOptions}
                  selectedSubjectId={selectedSubjectId}
                  onSubjectChange={(subjectId) => {
                    setSelectedSubjectId(subjectId)
                    setSelectedTopicId('all')
                  }}
                  topicOptions={topicOptions}
                  selectedTopicId={selectedTopicId}
                  onTopicChange={setSelectedTopicId}
                  visibleCount={filteredAttempts.length}
                  totalCount={attempts.length}
                />
              }
              ListEmptyComponent={
                <View className="mt-8 items-center justify-center rounded-2xl border border-dashed border-[#1A3155] bg-[#09162C] p-8">
                  <OmniGuide state="normal" autoBlink size={88} />
                  <Text className="mt-4 text-center text-[16px] font-bold text-white">
                    {attempts.length === 0 ? 'No hay actividad registrada' : 'No hay resultados con estos filtros'}
                  </Text>
                  <Text className="mt-1 text-center text-[13px] text-[#8FA7C7]">
                    {attempts.length === 0
                      ? 'Tus respuestas aparecerán aquí en cuanto empieces a completar retos.'
                      : 'Prueba a cambiar la búsqueda, la clase, el tema o el estado de la respuesta.'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </View>
  )
}

function ActivityFilters({
  searchQuery,
  onSearchChange,
  statusFilters,
  statusFilter,
  onStatusFilterChange,
  subjectOptions,
  selectedSubjectId,
  onSubjectChange,
  topicOptions,
  selectedTopicId,
  onTopicChange,
  visibleCount,
  totalCount,
}: {
  searchQuery: string
  onSearchChange: (value: string) => void
  statusFilters: { id: ActivityFilter; label: string; count: number; icon: keyof typeof Ionicons.glyphMap }[]
  statusFilter: ActivityFilter
  onStatusFilterChange: (value: ActivityFilter) => void
  subjectOptions: FilterOption[]
  selectedSubjectId: string
  onSubjectChange: (value: string) => void
  topicOptions: FilterOption[]
  selectedTopicId: string
  onTopicChange: (value: string) => void
  visibleCount: number
  totalCount: number
}) {
  return (
    <View className="mb-5 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-white">Filtra tu actividad</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">
            Mostrando {visibleCount} de {totalCount} intentos guardados.
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center gap-3 rounded-xl border border-[#1A3155] bg-[#071A33] px-4 py-3">
        <Ionicons name="search" size={18} color="#8FA7C7" />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Buscar pregunta, tema, clase o respuesta..."
          placeholderTextColor="#647A9D"
          className="min-w-0 flex-1 text-[14px] text-white outline-none"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.trim() ? (
          <Pressable onPress={() => onSearchChange('')} className="h-8 w-8 items-center justify-center rounded-full bg-[#13284A]">
            <Ionicons name="close" size={16} color="#DDE7F4" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 14 }}>
        {statusFilters.map((filter) => (
          <FilterChip
            key={filter.id}
            label={filter.label}
            count={filter.count}
            icon={filter.icon}
            active={statusFilter === filter.id}
            onPress={() => onStatusFilterChange(filter.id)}
          />
        ))}
      </ScrollView>

      <View className="mt-4 gap-3">
        <View>
          <Text className="mb-2 text-[12px] font-black uppercase tracking-wide text-[#8FA7C7]">Por clase</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {subjectOptions.map((option) => (
              <FilterChip
                key={option.id}
                label={option.label}
                count={option.count}
                icon="book"
                active={selectedSubjectId === option.id}
                onPress={() => onSubjectChange(option.id)}
              />
            ))}
          </ScrollView>
        </View>

        <View>
          <Text className="mb-2 text-[12px] font-black uppercase tracking-wide text-[#8FA7C7]">Por tema</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {topicOptions.map((option) => (
              <FilterChip
                key={option.id}
                label={option.label}
                count={option.count}
                icon="pricetag"
                active={selectedTopicId === option.id}
                onPress={() => onTopicChange(option.id)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  )
}

function FilterChip({
  label,
  count,
  icon,
  active,
  onPress,
}: {
  label: string
  count: number
  icon: keyof typeof Ionicons.glyphMap
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-xl border px-4 py-2"
      style={{
        borderColor: active ? '#8B5CF6' : '#1A3155',
        backgroundColor: active ? '#7C5CFF' : '#071A33',
      }}
    >
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : '#8FA7C7'} />
      <Text className="text-[13px] font-black" style={{ color: active ? '#FFFFFF' : '#AFC2DB' }}>
        {label}
      </Text>
      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: active ? '#FFFFFF24' : '#13284A' }}>
        <Text className="text-[11px] font-black" style={{ color: active ? '#FFFFFF' : '#8FA7C7' }}>
          {count}
        </Text>
      </View>
    </Pressable>
  )
}

function AttemptCard({
  item,
  isExpanded,
  onToggle,
}: {
  item: AttemptRow
  isExpanded: boolean
  onToggle: () => void
}) {
  const question = normalizeSingleRelation(item.questions)
  const subject = normalizeSingleRelation(question?.subjects)
  const topic = normalizeSingleRelation(question?.subject_topics)
  const answers = getQuestionAnswers(question)
  const isCorrect = item.is_correct
  const questionText = question?.text || 'Pregunta eliminada'
  const topicTitle = topic?.title || 'Práctica libre'
  const subjectName = subject?.name || 'Clase no disponible'
  const submittedAnswer = getSubmittedAnswerText(item, question, answers)
  const correctAnswer = getCorrectAnswerText(question, answers)
  const explanation = question?.explanation?.trim() || 'El profesor no ha añadido explicación para esta pregunta.'
  const earnedPoints = Math.max(0, Number(item.earned_points ?? (isCorrect ? 10 : 0)))
  const formattedDate = formatAttemptDate(item.attempted_at)
  const resultColor = isCorrect ? '#43D991' : '#FB7185'

  return (
    <Pressable
      onPress={onToggle}
      className="mb-3 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4"
      style={{ borderColor: isExpanded ? '#4A64A8' : '#1A3155' }}
    >
      <View className="flex-row items-center gap-4">
        <View
          className="h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: isCorrect ? '#70E0A520' : '#FB718520' }}
        >
          <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={26} color={resultColor} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="mb-1 flex-row flex-wrap items-center gap-2">
            <Text className="text-[15px] font-black text-white" numberOfLines={1}>
              {isCorrect ? 'Respuesta correcta' : 'Respuesta incorrecta'}
            </Text>
            <View className="rounded-full bg-[#13284A] px-2 py-0.5">
              <Text className="text-[11px] font-black text-[#9FD6FF]">{getQuestionTypeLabel(question?.type)}</Text>
            </View>
          </View>
          <Text className="text-[13px] text-[#DDE7F4]" numberOfLines={1}>
            {questionText}
          </Text>
          <Text className="mt-1 text-[12px] font-semibold text-[#8FA7C7]" numberOfLines={1}>
            {subjectName} · {topicTitle}
          </Text>
        </View>

        <View className="items-end gap-1">
          <Text className="text-[12px] text-[#8FA7C7]">{formattedDate}</Text>
          <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: isCorrect ? '#22C55E20' : '#33415550' }}>
            <Text className="text-[12px] font-black" style={{ color: isCorrect ? '#43D991' : '#94A7C4' }}>
              {earnedPoints > 0 ? `+${earnedPoints} XP` : '0 XP'}
            </Text>
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#8B5CF6" />
        </View>
      </View>

      {isExpanded ? (
        <View className="mt-4 border-t border-[#1A3155] pt-4">
          <View className="gap-3">
            <DetailBlock icon="help-circle" label="Pregunta" value={questionText} />
            <DetailBlock icon="person-circle" label="Tu respuesta" value={submittedAnswer} highlightColor={isCorrect ? '#70E0A5' : '#FB7185'} />
            <DetailBlock icon="checkmark-done-circle" label="Respuesta correcta" value={correctAnswer} highlightColor="#70E0A5" />
            <DetailBlock icon="bulb" label="Explicación" value={explanation} />

            <View className="flex-row flex-wrap gap-3">
              <MiniMetric icon="timer" label="Tiempo empleado" value={formatTimeTaken(item.time_taken_seconds)} />
              <MiniMetric icon="flash" label="XP ganado" value={`${earnedPoints} XP`} />
              <MiniMetric icon="school" label="Clase" value={subjectName} />
              <MiniMetric icon="pricetag" label="Tema" value={topicTitle} />
              {item.hint_used ? <MiniMetric icon="bulb" label="Pista" value="Usada" /> : null}
              {item.was_skipped ? <MiniMetric icon="play-skip-forward" label="Estado" value="Saltada" /> : null}
            </View>
          </View>
        </View>
      ) : null}
    </Pressable>
  )
}

function DetailBlock({
  icon,
  label,
  value,
  highlightColor,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  highlightColor?: string
}) {
  return (
    <View className="rounded-xl border border-[#1A3155] bg-[#071A33] p-3">
      <View className="mb-2 flex-row items-center gap-2">
        <Ionicons name={icon} size={15} color={highlightColor || '#8FA7C7'} />
        <Text className="text-[11px] font-black uppercase tracking-wide text-[#8FA7C7]">{label}</Text>
      </View>
      <Text className="text-[13px] leading-5" style={{ color: highlightColor || '#DDE7F4' }}>
        {value || 'Sin información'}
      </Text>
    </View>
  )
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  return (
    <MobileMetricCard
      className="min-w-[150px] flex-1 rounded-xl"
      color="#8B5CF6"
      compact
      icon={icon}
      label={label}
      value={value || 'Sin información'}
    />
  )
}

function buildSubjectOptions(attempts: AttemptRow[]): FilterOption[] {
  const counts = new Map<string, FilterOption>()

  attempts.forEach((attempt) => {
    const question = normalizeSingleRelation(attempt.questions)
    const subject = normalizeSingleRelation(question?.subjects)
    const id = String(subject?.id ?? question?.subject_id ?? '')
    if (!id) return

    const current = counts.get(id)
    counts.set(id, {
      id,
      label: subject?.name || 'Clase sin nombre',
      count: (current?.count || 0) + 1,
    })
  })

  return [{ id: 'all', label: 'Todas las clases', count: attempts.length }, ...Array.from(counts.values())]
}

function buildTopicOptions(attempts: AttemptRow[], selectedSubjectId: string): FilterOption[] {
  const scopedAttempts = attempts.filter((attempt) => {
    if (selectedSubjectId === 'all') return true
    const question = normalizeSingleRelation(attempt.questions)
    const subject = normalizeSingleRelation(question?.subjects)
    return String(subject?.id ?? question?.subject_id ?? '') === selectedSubjectId
  })

  const counts = new Map<string, FilterOption>()

  scopedAttempts.forEach((attempt) => {
    const question = normalizeSingleRelation(attempt.questions)
    const topic = normalizeSingleRelation(question?.subject_topics)
    const id = String(topic?.id ?? question?.topic_id ?? 'general')
    const current = counts.get(id)
    counts.set(id, {
      id,
      label: topic?.title || 'Tema general',
      count: (current?.count || 0) + 1,
    })
  })

  return [{ id: 'all', label: 'Todos los temas', count: scopedAttempts.length }, ...Array.from(counts.values())]
}

function normalizeSingleRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation ?? null
}

function getQuestionAnswers(question: AttemptQuestion | null): AttemptAnswer[] {
  return Array.isArray(question?.answers) ? question.answers : []
}

function getSubmittedAnswerText(attempt: AttemptRow, question: AttemptQuestion | null, answers: AttemptAnswer[]) {
  if (attempt.was_skipped) return 'Sin respuesta / tiempo agotado'

  const textAnswer = attempt.submitted_answer_text?.trim()
  if (textAnswer) return textAnswer

  const payload = attempt.submitted_answer_payload
  const answerMap = new Map(answers.map((answer) => [Number(answer.id), formatAnswerText(answer.text)]))

  if (Array.isArray(payload?.answer_ids)) {
    const orderedAnswers = payload.answer_ids
      .map((id: unknown) => answerMap.get(Number(id)))
      .filter(Boolean)
    if (orderedAnswers.length > 0) return orderedAnswers.join(' → ')
  }

  if (Array.isArray(payload?.pairs)) {
    const pairs = payload.pairs
      .map((pair: any) => `${pair?.left ?? ''} → ${pair?.right ?? ''}`.trim())
      .filter((value: string) => value.replace('→', '').trim().length > 0)
    if (pairs.length > 0) return pairs.join('\n')
  }

  if (attempt.answer_id !== null) {
    const selectedAnswer = answerMap.get(Number(attempt.answer_id))
    if (selectedAnswer) return selectedAnswer
  }

  return 'Sin respuesta registrada'
}

function getCorrectAnswerText(question: AttemptQuestion | null, answers: AttemptAnswer[]) {
  if (!question) return 'Pregunta eliminada'

  const orderedAnswers = [...answers].sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id))

  if (question.type === 'ordering') {
    return orderedAnswers.map((answer) => formatAnswerText(answer.text)).join(' → ') || 'Sin respuesta correcta registrada'
  }

  if (question.type === 'match_pairs' || question.type === 'drag_drop') {
    return orderedAnswers.map((answer) => formatAnswerText(answer.text)).join('\n') || 'Sin respuesta correcta registrada'
  }

  const correctAnswers = orderedAnswers.filter((answer) => answer.is_correct === true || answer.is_correct === null)
  const values = correctAnswers.length > 0 ? correctAnswers : orderedAnswers.filter((answer) => answer.is_correct !== false)

  return values.map((answer) => formatAnswerText(answer.text)).filter(Boolean).join(', ') || 'Sin respuesta correcta registrada'
}

function formatAnswerText(value: string | null | undefined) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.includes('|||')) {
    const [left, right] = text.split('|||')
    return `${left?.trim() || ''} → ${right?.trim() || ''}`.trim()
  }
  return text
}

function getQuestionTypeLabel(type?: string | null) {
  switch (type) {
    case 'multiple_choice':
      return 'Tipo test'
    case 'true_false':
      return 'Verdadero/Falso'
    case 'open_answer':
      return 'Abierta'
    case 'fill_blank':
      return 'Huecos'
    case 'ordering':
      return 'Ordenar'
    case 'match_pairs':
      return 'Parejas'
    case 'drag_drop':
      return 'Asignar'
    default:
      return 'Pregunta'
  }
}

function formatAttemptDate(value: string) {
  const date = new Date(value)
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTimeTaken(seconds: number | null) {
  if (seconds === null || Number.isNaN(seconds)) return 'Sin tiempo'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}m ${rest}s`
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
