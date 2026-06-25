import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import BrandLogo from '../../components/BrandLogo'
import { supabase } from '../../lib/supabase'

type AdminTab = 'teachers' | 'students' | 'courses' | 'classrooms'
type IconName = keyof typeof Ionicons.glyphMap

type ProfileRow = {
  id: string
  alias: string
  email: string | null
  role_id: string | null
  active: boolean | null
  created_at: string
}

type SubjectRow = {
  id: number
  name: string
  teacher_id: string | null
  active: boolean | null
  is_archived: boolean | null
  created_at: string | null
}

type ClassroomRow = {
  id: number
  subject_id: number | null
  name: string
  code: string | null
  active: boolean | null
  created_at: string
}

type EnrollmentRow = {
  id: number
  student_id: string
  subject_id: number
  classroom_id: number | null
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

const tabs: { key: AdminTab; label: string; icon: IconName }[] = [
  { key: 'teachers', label: 'Profesores', icon: 'school-outline' },
  { key: 'students', label: 'Alumnos', icon: 'people-outline' },
  { key: 'courses', label: 'Cursos', icon: 'book-outline' },
  { key: 'classrooms', label: 'Clases', icon: 'albums-outline' },
]

export default function AdminPortalScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminTab>('teachers')
  const [search, setSearch] = useState('')
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [teacherAlias, setTeacherAlias] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [createdTeacher, setCreatedTeacher] = useState<CreateTeacherResult | null>(null)

  const teachers = useMemo(() => profiles.filter((profile) => profile.role_id === 'teacher'), [profiles])
  const students = useMemo(() => profiles.filter((profile) => profile.role_id === 'student' || profile.role_id === 'guest'), [profiles])
  const teacherById = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher])), [teachers])
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects])

  const normalizedSearch = search.trim().toLowerCase()
  const visibleTeachers = useMemo(
    () => filterProfiles(teachers, normalizedSearch),
    [normalizedSearch, teachers]
  )
  const visibleStudents = useMemo(
    () => filterProfiles(students, normalizedSearch),
    [normalizedSearch, students]
  )
  const visibleSubjects = useMemo(
    () => subjects.filter((subject) => {
      if (!normalizedSearch) return true
      const teacher = subject.teacher_id ? teacherById.get(subject.teacher_id) : null
      return `${subject.name} ${teacher?.alias || ''} ${teacher?.email || ''}`.toLowerCase().includes(normalizedSearch)
    }),
    [normalizedSearch, subjects, teacherById]
  )
  const visibleClassrooms = useMemo(
    () => classrooms.filter((classroom) => {
      if (!normalizedSearch) return true
      const subject = classroom.subject_id ? subjectById.get(classroom.subject_id) : null
      return `${classroom.name} ${classroom.code || ''} ${subject?.name || ''}`.toLowerCase().includes(normalizedSearch)
    }),
    [classrooms, normalizedSearch, subjectById]
  )

  const fetchData = useCallback(async () => {
    try {
      const [profilesResult, subjectsResult, classroomsResult, enrollmentsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, alias, email, role_id, active, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('subjects')
          .select('id, name, teacher_id, active, is_archived, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('classrooms')
          .select('id, subject_id, name, code, active, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('enrollments')
          .select('id, student_id, subject_id, classroom_id'),
      ])

      if (profilesResult.error) throw profilesResult.error
      if (subjectsResult.error) throw subjectsResult.error
      if (classroomsResult.error) throw classroomsResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error

      setProfiles((profilesResult.data || []) as ProfileRow[])
      setSubjects((subjectsResult.data || []) as SubjectRow[])
      setClassrooms((classroomsResult.data || []) as ClassroomRow[])
      setEnrollments((enrollmentsResult.data || []) as EnrollmentRow[])
    } catch (error: any) {
      Alert.alert('No se pudo cargar el portal', error.message || 'Revisa los permisos de administrador y las políticas RLS.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const onRefresh = () => {
    setRefreshing(true)
    void fetchData()
  }

  const handleCreateTeacher = async () => {
    const email = teacherEmail.trim().toLowerCase()
    const alias = teacherAlias.trim() || email.split('@')[0]

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Correo no válido', 'Introduce el correo del profesor.')
      return
    }

    setCreatingTeacher(true)
    setCreatedTeacher(null)

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-teacher', {
        body: {
          alias,
          email,
          password: teacherPassword.trim() || undefined,
        },
      })

      if (error) throw error

      const result = data as CreateTeacherResult
      setCreatedTeacher(result)
      setTeacherAlias('')
      setTeacherEmail('')
      setTeacherPassword('')
      await fetchData()
    } catch (error: any) {
      Alert.alert('No se pudo crear el profesor', error.message || 'Revisa la Edge Function y los permisos del usuario administrador.')
    } finally {
      setCreatingTeacher(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando portal de administrador...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} onSignOut={handleSignOut} /> : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 16,
            paddingTop: isDesktop ? 24 : 18,
            paddingBottom: 36,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[260px] flex-1">
              {!isDesktop ? <BrandLogo size={30} style={{ marginBottom: 12 }} /> : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="shield-checkmark" size={42} color="#9FD6FF" />
                <Text className="text-[36px] font-black text-white">Portal Admin</Text>
              </View>
              <Text className="mt-2 text-[14px] text-[#B7C4D7]">
                Control global de profesores, alumnos, cursos, clases e inscripciones.
              </Text>
            </View>

            <Pressable
              onPress={handleSignOut}
              className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
            >
              <Ionicons name="log-out-outline" size={18} color="#FB7185" />
              <Text className="font-bold text-[#FCA5A5]">Cerrar sesión</Text>
            </Pressable>
          </View>

          <View className={isDesktop ? 'mb-5 flex-row gap-4' : 'mb-5 gap-4'}>
            <AdminMetric icon="school" label="Profesores" value={String(teachers.length)} color="#8B5CF6" />
            <AdminMetric icon="people" label="Alumnos" value={String(students.length)} color="#34D399" />
            <AdminMetric icon="book" label="Cursos" value={String(subjects.length)} color="#38BDF8" />
            <AdminMetric icon="albums" label="Clases" value={String(classrooms.length)} color="#F59E0B" />
            <AdminMetric icon="person-add" label="Inscripciones" value={String(enrollments.length)} color="#FB7185" />
          </View>

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <View className={isDesktop ? 'flex-[1.45]' : ''}>
              <Panel title="Crear cuenta de profesor" icon="person-add-outline">
                <View className={isDesktop ? 'flex-row flex-wrap items-end gap-3' : 'gap-3'}>
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

              {!isDesktop ? (
                <View className="mt-5 flex-row flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onPress={() => setActiveTab(tab.key)} />
                  ))}
                </View>
              ) : null}

              <Panel title={getTabTitle(activeTab)} icon={getTabIcon(activeTab)} className="mt-5">
                <View className="mb-4 h-12 flex-row items-center rounded-xl border border-[#20375E] bg-[#09162C] px-4">
                  <TextInput
                    className="min-w-0 flex-1 text-white"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Buscar por nombre, correo, curso o código..."
                    placeholderTextColor="#60799C"
                  />
                  <Ionicons name="search-outline" size={19} color="#8FA7C7" />
                </View>

                {activeTab === 'teachers' ? (
                  <View style={{ gap: 12 }}>
                    {visibleTeachers.map((profile) => (
                      <ProfileRowCard
                        key={profile.id}
                        profile={profile}
                        meta={`${subjects.filter((subject) => subject.teacher_id === profile.id).length} curso(s)`}
                      />
                    ))}
                    {visibleTeachers.length === 0 ? <EmptyState label="No hay profesores que coincidan." /> : null}
                  </View>
                ) : null}

                {activeTab === 'students' ? (
                  <View style={{ gap: 12 }}>
                    {visibleStudents.map((profile) => (
                      <ProfileRowCard
                        key={profile.id}
                        profile={profile}
                        meta={`${enrollments.filter((enrollment) => enrollment.student_id === profile.id).length} inscripción(es)`}
                      />
                    ))}
                    {visibleStudents.length === 0 ? <EmptyState label="No hay alumnos que coincidan." /> : null}
                  </View>
                ) : null}

                {activeTab === 'courses' ? (
                  <View style={{ gap: 12 }}>
                    {visibleSubjects.map((subject) => (
                      <CourseRowCard
                        key={subject.id}
                        subject={subject}
                        teacher={subject.teacher_id ? teacherById.get(subject.teacher_id) : undefined}
                        classesCount={classrooms.filter((classroom) => classroom.subject_id === subject.id).length}
                        enrollmentsCount={enrollments.filter((enrollment) => enrollment.subject_id === subject.id).length}
                      />
                    ))}
                    {visibleSubjects.length === 0 ? <EmptyState label="No hay cursos que coincidan." /> : null}
                  </View>
                ) : null}

                {activeTab === 'classrooms' ? (
                  <View style={{ gap: 12 }}>
                    {visibleClassrooms.map((classroom) => (
                      <ClassroomRowCard
                        key={classroom.id}
                        classroom={classroom}
                        subject={classroom.subject_id ? subjectById.get(classroom.subject_id) : undefined}
                        enrollmentsCount={enrollments.filter((enrollment) => enrollment.classroom_id === classroom.id).length}
                      />
                    ))}
                    {visibleClassrooms.length === 0 ? <EmptyState label="No hay clases que coincidan." /> : null}
                  </View>
                ) : null}
              </Panel>
            </View>

            <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
              <Panel title="Estado del sistema" icon="analytics-outline">
                <SideFact label="Cursos archivados" value={String(subjects.filter((subject) => subject.is_archived).length)} />
                <SideFact label="Cursos activos" value={String(subjects.filter((subject) => subject.active !== false && !subject.is_archived).length)} />
                <SideFact label="Clases activas" value={String(classrooms.filter((classroom) => classroom.active !== false).length)} />
                <SideFact label="Usuarios inactivos" value={String(profiles.filter((profile) => profile.active === false).length)} />
              </Panel>

              <Panel title="Modelo de acceso" icon="lock-closed-outline">
                <Text className="text-[13px] leading-5 text-[#B7C4D7]">
                  Los alumnos se registran desde la app. Los profesores solo se crean desde este portal por un administrador.
                </Text>
                <Text className="mt-3 text-[12px] leading-5 text-[#8FA7C7]">
                  Para activar el primer administrador, cambia manualmente su perfil a role_id = admin en Supabase.
                </Text>
              </Panel>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

function AdminSidebar({
  activeTab,
  onSignOut,
  onTabChange,
}: {
  activeTab: AdminTab
  onSignOut: () => void
  onTabChange: (tab: AdminTab) => void
}) {
  return (
    <View className="w-[292px] border-r border-[#1A3155] bg-[#07162D] px-5 py-6">
      <BrandLogo size={32} />
      <Text className="mt-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#60799C]">Administración</Text>

      <View className="mt-8 gap-2">
        {tabs.map((tab) => (
          <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onPress={() => onTabChange(tab.key)} />
        ))}
      </View>

      <View className="mt-auto rounded-2xl border border-[#20375E] bg-[#09162C] p-4">
        <Text className="font-black text-white">Portal privado</Text>
        <Text className="mt-1 text-[12px] leading-5 text-[#8FA7C7]">Gestión interna de OmniQuest.</Text>
        <Pressable onPress={onSignOut} className="mt-4 flex-row items-center gap-2 rounded-xl border border-[#3B1D2A] bg-[#1F1020] px-4 py-3">
          <Ionicons name="log-out-outline" size={17} color="#FB7185" />
          <Text className="font-bold text-[#FCA5A5]">Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  )
}

function TabButton({
  active,
  onPress,
  tab,
}: {
  active: boolean
  onPress: () => void
  tab: { key: AdminTab; label: string; icon: IconName }
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl px-4 py-3"
      style={({ pressed }) => ({
        backgroundColor: active ? '#28357D' : '#09162C',
        borderWidth: 1,
        borderColor: active ? '#6D5AF6' : '#20375E',
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Ionicons name={active ? (tab.icon.replace('-outline', '') as IconName) : tab.icon} size={19} color={active ? '#FFFFFF' : '#AFC2DB'} />
      <Text className={`font-black ${active ? 'text-white' : 'text-[#B7C4D7]'}`}>{tab.label}</Text>
    </Pressable>
  )
}

function Panel({
  children,
  className = '',
  icon,
  title,
}: {
  children: React.ReactNode
  className?: string
  icon: IconName
  title: string
}) {
  return (
    <View className={`rounded-2xl border border-[#1A3155] bg-[#07162D] p-5 ${className}`}>
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

function AdminMetric({ color, icon, label, value }: { color: string; icon: IconName; label: string; value: string }) {
  return (
    <View className="min-w-[160px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}26` }}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text className="mt-4 text-[28px] font-black text-white">{value}</Text>
      <Text className="mt-1 text-[12px] font-semibold text-[#AFC2DB]">{label}</Text>
    </View>
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
        placeholderTextColor="#60799C"
        className="h-12 rounded-xl border border-[#20375E] bg-[#09162C] px-4 text-white"
      />
    </View>
  )
}

function ProfileRowCard({ meta, profile }: { meta: string; profile: ProfileRow }) {
  return (
    <View className="flex-row flex-wrap items-center gap-4 rounded-xl border border-[#20375E] bg-[#09162C] p-4">
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
  )
}

function CourseRowCard({
  classesCount,
  enrollmentsCount,
  subject,
  teacher,
}: {
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
        <StatusPill active={subject.active !== false && !subject.is_archived} />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <MiniPill icon="albums-outline" label={`${classesCount} clase(s)`} />
        <MiniPill icon="people-outline" label={`${enrollmentsCount} inscripción(es)`} />
      </View>
    </View>
  )
}

function ClassroomRowCard({
  classroom,
  enrollmentsCount,
  subject,
}: {
  classroom: ClassroomRow
  enrollmentsCount: number
  subject?: SubjectRow
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-4 rounded-xl border border-[#20375E] bg-[#09162C] p-4">
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
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: active ? '#063D31' : '#3B1D2A' }}>
      <Text className="text-[11px] font-black" style={{ color: active ? '#34D399' : '#FB7185' }}>
        {active ? 'Activo' : 'Inactivo'}
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

function EmptyState({ label }: { label: string }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-8">
      <Ionicons name="search-outline" size={34} color="#60799C" />
      <Text className="mt-3 text-center font-bold text-[#AFC2DB]">{label}</Text>
    </View>
  )
}

function filterProfiles(rows: ProfileRow[], search: string) {
  if (!search) return rows
  return rows.filter((profile) => `${profile.alias} ${profile.email || ''}`.toLowerCase().includes(search))
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}

function getTabTitle(tab: AdminTab) {
  if (tab === 'teachers') return 'Gestión de profesores'
  if (tab === 'students') return 'Gestión de alumnos'
  if (tab === 'courses') return 'Gestión de cursos'
  return 'Gestión de clases'
}

function getTabIcon(tab: AdminTab): IconName {
  if (tab === 'teachers') return 'school-outline'
  if (tab === 'students') return 'people-outline'
  if (tab === 'courses') return 'book-outline'
  return 'albums-outline'
}
