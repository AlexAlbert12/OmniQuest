import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useLocalSearchParams, useRouter } from 'expo-router'
import BrandLogo from '../../BrandLogo'
import AdminBottomNav from '../AdminBottomNav'
import MobileMetricCard from '../../ui/mobile/MobileMetricCard'
import { supabase } from '../../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout'
import { useAppTheme } from '../../../lib/appTheme'
import type { AdminConfirmationRequester } from './AdminTypedConfirmation'
import GlobalSearchButton from '../../search/GlobalSearchButton'
import {
  exportAdminAudit,
  exportAdminClassrooms,
  exportAdminProfiles,
  exportAdminSubjects,
  exportAdminSupport,
} from '../../../lib/adminExports'

export type AdminSection = 'home' | 'teachers' | 'students' | 'courses' | 'classrooms' | 'support' | 'audit'
export type IconName = keyof typeof Ionicons.glyphMap

export type ProfileRow = {
  id: string
  alias: string
  email: string | null
  role_id: string | null
  active: boolean | null
  created_at: string
  subject_count?: number | null
  enrollment_count?: number | null
  last_activity_at?: string | null
  activity_state?: 'recent' | 'inactive' | 'never' | string | null
  total_count?: number | null
}

export type SubjectRow = {
  id: number
  name: string
  teacher_id: string | null
  active: boolean | null
  is_archived: boolean | null
  created_at: string | null
  teacher_alias?: string | null
  teacher_email?: string | null
  classes_count?: number | null
  enrollments_count?: number | null
  last_activity_at?: string | null
  incidents_count?: number | null
  pending_reviews_count?: number | null
  inactive_classrooms_count?: number | null
  missing_code_count?: number | null
  total_count?: number | null
}

export type ClassroomRow = {
  id: number
  subject_id: number | null
  name: string
  code: string | null
  active: boolean | null
  created_at: string
  subject_name?: string | null
  teacher_id?: string | null
  teacher_alias?: string | null
  teacher_email?: string | null
  enrollments_count?: number | null
  last_activity_at?: string | null
  incidents_count?: number | null
  pending_reviews_count?: number | null
  total_count?: number | null
}

export type AdminAuditLogRow = {
  id: number
  admin_id: string
  actor_alias?: string | null
  actor_email?: string | null
  action: string
  target_table: string | null
  target_id: string | null
  severity?: 'info' | 'warning' | 'critical' | string | null
  metadata: Record<string, unknown> | null
  created_at: string
  total_count?: number | null
}

export type AdminProfileActivityRow = {
  event_id: string
  profile_id: string
  event_type: string
  title: string
  description: string | null
  entity_table: string | null
  entity_id: string | null
  severity: 'info' | 'warning' | 'critical' | 'success' | string
  metadata: Record<string, unknown> | null
  occurred_at: string
  total_count?: number | null
}

export type AdminSupportTicketRow = {
  id: number
  user_id: string
  user_alias: string | null
  user_email: string | null
  role: 'student' | 'teacher'
  category: string
  subject: string
  message: string
  contact_email: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  admin_response: string | null
  assigned_admin_id: string | null
  resolved_at: string | null
  last_response_at: string | null
  created_at: string
  updated_at: string
  total_count?: number | null
}

export type AdminUsageAnalytics = {
  days: number
  game_started: number
  game_finished: number
  game_abandoned: number
  game_errors: number
  badges_unlocked: number
  active_users: number
  completion_rate: number
}

export type EnrollmentRow = {
  id: number
  student_id: string
  subject_id: number
  classroom_id: number | null
}

export type AdminDashboardMetrics = {
  totalProfiles: number
  teachersCount: number
  studentsCount: number
  subjectsCount: number
  classroomsCount: number
  enrollmentsCount: number
  activeCourses: number
  archivedCourses: number
  activeClassrooms: number
  inactiveUsers: number
  coursesWithoutClassrooms: number
  studentsWithoutActivity: number
  classroomsWithoutCode: number
}

export type CreateTeacherResult = {
  status: 'created' | 'existing'
  teacher: {
    id: string
    alias: string
    email: string
  }
  temporaryPassword?: string
}

export type AdminData = {
  profiles: ProfileRow[]
  teachers: ProfileRow[]
  students: ProfileRow[]
  subjects: SubjectRow[]
  classrooms: ClassroomRow[]
  enrollments: EnrollmentRow[]
  metrics: AdminDashboardMetrics
  auditLogs: AdminAuditLogRow[]
  teacherById: Map<string, ProfileRow>
  studentById: Map<string, ProfileRow>
  subjectById: Map<number, SubjectRow>
  classroomById: Map<number, ClassroomRow>
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
  refresh: () => Promise<void>
  version: number
}

export type AdminActionResult = {
  error?: string
  ok?: boolean
}

export const ADMIN_PAGE_SIZE = 50

export const adminSections: { section: AdminSection; label: string; icon: IconName; href: string }[] = [
  { section: 'home', label: 'Inicio', icon: 'home-outline', href: '/(admin)/homeAdmin' },
  { section: 'teachers', label: 'Profesores', icon: 'school-outline', href: '/(admin)/teachers' },
  { section: 'students', label: 'Alumnos', icon: 'people-outline', href: '/(admin)/students' },
  { section: 'courses', label: 'Cursos', icon: 'book-outline', href: '/(admin)/courses' },
  { section: 'classrooms', label: 'Clases', icon: 'albums-outline', href: '/(admin)/classrooms' },
  { section: 'support', label: 'Soporte', icon: 'headset-outline', href: '/(admin)/support' },
  { section: 'audit', label: 'Auditoría', icon: 'receipt-outline', href: '/(admin)/audit' },
]

export function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204' || errorCode === 'PGRST205'
}

export function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`)
    return
  }

  Alert.alert(title, message)
}

export async function runAdminExport(setExporting: (value: boolean) => void, task: () => Promise<boolean>) {
  setExporting(true)
  try {
    const exported = await task()
    if (!exported) {
      showAlert('Exportación no disponible', 'No se pudo abrir el diálogo para guardar o compartir el archivo.')
    }
  } catch (error: any) {
    showAlert('No se pudo exportar', error?.message || 'Revisa la conexión y vuelve a intentarlo.')
  } finally {
    setExporting(false)
  }
}

export function confirmAction(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
  ])
}


export function confirmActionAsync(title: string, message: string) {
  return new Promise<boolean>((resolve) => {
    if (Platform.OS === 'web') {
      resolve(typeof window !== 'undefined' ? window.confirm(`${title}

${message}`) : false)
      return
    }

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
}

export async function fetchOptionalRows<T>(
  table: string,
  select: string,
  options: { ascending?: boolean; limit?: number; orderBy?: string } = {}
) {
  let query = (supabase.from(table as any) as any).select(select)
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? true })
  if (options.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error && !isMissingSchemaError(error.code)) {
    console.warn(`[admin] No se pudo cargar ${table}:`, error.message)
  }
  return error ? [] : ((data || []) as T[])
}

export async function invokeAdminAction<T extends AdminActionResult>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) {
    throw error
  }

  const result = (data || {}) as T
  if (result.error) {
    throw new Error(result.error)
  }

  return result
}


export function getFallbackAdminMetrics({
  classrooms,
  enrollments,
  profiles,
  subjects,
}: {
  classrooms: ClassroomRow[]
  enrollments: EnrollmentRow[]
  profiles: ProfileRow[]
  subjects: SubjectRow[]
}): AdminDashboardMetrics {
  const subjectIdsWithClassrooms = new Set(
    classrooms
      .map((classroom) => classroom.subject_id)
      .filter((id): id is number => typeof id === 'number')
  )

  return {
    totalProfiles: profiles.length,
    teachersCount: profiles.filter((profile) => profile.role_id === 'teacher').length,
    studentsCount: profiles.filter((profile) => profile.role_id === 'student' || profile.role_id === 'guest').length,
    subjectsCount: subjects.length,
    classroomsCount: classrooms.length,
    enrollmentsCount: enrollments.length,
    activeCourses: subjects.filter((subject) => subject.active !== false && !subject.is_archived).length,
    archivedCourses: subjects.filter((subject) => subject.is_archived).length,
    activeClassrooms: classrooms.filter((classroom) => classroom.active !== false).length,
    inactiveUsers: profiles.filter((profile) => profile.active === false).length,
    coursesWithoutClassrooms: subjects.filter((subject) => !subjectIdsWithClassrooms.has(subject.id)).length,
    studentsWithoutActivity: 0,
    classroomsWithoutCode: classrooms.filter((classroom) => !classroom.code).length,
  }
}

export function normalizeAdminMetrics(value: unknown, fallback: AdminDashboardMetrics): AdminDashboardMetrics {
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Partial<Record<keyof AdminDashboardMetrics, unknown>>

  return Object.fromEntries(
    (Object.keys(fallback) as (keyof AdminDashboardMetrics)[]).map((key) => {
      const numberValue = typeof raw[key] === 'number' ? raw[key] as number : fallback[key]
      return [key, Number.isFinite(numberValue) ? numberValue : fallback[key]]
    })
  ) as AdminDashboardMetrics
}

export function useAdminData(): AdminData {
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [metrics, setMetrics] = useState<AdminDashboardMetrics>(() => getFallbackAdminMetrics({
    classrooms: [],
    enrollments: [],
    profiles: [],
    subjects: [],
  }))
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [version, setVersion] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const [metricsResult, adminsResult, auditLogData] = await Promise.all([
        (supabase.rpc('get_admin_dashboard_metrics' as any) as any),
        (supabase.rpc('get_admin_profiles_page' as any, {
          p_role: 'admin',
          p_search: '',
          p_subject_id: null,
          p_classroom_id: null,
          p_profile_id: null,
          p_limit: 50,
          p_offset: 0,
        }) as any),
        fetchOptionalRows<AdminAuditLogRow>('admin_audit_logs', 'id, admin_id, action, target_table, target_id, metadata, created_at', {
          orderBy: 'created_at',
          ascending: false,
          limit: 50,
        }),
      ])

      const fallbackMetrics = getFallbackAdminMetrics({
        classrooms: [],
        enrollments: [],
        profiles: [],
        subjects: [],
      })

      if (metricsResult.error && !isMissingSchemaError(metricsResult.error.code)) {
        console.warn('[admin] No se pudieron cargar métricas agregadas:', metricsResult.error.message)
      }
      if (adminsResult.error && !isMissingSchemaError(adminsResult.error.code)) {
        console.warn('[admin] No se pudieron cargar administradores:', adminsResult.error.message)
      }

      setProfiles(adminsResult.error ? [] : ((adminsResult.data || []) as ProfileRow[]))
      setMetrics(normalizeAdminMetrics(metricsResult.error ? null : metricsResult.data, fallbackMetrics))
      setAuditLogs(auditLogData)
      setVersion((value) => value + 1)
    } catch (error: any) {
      showAlert('No se pudo cargar el portal', error.message || 'Revisa los permisos de administrador y las políticas RLS.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const teachers = useMemo(() => profiles.filter((profile) => profile.role_id === 'teacher'), [profiles])
  const students = useMemo(
    () => profiles.filter((profile) => profile.role_id === 'student' || profile.role_id === 'guest'),
    [profiles]
  )
  const teacherById = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher])), [teachers])
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students])
  const subjectById = useMemo(() => new Map<number, SubjectRow>(), [])
  const classroomById = useMemo(() => new Map<number, ClassroomRow>(), [])

  const onRefresh = () => {
    setRefreshing(true)
    void fetchData()
  }

  return {
    profiles,
    teachers,
    students,
    subjects: [],
    classrooms: [],
    enrollments: [],
    metrics,
    auditLogs,
    teacherById,
    studentById,
    subjectById,
    classroomById,
    loading,
    refreshing,
    onRefresh,
    refresh: fetchData,
    version,
  }
}

export function useAdminRpcPage<T extends { total_count?: number | null }>(
  functionName: string,
  args: Record<string, unknown>,
  refreshVersion: number,
  pageSize = ADMIN_PAGE_SIZE
) {
  const [rows, setRows] = useState<T[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const argsKey = JSON.stringify(args)
  const stableArgs = useMemo(() => JSON.parse(argsKey) as Record<string, unknown>, [argsKey])

  useEffect(() => {
    setPage(0)
  }, [argsKey])

  const fetchPage = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase.rpc(functionName as any, {
        ...stableArgs,
        p_limit: pageSize,
        p_offset: page * pageSize,
      }) as any)

      if (error) throw error

      const nextRows = (data || []) as T[]
      setRows(nextRows)
      setTotal(Number(nextRows[0]?.total_count || 0))
    } catch (error: any) {
      setRows([])
      setTotal(0)
      showAlert('No se pudo cargar el listado', error.message || 'Revisa la conexión y las funciones RPC de administración.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [functionName, page, pageSize, stableArgs])

  useEffect(() => {
    void fetchPage()
  }, [fetchPage, refreshVersion])

  const refresh = () => {
    setRefreshing(true)
    void fetchPage()
  }

  return {
    rows,
    page,
    pageSize,
    total,
    loading,
    refreshing,
    hasPrevious: page > 0,
    hasNext: (page + 1) * pageSize < total,
    nextPage: () => setPage((value) => value + 1),
    previousPage: () => setPage((value) => Math.max(0, value - 1)),
    refresh,
  }
}

export function useAdminActions(data: AdminData, requestConfirmation?: AdminConfirmationRequester) {
  const router = useRouter()

  const requestSensitiveConfirmation = useCallback(async (
    options: Parameters<AdminConfirmationRequester>[0],
  ) => {
    if (requestConfirmation) return requestConfirmation(options)
    return confirmActionAsync(options.title, `${options.message}

Escribe ${options.confirmationText} en la confirmación para continuar.`)
  }, [requestConfirmation])

  const toggleProfileActive = useCallback(
    async (profile: ProfileRow) => {
      const nextActive = profile.active === false
      const approved = nextActive
        ? await confirmActionAsync('Activar usuario', `Se activará la cuenta de ${profile.alias}.`)
        : await requestSensitiveConfirmation({
            title: 'Desactivar usuario',
            message: `La cuenta de ${profile.alias} dejará de poder acceder a OmniQuest. Sus datos se conservarán y podrás reactivarla más adelante.`,
            confirmationText: 'DESACTIVAR',
            confirmLabel: 'Desactivar cuenta',
            destructive: true,
            icon: 'ban-outline',
          })

      if (!approved) return

      try {
        await invokeAdminAction('admin-toggle-user', {
          active: nextActive,
          profileId: profile.id,
        })
        await data.refresh()
      } catch (error: any) {
        showAlert('No se pudo actualizar', error.message)
      }
    },
    [data, requestSensitiveConfirmation]
  )

  const resetPassword = useCallback(async (profile: ProfileRow) => {
    if (!profile.email) {
      showAlert('Sin correo', 'Este usuario no tiene correo guardado en profiles.email.')
      return
    }

    const approved = await requestSensitiveConfirmation({
      title: 'Restablecer contraseña',
      message: `Se enviará un enlace de recuperación a ${profile.email}. Esta acción quedará registrada en auditoría.`,
      confirmationText: 'RESET',
      confirmLabel: 'Enviar enlace',
      destructive: true,
      icon: 'key-outline',
    })
    if (!approved) return

    try {
      await invokeAdminAction('admin-reset-password', {
        profileId: profile.id,
      })
      showAlert('Correo enviado', `Se ha enviado un enlace de restablecimiento a ${profile.email}.`)
    } catch (error: any) {
      showAlert('No se pudo restablecer', error.message)
    }
  }, [requestSensitiveConfirmation])

  const deleteStudentProgress = useCallback(
    async (student: ProfileRow) => {
      const approved = await requestSensitiveConfirmation({
        title: 'Eliminar progreso académico',
        message: `Se eliminarán puntuaciones, progreso por tema e intentos de ${student.alias}. Esta acción no se puede deshacer.`,
        confirmationText: 'ELIMINAR',
        confirmLabel: 'Eliminar progreso',
        destructive: true,
        icon: 'trash-outline',
      })
      if (!approved) return

      try {
        await invokeAdminAction('admin-delete-student-progress', {
          studentId: student.id,
        })
        await data.refresh()
        showAlert('Progreso eliminado', `El progreso de ${student.alias} se ha eliminado.`)
      } catch (error: any) {
        showAlert('No se pudo eliminar progreso', error.message)
      }
    },
    [data, requestSensitiveConfirmation]
  )

  const toggleCourseArchive = useCallback(
    async (subject: SubjectRow) => {
      const archive = !subject.is_archived
      const approved = archive
        ? await requestSensitiveConfirmation({
            title: 'Archivar curso',
            message: `El curso ${subject.name} dejará de estar operativo para el alumnado. El contenido y el historial se conservarán.`,
            confirmationText: 'ARCHIVAR',
            confirmLabel: 'Archivar curso',
            destructive: true,
            icon: 'archive-outline',
          })
        : await confirmActionAsync('Restaurar curso', `Se restaurará el curso ${subject.name}.`)
      if (!approved) return

      try {
        await invokeAdminAction('admin-archive-course', {
          archive,
          subjectId: subject.id,
        })
        await data.refresh()
      } catch (error: any) {
        showAlert('No se pudo actualizar el curso', error.message)
      }
    },
    [data, requestSensitiveConfirmation]
  )

  const toggleClassroomActive = useCallback(
    async (classroom: ClassroomRow) => {
      const nextActive = classroom.active === false
      const approved = nextActive
        ? await confirmActionAsync('Activar clase', `Se activará la clase ${classroom.name}.`)
        : await requestSensitiveConfirmation({
            title: 'Desactivar clase',
            message: `La clase ${classroom.name} dejará de aceptar actividad e incorporaciones hasta que vuelva a activarse.`,
            confirmationText: 'DESACTIVAR',
            confirmLabel: 'Desactivar clase',
            destructive: true,
            icon: 'ban-outline',
          })
      if (!approved) return

      try {
        await invokeAdminAction('admin-deactivate-classroom', {
          active: nextActive,
          classroomId: classroom.id,
        })
        await data.refresh()
      } catch (error: any) {
        showAlert('No se pudo actualizar la clase', error.message)
      }
    },
    [data, requestSensitiveConfirmation]
  )

  const copyClassroomCode = useCallback(async (classroom: ClassroomRow) => {
    if (!classroom.code) {
      showAlert('Sin código', 'Esta clase no tiene código disponible.')
      return
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(classroom.code)
      showAlert('Código copiado', `Código ${classroom.code} copiado al portapapeles.`)
      return
    }

    showAlert('Código de clase', classroom.code)
  }, [])

  const viewProfileActivity = useCallback((profile: ProfileRow) => {
    router.push(`/(admin)/user/${profile.id}/activity` as any)
  }, [router])

  const viewRelatedAudit = useCallback((targetTable: string, targetId: string | number) => {
    router.push(`/(admin)/audit?targetTable=${encodeURIComponent(targetTable)}&targetId=${encodeURIComponent(String(targetId))}` as any)
  }, [router])

  return {
    router,
    toggleProfileActive,
    resetPassword,
    deleteStudentProgress,
    toggleCourseArchive,
    toggleClassroomActive,
    copyClassroomCode,
    viewProfileActivity,
    viewRelatedAudit,
  }
}

export function AdminScaffold({
  activeSection,
  children,
  data,
  subtitle,
  title,
}: {
  activeSection: AdminSection
  children: React.ReactNode
  data: AdminData
  subtitle: string
  title: string
}) {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const { colors } = useAppTheme()
  const isDesktop = width >= 1040
  const activeIcon = activeSection === 'home' ? 'shield-checkmark' : getAdminSectionIcon(activeSection)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  if (data.loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4" style={{ color: colors.textMuted }}>Cargando portal de administrador...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 flex-row">
        {isDesktop ? <AdminSidebar activeSection={activeSection} onSignOut={handleSignOut} /> : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 20,
            paddingTop: isDesktop ? 24 : 20,
            paddingBottom: isDesktop ? 36 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          {isDesktop ? (
            <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
              <View className="min-w-[260px] flex-1">
                <View className="flex-row items-center gap-3">
                  <Ionicons name={activeIcon} size={42} color="#9FD6FF" />
                  <Text className="text-[36px] font-black text-white">{title}</Text>
                </View>
                <Text className="mt-2 text-[14px] text-[#B7C4D7]">{subtitle}</Text>
              </View>
              <GlobalSearchButton role="admin" />
            </View>
          ) : (
            <View className="mb-6">
              <View className="mb-6 flex-row items-center justify-between">
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#2D1D6B]">
                    <Ionicons name={activeIcon} size={25} color="#C4B5FD" />
                  </View>
                  <Text className="min-w-0 text-[28px] font-black text-white" numberOfLines={1}>{title}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <GlobalSearchButton role="admin" compact />
                  <Pressable
                    onPress={handleSignOut}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar sesión"
                    className="h-12 w-12 items-center justify-center rounded-2xl border border-[#20375E] bg-[#09162C]"
                    style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                  >
                    <Ionicons name="log-out-outline" size={20} color="#FB7185" />
                  </Pressable>
                </View>
              </View>

              <View className="rounded-[28px] border border-[#1A3155] bg-[#09162C] p-5">
                <View className="flex-row items-start gap-4">
                  <View className="h-16 w-16 items-center justify-center rounded-3xl bg-[#2D1D6B]">
                    <Ionicons name={activeIcon} size={34} color="#C4B5FD" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[34px] font-black leading-[38px] text-white" numberOfLines={2}>{title}</Text>
                    <Text className="mt-2 text-[14px] leading-5 text-[#B7C4D7]" numberOfLines={3}>{subtitle}</Text>
                  </View>
                </View>
                <View className="mt-5 flex-row items-center justify-between rounded-2xl border border-[#20375E] bg-[#07162D] px-4 py-3">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="lock-closed-outline" size={15} color="#8B5CF6" />
                    <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-[#A78BFA]">Portal privado</Text>
                  </View>
                  <Pressable onPress={data.onRefresh} className="flex-row items-center gap-2" hitSlop={8}>
                    <Ionicons name="refresh-outline" size={16} color="#AFC2DB" />
                    <Text className="text-[12px] font-bold text-[#DDE7F4]">Actualizar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {!isDesktop && activeSection !== 'home' && activeSection !== 'support' ? (
            <View className="mb-4">
              <AdminMobileSectionTabs activeSection={activeSection} />
            </View>
          ) : null}

          {children}
        </ScrollView>
      </View>

      {!isDesktop ? <AdminBottomNav active={activeSection} /> : null}
    </View>
  )
}

export function AdminSidebar({ activeSection, onSignOut }: { activeSection: AdminSection; onSignOut: () => void }) {
  return (
    <View className="w-[244px] border-r border-[#183052] bg-[#041024] px-4 py-7">
      <View className="mb-5 flex-row items-center gap-2 px-2">
        <BrandLogo size={30} />
        <Ionicons name="shield-checkmark" size={19} color="#9FD6FF" />
      </View>

      <View style={{ gap: 8 }}>
        {adminSections.map((item) => (
          <AdminNavButton key={item.section} item={item} active={item.section === activeSection} />
        ))}
      </View>

      <View className="mt-auto" style={{ gap: 10 }}>
        <View className="rounded-2xl border border-[#162B50] bg-[#091A35] p-4">
          <Text className="text-[14px] font-bold text-white">Administrador</Text>
          <Text className="mt-1 text-[12px] text-[#9BAEC9]">Portal privado</Text>
          <View className="mt-3 flex-row items-center gap-1">
            <Ionicons name="lock-closed-outline" size={13} color="#8FA7C7" />
            <Text className="text-[12px] text-[#AFC2DB]">Gestión interna</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          onPress={onSignOut}
          className="items-center justify-center rounded-2xl"
          style={({ pressed }) => ({
            minHeight: 52,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: pressed ? '#FB7185' : '#3B1D2A',
            backgroundColor: pressed ? 'rgba(251,113,133,0.18)' : 'rgba(251,113,133,0.1)',
            transform: [{ scale: pressed ? 0.985 : 1 }],
          })}
        >
          <View className="flex-row items-center justify-center gap-2">
            <Ionicons name="log-out-outline" size={18} color="#FB7185" />
            <Text className="font-black text-[#FCA5B5]">Cerrar sesión</Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

export function AdminNavButton({ active, item }: { active: boolean; item: { label: string; icon: IconName; href: string } }) {
  const router = useRouter()

  return (
    <Pressable
      onPress={() => router.push(item.href as any)}
      className="flex-row items-center gap-3 rounded-xl px-4 py-3"
      style={({ pressed }) => ({
        backgroundColor: active ? '#28357D' : 'transparent',
        borderWidth: 1,
        borderColor: active ? '#6D5AF6' : 'transparent',
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Ionicons name={active ? filledIconFor(item.icon) : item.icon} size={19} color={active ? '#FFFFFF' : '#AFC2DB'} />
      <Text className={`font-black ${active ? 'text-white' : 'text-[#B7C4D7]'}`}>{item.label}</Text>
    </Pressable>
  )
}

export function AdminMetrics({ activeSection, data }: { activeSection: AdminSection; data: AdminData }) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const metricWidth = Math.max(136, Math.floor((width - 52) / 2))
  const metrics = [
    { icon: 'school' as IconName, label: 'Profesores', value: String(data.metrics.teachersCount), color: '#8B5CF6' },
    { icon: 'people' as IconName, label: 'Alumnos', value: String(data.metrics.studentsCount), color: '#34D399' },
    { icon: 'book' as IconName, label: 'Cursos', value: String(data.metrics.subjectsCount), color: '#38BDF8' },
    { icon: 'albums' as IconName, label: 'Clases', value: String(data.metrics.classroomsCount), color: '#F59E0B' },
    { icon: 'person-add' as IconName, label: 'Inscripciones', value: String(data.metrics.enrollmentsCount), color: '#FB7185' },
  ]

  if (!isDesktop) {
    return (
      <View style={{ gap: 14 }}>
        <View className="rounded-[26px] border border-[#1A3155] bg-[#07162D] p-4">
          <View className="flex-row items-center justify-between">
            <View className="min-w-0 flex-1">
              <Text className="text-[19px] font-black text-white">Resumen</Text>
              <Text className="mt-1 text-[12px] font-semibold text-[#8FA7C7]">Estado general de la plataforma.</Text>
            </View>
            <View className="rounded-full bg-[#2D1D6B] px-3 py-1">
              <Text className="text-[11px] font-black uppercase tracking-[0.6px] text-[#C4B5FD]">Admin</Text>
            </View>
          </View>

          <View className="mt-4 flex-row flex-wrap" style={{ gap: 12 }}>
            {metrics.slice(0, 4).map((metric) => (
              <AdminMetric key={metric.label} {...metric} compact width={metricWidth} />
            ))}
          </View>
        </View>

        <AdminMobileCriticalAlerts data={data} />
        <AdminMobileSectionTabs activeSection={activeSection} />
      </View>
    )
  }

  return (
    <View className="flex-row flex-wrap gap-4">
      {metrics.map((metric) => (
        <AdminMetric key={metric.label} {...metric} />
      ))}
    </View>
  )
}

export function AdminMobileCriticalAlerts({ data }: { data: AdminData }) {
  const alerts = [
    { icon: 'person-remove-outline' as IconName, label: 'Usuarios inactivos', value: data.metrics.inactiveUsers, color: '#FB7185' },
    { icon: 'book-outline' as IconName, label: 'Cursos sin clases', value: data.metrics.coursesWithoutClassrooms, color: '#F59E0B' },
    { icon: 'time-outline' as IconName, label: 'Alumnos sin actividad', value: data.metrics.studentsWithoutActivity, color: '#8FA7C7' },
    { icon: 'key-outline' as IconName, label: 'Clases sin código', value: data.metrics.classroomsWithoutCode, color: '#38BDF8' },
  ]
  const visibleAlerts = alerts.filter((alert) => alert.value > 0)

  return (
    <View className="rounded-[24px] border border-[#1A3155] bg-[#07162D] p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="alert-circle-outline" size={19} color="#FB7185" />
          <Text className="text-[17px] font-black text-white">Alertas críticas</Text>
        </View>
        <Text className="rounded-full bg-[#102A54] px-3 py-1 text-[12px] font-black text-[#9FD6FF]">
          {visibleAlerts.length}
        </Text>
      </View>

      <View className="mt-3" style={{ gap: 10 }}>
        {visibleAlerts.length > 0 ? (
          visibleAlerts.slice(0, 3).map((alert) => (
            <View key={alert.label} className="flex-row items-center rounded-2xl border border-[#20375E] bg-[#09162C] px-3 py-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: `${alert.color}24` }}>
                <Ionicons name={alert.icon} size={18} color={alert.color} />
              </View>
              <Text className="ml-3 min-w-0 flex-1 text-[13px] font-bold text-[#DDE7F4]" numberOfLines={1}>{alert.label}</Text>
              <Text className="text-[18px] font-black text-white">{alert.value}</Text>
            </View>
          ))
        ) : (
          <View className="items-center rounded-2xl border border-dashed border-[#29466F] bg-[#09162C] px-4 py-5">
            <Ionicons name="checkmark-circle-outline" size={26} color="#34D399" />
            <Text className="mt-2 text-center text-[13px] font-bold text-[#AFC2DB]">No hay alertas críticas ahora mismo.</Text>
          </View>
        )}
      </View>
    </View>
  )
}

export function AdminMobileSectionTabs({ activeSection }: { activeSection: AdminSection }) {
  const router = useRouter()

  return (
    <View className="rounded-[24px] border border-[#1A3155] bg-[#07162D] p-4">
      <Text className="text-[17px] font-black text-white">Secciones</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4 mt-3"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {adminSections
          .filter((item) => ['teachers', 'students', 'courses', 'classrooms', 'audit'].includes(item.section))
          .map((item) => {
          const active = item.section === activeSection
          return (
            <Pressable
              key={item.section}
              onPress={() => router.push(item.href as any)}
              className="h-11 flex-row items-center gap-2 rounded-2xl border px-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.82 : 1,
                borderColor: active ? '#6D5AF6' : '#20375E',
                backgroundColor: active ? '#2D1D6B' : '#09162C',
              })}
            >
              <Ionicons name={active ? filledIconFor(item.icon) : item.icon} size={17} color={active ? '#FFFFFF' : '#AFC2DB'} />
              <Text className="text-[13px] font-black" style={{ color: active ? '#FFFFFF' : '#DDE7F4' }} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

export function HomeShortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[185px] flex-1 flex-row items-center gap-3 rounded-2xl border border-[#20375E] bg-[#09162C] p-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#102A54]">
        <Ionicons name={icon} size={20} color="#9FD6FF" />
      </View>
      <Text className="min-w-0 flex-1 font-black text-white">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#8FA7C7" />
    </Pressable>
  )
}

export function Panel({
  children,
  className = '',
  compact = false,
  icon,
  title,
}: {
  children: React.ReactNode
  className?: string
  compact?: boolean
  icon: IconName
  title: string
}) {
  return (
    <View className={`rounded-2xl border border-[#1A3155] bg-[#07162D] ${compact ? 'p-4' : 'p-5'} ${className}`}>
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#102A54]">
          <Ionicons name={icon} size={20} color="#9FD6FF" />
        </View>
        <Text className="text-[18px] font-black text-white">{title}</Text>
      </View>
      {children}
    </View>
  )
}

export function AdminMetric({ color, compact = false, icon, label, value, width }: { color: string; compact?: boolean; icon: IconName; label: string; value: string; width?: number }) {
  return (
    <MobileMetricCard
      className={compact ? '' : 'min-w-[160px] flex-1'}
      color={color}
      compact={compact}
      icon={icon}
      title={label}
      value={value}
      width={width}
    />
  )
}

export function AdminInput({
  autoCapitalize,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  autoCapitalize?: 'none'
  label: string
  onChangeText: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <View className="min-w-[210px] flex-1">
      <Text className="mb-2 text-[12px] font-bold text-[#AFC2DB]">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        placeholder={placeholder}
        placeholderTextColor="#8FA7C7"
        className="h-12 rounded-xl border border-[#20375E] bg-[#09162C] px-4 text-white"
      />
    </View>
  )
}

export function AdminSearch({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return (
    <View className="h-12 flex-row items-center rounded-xl border border-[#20375E] bg-[#09162C] px-4">
      <TextInput
        className="min-w-0 flex-1 text-white"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8FA7C7"
      />
      <Ionicons name="search-outline" size={19} color="#8FA7C7" />
    </View>
  )
}


export function AdminListToolbar({
  exporting,
  onChangeSearch,
  onExport,
  placeholder,
  search,
}: {
  exporting: boolean
  onChangeSearch: (value: string) => void
  onExport?: () => void
  placeholder: string
  search: string
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-3">
      <View className="min-w-[240px] flex-1">
        <AdminSearch value={search} onChangeText={onChangeSearch} placeholder={placeholder} />
      </View>
      {onExport ? (
        <Pressable
          accessibilityLabel="Exportar listado filtrado a CSV"
          accessibilityRole="button"
          disabled={exporting}
          onPress={onExport}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-[#35578A] bg-[#102A54] px-4"
          style={({ pressed }) => ({ opacity: exporting ? 0.55 : pressed ? 0.78 : 1 })}
        >
          {exporting ? <ActivityIndicator color="#9FD6FF" /> : <Ionicons name="download-outline" size={18} color="#9FD6FF" />}
          <Text className="font-black text-[#DDE7F4]">{exporting ? 'Exportando...' : 'Exportar CSV'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function AdminFilterRow({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  value: string
}) {
  return (
    <View>
      <Text className="mb-2 text-[11px] font-black uppercase tracking-[0.7px] text-[#8FA7C7]">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((option) => (
          <AdminChoiceChip key={option.value} active={value === option.value} label={option.label} onPress={() => onChange(option.value)} />
        ))}
      </ScrollView>
    </View>
  )
}

export function AdminChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="h-10 items-center justify-center rounded-xl border px-3"
      style={({ pressed }) => ({
        borderColor: active ? '#8B5CF6' : '#20375E',
        backgroundColor: active ? '#2D1D6B' : '#09162C',
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <Text className="text-[12px] font-black" style={{ color: active ? '#FFFFFF' : '#AFC2DB' }}>{label}</Text>
    </Pressable>
  )
}

export function SupportTicketCard({ ticket, onManage }: { ticket: AdminSupportTicketRow; onManage: () => void }) {
  return (
    <View className="rounded-xl border border-[#20375E] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[220px] flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <SupportStatusPill status={ticket.status} />
            <SupportPriorityPill priority={ticket.priority} />
          </View>
          <Text className="mt-3 text-[16px] font-black text-white">{ticket.subject}</Text>
          <Text className="mt-1 text-[12px] font-semibold text-[#8FA7C7]">
            {ticket.user_alias || 'Usuario'} · {ticket.role === 'teacher' ? 'Profesor' : 'Alumno'} · {formatAuditDate(ticket.created_at)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Gestionar ticket ${ticket.subject}`}
          accessibilityRole="button"
          onPress={onManage}
          className="h-10 flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Ionicons name="create-outline" size={16} color="#FFFFFF" />
          <Text className="text-[12px] font-black text-white">Gestionar</Text>
        </Pressable>
      </View>
      <Text className="mt-3 text-[13px] leading-5 text-[#DDE7F4]" numberOfLines={3}>{ticket.message}</Text>
      {ticket.admin_response ? (
        <View className="mt-3 rounded-xl border border-[#30508A] bg-[#10224A] p-3">
          <Text className="text-[11px] font-black uppercase tracking-[0.6px] text-[#9FD6FF]">Última respuesta</Text>
          <Text className="mt-1 text-[12px] leading-5 text-[#DDE7F4]" numberOfLines={2}>{ticket.admin_response}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function SupportStatusPill({ status }: { status: AdminSupportTicketRow['status'] }) {
  const meta = {
    open: { bg: '#3B1D2A', color: '#FB7185' },
    in_progress: { bg: '#3A2A0B', color: '#FBBF24' },
    resolved: { bg: '#063D31', color: '#34D399' },
    closed: { bg: '#1A3155', color: '#AFC2DB' },
  }[status]
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: meta.bg }}>
      <Text className="text-[11px] font-black" style={{ color: meta.color }}>{getSupportStatusLabel(status)}</Text>
    </View>
  )
}

export function SupportPriorityPill({ priority }: { priority: AdminSupportTicketRow['priority'] }) {
  const meta = {
    high: { bg: '#3B1D2A', color: '#FB7185' },
    medium: { bg: '#3A2A0B', color: '#FBBF24' },
    low: { bg: '#102A54', color: '#9FD6FF' },
  }[priority]
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: meta.bg }}>
      <Text className="text-[11px] font-black" style={{ color: meta.color }}>Prioridad {getSupportPriorityLabel(priority).toLowerCase()}</Text>
    </View>
  )
}

export function AdminUsageAnalyticsPanel({ refreshVersion }: { refreshVersion: number }) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const [analytics, setAnalytics] = useState<AdminUsageAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_admin_usage_analytics', { p_days: 30 })
      if (!cancelled) {
        if (error) {
          console.warn('[admin] No se pudo cargar la analítica de uso:', error.message)
          setAnalytics(null)
        } else {
          setAnalytics((data || null) as AdminUsageAnalytics | null)
        }
        setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [refreshVersion])

  return (
    <Panel title="Analítica de uso · 30 días" icon="analytics-outline">
      {loading ? (
        <View className="items-center py-7">
          <ActivityIndicator color="#8B5CF6" />
          <Text className="mt-3 text-[13px] text-[#8FA7C7]">Calculando eventos de producto...</Text>
        </View>
      ) : analytics ? (
        <>
          <View className="flex-row flex-wrap gap-3">
            <AdminMetric color="#38BDF8" icon="play" label="Partidas iniciadas" value={String(analytics.game_started || 0)} />
            <AdminMetric color="#34D399" icon="checkmark-circle" label="Completadas" value={String(analytics.game_finished || 0)} />
            <AdminMetric color="#F59E0B" icon="exit" label="Abandonadas" value={String(analytics.game_abandoned || 0)} />
            <AdminMetric color="#FB7185" icon="warning" label="Errores" value={String(analytics.game_errors || 0)} />
          </View>
          <View className={isDesktop ? 'mt-4 flex-row gap-4' : 'mt-4 gap-3'}>
            <View className="flex-1 rounded-xl border border-[#20375E] bg-[#09162C] p-4">
              <Text className="text-[12px] font-bold text-[#8FA7C7]">Tasa de finalización</Text>
              <Text className="mt-1 text-[26px] font-black text-white">{Number(analytics.completion_rate || 0).toFixed(1)}%</Text>
            </View>
            <View className="flex-1 rounded-xl border border-[#20375E] bg-[#09162C] p-4">
              <Text className="text-[12px] font-bold text-[#8FA7C7]">Usuarios activos</Text>
              <Text className="mt-1 text-[26px] font-black text-white">{analytics.active_users || 0}</Text>
            </View>
            <View className="flex-1 rounded-xl border border-[#20375E] bg-[#09162C] p-4">
              <Text className="text-[12px] font-bold text-[#8FA7C7]">Logros desbloqueados</Text>
              <Text className="mt-1 text-[26px] font-black text-white">{analytics.badges_unlocked || 0}</Text>
            </View>
          </View>
        </>
      ) : (
        <EmptyState label="La analítica aparecerá cuando se registren eventos de uso." />
      )}
    </Panel>
  )
}

export function getSupportStatusLabel(status: AdminSupportTicketRow['status']) {
  if (status === 'in_progress') return 'En proceso'
  if (status === 'resolved') return 'Resuelto'
  if (status === 'closed') return 'Cerrado'
  return 'Abierto'
}

export function getSupportPriorityLabel(priority: AdminSupportTicketRow['priority']) {
  if (priority === 'high') return 'Alta'
  if (priority === 'low') return 'Baja'
  return 'Media'
}

export function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export function getNumericParam(value: string | string[] | undefined) {
  const raw = getSearchParam(value)
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export type RowAction = {
  label: string
  icon: IconName
  destructive?: boolean
  onPress: () => void
}

export function ProfileRowCard({ actions, meta, profile }: { actions: RowAction[]; meta: string; profile: ProfileRow }) {
  const roleLabel = profile.role_id === 'teacher' ? 'Profesor' : profile.role_id === 'admin' ? 'Administrador' : 'Alumno'
  const activityLabel = profile.last_activity_at ? `Actividad ${formatAuditDate(profile.last_activity_at)}` : 'Sin actividad registrada'

  return (
    <View className="rounded-xl border border-[#20375E] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-[#102A54]">
          <Text className="font-black text-[#9FD6FF]">{getInitials(profile.alias)}</Text>
        </View>
        <View className="min-w-[220px] flex-1">
          <Text className="font-black text-white">{profile.alias}</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">{profile.email || 'Sin correo guardado'}</Text>
        </View>
        <StatusPill active={profile.active !== false} />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <MiniPill icon={profile.role_id === 'teacher' ? 'school-outline' : 'person-outline'} label={roleLabel} />
        <MiniPill icon="layers-outline" label={meta} />
        <MiniPill icon="time-outline" label={activityLabel} />
      </View>
      <RowActions actions={actions} />
    </View>
  )
}

export function CourseRowCard({
  actions,
  classesCount,
  enrollmentsCount,
  subject,
  teacher,
}: {
  actions: RowAction[]
  classesCount: number
  enrollmentsCount: number
  subject: SubjectRow
  teacher?: ProfileRow
}) {
  const incidentCount = subject.incidents_count ?? 0
  const statusLabel = subject.is_archived ? 'Archivado' : subject.active === false ? 'Inactivo' : 'Activo'

  return (
    <View className="rounded-xl border border-[#20375E] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[240px] flex-1">
          <Text className="font-black text-white">{subject.name}</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">
            Profesor propietario: {teacher?.alias || subject.teacher_alias || 'Sin asignar'}
          </Text>
          {teacher?.email || subject.teacher_email ? (
            <Text className="mt-1 text-[11px] text-[#6F86A8]">{teacher?.email || subject.teacher_email}</Text>
          ) : null}
        </View>
        <StatusPill active={subject.active !== false && !subject.is_archived} label={statusLabel} />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <MiniPill icon="albums-outline" label={`${classesCount} clase(s)`} />
        <MiniPill icon="people-outline" label={`${enrollmentsCount} alumno(s)`} />
        <MiniPill icon="time-outline" label={subject.last_activity_at ? `Última actividad ${formatAuditDate(subject.last_activity_at)}` : 'Sin actividad'} />
        <MiniPill icon={incidentCount > 0 ? 'warning-outline' : 'checkmark-circle-outline'} label={`${incidentCount} incidencia(s)`} />
      </View>
      {incidentCount > 0 ? (
        <Text className="mt-3 text-[11px] leading-4 text-[#FBBF24]">
          {subject.pending_reviews_count || 0} revisiones pendientes · {subject.inactive_classrooms_count || 0} clases inactivas · {subject.missing_code_count || 0} clases sin código
        </Text>
      ) : null}
      <RowActions actions={actions} />
    </View>
  )
}

export function ClassroomRowCard({
  actions,
  classroom,
  enrollmentsCount,
  subject,
}: {
  actions: RowAction[]
  classroom: ClassroomRow
  enrollmentsCount: number
  subject?: SubjectRow
}) {
  const incidentCount = classroom.incidents_count ?? 0

  return (
    <View className="rounded-xl border border-[#20375E] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#1A1E55]">
          <Ionicons name="albums-outline" size={22} color="#C4B5FD" />
        </View>
        <View className="min-w-[240px] flex-1">
          <Text className="font-black text-white">{classroom.name}</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">{subject?.name || classroom.subject_name || 'Curso no disponible'}</Text>
          <Text className="mt-1 text-[11px] text-[#6F86A8]">Profesor propietario: {classroom.teacher_alias || 'Sin asignar'}</Text>
        </View>
        {classroom.code ? <Text className="rounded-lg bg-[#102A54] px-3 py-2 font-mono text-[12px] font-black text-[#9FD6FF]">{classroom.code}</Text> : null}
        <StatusPill active={classroom.active !== false} />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <MiniPill icon="people-outline" label={`${enrollmentsCount} alumno(s)`} />
        <MiniPill icon="time-outline" label={classroom.last_activity_at ? `Última actividad ${formatAuditDate(classroom.last_activity_at)}` : 'Sin actividad'} />
        <MiniPill icon={incidentCount > 0 ? 'warning-outline' : 'checkmark-circle-outline'} label={`${incidentCount} incidencia(s)`} />
      </View>
      {incidentCount > 0 ? (
        <Text className="mt-3 text-[11px] leading-4 text-[#FBBF24]">
          {classroom.pending_reviews_count || 0} revisiones pendientes{classroom.code ? '' : ' · clase sin código'}{classroom.active === false ? ' · clase inactiva' : ''}
        </Text>
      ) : null}
      <RowActions actions={actions} />
    </View>
  )
}


export function RecentAuditPanel({ data }: { data: AdminData }) {
  const latestLogs = data.auditLogs.slice(0, 5)

  return (
    <Panel title="Últimas acciones admin" icon="receipt-outline" compact>
      <View style={{ gap: 10 }}>
        {latestLogs.map((log) => (
          <AuditLogCard key={log.id} log={log} data={data} compact />
        ))}
        {latestLogs.length === 0 ? <EmptyState label="Todavía no hay acciones de auditoría registradas." /> : null}
      </View>
    </Panel>
  )
}

export function AuditLogCard({ compact, data, log }: { compact?: boolean; data: AdminData; log: AdminAuditLogRow }) {
  const admin = data.profiles.find((profile) => profile.id === log.admin_id)
  const targetLabel = getAuditTargetLabel(log)
  const actorLabel = log.actor_alias || admin?.alias || 'Admin desconocido'
  const severity = log.severity || getAdminAuditSeverity(log.action)
  const severityMeta = getAdminAuditSeverityMeta(severity)

  return (
    <View className="rounded-xl border border-[#20375E] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[220px] flex-1">
          <Text className="font-black text-white">{getAuditActionLabel(log.action)}</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">
            {actorLabel} · {formatAuditDate(log.created_at)}
          </Text>
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: severityMeta.background }}>
            <Text className="text-[10px] font-black uppercase" style={{ color: severityMeta.color }}>{severityMeta.label}</Text>
          </View>
          <MiniPill icon="shield-checkmark-outline" label={log.target_table || 'sistema'} />
        </View>
      </View>

      <Text className="mt-3 text-[13px] text-[#DDE7F4]">{targetLabel}</Text>

      {!compact ? (
        <Text className="mt-2 font-mono text-[12px] leading-5 text-[#AFC2DB]" numberOfLines={4}>
          {JSON.stringify(log.metadata || {}, null, 2)}
        </Text>
      ) : null}
    </View>
  )
}

export function getAdminAuditSeverity(action: string) {
  if (/delete|remove|critical/i.test(action) || action === 'admin.student.delete_progress') return 'critical'
  if (/deactivate|archive|reset/i.test(action)) return 'warning'
  return 'info'
}

export function getAdminAuditSeverityMeta(severity: string) {
  if (severity === 'critical') return { label: 'Crítica', color: '#FB7185', background: '#3B1D2A' }
  if (severity === 'warning') return { label: 'Advertencia', color: '#FBBF24', background: '#3A2A0B' }
  return { label: 'Información', color: '#9FD6FF', background: '#102A54' }
}


export function getAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    'admin.classroom.activate': 'Admin activó una clase',
    'admin.classroom.deactivate': 'Admin desactivó una clase',
    'admin.course.archive': 'Admin archivó un curso',
    'admin.course.restore': 'Admin restauró un curso',
    'admin.student.delete_progress': 'Admin eliminó progreso de un alumno',
    'admin.support.update': 'Admin actualizó un ticket de soporte',
    'admin.teacher.create': 'Admin creó un profesor',
    'admin.teacher.update_existing': 'Admin actualizó un profesor existente',
    'admin.user.activate': 'Admin activó un usuario',
    'admin.user.deactivate': 'Admin desactivó un usuario',
    'admin.user.reset_password': 'Admin restableció una contraseña',
  }
  return labels[action] || action
}

export function getAuditTargetLabel(log: AdminAuditLogRow) {
  const metadata = log.metadata || {}
  const name = stringMetadata(metadata, 'alias') || stringMetadata(metadata, 'name') || stringMetadata(metadata, 'email')
  const target = [log.target_table, log.target_id].filter(Boolean).join(': ')

  if (name && target) return `${name} · ${target}`
  return name || target || 'Acción sin objetivo concreto'
}

export function stringMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function formatAuditDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <View className="mt-4 flex-row flex-wrap gap-2">
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          className="flex-row items-center gap-2 rounded-xl border px-3 py-2"
          style={({ pressed }) => ({
            borderColor: action.destructive ? '#4A1E2B' : '#20375E',
            backgroundColor: action.destructive ? '#2A0B18' : '#07162D',
            opacity: pressed ? 0.82 : 1,
          })}
        >
          <Ionicons name={action.icon} size={14} color={action.destructive ? '#FB7185' : '#AFC2DB'} />
          <Text className="text-[12px] font-bold" style={{ color: action.destructive ? '#FCA5A5' : '#DDE7F4' }}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function StatusPill({ active, label }: { active: boolean; label?: string }) {
  const resolvedLabel = label || (active ? 'Activo' : 'Inactivo')
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: active ? '#063D31' : '#3B1D2A' }}>
      <Text className="text-[12px] font-black" style={{ color: active ? '#34D399' : '#FB7185' }}>
        {resolvedLabel}
      </Text>
    </View>
  )
}

export function MiniPill({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-[#20375E] bg-[#07162D] px-3 py-2">
      <Ionicons name={icon} size={14} color="#AFC2DB" />
      <Text className="text-[12px] font-semibold text-[#DDE7F4]">{label}</Text>
    </View>
  )
}

export function SideFact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#13284A] py-3">
      <Text className="text-[13px] font-semibold text-[#AFC2DB]">{label}</Text>
      <Text className="font-black text-white">{value}</Text>
    </View>
  )
}

export function SystemAlertRow({ color, icon, label, value }: { color: string; icon: IconName; label: string; value: number }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#13284A] py-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}24` }}>
          <Ionicons name={icon} size={17} color={color} />
        </View>
        <Text className="min-w-0 flex-1 text-[13px] font-semibold text-[#AFC2DB]">{label}</Text>
      </View>
      <Text className="text-[18px] font-black text-white">{value}</Text>
    </View>
  )
}

export function EmptyState({ label }: { label: string }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
      <Ionicons name="search-outline" size={34} color="#8FA7C7" />
      <Text className="mt-3 text-center font-bold text-[#AFC2DB]">{label}</Text>
    </View>
  )
}

export function ListLoadingState() {
  return (
    <View className="items-center rounded-xl border border-[#20375E] bg-[#09162C] p-5">
      <ActivityIndicator color="#8B5CF6" />
      <Text className="mt-3 text-[13px] font-semibold text-[#8FA7C7]">Cargando página...</Text>
    </View>
  )
}

export function AdminPaginationControls({
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  page,
  pageSize,
  total,
}: {
  hasNext: boolean
  hasPrevious: boolean
  onNext: () => void
  onPrevious: () => void
  page: number
  pageSize: number
  total: number
}) {
  const firstItem = total === 0 ? 0 : page * pageSize + 1
  const lastItem = Math.min(total, (page + 1) * pageSize)

  return (
    <View className="mt-4 flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1A3155] bg-[#07162E] px-4 py-3">
      <Text className="text-[12px] font-semibold text-[#AFC2DB]">
        {total === 0 ? 'Sin resultados' : `${firstItem}-${lastItem} de ${total}`}
      </Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onPrevious}
          disabled={!hasPrevious}
          className="h-10 flex-row items-center gap-1 rounded-xl border border-[#20375E] bg-[#09162C] px-3"
          style={({ pressed }) => ({ opacity: !hasPrevious ? 0.45 : pressed ? 0.78 : 1 })}
        >
          <Ionicons name="chevron-back" size={15} color="#DDE7F4" />
          <Text className="text-[12px] font-black text-[#DDE7F4]">Anterior</Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          disabled={!hasNext}
          className="h-10 flex-row items-center gap-1 rounded-xl bg-[#5A46D8] px-3"
          style={({ pressed }) => ({ opacity: !hasNext ? 0.45 : pressed ? 0.78 : 1 })}
        >
          <Text className="text-[12px] font-black text-white">Siguiente</Text>
          <Ionicons name="chevron-forward" size={15} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  )
}

export function buildTeacherProfileFromSubject(subject: SubjectRow): ProfileRow | undefined {
  if (!subject.teacher_id) return undefined

  return {
    id: subject.teacher_id,
    alias: subject.teacher_alias || 'Profesor sin perfil',
    email: subject.teacher_email || null,
    role_id: 'teacher',
    active: null,
    created_at: subject.created_at || '',
  }
}

export function buildSubjectFromClassroom(classroom: ClassroomRow): SubjectRow | undefined {
  if (typeof classroom.subject_id !== 'number') return undefined

  return {
    id: classroom.subject_id,
    name: classroom.subject_name || 'Curso no disponible',
    teacher_id: null,
    active: null,
    is_archived: null,
    created_at: null,
  }
}

export function useAdminDashboard(data: AdminData) {
  return useMemo(() => ({
    activeCourses: data.metrics.activeCourses,
    archivedCourses: data.metrics.archivedCourses,
    activeClassrooms: data.metrics.activeClassrooms,
    inactiveUsers: data.metrics.inactiveUsers,
    coursesWithoutClassrooms: data.metrics.coursesWithoutClassrooms,
    studentsWithoutActivity: data.metrics.studentsWithoutActivity,
    classroomsWithoutCode: data.metrics.classroomsWithoutCode,
    enrollmentsCount: data.metrics.enrollmentsCount,
  }), [data.metrics])
}

export function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}

export function getAdminSectionIcon(section: AdminSection): IconName {
  const item = adminSections.find((entry) => entry.section === section)
  return item?.icon || 'shield-checkmark-outline'
}

export function filledIconFor(icon: IconName): IconName {
  const map: Partial<Record<IconName, IconName>> = {
    'home-outline': 'home',
    'school-outline': 'school',
    'people-outline': 'people',
    'book-outline': 'book',
    'albums-outline': 'albums',
    'headset-outline': 'headset',
    'receipt-outline': 'receipt',
  }
  return map[icon] || icon
}
