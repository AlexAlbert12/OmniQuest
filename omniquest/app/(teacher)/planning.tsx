import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
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
import {
  endOfMonthExclusive,
  formatTaskDate,
  getTaskPriorityMeta,
  getTaskStatusLabel,
  sameCalendarDay,
  startOfMonth,
  type LearningTask,
  type LearningTaskPage,
  type LearningTaskStatus,
} from '../../lib/learningTasks'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import MonthCalendar from '../../components/planning/MonthCalendar'
import LearningTaskEditorModal from '../../components/teacher/LearningTaskEditorModal'

type SubjectOption = { id: number; name: string; theme_color: string | null }
type ClassroomOption = { id: number; subject_id: number; name: string }
type TopicOption = { id: number; subject_id: number; classroom_id: number; title: string }

type StatusFilter = 'all' | LearningTaskStatus

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'published', label: 'Publicadas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'closed', label: 'Cerradas' },
]

export default function TeacherPlanningScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { colors, accentColor } = useAppTheme()
  const isDesktop = width >= 1080
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [tasks, setTasks] = useState<LearningTask[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [topics, setTopics] = useState<TopicOption[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<LearningTask | null>(null)

  const fetchPlanning = useCallback(async () => {
    try {
      setErrorMessage(null)
      const { data: sessionData } = await supabase.auth.getSession()
      const teacherId = sessionData.session?.user.id
      if (!teacherId) throw new Error('No se ha encontrado la sesión del profesor.')

      const from = startOfMonth(month)
      const to = endOfMonthExclusive(month)
      const [tasksResult, subjectsResult, classroomsResult, topicsResult] = await Promise.all([
        (supabase.rpc as any)('get_teacher_learning_tasks_page', {
          p_subject_id: null,
          p_classroom_id: null,
          p_status: statusFilter === 'all' ? null : statusFilter,
          p_search: search.trim() || null,
          p_from: from.toISOString(),
          p_to: to.toISOString(),
          p_limit: 100,
          p_offset: 0,
        }),
        supabase.from('subjects').select('id, name, theme_color').eq('teacher_id', teacherId).eq('is_archived', false).order('name'),
        supabase.from('classrooms').select('id, subject_id, name').neq('active', false).order('name'),
        supabase.from('subject_topics').select('id, subject_id, classroom_id, title').eq('active', true).order('sort_order'),
      ])

      if (tasksResult.error) throw tasksResult.error
      if (subjectsResult.error) throw subjectsResult.error
      if (classroomsResult.error) throw classroomsResult.error
      if (topicsResult.error) throw topicsResult.error

      const payload = (tasksResult.data || { items: [], total: 0 }) as LearningTaskPage
      const teacherSubjects = (subjectsResult.data || []) as SubjectOption[]
      const subjectIds = new Set(teacherSubjects.map((item) => item.id))
      setTasks(payload.items || [])
      setSubjects(teacherSubjects)
      setClassrooms(((classroomsResult.data || []) as ClassroomOption[]).filter((item) => subjectIds.has(item.subject_id)))
      setTopics(((topicsResult.data || []) as TopicOption[]).filter((item) => subjectIds.has(item.subject_id)))
    } catch (error: any) {
      console.error('Error cargando planificación:', error)
      setErrorMessage(error?.message || 'No se pudo cargar la planificación docente.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [month, search, statusFilter])

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => void fetchPlanning(), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [fetchPlanning, search]))

  const visibleTasks = useMemo(() => {
    if (!selectedDate) return tasks
    return tasks.filter((task) => sameCalendarDay(new Date(task.due_at), selectedDate))
  }, [selectedDate, tasks])

  const metrics = useMemo(() => ({
    published: tasks.filter((task) => task.status === 'published').length,
    drafts: tasks.filter((task) => task.status === 'draft').length,
    highPriority: tasks.filter((task) => task.priority === 'high' && task.status !== 'closed').length,
    completion: tasks.reduce((sum, task) => sum + Number(task.completed_count || 0), 0),
  }), [tasks])

  const openCreate = () => {
    setEditingTask(null)
    setEditorOpen(true)
  }

  const confirmDelete = (task: LearningTask) => {
    const run = async () => {
      try {
        const { error } = await (supabase.rpc as any)('delete_learning_task', { p_task_id: task.id })
        if (error) throw error
        await fetchPlanning()
      } catch (error: any) {
        showAlert('No se pudo eliminar', error?.message || 'Inténtalo de nuevo.')
      }
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`¿Eliminar la tarea "${task.title}"?`)) void run()
      return
    }
    Alert.alert('Eliminar tarea', `¿Quieres eliminar "${task.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void run() },
    ])
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar activeSection="planning" subjectsCount={subjects.length} onSignOut={handleSignOut} />
        ) : null}

        <View className="flex-1">
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: isDesktop ? 32 : 16, paddingTop: isDesktop ? 30 : 22, paddingBottom: isDesktop ? 48 : MOBILE_BOTTOM_NAV_SPACER + 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchPlanning() }} tintColor={accentColor} />}
          >
            <TeacherPageHeader
              icon="calendar-outline"
              iconColor="#60A5FA"
              isDesktop={isDesktop}
              title="Planificación docente"
              mobileTitle="Planificación"
              subtitle="Organiza tareas, fechas límite y objetivos para cada clase."
              actions={(
                <Pressable
                  accessibilityRole="button"
                  onPress={openCreate}
                  style={({ pressed }) => ({
                    minHeight: 46,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: accentColor,
                    opacity: pressed ? 0.78 : 1,
                  })}
                >
                  <Ionicons name="add" size={21} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>Nueva tarea</Text>
                </Pressable>
              )}
            />

            <View className={isDesktop ? 'flex-row gap-4' : 'flex-row flex-wrap gap-3'}>
              <MobileMetricCard icon="send-outline" label="Publicadas" value={String(metrics.published)} color="#38BDF8" compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
              <MobileMetricCard icon="document-outline" label="Borradores" value={String(metrics.drafts)} color="#A78BFA" compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
              <MobileMetricCard icon="alert-circle-outline" label="Prioridad alta" value={String(metrics.highPriority)} color="#F59E0B" compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
              <MobileMetricCard icon="checkmark-done-outline" label="Entregas marcadas" value={String(metrics.completion)} color="#34D399" compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            </View>

            <View className={isDesktop ? 'mt-6 flex-row items-start gap-5' : 'mt-5 gap-5'}>
              <View className={isDesktop ? 'w-[420px]' : ''}>
                <MonthCalendar
                  month={month}
                  selectedDate={selectedDate}
                  tasks={tasks}
                  onMonthChange={(next) => { setMonth(next); setSelectedDate(null) }}
                  onSelectDate={(date) => setSelectedDate((current) => current && sameCalendarDay(current, date) ? null : date)}
                />
              </View>

              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <View
                    className="min-w-[220px] flex-1 flex-row items-center rounded-2xl border px-3"
                    style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                  >
                    <Ionicons name="search" size={19} color={colors.textMuted} />
                    <TextInput
                      accessibilityLabel="Buscar tareas"
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Buscar tarea, curso o clase"
                      placeholderTextColor={colors.textMuted}
                      style={{ minHeight: 46, minWidth: 0, flex: 1, paddingHorizontal: 10, color: colors.text, fontSize: 13, fontWeight: '600' }}
                    />
                  </View>
                  {selectedDate ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setSelectedDate(null)}
                      style={({ pressed }) => ({ minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 })}
                    >
                      <Ionicons name="close" size={18} color={colors.text} />
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>Todos los días</Text>
                    </Pressable>
                  ) : null}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
                  {statusFilters.map((filter) => {
                    const active = statusFilter === filter.value
                    return (
                      <Pressable
                        key={filter.value}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => setStatusFilter(filter.value)}
                        style={({ pressed }) => ({
                          minHeight: 40,
                          borderWidth: 1,
                          borderColor: active ? accentColor : colors.border,
                          borderRadius: 13,
                          paddingHorizontal: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: active ? withAlpha(accentColor, '20') : colors.surface,
                          opacity: pressed ? 0.72 : 1,
                        })}
                      >
                        <Text style={{ color: active ? accentColor : colors.textSecondary, fontSize: 12, fontWeight: '800' }}>{filter.label}</Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>

                <View className="mb-3 flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>
                      {selectedDate ? `Tareas del ${selectedDate.toLocaleDateString('es-ES')}` : 'Tareas del mes'}
                    </Text>
                    <Text style={{ marginTop: 2, color: colors.textMuted, fontSize: 12 }}>{visibleTasks.length} elementos visibles</Text>
                  </View>
                </View>

                {loading ? (
                  <View className="items-center py-16"><ActivityIndicator size="large" color={accentColor} /></View>
                ) : errorMessage ? (
                  <View className="items-center rounded-3xl border border-dashed p-8" style={{ borderColor: colors.danger, backgroundColor: withAlpha(colors.danger, '10') }}>
                    <Ionicons name="alert-circle-outline" size={42} color={colors.danger} />
                    <Text className="mt-3 text-center font-black" style={{ color: colors.text }}>No se pudo cargar la planificación</Text>
                    <Text className="mt-2 text-center text-[12px] leading-5" style={{ color: colors.textMuted }}>{errorMessage}</Text>
                  </View>
                ) : visibleTasks.length === 0 ? (
                  <View className="items-center rounded-3xl border border-dashed p-8" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                    <Ionicons name="calendar-clear-outline" size={46} color={colors.textMuted} />
                    <Text className="mt-3 text-center text-[17px] font-black" style={{ color: colors.text }}>No hay tareas en esta fecha</Text>
                    <Text className="mt-2 max-w-[380px] text-center text-[12px] leading-5" style={{ color: colors.textMuted }}>Crea una tarea para convertir el calendario en una guía clara de trabajo para el alumnado.</Text>
                    <Pressable onPress={openCreate} className="mt-5 rounded-2xl px-5 py-3" style={{ backgroundColor: accentColor }}>
                      <Text className="font-black text-white">Crear tarea</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className="gap-3">
                    {visibleTasks.map((task) => (
                      <TeacherTaskCard
                        key={task.id}
                        task={task}
                        onEdit={() => { setEditingTask(task); setEditorOpen(true) }}
                        onDelete={() => confirmDelete(task)}
                      />
                    ))}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {!isDesktop ? <TeacherBottomNav active="planning" /> : null}
      <LearningTaskEditorModal
        visible={editorOpen}
        task={editingTask}
        defaultDate={selectedDate}
        subjects={subjects}
        classrooms={classrooms}
        topics={topics}
        onClose={() => { setEditorOpen(false); setEditingTask(null) }}
        onSaved={() => void fetchPlanning()}
      />
    </View>
  )
}

function TeacherTaskCard({ task, onEdit, onDelete }: { task: LearningTask; onEdit: () => void; onDelete: () => void }) {
  const { colors, accentColor } = useAppTheme()
  const priority = getTaskPriorityMeta(task.priority)
  const completionPercent = task.student_count ? Math.round((Number(task.completed_count || 0) / task.student_count) * 100) : 0
  const courseColor = task.theme_color || accentColor

  return (
    <View className="overflow-hidden rounded-3xl border" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ height: 4, backgroundColor: courseColor }} />
      <View className="p-4">
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(courseColor, '22') }}>
            <Ionicons name="calendar" size={22} color={courseColor} />
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="min-w-0 flex-1 text-[15px] font-black" style={{ color: colors.text }} numberOfLines={2}>{task.title}</Text>
              <View className="rounded-full border px-2.5 py-1" style={{ borderColor: withAlpha(priority.color, '70'), backgroundColor: withAlpha(priority.color, '16') }}>
                <Text className="text-[10px] font-black" style={{ color: priority.color }}>{priority.label}</Text>
              </View>
            </View>
            <Text className="mt-1 text-[12px] font-semibold" style={{ color: colors.textSecondary }}>{task.subject_name} · {task.classroom_name}</Text>
            {task.topic_name ? <Text className="mt-1 text-[11px]" style={{ color: colors.textMuted }}>Tema: {task.topic_name}</Text> : null}
          </View>
        </View>

        {task.description ? <Text className="mt-3 text-[12px] leading-5" style={{ color: colors.textSecondary }} numberOfLines={3}>{task.description}</Text> : null}

        <View className="mt-4 flex-row flex-wrap items-center gap-3">
          <Meta icon="time-outline" text={formatTaskDate(task.due_at)} color={task.status === 'closed' ? colors.textMuted : '#FBBF24'} />
          <Meta icon="radio-button-on-outline" text={getTaskStatusLabel(task.status)} color={courseColor} />
          <Meta icon="people-outline" text={`${task.completed_count || 0}/${task.student_count || 0} completadas`} color="#34D399" />
        </View>

        <View className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.surfaceMuted }}>
          <View className="h-full rounded-full" style={{ width: `${Math.min(100, completionPercent)}%`, backgroundColor: '#34D399' }} />
        </View>

        <View className="mt-4 flex-row justify-end gap-2">
          <Pressable accessibilityRole="button" onPress={onEdit} className="min-h-[42px] flex-row items-center gap-2 rounded-xl border px-3" style={({ pressed }) => ({ borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
            <Text className="text-[12px] font-black" style={{ color: colors.textSecondary }}>Editar</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDelete} className="h-[42px] w-[42px] items-center justify-center rounded-xl border" style={({ pressed }) => ({ borderColor: withAlpha(colors.danger, '70'), backgroundColor: withAlpha(colors.danger, '12'), opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

function Meta({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon} size={15} color={color} />
      <Text className="text-[11px] font-bold" style={{ color }}>{text}</Text>
    </View>
  )
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`)
    return
  }
  Alert.alert(title, message)
}
