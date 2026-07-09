import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { getTimeAgo } from '../../lib/time'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import BrandLogo from '../../components/BrandLogo'
import NotificationBadge from '../../components/NotificationBadge'
import TeacherHeaderAvatar from '../../components/teacher/TeacherHeaderAvatar'

type TeacherAuditLogRow = {
  id: number
  teacher_id: string
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type AuditFilter = 'all' | 'student' | 'question' | 'subject' | 'code'

type AuditActionMeta = {
  label: string
  badge: string
  category: AuditFilter
  tone: 'neutral' | 'danger'
  icon: keyof typeof Ionicons.glyphMap
  color: string
}

const auditFilters: { id: AuditFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'Todas', icon: 'list-outline' },
  { id: 'student', label: 'Alumnos', icon: 'people-outline' },
  { id: 'question', label: 'Preguntas', icon: 'help-circle-outline' },
  { id: 'subject', label: 'Cursos', icon: 'book-outline' },
  { id: 'code', label: 'Códigos', icon: 'key-outline' },
]

export default function TeacherAuditScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [logs, setLogs] = useState<TeacherAuditLogRow[]>([])
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [selectedFilter, setSelectedFilter] = useState<AuditFilter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isDesktop = width >= 1080
  const isWide = width >= 900

  const fetchAuditLogs = useCallback(async () => {
    try {
      setErrorMessage(null)
      const { data: sessionData } = await supabase.auth.getSession()
      const teacherId = sessionData.session?.user.id

      if (!teacherId) {
        setErrorMessage('No se ha encontrado la sesión del profesor.')
        return
      }

      const [logsResult, subjectsResult] = await Promise.all([
        supabase
          .from('teacher_audit_logs')
          .select('id, teacher_id, action, target_table, target_id, metadata, created_at')
          .eq('teacher_id', teacherId)
          .order('created_at', { ascending: false })
          .limit(150),
        supabase
          .from('subjects')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacherId)
          .eq('is_archived', false),
      ])

      if (logsResult.error) throw logsResult.error
      if (subjectsResult.error) throw subjectsResult.error

      setLogs(((logsResult.data || []) as TeacherAuditLogRow[]))
      setSubjectsCount(subjectsResult.count || 0)
    } catch (error: any) {
      console.error('Error cargando auditoría docente:', error)
      setErrorMessage(error?.message || 'No se pudo cargar el centro de auditoría.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void fetchAuditLogs()
    }, [fetchAuditLogs])
  )

  const filteredLogs = useMemo(() => {
    if (selectedFilter === 'all') return logs
    return logs.filter((log) => getAuditActionMeta(log.action).category === selectedFilter)
  }, [logs, selectedFilter])

  const stats = useMemo(() => {
    const lastWeekThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000
    return {
      total: logs.length,
      lastWeek: logs.filter((log) => new Date(log.created_at).getTime() >= lastWeekThreshold).length,
      student: logs.filter((log) => getAuditActionMeta(log.action).category === 'student').length,
      destructive: logs.filter((log) => getAuditActionMeta(log.action).tone === 'danger').length,
    }
  }, [logs])

  const onRefresh = () => {
    setRefreshing(true)
    void fetchAuditLogs()
  }

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.replace('/(auth)/login' as any)
    } catch (error: any) {
      showAlert('No se pudo cerrar sesión', error?.message || 'Revisa la conexión e inténtalo de nuevo.')
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#AFC2DB]">Cargando auditoría docente...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar activeSection="audit" subjectsCount={subjectsCount} onSignOut={handleSignOut} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 28 : 18,
            paddingBottom: isDesktop ? 48 : 112,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[280px] flex-1">
              {!isDesktop ? <BrandLogo size={28} style={{ marginBottom: 12 }} /> : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="shield-checkmark" size={40} color="#9FD6FF" />
                <Text className="text-[38px] font-black text-white">Centro de auditoría</Text>
              </View>
              <Text className="mt-2 max-w-[760px] text-[14px] leading-5 text-[#B7C4D7]">
                Revisa las acciones docentes sensibles para explicar trazabilidad: alumnos, preguntas, cursos y códigos.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={onRefresh}
                className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
              >
                <Ionicons name="refresh-outline" size={16} color="#AFC2DB" />
                <Text className="text-[12px] font-bold text-[#DDE7F4]">Actualizar</Text>
              </Pressable>
              <NotificationBadge audience="teacher" onPress={() => router.push('/(teacher)/notifications' as any)} />
              <TeacherHeaderAvatar />
            </View>
          </View>

          {errorMessage ? (
            <View className="mb-5 rounded-2xl border border-[#3F2430] bg-[#160D19] p-5">
              <Ionicons name="warning-outline" size={28} color="#FB7185" />
              <Text className="mt-3 text-xl font-black text-white">No se pudo cargar la auditoría</Text>
              <Text className="mt-2 text-[13px] leading-5 text-[#FCA5A5]">{errorMessage}</Text>
            </View>
          ) : null}

          <View className={isWide ? 'mb-5 flex-row gap-4' : 'mb-5 gap-4'}>
            <AuditStatCard icon="document-text" label="Acciones registradas" value={String(stats.total)} detail="Últimos eventos" color="#8B5CF6" />
            <AuditStatCard icon="calendar" label="Últimos 7 días" value={String(stats.lastWeek)} detail="Actividad reciente" color="#58B5FF" />
            <AuditStatCard icon="people" label="Acciones con alumnos" value={String(stats.student)} detail="Inscripciones y progreso" color="#43D991" />
            <AuditStatCard icon="warning" label="Críticas" value={String(stats.destructive)} detail="Borrado o archivado" color="#FB7185" />
          </View>

          <View className="mb-5 flex-row flex-wrap gap-3">
            {auditFilters.map((filter) => (
              <AuditFilterChip
                key={filter.id}
                filter={filter}
                active={selectedFilter === filter.id}
                count={filter.id === 'all' ? logs.length : logs.filter((log) => getAuditActionMeta(log.action).category === filter.id).length}
                onPress={() => setSelectedFilter(filter.id)}
              />
            ))}
          </View>

          <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
            <View className="mb-4 flex-row items-center justify-between gap-3">
              <Text className="text-[18px] font-black text-white">Registro docente</Text>
              <Text className="text-[12px] font-bold text-[#B9A7FF]">{filteredLogs.length} visibles</Text>
            </View>

            <View className="gap-3">
              {filteredLogs.map((log) => (
                <AuditLogItem key={log.id} log={log} />
              ))}
              {filteredLogs.length === 0 ? (
                <View className="rounded-xl border border-dashed border-[#253C67] bg-[#0D1D3B] px-4 py-8">
                  <Ionicons name="shield-checkmark-outline" size={30} color="#8FA7C7" style={{ alignSelf: 'center' }} />
                  <Text className="mt-3 text-center text-[13px] font-bold text-[#AFC2DB]">
                    No hay acciones registradas con este filtro.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="audit" /> : null}
    </View>
  )
}

function AuditStatCard({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  detail: string
  color: string
}) {
  return (
    <View className="min-w-[190px] flex-1 rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${color}29` }}>
        <Ionicons name={icon} size={23} color={color} />
      </View>
      <Text className="text-[12px] font-bold text-[#AFC2DB]">{label}</Text>
      <Text className="mt-2 text-[28px] font-black text-white">{value}</Text>
      <Text className="mt-1 text-[12px] text-[#AFC2DB]">{detail}</Text>
    </View>
  )
}

function AuditFilterChip({
  filter,
  active,
  count,
  onPress,
}: {
  filter: { id: AuditFilter; label: string; icon: keyof typeof Ionicons.glyphMap }
  active: boolean
  count: number
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-xl border px-4 py-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
        borderColor: active ? '#8B5CF6' : '#20375E',
        backgroundColor: active ? '#4C2FA666' : '#07162E',
      })}
    >
      <Ionicons name={filter.icon} size={16} color={active ? '#FFFFFF' : '#AFC2DB'} />
      <Text className="text-[12px] font-black" style={{ color: active ? '#FFFFFF' : '#DDE7F4' }}>
        {filter.label}
      </Text>
      <View className="rounded-full bg-[#1B3158] px-2 py-0.5">
        <Text className="text-[12px] font-black text-white">{count}</Text>
      </View>
    </Pressable>
  )
}

function AuditLogItem({ log }: { log: TeacherAuditLogRow }) {
  const meta = getAuditActionMeta(log.action)
  const metadata = log.metadata || {}
  const summary = formatAuditSummary(log)

  return (
    <View className="rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}24` }}>
          <Ionicons name={meta.icon} size={21} color={meta.color} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[14px] font-black text-white">{meta.label}</Text>
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: `${meta.color}24` }}>
              <Text className="text-[12px] font-black" style={{ color: meta.color }}>{meta.badge}</Text>
            </View>
          </View>
          <Text className="mt-1 text-[13px] leading-5 text-[#AFC2DB]">{summary}</Text>
          <Text className="mt-2 text-[12px] text-[#AFC2DB]">
            {getTimeAgo(log.created_at)} · {formatAuditTarget(log)}
          </Text>
          {metadata.reason ? (
            <Text className="mt-2 text-[12px] leading-5 text-[#B7C4D7]">
              Motivo: {String(metadata.reason)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}

function getAuditActionMeta(action: string): AuditActionMeta {
  const map: Record<string, AuditActionMeta> = {
    'teacher.student.remove_from_class': {
      label: 'Alumno retirado de clase',
      badge: 'Alumno',
      category: 'student',
      tone: 'danger',
      icon: 'person-remove-outline',
      color: '#FB7185',
    },
    'teacher.student.reset_progress': {
      label: 'Progreso reiniciado',
      badge: 'Alumno',
      category: 'student',
      tone: 'danger',
      icon: 'refresh-circle-outline',
      color: '#F6A64A',
    },
    'teacher.question.delete': {
      label: 'Pregunta eliminada',
      badge: 'Pregunta',
      category: 'question',
      tone: 'danger',
      icon: 'trash-outline',
      color: '#FB7185',
    },
    'teacher.subject.archive': {
      label: 'Curso archivado',
      badge: 'Curso',
      category: 'subject',
      tone: 'danger',
      icon: 'archive-outline',
      color: '#F6A64A',
    },
    'teacher.subject.restore': {
      label: 'Curso restaurado',
      badge: 'Curso',
      category: 'subject',
      tone: 'neutral',
      icon: 'archive-outline',
      color: '#43D991',
    },
    'teacher.subject.regenerate_code': {
      label: 'Código de curso regenerado',
      badge: 'Código',
      category: 'code',
      tone: 'neutral',
      icon: 'key-outline',
      color: '#8B5CF6',
    },
    'teacher.classroom.regenerate_code': {
      label: 'Código de clase regenerado',
      badge: 'Código',
      category: 'code',
      tone: 'neutral',
      icon: 'key-outline',
      color: '#8B5CF6',
    },
  }

  return map[action] || {
    label: action.replace(/^teacher\./, '').replace(/[._-]/g, ' '),
    badge: 'Evento',
    category: 'all',
    tone: 'neutral',
    icon: 'shield-outline',
    color: '#58B5FF',
  }
}

function formatAuditSummary(log: TeacherAuditLogRow) {
  const metadata = log.metadata || {}
  const subjectName = getMetadataText(metadata, 'subject_name') || getMetadataText(metadata, 'course_name')
  const classroomName = getMetadataText(metadata, 'classroom_name')
  const studentAlias = getMetadataText(metadata, 'student_alias') || getMetadataText(metadata, 'alias')
  const questionText = getMetadataText(metadata, 'question_text')
  const nextCode = getMetadataText(metadata, 'next_code')
  const previousCode = getMetadataText(metadata, 'previous_code')

  if (log.action === 'teacher.student.remove_from_class') {
    return `${studentAlias || 'Un alumno'} fue retirado${classroomName ? ` de ${classroomName}` : ''}${subjectName ? ` en ${subjectName}` : ''}.`
  }

  if (log.action === 'teacher.student.reset_progress') {
    return `Se reinició el progreso de ${studentAlias || 'un alumno'}${subjectName ? ` en ${subjectName}` : ' en cursos del profesor'}.`
  }

  if (log.action === 'teacher.question.delete') {
    return `Se eliminó la pregunta${questionText ? ` "${truncate(questionText, 80)}"` : ''}${subjectName ? ` de ${subjectName}` : ''}.`
  }

  if (log.action === 'teacher.subject.archive') {
    return `El curso ${subjectName || log.target_id || 'seleccionado'} fue archivado.`
  }

  if (log.action === 'teacher.subject.restore') {
    return `El curso ${subjectName || log.target_id || 'seleccionado'} fue restaurado.`
  }

  if (log.action.includes('regenerate_code')) {
    const scope = classroomName ? `la clase ${classroomName}` : subjectName ? `el curso ${subjectName}` : 'el recurso seleccionado'
    return `Se regeneró el código de ${scope}${nextCode ? `: ${previousCode || 'anterior'} → ${nextCode}` : '.'}`
  }

  return 'Acción docente registrada correctamente.'
}

function formatAuditTarget(log: TeacherAuditLogRow) {
  if (!log.target_table && !log.target_id) return 'Sin objetivo asociado'
  return [log.target_table || 'registro', log.target_id].filter(Boolean).join(' #')
}

function getMetadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`)
    return
  }
  Alert.alert(title, message)
}
