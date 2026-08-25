import React, { useEffect, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import AdminProfileAvatar from '../shared/AdminProfileAvatar'
import AdminSearchBar from '../shared/AdminSearchBar'
import { AdminPaginationControls, EmptyState, ListLoadingState, Panel } from '../shared/AdminPrimitives'
import { AdminDateRangeFields, AdminFilterSelect, toAdminFilterTimestamp } from '../shared/AdminAdvancedFilters'
import AppPressable from '../../ui/AppPressable'
import AppBackButton from '../../ui/AppBackButton'
import { supabase } from '../../../lib/supabase'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import { withAlpha } from '../../../lib/color'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage } from '../../../lib/typeGuards'
import { AdminScaffold } from '../shared/AdminScaffold'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminRpcPage } from '../hooks/useAdminRpcPage'
import { formatAdminDate, formatAuditDate, getAuditActionLabel, getAuditTargetTypeLabel, stringMetadata } from '../utils/adminUtils'
import type { AdminProfileActivityRow, AdminSection, IconName, ProfileRow } from '../types/admin'

export default function AdminProfileActivityScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const profileId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const feedback = useAppFeedback()
  const data = useAdminData()
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [eventType, setEventType] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const pageSize = responsive.isDesktop ? 25 : 8

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const loadProfile = async () => {
      setProfileLoading(true)
      setProfileError(null)
      if (!profileId) {
        setProfile(null)
        setProfileError('No se ha indicado un usuario válido.')
        setProfileLoading(false)
        return
      }
      try {
        const { data: rows, error } = await supabase.rpc('get_admin_profiles_page', { p_profile_id: profileId, p_limit: 1, p_offset: 0 })
        if (error) throw error
        const nextProfile = rows?.[0] as ProfileRow | undefined
        if (!nextProfile) throw new Error('Usuario no encontrado')
        if (!cancelled) setProfile(nextProfile)
      } catch (error: unknown) {
        if (!cancelled) {
          setProfile(null)
          setProfileError(getErrorMessage(error, 'El usuario puede haber sido eliminado o no estar disponible.'))
        }
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }
    void loadProfile()
    return () => { cancelled = true }
  }, [data.version, profileId])

  const activityPage = useAdminRpcPage<AdminProfileActivityRow>(
    'get_admin_profile_activity_page',
    {
      p_profile_id: profileId || null,
      p_search: debouncedSearch || null,
      p_event_type: eventType || null,
      p_from: toAdminFilterTimestamp(createdFrom),
      p_to: toAdminFilterTimestamp(createdTo, true),
    },
    data.version,
    pageSize,
    Boolean(profile && !profileError),
  )

  const activeSection: AdminSection = profile?.role_id === 'teacher' ? 'teachers' : profile ? 'students' : 'users'
  const title = profile ? `Actividad de ${profile.alias}` : 'Actividad del usuario'

  const copyReference = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value)
      feedback.success('Referencia copiada', 'Se ha copiado el identificador completo.')
    } catch (error: unknown) {
      feedback.error('No se pudo copiar', getErrorMessage(error, 'Inténtalo de nuevo.'))
    }
  }

  return (
    <AdminScaffold activeSection={activeSection} title={title} subtitle="Cronología segura de actividad, accesos académicos y acciones auditadas." data={data}>
      {profileError ? (
        <Panel title="No se ha podido cargar el usuario" icon="alert-circle-outline" className="mt-5">
          <Text className="text-[13px] leading-5 text-text-secondary">{profileError}</Text>
          <Text className="mt-2 text-[12px] text-text-muted">El usuario puede haber sido eliminado o no estar disponible.</Text>
          <View className="mt-4 self-start"><AppBackButton label="Volver a usuarios" onPress={() => router.back()} /></View>
        </Panel>
      ) : (
        <>
          <Panel title="Resumen del usuario" icon="person-circle-outline" className="mt-5">
            {profileLoading && !profile ? <ListLoadingState /> : null}
            {profile ? (
              <>
                <View className="flex-row flex-wrap items-center gap-4">
                  <AdminProfileAvatar alias={profile.alias} avatar={profile.avatar} size={56} />
                  <View className="min-w-[220px] flex-1">
                    <Text className="text-[18px] font-black text-white">{profile.alias}</Text>
                    <Text className="mt-1 text-[12px] text-text-muted">{profile.email || 'Sin correo guardado'}</Text>
                    <Text className="mt-1 text-[11px] font-bold text-text-secondary">{getRoleLabel(profile.role_id)} · {profile.active === false ? 'Cuenta inactiva' : 'Cuenta activa'}</Text>
                  </View>
                  <AppBackButton label={profile.role_id === 'teacher' ? 'Volver a profesores' : 'Volver a alumnos'} onPress={() => router.back()} />
                </View>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  <SummaryFact icon={profile.role_id === 'teacher' ? 'book-outline' : 'people-outline'} label={getScopeSummary(profile)} />
                  <SummaryFact icon="time-outline" label={profile.last_activity_at ? `Última actividad: ${formatAdminDate(profile.last_activity_at)}` : 'Sin actividad registrada'} />
                  {profile.last_sign_in_at ? <SummaryFact icon="log-in-outline" label={`Último acceso: ${formatAdminDate(profile.last_sign_in_at)}`} /> : null}
                  <SummaryFact icon={profile.security_status === 'secure' ? 'shield-checkmark-outline' : profile.security_status === 'locked' ? 'lock-closed-outline' : 'shield-outline'} label={getSecurityLabel(profile.security_status)} />
                </View>
              </>
            ) : null}
          </Panel>

          <Panel title="Historial paginado" icon="pulse-outline" className="mt-5">
            <AdminSearchBar search={search} onChangeSearch={setSearch} placeholder="Buscar actividad, cursos o contenido..." />
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
              {activityPage.rows.map((event) => {
                const titleLabel = event.event_type === 'teacher_action' || event.event_type === 'admin_action' ? getAuditActionLabel(event.title) : event.title
                const questionText = event.event_type === 'attempt' ? stringMetadata(event.metadata || {}, 'question_text') : null
                const description = event.event_type === 'teacher_action' || event.event_type === 'admin_action' ? null : event.description
                const earnedPoints = numericMetadata(event.metadata, 'earned_points')
                const reference = formatActivityReference(event.entity_table, event.entity_id)
                return (
                  <View key={event.event_id} style={[styles.eventRow, { borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }]}>
                    <View style={[styles.eventIcon, { backgroundColor: getSeverityColor(event.severity, true) }]}><Ionicons name={getEventIcon(event.event_type)} size={20} color={getSeverityColor(event.severity, false)} /></View>
                    <View className="min-w-0 flex-1">
                      <View className="flex-row flex-wrap items-start justify-between gap-2">
                        <Text className="min-w-[180px] flex-1 text-[14px] font-black text-white">{titleLabel}</Text>
                        <Text className="text-[10px] font-bold text-text-muted">{formatAuditDate(event.occurred_at)}</Text>
                      </View>
                      {questionText ? <Text className="mt-1 text-[13px] font-bold leading-5 text-text-primary" numberOfLines={2}>{questionText}</Text> : null}
                      {description ? <Text className="mt-1 text-[12px] leading-5 text-text-secondary">{description}</Text> : null}
                      <View className="mt-2 flex-row flex-wrap items-center gap-2">
                        {event.event_type === 'attempt' && earnedPoints > 0 ? <Text className="text-[10px] font-black text-semantic-success">+{earnedPoints} XP</Text> : null}
                        <Text className="text-[10px] font-bold text-text-muted">{reference}</Text>
                        {event.entity_id ? (
                          <AppPressable accessibilityLabel={`Copiar identificador completo de ${getAuditTargetTypeLabel(event.entity_table)}`} accessibilityHint="Copia la referencia técnica sin mostrarla completa en pantalla" onPress={() => void copyReference(event.entity_id!)} style={({ pressed }) => ({ width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(tokens.brand.admin, pressed ? '28' : '14'), opacity: pressed ? 0.78 : 1 })}>
                            <Ionicons name="copy-outline" size={14} color={tokens.brand.admin} />
                          </AppPressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                )
              })}
              {!activityPage.loading && activityPage.rows.length === 0 ? <EmptyState label="No hay actividad que coincida con los filtros." /> : null}
            </View>

            <AdminPaginationControls page={activityPage.page} pageSize={activityPage.pageSize} total={activityPage.total} hasPrevious={activityPage.hasPrevious} hasNext={activityPage.hasNext} onPrevious={activityPage.previousPage} onNext={activityPage.nextPage} />
          </Panel>
        </>
      )}
    </AdminScaffold>
  )
}

function SummaryFact({ icon, label }: { icon: IconName; label: string }) {
  const { tokens } = useAppTheme()
  return <View className="min-h-9 flex-row items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}><Ionicons name={icon} size={15} color={tokens.brand.admin} /><Text className="text-[11px] font-bold text-text-secondary">{label}</Text></View>
}

function getRoleLabel(role?: string | null) { return role === 'teacher' ? 'Profesor' : role === 'admin' ? 'Administrador' : role === 'guest' ? 'Invitado' : 'Alumno' }
function getScopeSummary(profile: ProfileRow) { const count = profile.role_id === 'teacher' ? Number(profile.subject_count || 0) : Number(profile.enrollment_count || 0); const noun = profile.role_id === 'teacher' ? (count === 1 ? 'curso' : 'cursos') : (count === 1 ? 'inscripción' : 'inscripciones'); return `${count} ${noun}` }
function getSecurityLabel(status?: string | null) { return status === 'secure' ? 'Cuenta sin alertas' : status === 'inactive' ? 'Cuenta inactiva' : status === 'locked' ? 'Acceso bloqueado' : status === 'unverified' ? 'Correo sin verificar' : status === 'never_signed_in' ? 'Sin primer acceso' : 'Seguridad por revisar' }
function numericMetadata(metadata: Record<string, unknown> | null, key: string) { const value = metadata?.[key]; return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
function formatActivityReference(table?: string | null, id?: string | null) { const label = getAuditTargetTypeLabel(table); if (!id) return label; if (/^[0-9]+$/.test(id)) return `${label} · #${id}`; if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return `${label} · referencia …${id.slice(-12)}`; return `${label} · ${id.length > 18 ? `…${id.slice(-12)}` : id}` }

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
  eventRow: { minHeight: 82, borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12 },
  eventIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
}
