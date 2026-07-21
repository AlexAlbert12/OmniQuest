import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import {
  formatTaskDate,
  getTaskPriorityMeta,
  isTaskOverdue,
  type LearningTask,
  type LearningTaskPage,
  type StudentTaskFilter,
} from '../../lib/learningTasks'
import StudentSidebar from '../../components/student/StudentSidebar'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import PaginationControls from '../../components/ui/PaginationControls'

type Profile = { alias: string | null; avatar: string | null; points: number | null }

const filters: { value: StudentTaskFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'upcoming', label: 'Próximas', icon: 'time-outline' },
  { value: 'overdue', label: 'Atrasadas', icon: 'alert-circle-outline' },
  { value: 'completed', label: 'Completadas', icon: 'checkmark-circle-outline' },
  { value: 'all', label: 'Todas', icon: 'list-outline' },
]

export default function StudentTasksScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { colors, accentColor } = useAppTheme()
  const isDesktop = width >= 1024
  const pageSize = isDesktop ? 12 : 6
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tasks, setTasks] = useState<LearningTask[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<StudentTaskFilter>('upcoming')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      setErrorMessage(null)
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('No se ha encontrado la sesión del alumno.')

      const [profileResult, tasksResult] = await Promise.all([
        supabase.from('profiles').select('alias, avatar, points').eq('id', userId).single(),
        (supabase.rpc as any)('get_student_learning_tasks_page', {
          p_filter: filter,
          p_search: search.trim() || null,
          p_limit: pageSize,
          p_offset: page * pageSize,
        }),
      ])
      if (profileResult.error) throw profileResult.error
      if (tasksResult.error) throw tasksResult.error

      const payload = (tasksResult.data || { items: [], total: 0 }) as LearningTaskPage
      setProfile(profileResult.data as Profile)
      setTasks(payload.items || [])
      setTotal(Number(payload.total || 0))
    } catch (error: any) {
      console.error('Error cargando tareas del alumno:', error)
      setErrorMessage(error?.message || 'No se pudo cargar la planificación.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter, page, pageSize, search])

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => void fetchTasks(), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [fetchTasks, search]))

  const toggleCompleted = async (task: LearningTask) => {
    setBusyTaskId(task.id)
    try {
      const { error } = await (supabase.rpc as any)('set_learning_task_completed', {
        p_task_id: task.id,
        p_completed: !task.is_completed,
      })
      if (error) throw error
      if (tasks.length === 1 && page > 0) setPage((current) => Math.max(0, current - 1))
      else await fetchTasks()
    } catch (error: any) {
      setErrorMessage(error?.message || 'No se pudo actualizar la tarea.')
    } finally {
      setBusyTaskId(null)
    }
  }

  const points = profile?.points || 0
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const visibleMetrics = useMemo(() => ({
    current: filter === 'upcoming' ? total : tasks.filter((task) => !task.is_completed && !isTaskOverdue(task)).length,
    overdue: filter === 'overdue' ? total : tasks.filter((task) => isTaskOverdue(task)).length,
    completed: filter === 'completed' ? total : tasks.filter((task) => task.is_completed).length,
  }), [filter, tasks, total])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 flex-row">
        {isDesktop && profile ? (
          <StudentSidebar
            activeSection="tasks"
            alias={profile.alias || 'Estudiante'}
            avatar={profile.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={handleSignOut}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: isDesktop ? 32 : 16, paddingTop: isDesktop ? 30 : 22, paddingBottom: isDesktop ? 48 : MOBILE_BOTTOM_NAV_SPACER + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchTasks() }} tintColor={accentColor} />}
        >
          <StudentPageHeader
            icon="calendar-outline"
            iconColor="#60A5FA"
            isDesktop={isDesktop}
            title="Mis tareas"
            subtitle="Consulta las fechas límite y organiza tu siguiente sesión de aprendizaje."
          />

          <View className="flex-row flex-wrap gap-3">
            <MobileMetricCard icon="time-outline" label="Próximas" value={String(visibleMetrics.current)} color="#60A5FA" compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard icon="alert-circle-outline" label="Atrasadas" value={String(visibleMetrics.overdue)} color="#F59E0B" compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard icon="checkmark-done-outline" label="Completadas" value={String(visibleMetrics.completed)} color="#34D399" compact style={isDesktop ? { flex: 1 } : { width: '100%' }} />
          </View>

          <View className="mt-5 flex-row items-center rounded-2xl border px-3" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
            <Ionicons name="search" size={19} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="Buscar tareas"
              value={search}
              onChangeText={(value) => { setSearch(value); setPage(0) }}
              placeholder="Buscar por tarea o curso"
              placeholderTextColor={colors.textMuted}
              style={{ minHeight: 48, minWidth: 0, flex: 1, paddingHorizontal: 10, color: colors.text, fontSize: 13, fontWeight: '600' }}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
            {filters.map((item) => {
              const active = item.value === filter
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => { setFilter(item.value); setPage(0) }}
                  style={({ pressed }) => ({
                    minHeight: 42,
                    borderWidth: 1,
                    borderColor: active ? accentColor : colors.border,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    backgroundColor: active ? withAlpha(accentColor, '20') : colors.surface,
                    opacity: pressed ? 0.72 : 1,
                  })}
                >
                  <Ionicons name={item.icon} size={17} color={active ? accentColor : colors.textMuted} />
                  <Text style={{ color: active ? accentColor : colors.textSecondary, fontSize: 12, fontWeight: '900' }}>{item.label}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {errorMessage ? (
            <View className="mb-4 flex-row items-center gap-2 rounded-2xl border p-3" style={{ borderColor: withAlpha(colors.danger, '80'), backgroundColor: withAlpha(colors.danger, '12') }}>
              <Ionicons name="alert-circle" size={19} color={colors.danger} />
              <Text className="min-w-0 flex-1 text-[12px] font-bold" style={{ color: colors.danger }}>{errorMessage}</Text>
            </View>
          ) : null}

          {loading ? (
            <View className="items-center py-20"><ActivityIndicator size="large" color={accentColor} /></View>
          ) : tasks.length === 0 ? (
            <View className="items-center rounded-3xl border border-dashed p-9" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(accentColor, '20') }}>
                <Ionicons name={filter === 'completed' ? 'checkmark-done' : 'calendar-clear-outline'} size={32} color={accentColor} />
              </View>
              <Text className="mt-4 text-center text-[18px] font-black" style={{ color: colors.text }}>
                {filter === 'completed' ? 'Aún no has marcado tareas como completadas' : 'No hay tareas en esta sección'}
              </Text>
              <Text className="mt-2 max-w-[420px] text-center text-[13px] leading-5" style={{ color: colors.textMuted }}>
                Las tareas publicadas por tus profesores aparecerán aquí con su curso, tema y fecha límite.
              </Text>
            </View>
          ) : (
            <View className={isDesktop ? 'flex-row flex-wrap gap-4' : 'gap-3'}>
              {tasks.map((task) => (
                <StudentTaskCard
                  key={task.id}
                  task={task}
                  busy={busyTaskId === task.id}
                  isDesktop={isDesktop}
                  onOpenCourse={() => router.push(`/(student)/class/${task.subject_id}` as any)}
                  onToggleCompleted={() => void toggleCompleted(task)}
                />
              ))}
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
      {!isDesktop ? <StudentBottomNav active="tasks" /> : null}
    </View>
  )
}

function StudentTaskCard({
  task,
  busy,
  isDesktop,
  onOpenCourse,
  onToggleCompleted,
}: {
  task: LearningTask
  busy: boolean
  isDesktop: boolean
  onOpenCourse: () => void
  onToggleCompleted: () => void
}) {
  const { colors, accentColor } = useAppTheme()
  const courseColor = task.theme_color || accentColor
  const priority = getTaskPriorityMeta(task.priority)
  const overdue = isTaskOverdue(task)
  const statusColor = task.is_completed ? '#34D399' : overdue ? '#FB7185' : '#60A5FA'
  const statusLabel = task.is_completed ? 'Completada' : overdue ? 'Fuera de plazo' : 'Pendiente'

  return (
    <View
      className="overflow-hidden rounded-3xl border"
      style={{ width: isDesktop ? '48.8%' : '100%', borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <View style={{ height: 5, backgroundColor: courseColor }} />
      <View className="p-4">
        <View className="flex-row items-start gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(courseColor, '22') }}>
            <Ionicons name={task.is_completed ? 'checkmark-done' : 'rocket-outline'} size={24} color={courseColor} />
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="min-w-0 flex-1 text-[16px] font-black" style={{ color: colors.text }} numberOfLines={2}>{task.title}</Text>
              <View className="rounded-full border px-2.5 py-1" style={{ borderColor: withAlpha(statusColor, '70'), backgroundColor: withAlpha(statusColor, '16') }}>
                <Text className="text-[10px] font-black" style={{ color: statusColor }}>{statusLabel}</Text>
              </View>
            </View>
            <Text className="mt-1 text-[12px] font-bold" style={{ color: courseColor }}>{task.subject_name}</Text>
            <Text className="mt-0.5 text-[11px]" style={{ color: colors.textMuted }}>{task.classroom_name}{task.topic_name ? ` · ${task.topic_name}` : ''}</Text>
          </View>
        </View>

        {task.description ? <Text className="mt-3 text-[12px] leading-5" style={{ color: colors.textSecondary }} numberOfLines={3}>{task.description}</Text> : null}

        <View className="mt-4 flex-row flex-wrap gap-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="time-outline" size={16} color={statusColor} />
            <Text className="text-[11px] font-black" style={{ color: statusColor }}>{formatTaskDate(task.due_at)}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="flag-outline" size={16} color={priority.color} />
            <Text className="text-[11px] font-black" style={{ color: priority.color }}>Prioridad {priority.label.toLowerCase()}</Text>
          </View>
        </View>

        <View className="mt-4 flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={onOpenCourse}
            className="min-h-[46px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border"
            style={({ pressed }) => ({ borderColor: withAlpha(courseColor, '80'), backgroundColor: withAlpha(courseColor, '18'), opacity: pressed ? 0.72 : 1 })}
          >
            <Ionicons name="book-outline" size={18} color={courseColor} />
            <Text className="text-[12px] font-black" style={{ color: courseColor }}>Ir al curso</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, checked: Boolean(task.is_completed) }}
            disabled={busy}
            onPress={onToggleCompleted}
            className="min-h-[46px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl"
            style={({ pressed }) => ({ backgroundColor: task.is_completed ? colors.surfaceMuted : accentColor, opacity: busy ? 0.55 : pressed ? 0.75 : 1 })}
          >
            {busy ? <ActivityIndicator size="small" color={task.is_completed ? colors.text : '#FFFFFF'} /> : <Ionicons name={task.is_completed ? 'arrow-undo-outline' : 'checkmark'} size={18} color={task.is_completed ? colors.text : '#FFFFFF'} />}
            <Text className="text-[12px] font-black" style={{ color: task.is_completed ? colors.text : '#FFFFFF' }}>{task.is_completed ? 'Reabrir' : 'Completar'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
