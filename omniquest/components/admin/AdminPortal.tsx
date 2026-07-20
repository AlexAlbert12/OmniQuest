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
import BrandLogo from '../BrandLogo'
import AdminBottomNav from './AdminBottomNav'
import MobileMetricCard from '../ui/mobile/MobileMetricCard'
import { supabase } from '../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { useAppTheme } from '../../lib/appTheme'

type AdminSection = 'home' | 'teachers' | 'students' | 'courses' | 'classrooms' | 'audit'
type IconName = keyof typeof Ionicons.glyphMap

type ProfileRow = {
  id: string
  alias: string
  email: string | null
  role_id: string | null
  active: boolean | null
  created_at: string
  subject_count?: number | null
  enrollment_count?: number | null
  total_count?: number | null
}

type SubjectRow = {
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
  total_count?: number | null
}

type ClassroomRow = {
  id: number
  subject_id: number | null
  name: string
  code: string | null
  active: boolean | null
  created_at: string
  subject_name?: string | null
  enrollments_count?: number | null
  total_count?: number | null
}

type AdminAuditLogRow = {
  id: number
  admin_id: string
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type EnrollmentRow = {
  id: number
  student_id: string
  subject_id: number
  classroom_id: number | null
}

type AdminDashboardMetrics = {
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

type CreateTeacherResult = {
  status: 'created' | 'existing'
  teacher: {
    id: string
    alias: string
    email: string
  }
  temporaryPassword?: string
}

type AdminData = {
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

type AdminActionResult = {
  error?: string
  ok?: boolean
}

const ADMIN_PAGE_SIZE = 50

const adminSections: { section: AdminSection; label: string; icon: IconName; href: string }[] = [
  { section: 'home', label: 'Inicio', icon: 'home-outline', href: '/(admin)/homeAdmin' },
  { section: 'teachers', label: 'Profesores', icon: 'school-outline', href: '/(admin)/teachers' },
  { section: 'students', label: 'Alumnos', icon: 'people-outline', href: '/(admin)/students' },
  { section: 'courses', label: 'Cursos', icon: 'book-outline', href: '/(admin)/courses' },
  { section: 'classrooms', label: 'Clases', icon: 'albums-outline', href: '/(admin)/classrooms' },
  { section: 'audit', label: 'Auditoría', icon: 'receipt-outline', href: '/(admin)/audit' },
]

function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204' || errorCode === 'PGRST205'
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`)
    return
  }

  Alert.alert(title, message)
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
  ])
}

async function fetchOptionalRows<T>(
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

async function invokeAdminAction<T extends AdminActionResult>(
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


function getFallbackAdminMetrics({
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

function normalizeAdminMetrics(value: unknown, fallback: AdminDashboardMetrics): AdminDashboardMetrics {
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Partial<Record<keyof AdminDashboardMetrics, unknown>>

  return Object.fromEntries(
    (Object.keys(fallback) as (keyof AdminDashboardMetrics)[]).map((key) => {
      const numberValue = typeof raw[key] === 'number' ? raw[key] as number : fallback[key]
      return [key, Number.isFinite(numberValue) ? numberValue : fallback[key]]
    })
  ) as AdminDashboardMetrics
}

function useAdminData(): AdminData {
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

function useAdminRpcPage<T extends { total_count?: number | null }>(
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

function useAdminActions(data: AdminData) {
  const router = useRouter()

  const toggleProfileActive = useCallback(
    async (profile: ProfileRow) => {
      const nextActive = profile.active === false
      confirmAction(
        nextActive ? 'Activar usuario' : 'Desactivar usuario',
        `${nextActive ? 'Se activará' : 'Se desactivará'} la cuenta de ${profile.alias}.`,
        async () => {
          try {
            await invokeAdminAction('admin-toggle-user', {
              active: nextActive,
              profileId: profile.id,
            })
            await data.refresh()
          } catch (error: any) {
            showAlert('No se pudo actualizar', error.message)
          }
        }
      )
    },
    [data]
  )

  const resetPassword = useCallback(async (profile: ProfileRow) => {
    if (!profile.email) {
      showAlert('Sin correo', 'Este usuario no tiene correo guardado en profiles.email.')
      return
    }

    try {
      await invokeAdminAction('admin-reset-password', {
        profileId: profile.id,
      })
      showAlert('Correo enviado', `Se ha enviado un enlace de restablecimiento a ${profile.email}.`)
    } catch (error: any) {
      showAlert('No se pudo restablecer', error.message)
    }
  }, [])

  const deleteStudentProgress = useCallback(
    async (student: ProfileRow) => {
      confirmAction(
        'Eliminar progreso',
        `Se eliminarán puntuaciones, progreso por tema e intentos de ${student.alias}. Esta acción no se puede deshacer.`,
        async () => {
          try {
            await invokeAdminAction('admin-delete-student-progress', {
              studentId: student.id,
            })
            await data.refresh()
            showAlert('Progreso eliminado', `El progreso de ${student.alias} se ha eliminado.`)
          } catch (error: any) {
            showAlert('No se pudo eliminar progreso', error.message)
          }
        }
      )
    },
    [data]
  )

  const toggleCourseArchive = useCallback(
    async (subject: SubjectRow) => {
      const archive = !subject.is_archived
      confirmAction(
        archive ? 'Archivar curso' : 'Restaurar curso',
        `${archive ? 'Se archivará' : 'Se restaurará'} el curso ${subject.name}.`,
        async () => {
          try {
            await invokeAdminAction('admin-archive-course', {
              archive,
              subjectId: subject.id,
            })
            await data.refresh()
          } catch (error: any) {
            showAlert('No se pudo actualizar el curso', error.message)
          }
        }
      )
    },
    [data]
  )

  const toggleClassroomActive = useCallback(
    async (classroom: ClassroomRow) => {
      const nextActive = classroom.active === false
      confirmAction(
        nextActive ? 'Activar clase' : 'Desactivar clase',
        `${nextActive ? 'Se activará' : 'Se desactivará'} la clase ${classroom.name}.`,
        async () => {
          try {
            await invokeAdminAction('admin-deactivate-classroom', {
              active: nextActive,
              classroomId: classroom.id,
            })
            await data.refresh()
          } catch (error: any) {
            showAlert('No se pudo actualizar la clase', error.message)
          }
        }
      )
    },
    [data]
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

  return {
    router,
    toggleProfileActive,
    resetPassword,
    deleteStudentProgress,
    toggleCourseArchive,
    toggleClassroomActive,
    copyClassroomCode,
  }
}

export function AdminHomeScreen() {
  const data = useAdminData()
  const actions = useAdminActions(data)
  const dashboard = useAdminDashboard(data)

  return (
    <AdminScaffold activeSection="home" title="Inicio Admin" subtitle="Vista general del sistema, alertas y accesos rápidos." data={data}>
      <AdminMetrics data={data} activeSection="home" />

      <View className="mt-5">
        <AdminSectionIntro
          title="Panel de control"
          description="Supervisa usuarios, cursos, clases e inscripciones desde una vista general."
        />
      </View>

      <View className="mt-5 flex-row flex-wrap gap-4">
        <HomeShortcut icon="person-add-outline" label="Crear profesor" onPress={() => actions.router.push('/(admin)/teachers' as any)} />
        <HomeShortcut icon="archive-outline" label="Cursos archivados" onPress={() => actions.router.push('/(admin)/courses?archived=1' as any)} />
        <HomeShortcut icon="download-outline" label="Exportar usuarios" onPress={() => showAlert('Exportar usuarios', 'Usa las secciones Profesores o Alumnos para exportar el listado filtrado.')} />
        <HomeShortcut icon="albums-outline" label="Revisar clases" onPress={() => actions.router.push('/(admin)/classrooms' as any)} />
        <HomeShortcut icon="receipt-outline" label="Ver auditoría" onPress={() => actions.router.push('/(admin)/audit' as any)} />
      </View>

      <View className="mt-5 flex-row flex-wrap gap-5">
        <View className="min-w-[280px] flex-1">
          <Panel title="Alertas del sistema" icon="alert-circle-outline">
            <SystemAlertRow icon="person-remove-outline" label="Usuarios inactivos" value={dashboard.inactiveUsers} color="#FB7185" />
            <SystemAlertRow icon="book-outline" label="Cursos sin clases" value={dashboard.coursesWithoutClassrooms} color="#F59E0B" />
            <SystemAlertRow icon="time-outline" label="Alumnos sin actividad" value={dashboard.studentsWithoutActivity} color="#8FA7C7" />
            <SystemAlertRow icon="key-outline" label="Clases sin código" value={dashboard.classroomsWithoutCode} color="#38BDF8" />
          </Panel>
        </View>

        <View className="min-w-[280px] flex-1">
          <Panel title="Actividad administrativa" icon="analytics-outline">
            <SideFact label="Cursos activos" value={String(dashboard.activeCourses)} />
            <SideFact label="Cursos archivados" value={String(dashboard.archivedCourses)} />
            <SideFact label="Clases activas" value={String(dashboard.activeClassrooms)} />
            <SideFact label="Inscripciones" value={String(dashboard.enrollmentsCount)} />
          </Panel>
        </View>
      </View>

      <View className="mt-5">
        <RecentAuditPanel data={data} />
      </View>

      <View className="mt-5">
        <Panel title="Modelo de acceso" icon="lock-closed-outline" compact>
          <Text className="text-[13px] leading-5 text-[#B7C4D7]">
            Los alumnos se registran desde la app o se importan por clase. Los profesores se crean desde el portal de administración.
          </Text>
          <Text className="mt-2 text-[12px] leading-5 text-[#8FA7C7]">
            Para activar el primer administrador, asigna role_id = admin al perfil correspondiente en Supabase.
          </Text>
        </Panel>
      </View>
    </AdminScaffold>
  )
}

export function AdminTeachersScreen() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const actions = useAdminActions(data)
  const params = useLocalSearchParams<{ teacherId?: string }>()
  const [search, setSearch] = useState('')
  const [teacherAlias, setTeacherAlias] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [createdTeacher, setCreatedTeacher] = useState<CreateTeacherResult | null>(null)

  const teacherPage = useAdminRpcPage<ProfileRow>('get_admin_profiles_page', {
    p_role: 'teacher',
    p_search: search.trim(),
    p_subject_id: null,
    p_classroom_id: null,
    p_profile_id: params.teacherId || null,
  }, data.version, adminPageSize)
  const visibleTeachers = teacherPage.rows

  const handleCreateTeacher = async () => {
    const email = teacherEmail.trim().toLowerCase()
    const alias = teacherAlias.trim() || email.split('@')[0]

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Correo no válido', 'Introduce el correo del profesor.')
      return
    }

    setCreatingTeacher(true)
    setCreatedTeacher(null)

    try {
      const { data: resultData, error } = await supabase.functions.invoke('admin-create-teacher', {
        body: {
          alias,
          email,
          password: teacherPassword.trim() || undefined,
        },
      })

      if (error) throw error

      const result = resultData as CreateTeacherResult
      setCreatedTeacher(result)
      setTeacherAlias('')
      setTeacherEmail('')
      setTeacherPassword('')
      await data.refresh()
      teacherPage.refresh()
    } catch (error: any) {
      showAlert('No se pudo crear el profesor', error.message || 'Revisa la Edge Function y los permisos del usuario administrador.')
    } finally {
      setCreatingTeacher(false)
    }
  }

  return (
    <AdminScaffold activeSection="teachers" title="Profesores" subtitle="Crea y gestiona las cuentas docentes." data={data}>
      <AdminMetrics data={data} activeSection="teachers" />

      <View className="mt-5">
        <AdminSectionIntro title="Gestión de profesores" description="Administra cuentas docentes, sus cursos y el acceso a la plataforma." />
      </View>

      <Panel title="Crear cuenta de profesor" icon="person-add-outline" className="mt-5">
        <View className="flex-row flex-wrap items-end gap-3">
          <AdminInput label="Alias" value={teacherAlias} onChangeText={setTeacherAlias} placeholder="Ej. Profesor Random" />
          <AdminInput label="Correo" value={teacherEmail} onChangeText={setTeacherEmail} placeholder="profesor@centro.es" autoCapitalize="none" />
          <AdminInput label="Contraseña temporal" value={teacherPassword} onChangeText={setTeacherPassword} placeholder="Autogenerar" />
          <Pressable
            onPress={handleCreateTeacher}
            disabled={creatingTeacher}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#5A46D8] px-5"
            style={({ pressed }) => ({ opacity: creatingTeacher ? 0.6 : pressed ? 0.82 : 1 })}
          >
            {creatingTeacher ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={18} color="#FFFFFF" />}
            <Text className="font-black text-white">{creatingTeacher ? 'Creando...' : 'Crear profesor'}</Text>
          </Pressable>
        </View>

        {createdTeacher ? (
          <View className="mt-4 rounded-xl border border-[#1E3A8A] bg-[#10224A] p-4">
            <Text className="font-black text-white">
              {createdTeacher.status === 'created' ? 'Profesor creado' : 'Profesor actualizado'}
            </Text>
            <Text className="mt-1 text-[13px] text-[#B7C4D7]">
              {createdTeacher.teacher.alias} · {createdTeacher.teacher.email}
            </Text>
            {createdTeacher.temporaryPassword ? (
              <Text className="mt-2 text-[13px] text-[#DDE7F4]">
                Contraseña temporal:{' '}
                <Text className="font-mono font-black text-[#9FD6FF]">{createdTeacher.temporaryPassword}</Text>
              </Text>
            ) : null}
          </View>
        ) : null}
      </Panel>

      <Panel title="Listado de profesores" icon="school-outline" className="mt-5">
        <AdminSearch value={search} onChangeText={setSearch} placeholder="Buscar profesor por nombre o correo..." />
        <View className="mt-4" style={{ gap: 12 }}>
          {teacherPage.loading && !teacherPage.refreshing ? <ListLoadingState /> : null}
          {visibleTeachers.map((profile) => (
            <ProfileRowCard
              key={profile.id}
              profile={profile}
              meta={`${profile.subject_count ?? 0} curso(s)`}
              actions={[
                { label: 'Ver cursos', icon: 'book-outline', onPress: () => actions.router.push(`/(admin)/courses?teacherId=${profile.id}` as any) },
                { label: profile.active === false ? 'Activar' : 'Desactivar', icon: profile.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: profile.active !== false, onPress: () => actions.toggleProfileActive(profile) },
                { label: 'Restablecer contraseña', icon: 'key-outline', onPress: () => actions.resetPassword(profile) },
              ]}
            />
          ))}
          {!teacherPage.loading && visibleTeachers.length === 0 ? <EmptyState label="No hay profesores que coincidan." /> : null}
        </View>
        <AdminPaginationControls page={teacherPage.page} pageSize={teacherPage.pageSize} total={teacherPage.total} hasPrevious={teacherPage.hasPrevious} hasNext={teacherPage.hasNext} onPrevious={teacherPage.previousPage} onNext={teacherPage.nextPage} />
      </Panel>
    </AdminScaffold>
  )
}

export function AdminStudentsScreen() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const actions = useAdminActions(data)
  const params = useLocalSearchParams<{ classroomId?: string; subjectId?: string }>()
  const [search, setSearch] = useState('')

  const studentPage = useAdminRpcPage<ProfileRow>('get_admin_profiles_page', {
    p_role: 'student',
    p_search: search.trim(),
    p_subject_id: params.subjectId ? Number(params.subjectId) : null,
    p_classroom_id: params.classroomId ? Number(params.classroomId) : null,
    p_profile_id: null,
  }, data.version, adminPageSize)
  const visibleStudents = studentPage.rows

  return (
    <AdminScaffold activeSection="students" title="Alumnos" subtitle="Consulta cuentas, inscripciones y progreso acumulado." data={data}>
      <AdminMetrics data={data} activeSection="students" />

      <View className="mt-5">
        <AdminSectionIntro title="Gestión de alumnos" description="Revisa alumnos registrados, inscripciones activas y acciones de mantenimiento." />
      </View>

      <Panel title="Listado de alumnos" icon="people-outline" className="mt-5">
        <AdminSearch value={search} onChangeText={setSearch} placeholder="Buscar alumno por nombre o correo..." />
        <View className="mt-4" style={{ gap: 12 }}>
          {studentPage.loading && !studentPage.refreshing ? <ListLoadingState /> : null}
          {visibleStudents.map((profile) => (
            <ProfileRowCard
              key={profile.id}
              profile={profile}
              meta={`${profile.enrollment_count ?? 0} inscripción(es)`}
              actions={[
                { label: 'Ver inscripciones', icon: 'albums-outline', onPress: () => actions.router.push(`/(admin)/classrooms?studentId=${profile.id}` as any) },
                { label: profile.active === false ? 'Activar' : 'Desactivar', icon: profile.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: profile.active !== false, onPress: () => actions.toggleProfileActive(profile) },
                { label: 'Eliminar progreso', icon: 'trash-outline', destructive: true, onPress: () => actions.deleteStudentProgress(profile) },
              ]}
            />
          ))}
          {!studentPage.loading && visibleStudents.length === 0 ? <EmptyState label="No hay alumnos que coincidan." /> : null}
        </View>
        <AdminPaginationControls page={studentPage.page} pageSize={studentPage.pageSize} total={studentPage.total} hasPrevious={studentPage.hasPrevious} hasNext={studentPage.hasNext} onPrevious={studentPage.previousPage} onNext={studentPage.nextPage} />
      </Panel>
    </AdminScaffold>
  )
}

export function AdminCoursesScreen() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const actions = useAdminActions(data)
  const params = useLocalSearchParams<{ teacherId?: string; archived?: string }>()
  const [search, setSearch] = useState('')

  const subjectPage = useAdminRpcPage<SubjectRow>('get_admin_subjects_page', {
    p_search: search.trim(),
    p_teacher_id: params.teacherId || null,
    p_archived: params.archived === '1' ? true : null,
  }, data.version, adminPageSize)
  const visibleSubjects = subjectPage.rows

  return (
    <AdminScaffold activeSection="courses" title="Cursos" subtitle="Administra cursos activos, archivados y docentes responsables." data={data}>
      <AdminMetrics data={data} activeSection="courses" />

      <View className="mt-5">
        <AdminSectionIntro title="Gestión de cursos" description="Consulta cursos, clases asociadas, inscripciones y estado de archivo." />
      </View>

      <Panel title="Listado de cursos" icon="book-outline" className="mt-5">
        <AdminSearch value={search} onChangeText={setSearch} placeholder="Buscar curso o profesor..." />
        <View className="mt-4" style={{ gap: 12 }}>
          {subjectPage.loading && !subjectPage.refreshing ? <ListLoadingState /> : null}
          {visibleSubjects.map((subject) => (
            <CourseRowCard
              key={subject.id}
              subject={subject}
              teacher={buildTeacherProfileFromSubject(subject)}
              classesCount={subject.classes_count ?? 0}
              enrollmentsCount={subject.enrollments_count ?? 0}
              actions={[
                { label: 'Ver clases', icon: 'albums-outline', onPress: () => actions.router.push(`/(admin)/classrooms?subjectId=${subject.id}` as any) },
                { label: subject.is_archived ? 'Restaurar' : 'Archivar', icon: subject.is_archived ? 'refresh-outline' : 'archive-outline', destructive: !subject.is_archived, onPress: () => actions.toggleCourseArchive(subject) },
                { label: 'Ver profesor', icon: 'school-outline', onPress: () => subject.teacher_id ? actions.router.push(`/(admin)/teachers?teacherId=${subject.teacher_id}` as any) : showAlert('Sin profesor', 'Este curso no tiene profesor asignado.') },
              ]}
            />
          ))}
          {!subjectPage.loading && visibleSubjects.length === 0 ? <EmptyState label="No hay cursos que coincidan." /> : null}
        </View>
        <AdminPaginationControls page={subjectPage.page} pageSize={subjectPage.pageSize} total={subjectPage.total} hasPrevious={subjectPage.hasPrevious} hasNext={subjectPage.hasNext} onPrevious={subjectPage.previousPage} onNext={subjectPage.nextPage} />
      </Panel>
    </AdminScaffold>
  )
}

export function AdminClassroomsScreen() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const adminPageSize = isDesktop ? ADMIN_PAGE_SIZE : 8
  const data = useAdminData()
  const actions = useAdminActions(data)
  const params = useLocalSearchParams<{ subjectId?: string; studentId?: string }>()
  const [search, setSearch] = useState('')

  const classroomPage = useAdminRpcPage<ClassroomRow>('get_admin_classrooms_page', {
    p_search: search.trim(),
    p_subject_id: params.subjectId ? Number(params.subjectId) : null,
    p_student_id: params.studentId || null,
  }, data.version, adminPageSize)
  const visibleClassrooms = classroomPage.rows

  return (
    <AdminScaffold activeSection="classrooms" title="Clases" subtitle="Gestiona códigos, estado e inscripciones por clase." data={data}>
      <AdminMetrics data={data} activeSection="classrooms" />

      <View className="mt-5">
        <AdminSectionIntro title="Gestión de clases" description="Revisa clases de cada curso, códigos de acceso y alumnos inscritos." />
      </View>

      <Panel title="Listado de clases" icon="albums-outline" className="mt-5">
        <AdminSearch value={search} onChangeText={setSearch} placeholder="Buscar clase, código o curso..." />
        <View className="mt-4" style={{ gap: 12 }}>
          {classroomPage.loading && !classroomPage.refreshing ? <ListLoadingState /> : null}
          {visibleClassrooms.map((classroom) => (
            <ClassroomRowCard
              key={classroom.id}
              classroom={classroom}
              subject={buildSubjectFromClassroom(classroom)}
              enrollmentsCount={classroom.enrollments_count ?? 0}
              actions={[
                { label: 'Copiar código', icon: 'copy-outline', onPress: () => actions.copyClassroomCode(classroom) },
                { label: 'Ver alumnos', icon: 'people-outline', onPress: () => actions.router.push(`/(admin)/students?classroomId=${classroom.id}` as any) },
                { label: classroom.active === false ? 'Activar' : 'Desactivar', icon: classroom.active === false ? 'checkmark-circle-outline' : 'ban-outline', destructive: classroom.active !== false, onPress: () => actions.toggleClassroomActive(classroom) },
              ]}
            />
          ))}
          {!classroomPage.loading && visibleClassrooms.length === 0 ? <EmptyState label="No hay clases que coincidan." /> : null}
        </View>
        <AdminPaginationControls page={classroomPage.page} pageSize={classroomPage.pageSize} total={classroomPage.total} hasPrevious={classroomPage.hasPrevious} hasNext={classroomPage.hasNext} onPrevious={classroomPage.previousPage} onNext={classroomPage.nextPage} />
      </Panel>
    </AdminScaffold>
  )
}


export function AdminAuditScreen() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const auditPageSize = isDesktop ? 25 : 8
  const data = useAdminData()
  const [search, setSearch] = useState('')

  const auditPage = useAdminRpcPage<AdminAuditLogRow & { total_count?: number | null }>(
    'get_admin_audit_logs_page',
    { p_search: search.trim() || null },
    data.version,
    auditPageSize,
  )

  return (
    <AdminScaffold activeSection="audit" title="Auditoría" subtitle="Registro de acciones sensibles realizadas desde el portal admin." data={data}>
      <AdminMetrics data={data} activeSection="audit" />

      <View className="mt-5">
        <AdminSectionIntro
          title="Registro de auditoría"
          description="Consulta quién ejecutó cada acción crítica, sobre qué entidad y cuándo se realizó. El listado se pagina directamente en servidor."
        />
      </View>

      <Panel title="Últimas acciones registradas" icon="receipt-outline" className="mt-5">
        <AdminSearch
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por acción, admin, objetivo o metadata..."
        />
        <View className="mt-4" style={{ gap: 12 }}>
          {auditPage.loading && !auditPage.refreshing ? <ListLoadingState /> : null}
          {auditPage.rows.map((log) => (
            <AuditLogCard key={log.id} log={log} data={data} />
          ))}
          {!auditPage.loading && auditPage.rows.length === 0 ? (
            <EmptyState label="No hay acciones de auditoría que coincidan." />
          ) : null}
        </View>
        <AdminPaginationControls
          page={auditPage.page}
          pageSize={auditPage.pageSize}
          total={auditPage.total}
          hasPrevious={auditPage.hasPrevious}
          hasNext={auditPage.hasNext}
          onPrevious={auditPage.previousPage}
          onNext={auditPage.nextPage}
        />
      </Panel>
    </AdminScaffold>
  )
}

function AdminScaffold({
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

          {children}
        </ScrollView>
      </View>

      {!isDesktop ? <AdminBottomNav active={activeSection} /> : null}
    </View>
  )
}

function AdminSidebar({ activeSection, onSignOut }: { activeSection: AdminSection; onSignOut: () => void }) {
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

function AdminNavButton({ active, item }: { active: boolean; item: { label: string; icon: IconName; href: string } }) {
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

function AdminMetrics({ activeSection, data }: { activeSection: AdminSection; data: AdminData }) {
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

function AdminMobileCriticalAlerts({ data }: { data: AdminData }) {
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

function AdminMobileSectionTabs({ activeSection }: { activeSection: AdminSection }) {
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
        {adminSections.map((item) => {
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

function AdminSectionIntro({ title, description }: { title: string; description: string }) {
  const { width } = useWindowDimensions()
  if (width < 1040) return null

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <Text className="text-[18px] font-black text-white">{title}</Text>
      <Text className="mt-1 text-[13px] leading-5 text-[#B7C4D7]">{description}</Text>
    </View>
  )
}

function HomeShortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
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

function Panel({
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

function AdminMetric({ color, compact = false, icon, label, value, width }: { color: string; compact?: boolean; icon: IconName; label: string; value: string; width?: number }) {
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

function AdminInput({
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

function AdminSearch({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
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

type RowAction = {
  label: string
  icon: IconName
  destructive?: boolean
  onPress: () => void
}

function ProfileRowCard({ actions, meta, profile }: { actions: RowAction[]; meta: string; profile: ProfileRow }) {
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
        <Text className="text-[12px] font-semibold text-[#AFC2DB]">{meta}</Text>
      </View>
      <RowActions actions={actions} />
    </View>
  )
}

function CourseRowCard({
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
  return (
    <View className="rounded-xl border border-[#20375E] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-[240px] flex-1">
          <Text className="font-black text-white">{subject.name}</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">Profesor: {teacher?.alias || 'Sin asignar'}</Text>
        </View>
        <StatusPill active={subject.active !== false && !subject.is_archived} label={subject.is_archived ? 'Archivado' : undefined} />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <MiniPill icon="albums-outline" label={`${classesCount} clase(s)`} />
        <MiniPill icon="people-outline" label={`${enrollmentsCount} inscripción(es)`} />
      </View>
      <RowActions actions={actions} />
    </View>
  )
}

function ClassroomRowCard({
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
  return (
    <View className="rounded-xl border border-[#20375E] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#1A1E55]">
          <Ionicons name="albums-outline" size={22} color="#C4B5FD" />
        </View>
        <View className="min-w-[240px] flex-1">
          <Text className="font-black text-white">{classroom.name}</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">{subject?.name || 'Curso no disponible'}</Text>
        </View>
        {classroom.code ? <Text className="rounded-lg bg-[#102A54] px-3 py-2 font-mono text-[12px] font-black text-[#9FD6FF]">{classroom.code}</Text> : null}
        <MiniPill icon="people-outline" label={`${enrollmentsCount} alumno(s)`} />
        <StatusPill active={classroom.active !== false} />
      </View>
      <RowActions actions={actions} />
    </View>
  )
}


function RecentAuditPanel({ data }: { data: AdminData }) {
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

function AuditLogCard({ compact, data, log }: { compact?: boolean; data: AdminData; log: AdminAuditLogRow }) {
  const admin = data.profiles.find((profile) => profile.id === log.admin_id)
  const targetLabel = getAuditTargetLabel(log)

  return (
    <View className="rounded-xl border border-[#20375E] bg-[#09162C] p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[220px] flex-1">
          <Text className="font-black text-white">{getAuditActionLabel(log.action)}</Text>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]">
            {admin?.alias || 'Admin desconocido'} · {formatAuditDate(log.created_at)}
          </Text>
        </View>
        <MiniPill icon="shield-checkmark-outline" label={log.target_table || 'sistema'} />
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

function getAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    'admin.classroom.activate': 'Admin activó una clase',
    'admin.classroom.deactivate': 'Admin desactivó una clase',
    'admin.course.archive': 'Admin archivó un curso',
    'admin.course.restore': 'Admin restauró un curso',
    'admin.student.delete_progress': 'Admin eliminó progreso de un alumno',
    'admin.teacher.create': 'Admin creó un profesor',
    'admin.teacher.update_existing': 'Admin actualizó un profesor existente',
    'admin.user.activate': 'Admin activó un usuario',
    'admin.user.deactivate': 'Admin desactivó un usuario',
    'admin.user.reset_password': 'Admin restableció una contraseña',
  }
  return labels[action] || action
}

function getAuditTargetLabel(log: AdminAuditLogRow) {
  const metadata = log.metadata || {}
  const name = stringMetadata(metadata, 'alias') || stringMetadata(metadata, 'name') || stringMetadata(metadata, 'email')
  const target = [log.target_table, log.target_id].filter(Boolean).join(': ')

  if (name && target) return `${name} · ${target}`
  return name || target || 'Acción sin objetivo concreto'
}

function auditSearchText(log: AdminAuditLogRow, data: AdminData) {
  const admin = data.profiles.find((profile) => profile.id === log.admin_id)
  return [
    log.action,
    getAuditActionLabel(log.action),
    getAuditTargetLabel(log),
    log.target_table,
    log.target_id,
    admin?.alias,
    admin?.email,
    JSON.stringify(log.metadata || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function stringMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function formatAuditDate(value?: string | null) {
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

function RowActions({ actions }: { actions: RowAction[] }) {
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

function StatusPill({ active, label }: { active: boolean; label?: string }) {
  const resolvedLabel = label || (active ? 'Activo' : 'Inactivo')
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: active ? '#063D31' : '#3B1D2A' }}>
      <Text className="text-[12px] font-black" style={{ color: active ? '#34D399' : '#FB7185' }}>
        {resolvedLabel}
      </Text>
    </View>
  )
}

function MiniPill({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-[#20375E] bg-[#07162D] px-3 py-2">
      <Ionicons name={icon} size={14} color="#AFC2DB" />
      <Text className="text-[12px] font-semibold text-[#DDE7F4]">{label}</Text>
    </View>
  )
}

function SideFact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#13284A] py-3">
      <Text className="text-[13px] font-semibold text-[#AFC2DB]">{label}</Text>
      <Text className="font-black text-white">{value}</Text>
    </View>
  )
}

function SystemAlertRow({ color, icon, label, value }: { color: string; icon: IconName; label: string; value: number }) {
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

function EmptyState({ label }: { label: string }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
      <Ionicons name="search-outline" size={34} color="#8FA7C7" />
      <Text className="mt-3 text-center font-bold text-[#AFC2DB]">{label}</Text>
    </View>
  )
}

function ListLoadingState() {
  return (
    <View className="items-center rounded-xl border border-[#20375E] bg-[#09162C] p-5">
      <ActivityIndicator color="#8B5CF6" />
      <Text className="mt-3 text-[13px] font-semibold text-[#8FA7C7]">Cargando página...</Text>
    </View>
  )
}

function AdminPaginationControls({
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

function buildTeacherProfileFromSubject(subject: SubjectRow): ProfileRow | undefined {
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

function buildSubjectFromClassroom(classroom: ClassroomRow): SubjectRow | undefined {
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

function useAdminDashboard(data: AdminData) {
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

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}

function getAdminSectionIcon(section: AdminSection): IconName {
  const item = adminSections.find((entry) => entry.section === section)
  return item?.icon || 'shield-checkmark-outline'
}

function filledIconFor(icon: IconName): IconName {
  const map: Partial<Record<IconName, IconName>> = {
    'home-outline': 'home',
    'school-outline': 'school',
    'people-outline': 'people',
    'book-outline': 'book',
    'albums-outline': 'albums',
    'receipt-outline': 'receipt',
  }
  return map[icon] || icon
}
