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
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import PaginationControls from '../../components/ui/PaginationControls'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { withAlpha } from '../../lib/color'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { getTimeAgo } from '../../lib/time'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'

type TeacherAuditLogRow = {
  id: number
  teacher_id: string
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type AuditFilter = 'all' | 'student' | 'question' | 'subject' | 'topic' | 'code' | 'profile'

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
  { id: 'topic', label: 'Temas', icon: 'layers-outline' },
  { id: 'code', label: 'Códigos', icon: 'key-outline' },
  { id: 'profile', label: 'Perfil', icon: 'person-circle-outline' },
]

export default function TeacherAuditScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { colors } = useAppTheme()
  const [logs, setLogs] = useState<TeacherAuditLogRow[]>([])
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [page, setPage] = useState(0)
  const [totalLogs, setTotalLogs] = useState(0)
  const [selectedFilter, setSelectedFilter] = useState<AuditFilter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isDesktop = width >= 1080
  const isWide = width >= 900
  const pageSize = isDesktop ? 25 : 8

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
        (supabase.rpc as any)('get_teacher_audit_logs_page', {
          p_category: selectedFilter,
          p_search: null,
          p_limit: pageSize,
          p_offset: page * pageSize,
        }),
        supabase
          .from('subjects')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacherId)
          .eq('is_archived', false),
      ])

      if (logsResult.error) throw logsResult.error
      if (subjectsResult.error) throw subjectsResult.error

      const nextLogs = ((logsResult.data || []) as (TeacherAuditLogRow & { total_count?: number | null })[])
      setLogs(nextLogs)
      setTotalLogs(Number(nextLogs[0]?.total_count || 0))
      setSubjectsCount(subjectsResult.count || 0)
    } catch (error: any) {
      console.error('Error cargando auditoría docente:', error)
      setErrorMessage(error?.message || 'No se pudo cargar el centro de auditoría.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, pageSize, selectedFilter])

  useFocusEffect(
    useCallback(() => {
      void fetchAuditLogs()
    }, [fetchAuditLogs])
  )

  const filteredLogs = logs

  const stats = useMemo(() => {
    const lastWeekThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000
    return {
      total: totalLogs,
      lastWeek: logs.filter((log) => new Date(log.created_at).getTime() >= lastWeekThreshold).length,
      student: logs.filter((log) => getAuditActionMeta(log.action).category === 'student').length,
      destructive: logs.filter((log) => getAuditActionMeta(log.action).tone === 'danger').length,
    }
  }, [logs, totalLogs])

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
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4" style={{ color: colors.textSecondary }}>Cargando auditoría docente...</Text>
      </View>
    )
  }

  if (!isDesktop) {
    return (
      <MobileTeacherAudit
        logs={logs}
        filteredLogs={filteredLogs}
        selectedFilter={selectedFilter}
        stats={stats}
        refreshing={refreshing}
        errorMessage={errorMessage}
        onRefresh={onRefresh}
        page={page}
        pageSize={pageSize}
        totalLogs={totalLogs}
        onPreviousPage={() => setPage((value) => Math.max(0, value - 1))}
        onNextPage={() => setPage((value) => value + 1)}
        onSelectFilter={(filter) => { setPage(0); setSelectedFilter(filter) }}
        onNotifications={() => router.push('/(teacher)/notifications' as any)}
      />
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar activeSection="audit" subjectsCount={subjectsCount} onSignOut={handleSignOut} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 28 : 18,
            paddingBottom: isDesktop ? 48 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <TeacherPageHeader
            icon="shield-checkmark"
            isDesktop={isDesktop}
            title="Centro de auditoría"
            mobileTitle="Auditoría"
            subtitle="Revisa las acciones docentes sensibles para explicar trazabilidad: alumnos, preguntas, cursos y códigos."
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
            actions={(
              <Pressable
                accessibilityLabel="Actualizar auditoría"
                accessibilityRole="button"
                onPress={onRefresh}
                className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
              >
                <Ionicons name="refresh-outline" size={16} color="#AFC2DB" />
                <Text className="text-[12px] font-bold text-[#DDE7F4]">Actualizar</Text>
              </Pressable>
            )}
          />

          {errorMessage ? (
            <View className="mb-5 rounded-2xl border border-[#3F2430] bg-[#160D19] p-5">
              <Ionicons name="warning-outline" size={28} color="#FB7185" />
              <Text className="mt-3 text-xl font-black text-white">No se pudo cargar la auditoría</Text>
              <Text className="mt-2 text-[13px] leading-5 text-[#FCA5A5]">{errorMessage}</Text>
            </View>
          ) : null}

          <AuditContextCard className="mb-5" />

          {logs.length > 0 ? (
            <View className={isWide ? 'mb-5 flex-row gap-4' : 'mb-5 gap-4'}>
              <AuditStatCard icon="document-text" label="Acciones registradas" value={String(stats.total)} detail="Últimos eventos" color="#8B5CF6" />
              <AuditStatCard icon="calendar" label="Últimos 7 días" value={String(stats.lastWeek)} detail="Actividad reciente" color="#58B5FF" />
              <AuditStatCard icon="people" label="Acciones con alumnos" value={String(stats.student)} detail="Inscripciones y progreso" color="#43D991" />
              <AuditStatCard icon="warning" label="Críticas" value={String(stats.destructive)} detail="Borrado o archivado" color="#FB7185" />
            </View>
          ) : null}

          {logs.length > 0 ? (
            <View className="mb-5 flex-row flex-wrap gap-3">
              {auditFilters.map((filter) => (
              <AuditFilterChip
                key={filter.id}
                filter={filter}
                active={selectedFilter === filter.id}
                count={filter.id === 'all' ? logs.length : logs.filter((log) => getAuditActionMeta(log.action).category === filter.id).length}
                onPress={() => { setPage(0); setSelectedFilter(filter.id) }}
              />
              ))}
            </View>
          ) : null}

          <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
            <View className="mb-4 flex-row items-center justify-between gap-3">
              <Text className="text-[18px] font-black text-white">Timeline de auditoría</Text>
              <Text className="text-[12px] font-bold text-[#B9A7FF]">{totalLogs} registros</Text>
            </View>

            <View className="gap-3">
              {filteredLogs.map((log) => (
                <AuditLogItem key={log.id} log={log} />
              ))}
              {filteredLogs.length === 0 ? (
                <AuditEmptyState selectedFilter={selectedFilter} />
              ) : null}
              <PaginationControls
                page={page}
                pageSize={pageSize}
                total={totalLogs}
                onPrevious={() => setPage((value) => Math.max(0, value - 1))}
                onNext={() => setPage((value) => value + 1)}
              />
            </View>
          </View>
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="audit" /> : null}
    </View>
  )
}

type AuditStats = {
  total: number
  lastWeek: number
  student: number
  destructive: number
}

function MobileTeacherAudit({
  logs,
  filteredLogs,
  selectedFilter,
  stats,
  refreshing,
  errorMessage,
  onRefresh,
  onSelectFilter,
  page,
  pageSize,
  totalLogs,
  onPreviousPage,
  onNextPage,
  onNotifications,
}: {
  logs: TeacherAuditLogRow[]
  filteredLogs: TeacherAuditLogRow[]
  selectedFilter: AuditFilter
  stats: AuditStats
  refreshing: boolean
  errorMessage: string | null
  onRefresh: () => void
  onSelectFilter: (filter: AuditFilter) => void
  page: number
  pageSize: number
  totalLogs: number
  onPreviousPage: () => void
  onNextPage: () => void
  onNotifications: () => void
}) {
  const { colors } = useAppTheme()
  const metricCards = [
    {
      icon: 'document-text' as keyof typeof Ionicons.glyphMap,
      label: 'Acciones registradas',
      value: String(stats.total),
      detail: 'Última semana',
      color: '#8B5CF6',
    },
    {
      icon: 'calendar' as keyof typeof Ionicons.glyphMap,
      label: 'Últimos 7 días',
      value: String(stats.lastWeek),
      detail: 'Actividad reciente',
      color: '#58B5FF',
    },
    {
      icon: 'people' as keyof typeof Ionicons.glyphMap,
      label: 'Acciones con alumnos',
      value: String(stats.student),
      detail: 'Inscripciones y progreso',
      color: '#43D991',
    },
    {
      icon: 'warning' as keyof typeof Ionicons.glyphMap,
      label: 'Críticas',
      value: String(stats.destructive),
      detail: 'Eventos o activación',
      color: '#F59E0B',
    },
    {
      icon: 'lock-closed' as keyof typeof Ionicons.glyphMap,
      label: 'Accesos y cambios',
      value: String(logs.filter((log) => getAuditActionMeta(log.action).tone === 'danger').length),
      detail: 'Usuarios y permisos',
      color: '#FB7185',
    },
    {
      icon: 'code-slash' as keyof typeof Ionicons.glyphMap,
      label: 'Códigos generados',
      value: String(logs.filter((log) => getAuditActionMeta(log.action).category === 'code').length),
      detail: 'Clases y uniones',
      color: '#58B5FF',
    },
  ]

  return (
    <View className="flex-1" style={{ backgroundColor: colors.backgroundAlt }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 22, paddingBottom: MOBILE_BOTTOM_NAV_SPACER + 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        showsVerticalScrollIndicator={false}
      >
        <TeacherPageHeader
          icon="shield-checkmark"
          isDesktop={false}
          title="Auditoría"
          subtitle="Revisa acciones sensibles y trazabilidad docente."
          notificationOnPress={onNotifications}
          className="mb-7"
        />

        {errorMessage ? (
          <LinearGradient
            colors={['#30111F', '#120D19']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="mb-5 rounded-2xl border border-[#7F1D1D] p-5"
          >
            <Ionicons name="warning-outline" size={30} color="#FB7185" />
            <Text className="mt-3 text-xl font-black text-white">No se pudo cargar la auditoría</Text>
            <Text className="mt-2 text-[13px] leading-5 text-[#FCA5A5]">{errorMessage}</Text>
          </LinearGradient>
        ) : null}

        <AuditContextCard className="mb-5" mobile />

        {logs.length > 0 ? (
          <View className="mb-6 flex-row flex-wrap gap-3">
            {metricCards.slice(0, 4).map((metric) => (
              <MobileAuditStatCard key={metric.label} {...metric} />
            ))}
          </View>
        ) : null}

        {logs.length > 0 ? (
          <View className="mb-6 flex-row flex-wrap gap-3">
            {auditFilters.map((filter) => (
            <MobileAuditFilterChip
              key={filter.id}
              filter={filter}
              active={selectedFilter === filter.id}
              count={getAuditFilterCount(filter.id, logs)}
              onPress={() => onSelectFilter(filter.id)}
              />
            ))}
          </View>
        ) : null}

        <LinearGradient
          colors={['#071A33', '#061326']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="rounded-2xl border border-[#1D3760] p-4"
        >
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-[24px] font-black text-white">Timeline</Text>
              <Text className="mt-1 text-[12px] font-bold text-[#8FA7C7]">{totalLogs} registros</Text>
            </View>
            {filteredLogs.length > 0 ? (
              <View className="flex-row items-center gap-2">
                <Text className="text-[16px] font-black text-[#B175FF]">Ver todas</Text>
                <Ionicons name="arrow-forward" size={21} color="#B175FF" />
              </View>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            {filteredLogs.map((log) => (
              <MobileAuditLogItem key={log.id} log={log} />
            ))}

            {filteredLogs.length === 0 ? (
              <AuditEmptyState selectedFilter={selectedFilter} mobile />
            ) : null}

            <PaginationControls
              compact
              page={page}
              pageSize={pageSize}
              total={totalLogs}
              onPrevious={onPreviousPage}
              onNext={onNextPage}
            />
          </View>
        </LinearGradient>
      </ScrollView>

      <TeacherBottomNav active="audit" />
    </View>
  )
}

function AuditContextCard({ className = '', mobile = false }: { className?: string; mobile?: boolean }) {
  return (
    <LinearGradient
      colors={['#0D223F', '#07162C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={`rounded-2xl border border-[#1D3760] ${mobile ? 'p-4' : 'p-5'} ${className}`}
    >
      <View className="flex-row items-start gap-3">
        <View className={`${mobile ? 'h-11 w-11' : 'h-12 w-12'} items-center justify-center rounded-2xl bg-[#13284A]`}>
          <Ionicons name="shield-checkmark-outline" size={mobile ? 23 : 25} color="#9FD6FF" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className={`${mobile ? 'text-[17px]' : 'text-[18px]'} font-black text-white`}>Aquí se registran acciones sensibles</Text>
          <Text className="mt-1 text-[13px] leading-5 text-[#B7C4D7]">
            La auditoría deja trazabilidad de cambios relevantes sobre alumnos, cursos, temas, preguntas y códigos de acceso.
          </Text>
        </View>
      </View>
    </LinearGradient>
  )
}

function AuditEmptyState({ selectedFilter, mobile = false }: { selectedFilter: AuditFilter; mobile?: boolean }) {
  const filterLabel = auditFilters.find((filter) => filter.id === selectedFilter)?.label.toLowerCase() || 'este filtro'
  const isAll = selectedFilter === 'all'

  return (
    <View className={`${mobile ? 'px-4 py-8' : 'px-6 py-10'} items-center rounded-2xl border border-dashed border-[#253C67] bg-[#0D1D3B]`}>
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[#122747]">
        <Ionicons name="shield-checkmark-outline" size={34} color="#8FA7C7" />
      </View>
      <Text className="mt-4 text-center text-[17px] font-black text-white">Todavía no hay acciones sensibles</Text>
      <Text className="mt-2 text-center text-[13px] leading-5 text-[#AFC2DB]">
        {isAll
          ? 'Cuando edites cursos, temas, preguntas, códigos o alumnos, aparecerán aquí con fecha y contexto.'
          : `No hay eventos en ${filterLabel}. Cambia el filtro o realiza una acción sensible para verla registrada.`}
      </Text>
    </View>
  )
}

function MobileAuditStatCard({
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
    <MobileMetricCard
      className="min-h-[154px] flex-1 basis-[47%]"
      color={color}
      detail={detail}
      icon={icon}
      label={label}
      value={value}
    />
  )
}

function MobileAuditFilterChip({
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
  const color = getAuditFilterColor(filter.id)

  return (
    <Pressable
      onPress={onPress}
      className="h-16 flex-row items-center gap-3 rounded-2xl border px-5"
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
        minWidth: filter.id === 'all' ? 196 : 170,
        borderColor: active ? '#7C5CFF' : '#1D3760',
        backgroundColor: active ? '#6D47F6' : '#07162C',
      })}
    >
      <Ionicons name={filter.icon} size={23} color={active ? '#FFFFFF' : color} />
      <Text className={`min-w-0 flex-1 text-[18px] font-black ${active ? 'text-white' : 'text-[#DDE7F4]'}`} numberOfLines={1}>
        {filter.label}
      </Text>
      <View className="min-w-[34px] items-center rounded-full px-2 py-1" style={{ backgroundColor: active ? '#4C2FA6' : '#152B4E' }}>
        <Text className="text-[14px] font-black text-white">{count}</Text>
      </View>
    </Pressable>
  )
}

function MobileAuditLogItem({ log }: { log: TeacherAuditLogRow }) {
  const meta = getAuditActionMeta(log.action)
  const summary = formatAuditSummary(log)
  const actor = formatAuditActor(log)
  const object = formatAuditObject(log)

  return (
    <Pressable
      className="rounded-2xl bg-[#0A1D37] px-4 py-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
    >
      <View className="flex-row gap-4">
        <View className="items-center">
          <View className="items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(meta.color, '30'), height: 52, width: 52 }}>
            <Ionicons name={meta.icon} size={25} color={meta.color} />
          </View>
          <View className="mt-2 w-[2px] flex-1 rounded-full bg-[#213A62]" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="min-w-0 flex-1 text-[17px] font-black text-white" numberOfLines={1}>{meta.label}</Text>
            <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: withAlpha(meta.color, '24') }}>
              <Text className="text-[12px] font-black" style={{ color: meta.color }}>{meta.badge}</Text>
            </View>
          </View>
          <Text className="mt-1 text-[14px] leading-5 text-[#B8C6DC]" numberOfLines={3}>{summary}</Text>
          <View className="mt-3 gap-1.5">
            <Text className="text-[12px] text-[#8FA7C7]" numberOfLines={1}>Objeto: {object}</Text>
            <Text className="text-[12px] text-[#8FA7C7]" numberOfLines={1}>Usuario: {actor}</Text>
            <Text className="text-[12px] font-bold text-[#B9A7FF]">{getTimeAgo(log.created_at)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

function getAuditFilterCount(filter: AuditFilter, logs: TeacherAuditLogRow[]) {
  if (filter === 'all') return logs.length
  return logs.filter((log) => getAuditActionMeta(log.action).category === filter).length
}

function getAuditFilterColor(filter: AuditFilter) {
  if (filter === 'student') return '#43D991'
  if (filter === 'question') return '#58B5FF'
  if (filter === 'subject') return '#9FD6FF'
  if (filter === 'topic') return '#A78BFA'
  if (filter === 'code') return '#F59E0B'
  if (filter === 'profile') return '#38BDF8'
  return '#B175FF'
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
    <MobileMetricCard
      className="min-w-[190px] flex-1"
      color={color}
      detail={detail}
      icon={icon}
      label={label}
      value={value}
    />
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
  const actor = formatAuditActor(log)
  const object = formatAuditObject(log)

  return (
    <View className="rounded-xl border border-[#172A4A] bg-[#0D1D3B] p-4">
      <View className="flex-row items-start gap-4">
        <View className="items-center">
          <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}24` }}>
            <Ionicons name={meta.icon} size={21} color={meta.color} />
          </View>
          <View className="mt-2 w-[2px] flex-1 rounded-full bg-[#20375E]" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[14px] font-black text-white">{meta.label}</Text>
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: `${meta.color}24` }}>
              <Text className="text-[12px] font-black" style={{ color: meta.color }}>{meta.badge}</Text>
            </View>
          </View>
          <Text className="mt-1 text-[13px] leading-5 text-[#AFC2DB]">{summary}</Text>
          <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
            <Text className="text-[12px] text-[#8FA7C7]">Objeto: {object}</Text>
            <Text className="text-[12px] text-[#8FA7C7]">Usuario: {actor}</Text>
            <Text className="text-[12px] font-bold text-[#B9A7FF]">{getTimeAgo(log.created_at)}</Text>
          </View>
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
    'teacher.subject.update': {
      label: 'Curso actualizado',
      badge: 'Curso',
      category: 'subject',
      tone: 'neutral',
      icon: 'create-outline',
      color: '#58B5FF',
    },
    'teacher.topic.create': {
      label: 'Tema creado',
      badge: 'Tema',
      category: 'topic',
      tone: 'neutral',
      icon: 'add-circle-outline',
      color: '#A78BFA',
    },
    'teacher.topic.update': {
      label: 'Tema actualizado',
      badge: 'Tema',
      category: 'topic',
      tone: 'neutral',
      icon: 'layers-outline',
      color: '#A78BFA',
    },
    'teacher.profile.avatar.update': {
      label: 'Avatar actualizado',
      badge: 'Perfil',
      category: 'profile',
      tone: 'neutral',
      icon: 'person-circle-outline',
      color: '#38BDF8',
    },
    'teacher.profile.avatar.clear': {
      label: 'Avatar eliminado',
      badge: 'Perfil',
      category: 'profile',
      tone: 'neutral',
      icon: 'person-circle-outline',
      color: '#8FA7C7',
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

  if (log.action === 'teacher.subject.update') {
    const nextSubjectName = getNestedMetadataText(metadata, 'next', 'name')
    const previousSubjectName = getNestedMetadataText(metadata, 'previous', 'name')
    return `Se actualizaron los datos del curso ${nextSubjectName || previousSubjectName || subjectName || log.target_id || 'seleccionado'}.`
  }

  if (log.action === 'teacher.topic.create') {
    const topicTitle = getMetadataText(metadata, 'title')
    return `Se creó el tema ${topicTitle ? `"${truncate(topicTitle, 70)}"` : log.target_id || 'seleccionado'}${subjectName ? ` en ${subjectName}` : ''}.`
  }

  if (log.action === 'teacher.topic.update') {
    const nextTitle = getNestedMetadataText(metadata, 'next', 'title')
    const previousTitle = getNestedMetadataText(metadata, 'previous', 'title')
    return `Se actualizaron los datos del tema ${nextTitle || previousTitle ? `"${truncate(nextTitle || previousTitle || '', 70)}"` : log.target_id || 'seleccionado'}.`
  }

  if (log.action === 'teacher.profile.avatar.update') {
    return 'Se actualizó el avatar del perfil docente.'
  }

  if (log.action === 'teacher.profile.avatar.clear') {
    return 'Se eliminó el avatar del perfil docente.'
  }

  if (log.action.includes('regenerate_code')) {
    const scope = classroomName ? `la clase ${classroomName}` : subjectName ? `el curso ${subjectName}` : 'el recurso seleccionado'
    return `Se regeneró el código de ${scope}${nextCode ? `: ${previousCode || 'anterior'} → ${nextCode}` : '.'}`
  }

  return 'Acción docente registrada correctamente.'
}

function formatAuditActor(log: TeacherAuditLogRow) {
  const metadata = log.metadata || {}
  return (
    getMetadataText(metadata, 'teacher_alias')
    || getMetadataText(metadata, 'teacher_email')
    || getMetadataText(metadata, 'user_email')
    || getMetadataText(metadata, 'actor_email')
    || 'Profesor actual'
  )
}

function formatAuditObject(log: TeacherAuditLogRow) {
  const metadata = log.metadata || {}
  return (
    getMetadataText(metadata, 'student_alias')
    || getMetadataText(metadata, 'alias')
    || getMetadataText(metadata, 'subject_name')
    || getMetadataText(metadata, 'course_name')
    || getMetadataText(metadata, 'classroom_name')
    || getMetadataText(metadata, 'title')
    || formatAuditTarget(log)
  )
}

function formatAuditTarget(log: TeacherAuditLogRow) {
  if (!log.target_table && !log.target_id) return 'Sin objetivo asociado'
  return [log.target_table || 'registro', log.target_id].filter(Boolean).join(' #')
}

function getMetadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getNestedMetadataText(metadata: Record<string, unknown>, parentKey: string, key: string) {
  const parent = metadata[parentKey]
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return null
  const value = (parent as Record<string, unknown>)[key]
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
