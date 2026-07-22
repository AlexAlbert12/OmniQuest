import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import PaginationControls from '../../components/ui/PaginationControls'
import AppTabs from '../../components/ui/AppTabs'

type ReviewStatus = 'pending' | 'in_review' | 'needs_changes' | 'approved' | 'rejected'
type ReviewRow = {
  id: number
  student_id: string
  student_name: string
  student_email: string | null
  question_id: number
  question_text: string
  answer_text: string | null
  answer_payload: unknown
  status: ReviewStatus
  attempted_at: string
  reviewed_at: string | null
  review_notes: string | null
  earned_points: number
  possible_points: number
  time_taken_seconds: number | null
  subject_id: number
  subject_name: string
  classroom_id: number
  classroom_name: string
  topic_id: number | null
  topic_name: string | null
  comments_count: number
  latest_comment: string | null
}
type ReviewPage = { items: ReviewRow[]; total: number }
type ReviewComment = { id: number; author_id: string; author_name: string; audience: 'student' | 'internal'; body: string; created_at: string }
type SubjectOption = { id: number; name: string }
type ClassroomOption = { id: number; subject_id: number; name: string }

const filters: { value: 'all' | ReviewStatus; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'needs_changes', label: 'Necesita cambios' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
]

export default function TeacherReviewsScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { colors, accentColor } = useAppTheme()
  const isDesktop = width >= 1080
  const pageSize = isDesktop ? 15 : 6
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [classroomId, setClassroomId] = useState<number | null>(null)
  const [status, setStatus] = useState<'all' | ReviewStatus>('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReviewRow | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      setErrorMessage(null)
      const { data: sessionData } = await supabase.auth.getSession()
      const teacherId = sessionData.session?.user.id
      if (!teacherId) throw new Error('No se ha encontrado la sesión del profesor.')

      const [queueResult, subjectsResult, classroomsResult] = await Promise.all([
        (supabase.rpc as any)('get_teacher_manual_review_queue', {
          p_subject_id: subjectId,
          p_classroom_id: classroomId,
          p_status: status === 'all' ? null : status,
          p_search: search.trim() || null,
          p_limit: pageSize,
          p_offset: page * pageSize,
        }),
        supabase.from('subjects').select('id, name').eq('teacher_id', teacherId).eq('is_archived', false).order('name'),
        supabase.from('classrooms').select('id, subject_id, name').neq('active', false).order('name'),
      ])
      if (queueResult.error) throw queueResult.error
      if (subjectsResult.error) throw subjectsResult.error
      if (classroomsResult.error) throw classroomsResult.error

      const payload = (queueResult.data || { items: [], total: 0 }) as ReviewPage
      const nextSubjects = (subjectsResult.data || []) as SubjectOption[]
      const subjectIds = new Set(nextSubjects.map((item) => item.id))
      setRows(payload.items || [])
      setTotal(Number(payload.total || 0))
      setSubjects(nextSubjects)
      setClassrooms(((classroomsResult.data || []) as ClassroomOption[]).filter((item) => subjectIds.has(item.subject_id)))
    } catch (error: any) {
      console.error('Error cargando cola de revisión:', error)
      setErrorMessage(error?.message || 'No se pudo cargar la cola de revisión.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [classroomId, page, pageSize, search, status, subjectId])

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => void fetchQueue(), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [fetchQueue, search]))

  const visibleClassrooms = useMemo(
    () => subjectId ? classrooms.filter((item) => item.subject_id === subjectId) : classrooms,
    [classrooms, subjectId]
  )
  const pageStats = useMemo(() => ({
    pending: rows.filter((row) => row.status === 'pending').length,
    inReview: rows.filter((row) => row.status === 'in_review').length,
    needsChanges: rows.filter((row) => row.status === 'needs_changes').length,
    final: rows.filter((row) => row.status === 'approved' || row.status === 'rejected').length,
  }), [rows])

  const openReview = async (row: ReviewRow) => {
    let nextRow = row
    if (row.status === 'pending' || row.status === 'needs_changes') {
      try {
        const { error } = await (supabase.rpc as any)('claim_open_answer_attempt', { p_attempt_history_id: row.id })
        if (!error) nextRow = { ...row, status: 'in_review' }
      } catch {
        // The detail can still be opened if another teacher/admin already claimed it.
      }
    }
    setSelected(nextRow)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 flex-row">
        {isDesktop ? <TeacherSidebar activeSection="reviews" subjectsCount={subjects.length} onSignOut={handleSignOut} /> : null}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: isDesktop ? 32 : 16, paddingTop: isDesktop ? 30 : 22, paddingBottom: isDesktop ? 48 : MOBILE_BOTTOM_NAV_SPACER + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchQueue() }} tintColor={accentColor} />}
        >
          <TeacherPageHeader
            icon="create"
            iconColor="#38BDF8"
            isDesktop={isDesktop}
            title="Revisión manual"
            subtitle="Corrige respuestas abiertas, deja comentarios y mantén una trazabilidad clara del proceso."
          />

          <View className="flex-row flex-wrap gap-3">
            <MobileMetricCard semantic="attention" label="Pendientes en página" value={String(pageStats.pending)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard icon="eye-outline" label="En revisión" value={String(pageStats.inReview)} color="#38BDF8" compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="audit" label="Necesita cambios" value={String(pageStats.needsChanges)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="success" label="Decisión final" value={String(pageStats.final)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
          </View>

          <View className="mt-5 flex-row items-center rounded-2xl border px-3" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
            <Ionicons name="search" size={19} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="Buscar respuestas abiertas"
              value={search}
              onChangeText={(value) => { setSearch(value); setPage(0) }}
              placeholder="Alumno, pregunta, respuesta o curso"
              placeholderTextColor={colors.textMuted}
              style={{ minHeight: 48, minWidth: 0, flex: 1, paddingHorizontal: 10, color: colors.text, fontSize: 13, fontWeight: '600' }}
            />
          </View>

          <FilterStrip
            values={filters}
            active={status}
            onChange={(value) => { setStatus(value); setPage(0) }}
          />
          <FilterStrip
            values={[{ value: 'all', label: 'Todos los cursos' }, ...subjects.map((item) => ({ value: String(item.id), label: item.name }))]}
            active={subjectId ? String(subjectId) : 'all'}
            onChange={(value) => { setSubjectId(value === 'all' ? null : Number(value)); setClassroomId(null); setPage(0) }}
          />
          {visibleClassrooms.length > 0 ? (
            <FilterStrip
              values={[{ value: 'all', label: 'Todas las clases' }, ...visibleClassrooms.map((item) => ({ value: String(item.id), label: item.name }))]}
              active={classroomId ? String(classroomId) : 'all'}
              onChange={(value) => { setClassroomId(value === 'all' ? null : Number(value)); setPage(0) }}
            />
          ) : null}

          {errorMessage ? (
            <View className="mb-4 flex-row items-center gap-2 rounded-2xl border p-3" style={{ borderColor: withAlpha(colors.danger, '80'), backgroundColor: withAlpha(colors.danger, '12') }}>
              <Ionicons name="alert-circle" size={19} color={colors.danger} />
              <Text className="min-w-0 flex-1 text-[12px] font-bold" style={{ color: colors.danger }}>{errorMessage}</Text>
            </View>
          ) : null}

          {loading ? (
            <View className="items-center py-20"><ActivityIndicator size="large" color={accentColor} /></View>
          ) : rows.length === 0 ? (
            <View className="items-center rounded-3xl border border-dashed p-9" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <Ionicons name="chatbox-ellipses-outline" size={48} color={colors.textMuted} />
              <Text className="mt-4 text-center text-[18px] font-black" style={{ color: colors.text }}>No hay respuestas en esta cola</Text>
              <Text className="mt-2 max-w-[430px] text-center text-[13px] leading-5" style={{ color: colors.textMuted }}>Las respuestas abiertas aparecerán aquí y podrás asignarles un estado, una decisión y comentarios visibles o internos.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {rows.map((row) => <ReviewQueueCard key={row.id} row={row} onOpen={() => void openReview(row)} />)}
            </View>
          )}

          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={total}
            compact={!isDesktop}
            onPrevious={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="reviews" /> : null}
      <ReviewDetailModal
        row={selected}
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        onChanged={async () => { setSelected(null); await fetchQueue() }}
      />
    </View>
  )
}

function ReviewQueueCard({ row, onOpen }: { row: ReviewRow; onOpen: () => void }) {
  const { colors } = useAppTheme()
  const meta = getReviewStatusMeta(row.status)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Revisar respuesta de ${row.student_name}`}
      onPress={onOpen}
      className="rounded-3xl border p-4"
      style={({ pressed }) => ({ borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.76 : 1 })}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(meta.color, '20') }}>
          <Ionicons name={meta.icon} size={24} color={meta.color} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="min-w-0 flex-1 text-[15px] font-black" style={{ color: colors.text }}>{row.student_name}</Text>
            <View className="rounded-full border px-2.5 py-1" style={{ borderColor: withAlpha(meta.color, '70'), backgroundColor: withAlpha(meta.color, '15') }}>
              <Text className="text-[10px] font-black" style={{ color: meta.color }}>{meta.label}</Text>
            </View>
          </View>
          <Text className="mt-1 text-[12px] font-bold" style={{ color: colors.textSecondary }}>{row.subject_name} · {row.classroom_name}</Text>
          <Text className="mt-2 text-[13px] font-semibold" style={{ color: colors.text }} numberOfLines={2}>{row.question_text}</Text>
          <View className="mt-2 rounded-2xl p-3" style={{ backgroundColor: colors.surfaceMuted }}>
            <Text className="text-[12px] leading-5" style={{ color: colors.textSecondary }} numberOfLines={3}>{row.answer_text || 'Sin respuesta escrita'}</Text>
          </View>
          <View className="mt-3 flex-row flex-wrap items-center gap-3">
            <Meta icon="time-outline" text={formatDate(row.attempted_at)} color={colors.textMuted} />
            <Meta icon="chatbubble-ellipses-outline" text={`${row.comments_count || 0} comentarios`} color="#A78BFA" />
            <Meta icon="flash-outline" text={`${row.earned_points}/${row.possible_points} XP`} color="#FBBF24" />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </Pressable>
  )
}

function ReviewDetailModal({ row, visible, onClose, onChanged }: { row: ReviewRow | null; visible: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const { colors, accentColor } = useAppTheme()
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [comment, setComment] = useState('')
  const [audience, setAudience] = useState<'student' | 'internal'>('student')
  const [loading, setLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<ReviewStatus | 'comment' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadThread = useCallback(async () => {
    if (!row) return
    setLoading(true)
    setErrorMessage(null)
    try {
      const { data, error } = await (supabase.rpc as any)('get_manual_review_thread', { p_attempt_history_id: row.id })
      if (error) throw error
      setComments((data || []) as ReviewComment[])
    } catch (error: any) {
      setErrorMessage(error?.message || 'No se pudo cargar el hilo.')
    } finally {
      setLoading(false)
    }
  }, [row])

  React.useEffect(() => {
    if (visible) void loadThread()
    else { setComments([]); setComment(''); setErrorMessage(null) }
  }, [loadThread, visible])

  const addComment = async () => {
    if (!row || !comment.trim()) return
    setBusyAction('comment')
    try {
      const { error } = await (supabase.rpc as any)('add_manual_review_comment', {
        p_attempt_history_id: row.id,
        p_body: comment.trim(),
        p_audience: audience,
      })
      if (error) throw error
      setComment('')
      await loadThread()
    } catch (error: any) {
      setErrorMessage(error?.message || 'No se pudo guardar el comentario.')
    } finally {
      setBusyAction(null)
    }
  }

  const decide = async (status: 'approved' | 'rejected' | 'needs_changes') => {
    if (!row) return
    setBusyAction(status)
    setErrorMessage(null)
    try {
      const { error } = await (supabase.rpc as any)('review_open_answer_attempt_v2', {
        p_attempt_history_id: row.id,
        p_status: status,
        p_notes: comment.trim() || null,
        p_comment_audience: audience,
      })
      if (error) throw error
      await onChanged()
    } catch (error: any) {
      setErrorMessage(error?.message || 'No se pudo guardar la revisión.')
    } finally {
      setBusyAction(null)
    }
  }

  if (!row) return null
  const statusMeta = getReviewStatusMeta(row.status)

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable accessibilityViewIsModal onPress={() => undefined} style={[styles.modalPanel, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.modalHeaderCopy}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Revisar respuesta abierta</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>{row.student_name} · {row.subject_name}</Text>
            </View>
            <Pressable accessibilityLabel="Cerrar revisión" accessibilityRole="button" onPress={onClose} style={[styles.closeButton, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View className="flex-row flex-wrap items-center gap-2">
              <View className="rounded-full border px-3 py-1.5" style={{ borderColor: withAlpha(statusMeta.color, '70'), backgroundColor: withAlpha(statusMeta.color, '15') }}>
                <Text className="text-[11px] font-black" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
              </View>
              <Text className="text-[11px] font-bold" style={{ color: colors.textMuted }}>{formatDate(row.attempted_at)}</Text>
            </View>

            <Section title="Pregunta">
              <Text style={[styles.bodyText, { color: colors.text }]}>{row.question_text}</Text>
            </Section>
            <Section title="Respuesta del alumno">
              <Text style={[styles.answerText, { color: colors.textSecondary }]}>{row.answer_text || 'Sin respuesta escrita'}</Text>
            </Section>

            <View className="flex-row flex-wrap gap-3">
              <SmallMetric icon="flash-outline" label="XP posibles" value={String(row.possible_points)} color="#FBBF24" />
              <SmallMetric icon="timer-outline" label="Tiempo" value={row.time_taken_seconds == null ? '—' : `${row.time_taken_seconds}s`} color="#60A5FA" />
              <SmallMetric icon="chatbubbles-outline" label="Comentarios" value={String(comments.length)} color="#A78BFA" />
            </View>

            <Section title="Hilo de revisión">
              {loading ? <ActivityIndicator color={accentColor} /> : comments.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aún no hay comentarios. Añade feedback visible para el alumno o una nota interna.</Text>
              ) : (
                <View className="gap-2">
                  {comments.map((item) => (
                    <View key={item.id} className="rounded-2xl border p-3" style={{ borderColor: colors.border, backgroundColor: item.audience === 'internal' ? withAlpha('#F59E0B', '10') : colors.surfaceMuted }}>
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="font-black" style={{ color: colors.text }}>{item.author_name}</Text>
                        <Text className="text-[10px] font-bold" style={{ color: item.audience === 'internal' ? '#F59E0B' : '#60A5FA' }}>{item.audience === 'internal' ? 'Nota interna' : 'Visible para alumno'}</Text>
                      </View>
                      <Text className="mt-2 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{item.body}</Text>
                      <Text className="mt-2 text-[10px]" style={{ color: colors.textMuted }}>{formatDate(item.created_at)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Section>

            <Section title="Nuevo comentario o decisión">
              <View className="mb-2 flex-row gap-2">
                {(['student', 'internal'] as const).map((value) => {
                  const active = audience === value
                  return (
                    <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setAudience(value)} className="min-h-[40px] flex-1 items-center justify-center rounded-xl border" style={{ borderColor: active ? accentColor : colors.border, backgroundColor: active ? withAlpha(accentColor, '18') : colors.surfaceMuted }}>
                      <Text className="text-[11px] font-black" style={{ color: active ? accentColor : colors.textMuted }}>{value === 'student' ? 'Visible para alumno' : 'Nota interna'}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <TextInput
                accessibilityLabel="Comentario de revisión"
                value={comment}
                onChangeText={setComment}
                placeholder="Explica qué está bien o qué debe mejorar..."
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                style={[styles.commentInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              />
              <Pressable accessibilityRole="button" disabled={!comment.trim() || busyAction !== null} onPress={() => void addComment()} className="mt-2 min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl border" style={{ borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: !comment.trim() || busyAction ? 0.5 : 1 }}>
                {busyAction === 'comment' ? <ActivityIndicator size="small" color={accentColor} /> : <Ionicons name="chatbubble-ellipses-outline" size={18} color={accentColor} />}
                <Text className="text-[12px] font-black" style={{ color: accentColor }}>Añadir comentario sin cerrar</Text>
              </Pressable>
            </Section>

            {errorMessage ? <Text className="mt-3 text-[12px] font-bold" style={{ color: colors.danger }}>{errorMessage}</Text> : null}
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <DecisionButton label="Necesita cambios" icon="refresh-outline" color="#A78BFA" busy={busyAction === 'needs_changes'} disabled={busyAction !== null} onPress={() => void decide('needs_changes')} />
            <DecisionButton label="Rechazar" icon="close" color="#FB7185" busy={busyAction === 'rejected'} disabled={busyAction !== null} onPress={() => void decide('rejected')} />
            <DecisionButton label="Aprobar" icon="checkmark" color="#34D399" busy={busyAction === 'approved'} disabled={busyAction !== null} onPress={() => void decide('approved')} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function FilterStrip<T extends string>({ values, active, onChange }: { values: { value: T; label: string }[]; active: T; onChange: (value: T) => void }) {
  return (
    <View className="mt-3">
      <AppTabs<T>
        accessibilityLabel="Filtros de revisión"
        compact
        role="teacher"
        items={values.map((item) => ({ key: item.value, label: item.label }))}
        value={active}
        onChange={onChange}
      />
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useAppTheme()
  return (
    <View className="mt-5">
      <Text className="mb-2 text-[11px] font-black uppercase tracking-wide" style={{ color: colors.textMuted }}>{title}</Text>
      {children}
    </View>
  )
}

function SmallMetric({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  const { colors } = useAppTheme()
  return (
    <View className="min-w-[120px] flex-1 rounded-2xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceMuted }}>
      <View className="flex-row items-center gap-2"><Ionicons name={icon} size={16} color={color} /><Text className="text-[10px] font-black" style={{ color: colors.textMuted }}>{label}</Text></View>
      <Text className="mt-2 text-[18px] font-black" style={{ color }}>{value}</Text>
    </View>
  )
}

function DecisionButton({ label, icon, color, busy, disabled, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 46, flex: 1, borderWidth: 1, borderColor: withAlpha(color, '80'), borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: withAlpha(color, '18'), opacity: disabled && !busy ? 0.48 : pressed ? 0.72 : 1 })}>
      {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={18} color={color} />}
      <Text className="text-[11px] font-black" style={{ color }} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

function Meta({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }) {
  return <View className="flex-row items-center gap-1.5"><Ionicons name={icon} size={15} color={color} /><Text className="text-[11px] font-bold" style={{ color }}>{text}</Text></View>
}

function getReviewStatusMeta(status: ReviewStatus | string) {
  const map: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    pending: { label: 'Pendiente', color: '#F59E0B', icon: 'time-outline' },
    in_review: { label: 'En revisión', color: '#38BDF8', icon: 'eye-outline' },
    needs_changes: { label: 'Necesita cambios', color: '#A78BFA', icon: 'refresh-outline' },
    approved: { label: 'Aprobada', color: '#34D399', icon: 'checkmark-circle-outline' },
    rejected: { label: 'Rechazada', color: '#FB7185', icon: 'close-circle-outline' },
  }
  return map[status] || { label: status, color: '#94A3B8', icon: 'help-circle-outline' as const }
}

function formatDate(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(1, 6, 17, 0.84)' },
  modalPanel: { width: '100%', maxWidth: 840, maxHeight: '94%', overflow: 'hidden', borderWidth: 1, borderRadius: 26, ...(Platform.OS === 'web' ? ({ boxShadow: '0 30px 90px rgba(0,0,0,0.5)' } as any) : {}) },
  modalHeader: { padding: 17, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalHeaderCopy: { minWidth: 0, flex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  modalSubtitle: { marginTop: 3, fontSize: 12 },
  closeButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 18, paddingBottom: 26 },
  bodyText: { fontSize: 15, lineHeight: 23, fontWeight: '800' },
  answerText: { padding: 14, borderRadius: 16, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  emptyText: { paddingVertical: 12, fontSize: 12, lineHeight: 19, textAlign: 'center' },
  commentInput: { minHeight: 100, borderWidth: 1, borderRadius: 15, padding: 13, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  modalFooter: { padding: 13, borderTopWidth: 1, flexDirection: 'row', gap: 8 },
})
