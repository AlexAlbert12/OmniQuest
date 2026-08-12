import React, { useEffect, useState } from 'react'
import AdminButton from '../shared/AdminButton'
import { Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import AdminSearchBar from '../shared/AdminSearchBar'
import { AdminPaginationControls, EmptyState, ListLoadingState, Panel } from '../shared/AdminPrimitives'
import { AdminDateRangeFields, AdminFilterSelect, toAdminFilterTimestamp } from '../shared/AdminAdvancedFilters'
import { supabase } from '../../../lib/supabase'
import { useAppTheme } from '../../../lib/appTheme'
import { AdminScaffold } from '../shared/AdminScaffold'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { formatAuditDate } from '../utils/adminUtils'
import type { AdminProfileActivityRow, AdminSection, ProfileRow } from '../types/admin'

export default function AdminProfileActivityScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const profileId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const data = useAdminData()
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const pageSize = width >= 1040 ? 25 : 8

  useEffect(() => {
    let cancelled = false
    const loadProfile = async () => {
      if (!profileId) return
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, alias, email, role_id, active, created_at')
        .eq('id', profileId)
        .maybeSingle()

      if (!cancelled && !error) setProfile(profileData as ProfileRow | null)
    }
    void loadProfile()
    return () => { cancelled = true }
  }, [profileId])

  const activityPage = useAdminRpcPage<AdminProfileActivityRow>(
    'get_admin_profile_activity_page',
    {
      p_profile_id: profileId || null,
      p_search: search.trim() || null,
      p_event_type: eventType || null,
      p_from: toAdminFilterTimestamp(createdFrom),
      p_to: toAdminFilterTimestamp(createdTo, true),
    },
    data.version,
    pageSize,
  )

  const activeSection: AdminSection = profile?.role_id === 'teacher' ? 'teachers' : 'students'
  const title = profile ? `Actividad de ${profile.alias}` : 'Actividad del usuario'

  return (
    <AdminScaffold
      activeSection={activeSection}
      title={title}
      subtitle="Cronología segura de actividad, accesos académicos y acciones auditadas."
      data={data}
    >
      <Panel title="Resumen del usuario" icon="person-circle-outline" className="mt-5">
        <View className="flex-row flex-wrap items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-interactive">
            <Text className="text-[18px] font-black text-semantic-info">{getInitial(profile?.alias)}</Text>
          </View>
          <View className="min-w-[220px] flex-1">
            <Text className="text-[18px] font-black text-white">{profile?.alias || 'Cargando usuario...'}</Text>
            <Text className="mt-1 text-[12px] text-text-muted">{profile?.email || 'Sin correo guardado'}</Text>
            <Text className="mt-1 text-[11px] font-bold text-text-secondary">
              {profile?.role_id === 'teacher' ? 'Profesor' : 'Alumno'} · {profile?.active === false ? 'Cuenta inactiva' : 'Cuenta activa'}
            </Text>
          </View>
          <AdminButton
            label={profile?.role_id === 'teacher' ? 'Volver a profesores' : 'Volver a alumnos'}
            icon="arrow-back"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </Panel>

      <Panel title="Historial paginado" icon="pulse-outline" className="mt-5">
        <AdminSearchBar
          search={search}
          onChangeSearch={setSearch}
          placeholder="Buscar eventos, cursos o entidades..."
        />
        <View className="mt-4 flex-row flex-wrap items-end gap-3">
          <AdminFilterSelect
            label="Tipo de evento"
            icon="list-outline"
            value={eventType}
            onChange={setEventType}
            options={[
              { value: '', label: 'Toda la actividad' },
              { value: 'attempt', label: 'Respuestas' },
              { value: 'game', label: 'Partidas' },
              { value: 'badge', label: 'Logros' },
              { value: 'enrollment', label: 'Inscripciones' },
              { value: 'course_created', label: 'Cursos creados' },
              { value: 'teacher_action', label: 'Acciones docentes' },
              { value: 'admin_action', label: 'Acciones administrativas' },
            ]}
          />
          <AdminDateRangeFields from={createdFrom} to={createdTo} onChangeFrom={setCreatedFrom} onChangeTo={setCreatedTo} />
        </View>

        <View className="mt-4" style={{ gap: 12 }}>
          {activityPage.loading && !activityPage.refreshing ? <ListLoadingState /> : null}
          {activityPage.rows.map((event) => (
            <View
              key={event.event_id}
              style={[
                styles.eventRow,
                { borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive },
              ]}
            >
              <View style={[styles.eventIcon, { backgroundColor: getSeverityColor(event.severity, true) }]}>
                <Ionicons name={getEventIcon(event.event_type)} size={20} color={getSeverityColor(event.severity, false)} />
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-start justify-between gap-2">
                  <Text className="min-w-[180px] flex-1 text-[14px] font-black text-white">{event.title}</Text>
                  <Text className="text-[10px] font-bold text-text-muted">{formatAuditDate(event.occurred_at)}</Text>
                </View>
                {event.description ? <Text className="mt-1 text-[12px] leading-5 text-text-secondary">{event.description}</Text> : null}
                <Text className="mt-2 text-[10px] font-mono text-text-muted" numberOfLines={1}>
                  {event.entity_table || 'sistema'}{event.entity_id ? ` #${event.entity_id}` : ''}
                </Text>
              </View>
            </View>
          ))}
          {!activityPage.loading && activityPage.rows.length === 0 ? (
            <EmptyState label="No hay actividad que coincida con los filtros." />
          ) : null}
        </View>

        <AdminPaginationControls
          page={activityPage.page}
          pageSize={activityPage.pageSize}
          total={activityPage.total}
          hasPrevious={activityPage.hasPrevious}
          hasNext={activityPage.hasNext}
          onPrevious={activityPage.previousPage}
          onNext={activityPage.nextPage}
        />
      </Panel>
    </AdminScaffold>
  )
}

function getInitial(alias?: string | null) {
  return (alias || '?').trim().charAt(0).toUpperCase()
}

function getEventIcon(eventType: string): keyof typeof Ionicons.glyphMap {
  if (eventType === 'attempt') return 'help-circle-outline'
  if (eventType === 'game') return 'game-controller-outline'
  if (eventType === 'badge') return 'trophy-outline'
  if (eventType === 'enrollment') return 'person-add-outline'
  if (eventType === 'course_created') return 'book-outline'
  if (eventType === 'teacher_action') return 'school-outline'
  return 'shield-checkmark-outline'
}

function getSeverityColor(severity: string, background: boolean) {
  if (severity === 'critical') return background ? '#3B1D2A' : '#FB7185'
  if (severity === 'warning') return background ? '#3A2A0B' : '#FBBF24'
  if (severity === 'success') return background ? '#063D31' : '#34D399'
  return background ? '#102A54' : '#9FD6FF'
}

const styles = {
  eventRow: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
  },
  eventIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
}
