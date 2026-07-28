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
import PaginationControls from '../../components/ui/PaginationControls'
import QuestionMedia from '../../components/questions/QuestionMedia'
import OmniGuide from '../../components/OmniGuide'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/student/StudentSidebar'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { fetchActivityAttemptDetail, fetchStudentAttemptHistoryPage } from '../../lib/studentSecureData'
import { useAppTheme } from '../../lib/appTheme'
import { readThroughCache } from '../../lib/offlineCache'

type ActivityFilter = 'all' | 'correct' | 'incorrect'

const ACTIVITY_PAGE_SIZE = 20

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

type ManualReviewComment = {
  id: number
  author_name: string | null
  body: string
  created_at: string
}

type AttemptQuestion = {
  id: number
  text: string | null
  type: string | null
  explanation: string | null
  media_type?: 'image' | 'audio' | 'video' | null
  media_url?: string | null
  media_alt_text?: string | null
  media_caption?: string | null
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
  manual_review_status?: string | null
  review_notes?: string | null
  review_comments?: ManualReviewComment[] | null
  questions: AttemptQuestion | AttemptQuestion[] | null
}

type FilterOption = {
  id: string
  label: string
  count: number
}

type ActivityListItem =
  | { kind: 'date'; key: string; label: string; count: number }
  | { kind: 'attempt'; key: string; attempt: AttemptRow }

type ActivityCacheSnapshot = {
  profile: any
  attempts: AttemptRow[]
  totalAttempts: number
}

export default function ActivityLogScreen() {
  const { width } = useWindowDimensions()
  const { colors } = useAppTheme()
  const router = useRouter()
  const isDesktop = width >= 1024

  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [page, setPage] = useState(0)
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ActivityFilter>('all')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all')
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null)
  const [attemptDetails, setAttemptDetails] = useState<Record<number, AttemptRow>>({})
  const [loadingAttemptId, setLoadingAttemptId] = useState<number | null>(null)

  const fetchActivityData = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return

      const resource = [
        'student:history',
        page,
        statusFilter,
        selectedSubjectId,
        selectedTopicId,
        searchQuery.trim().slice(0, 64),
      ].join(':')
      await readThroughCache<ActivityCacheSnapshot>({
        userId,
        resource,
        fetcher: async () => {
          const [profileResult, historyResult] = await Promise.all([
            supabase.from('profiles').select('id, alias, avatar, points').eq('id', userId).single(),
            fetchStudentAttemptHistoryPage({
              page,
              pageSize: ACTIVITY_PAGE_SIZE,
              status: statusFilter,
              search: searchQuery,
              subjectId: selectedSubjectId === 'all' ? null : Number(selectedSubjectId),
              topicId: selectedTopicId === 'all' ? null : Number(selectedTopicId),
            }),
          ])
          if (profileResult.error) throw profileResult.error
          return {
            profile: profileResult.data,
            attempts: (historyResult.rows || []) as unknown as AttemptRow[],
            totalAttempts: historyResult.total,
          }
        },
        onData: (snapshot) => {
          setProfile(snapshot.profile)
          setAttempts(snapshot.attempts)
          setTotalAttempts(snapshot.totalAttempts)
          setLoading(false)
          setRefreshing(false)
        },
      })
    } catch (error) {
      console.error('Error al cargar el historial de actividad:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, searchQuery, selectedSubjectId, selectedTopicId, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchActivityData()
    }, searchQuery ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchActivityData, searchQuery])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchActivityData()
  }

  const subjectOptions = useMemo(() => buildSubjectOptions(attempts), [attempts])
  const topicOptions = useMemo(() => buildTopicOptions(attempts, selectedSubjectId), [attempts, selectedSubjectId])

  const activityRows = useMemo(() => buildActivityRows(attempts), [attempts])

  const statusFilters = useMemo(
    () => [
      { id: 'all' as ActivityFilter, label: 'Todas', count: totalAttempts, icon: 'list' as keyof typeof Ionicons.glyphMap },
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
    [attempts, totalAttempts]
  )

  const points = profile?.points || 0
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)

  const handleToggleAttempt = useCallback(async (attemptId: number) => {
    if (expandedAttemptId === attemptId) {
      setExpandedAttemptId(null)
      return
    }

    setExpandedAttemptId(attemptId)
    if (attemptDetails[attemptId]) return

    setLoadingAttemptId(attemptId)
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return
      await readThroughCache<AttemptRow>({
        userId,
        resource: `student:history:detail:${attemptId}`,
        fetcher: async () => await fetchActivityAttemptDetail(attemptId) as unknown as AttemptRow,
        onData: (detail) => {
          setAttemptDetails((current) => ({ ...current, [attemptId]: detail }))
          setLoadingAttemptId((current) => (current === attemptId ? null : current))
        },
      })
    } catch (error) {
      console.error('No se pudo cargar el detalle seguro del intento:', error)
    } finally {
      setLoadingAttemptId((current) => (current === attemptId ? null : current))
    }
  }, [attemptDetails, expandedAttemptId])

  const renderActivityItem = ({ item }: { item: ActivityListItem }) => {
    if (item.kind === 'date') {
      return <ActivityDateHeader label={item.label} count={item.count} />
    }

    const attempt = item.attempt
    const isExpanded = expandedAttemptId === attempt.id
    return (
      <AttemptCard
        item={isExpanded ? attemptDetails[attempt.id] ?? attempt : attempt}
        isExpanded={isExpanded}
        isDetailLoading={loadingAttemptId === attempt.id}
        onToggle={() => void handleToggleAttempt(attempt.id)}
      />
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
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
              data={activityRows}
              keyExtractor={(item) => item.key}
              renderItem={renderActivityItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListHeaderComponent={
                <ActivityFilters
                  searchQuery={searchQuery}
                  onSearchChange={(value) => { setPage(0); setSearchQuery(value) }}
                  statusFilters={statusFilters}
                  statusFilter={statusFilter}
                  onStatusFilterChange={(value) => { setPage(0); setStatusFilter(value) }}
                  subjectOptions={subjectOptions}
                  selectedSubjectId={selectedSubjectId}
                  onSubjectChange={(subjectId) => {
                    setPage(0)
                    setSelectedSubjectId(subjectId)
                    setSelectedTopicId('all')
                  }}
                  topicOptions={topicOptions}
                  selectedTopicId={selectedTopicId}
                  onTopicChange={(value) => { setPage(0); setSelectedTopicId(value) }}
                  visibleCount={attempts.length}
                  totalCount={totalAttempts}
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
              ListFooterComponent={
                <PaginationControls
                  compact={!isDesktop}
                  page={page}
                  pageSize={ACTIVITY_PAGE_SIZE}
                  total={totalAttempts}
                  onPrevious={() => setPage((value) => Math.max(0, value - 1))}
                  onNext={() => setPage((value) => value + 1)}
                />
              }
            />
          )}
        </View>
      </View>
    </View>
  )
}


function ActivityDateHeader({ label, count }: { label: string; count: number }) {
  return (
    <View className="mb-3 mt-2 flex-row items-center gap-3">
      <View className="h-px flex-1 bg-[#173056]" />
      <View className="flex-row items-center gap-2 rounded-full border border-[#244269] bg-[#081A34] px-3 py-2">
        <Ionicons name="calendar" size={14} color="#9F7AEA" />
        <Text className="text-[12px] font-black text-[#DDE7F4]">{label}</Text>
        <View className="rounded-full bg-[#172A4A] px-2 py-0.5">
          <Text className="text-[10px] font-black text-[#9FB2CC]">{count}</Text>
        </View>
      </View>
      <View className="h-px flex-1 bg-[#173056]" />
    </View>
  )
}

function buildActivityRows(attempts: AttemptRow[]): ActivityListItem[] {
  const groups = new Map<string, AttemptRow[]>()

  attempts.forEach((attempt) => {
    const key = getAttemptDateKey(attempt.attempted_at)
    const current = groups.get(key) || []
    current.push(attempt)
    groups.set(key, current)
  })

  const rows: ActivityListItem[] = []
  groups.forEach((groupAttempts, key) => {
    rows.push({
      kind: 'date',
      key: `date-${key}`,
      label: formatActivityGroupLabel(groupAttempts[0]?.attempted_at),
      count: groupAttempts.length,
    })
    groupAttempts.forEach((attempt) => {
      rows.push({ kind: 'attempt', key: `attempt-${attempt.id}`, attempt })
    })
  })

  return rows
}

function getAttemptDateKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatActivityGroupLabel(value?: string) {
  if (!value) return 'Actividad'
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (getAttemptDateKey(value) === getAttemptDateKey(today.toISOString())) return 'Hoy'
  if (getAttemptDateKey(value) === getAttemptDateKey(yesterday.toISOString())) return 'Ayer'

  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).replace(/^./, (character) => character.toUpperCase())
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
  isDetailLoading,
  onToggle,
}: {
  item: AttemptRow
  isExpanded: boolean
  isDetailLoading: boolean
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
  const submittedAnswer = getSubmittedAnswerText(item, answers)
  const explanation = question?.explanation?.trim() || 'Vuelve a practicar este contenido para reforzar el concepto.'
  const earnedPoints = Math.max(0, Number(item.earned_points ?? (isCorrect ? 10 : 0)))
  const formattedTime = formatAttemptTime(item.attempted_at)
  const reviewStatus = getStudentReviewStatus(item.manual_review_status, isCorrect)
  const reviewComments = Array.isArray(item.review_comments) ? item.review_comments : []
  const resultColor = reviewStatus.color

  return (
    <Pressable
      onPress={onToggle}
      className="mb-3 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4"
      style={{ borderColor: isExpanded ? '#4A64A8' : '#1A3155' }}
    >
      <View className="flex-row items-center gap-4">
        <View
          className="h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${resultColor}20` }}
        >
          <Ionicons name={reviewStatus.icon} size={26} color={resultColor} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="mb-1 flex-row flex-wrap items-center gap-2">
            <Text className="text-[15px] font-black text-white" numberOfLines={1}>
              {reviewStatus.label}
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
          <Text className="text-[12px] text-[#8FA7C7]">{formattedTime}</Text>
          <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: `${resultColor}20` }}>
            <Text className="text-[12px] font-black" style={{ color: resultColor }}>
              {earnedPoints > 0 ? `+${earnedPoints} XP` : '0 XP'}
            </Text>
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#8B5CF6" />
        </View>
      </View>

      {isExpanded ? (
        <View className="mt-4 border-t border-[#1A3155] pt-4">
          {isDetailLoading ? (
            <View className="items-center py-5">
              <ActivityIndicator color="#8B5CF6" />
              <Text className="mt-2 text-[12px] font-semibold text-[#8FA7C7]">Cargando feedback seguro...</Text>
            </View>
          ) : (
            <View className="gap-3">
              <DetailBlock icon="help-circle" label="Pregunta" value={questionText} />
              {question?.media_type ? (
                <QuestionMedia
                  questionId={question.id}
                  type={question.media_type}
                  altText={question.media_alt_text}
                  caption={question.media_caption}
                  compact
                />
              ) : null}
              <DetailBlock icon="person-circle" label="Tu respuesta" value={submittedAnswer} highlightColor={resultColor} />

              {reviewStatus.waiting ? (
                <View className="rounded-2xl border p-4" style={{ borderColor: `${resultColor}70`, backgroundColor: `${resultColor}12` }}>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name={reviewStatus.icon} size={20} color={resultColor} />
                    <Text className="text-[13px] font-black" style={{ color: resultColor }}>{reviewStatus.label}</Text>
                  </View>
                  <Text className="mt-2 text-[12px] leading-5 text-[#AFC2DB]">{reviewStatus.description}</Text>
                </View>
              ) : (
                <>
                  <DetailBlock
                    icon="bulb"
                    label="Feedback de aprendizaje"
                    value={explanation}
                    highlightColor={isCorrect ? '#70E0A5' : '#FBBF24'}
                  />
                  <View className="flex-row items-start gap-3 rounded-xl border border-[#234166] bg-[#081B36] p-3">
                    <Ionicons name="shield-checkmark" size={18} color="#67C7FF" />
                    <Text className="min-w-0 flex-1 text-[12px] leading-5 text-[#AFC2DB]">
                      Para proteger el contenido del curso, el historial no muestra una plantilla completa de soluciones. Puedes volver a practicar el tema para comprobar la respuesta.
                    </Text>
                  </View>
                </>
              )}

              {reviewComments.length > 0 ? (
                <View className="rounded-2xl border border-[#3A315E] bg-[#17152C] p-4">
                  <View className="mb-3 flex-row items-center gap-2">
                    <Ionicons name="chatbubble-ellipses" size={18} color="#A78BFA" />
                    <Text className="text-[13px] font-black text-[#D8CCFF]">Comentarios del profesor</Text>
                  </View>
                  <View className="gap-3">
                    {reviewComments.map((comment) => (
                      <View key={comment.id} className="rounded-xl bg-[#211E3A] p-3">
                        <View className="flex-row items-center justify-between gap-3">
                          <Text className="min-w-0 flex-1 text-[11px] font-black text-[#C4B5FD]" numberOfLines={1}>{comment.author_name || 'Profesor'}</Text>
                          <Text className="text-[10px] text-[#8FA7C7]">{formatAttemptDate(comment.created_at)}</Text>
                        </View>
                        <Text className="mt-2 text-[12px] leading-5 text-[#E7E2FF]">{comment.body}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : item.review_notes ? (
                <DetailBlock icon="chatbubble-ellipses" label="Comentario del profesor" value={item.review_notes} highlightColor="#A78BFA" />
              ) : null}

              <View className="flex-row flex-wrap gap-3">
                <MiniMetric icon="timer" label="Tiempo empleado" value={formatTimeTaken(item.time_taken_seconds)} />
                <MiniMetric icon="flash" label="XP ganado" value={`${earnedPoints} XP`} />
                <MiniMetric icon="school" label="Clase" value={subjectName} />
                <MiniMetric icon="pricetag" label="Tema" value={topicTitle} />
                {item.hint_used ? <MiniMetric icon="bulb" label="Pista" value="Usada" /> : null}
                {item.was_skipped ? <MiniMetric icon="play-skip-forward" label="Estado" value="Saltada" /> : null}
              </View>
            </View>
          )}
        </View>
      ) : null}
    </Pressable>
  )
}

function getStudentReviewStatus(status: string | null | undefined, isCorrect: boolean) {
  const normalized = status || 'not_required'
  if (normalized === 'pending') {
    return { label: 'Pendiente de revisión', color: '#F59E0B', icon: 'time' as const, waiting: true, description: 'Tu profesor todavía tiene que revisar esta respuesta abierta.' }
  }
  if (normalized === 'in_review') {
    return { label: 'En revisión', color: '#38BDF8', icon: 'eye' as const, waiting: true, description: 'Tu profesor está revisando la respuesta. La solución se mostrará cuando termine.' }
  }
  if (normalized === 'needs_changes') {
    return { label: 'Necesita cambios', color: '#A78BFA', icon: 'refresh-circle' as const, waiting: true, description: 'Consulta los comentarios del profesor y vuelve a practicar este tema.' }
  }
  if (normalized === 'approved') {
    return { label: 'Respuesta aprobada', color: '#43D991', icon: 'checkmark-circle' as const, waiting: false, description: '' }
  }
  if (normalized === 'rejected') {
    return { label: 'Respuesta revisada', color: '#FB7185', icon: 'close-circle' as const, waiting: false, description: '' }
  }
  return isCorrect
    ? { label: 'Respuesta correcta', color: '#43D991', icon: 'checkmark-circle' as const, waiting: false, description: '' }
    : { label: 'Respuesta incorrecta', color: '#FB7185', icon: 'close-circle' as const, waiting: false, description: '' }
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

function getSubmittedAnswerText(attempt: AttemptRow, answers: AttemptAnswer[]) {
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

function formatAttemptTime(value: string) {
  return new Date(value).toLocaleTimeString('es-ES', {
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
