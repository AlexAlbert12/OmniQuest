import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fetchAdminPortalContext, fetchOptionalRows, isMissingSchemaError } from '../api/adminApi'
import type {
  AdminAuditLogRow,
  AdminDashboardMetrics,
  AdminData,
  AdminPortalContext,
  ClassroomRow,
  ProfileRow,
  SubjectRow,
} from '../types/admin'
import { getFallbackAdminMetrics, normalizeAdminMetrics, showAlert } from '../utils/adminUtils'

export function useAdminData(): AdminData {
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [portalContext, setPortalContext] = useState<AdminPortalContext | null>(null)
  const [metrics, setMetrics] = useState<AdminDashboardMetrics>(() => getFallbackAdminMetrics({ classrooms: [], enrollments: [], profiles: [], subjects: [] }))
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [version, setVersion] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const [contextResult, metricsResult, adminsResult, auditLogData] = await Promise.all([
        fetchAdminPortalContext().catch(() => null),
        supabase.rpc('get_admin_dashboard_metrics' as any) as any,
        supabase.rpc('get_admin_profiles_page' as any, {
          p_role: 'admin', p_search: '', p_subject_id: null, p_classroom_id: null, p_profile_id: null,
          p_active: null, p_activity_state: null, p_created_from: null, p_created_to: null, p_limit: 50, p_offset: 0,
        }) as any,
        fetchOptionalRows<AdminAuditLogRow>('admin_audit_logs', 'id, chain_seq, admin_id, action, target_table, target_id, severity, metadata, before_state, after_state, previous_hash, chain_hash, retention_until, created_at', { orderBy: 'created_at', ascending: false, limit: 50 }),
      ])

      const fallbackMetrics = getFallbackAdminMetrics({ classrooms: [], enrollments: [], profiles: [], subjects: [] })
      if (metricsResult.error && !isMissingSchemaError(metricsResult.error.code)) console.warn('[admin] No se pudieron cargar métricas agregadas:', metricsResult.error.message)
      if (adminsResult.error && !isMissingSchemaError(adminsResult.error.code)) console.warn('[admin] No se pudieron cargar administradores:', adminsResult.error.message)

      setPortalContext(contextResult)
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

  useEffect(() => { void fetchData() }, [fetchData])

  const teachers = useMemo(() => profiles.filter((profile) => profile.role_id === 'teacher'), [profiles])
  const students = useMemo(() => profiles.filter((profile) => profile.role_id === 'student' || profile.role_id === 'guest'), [profiles])
  const teacherById = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher])), [teachers])
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students])
  const subjectById = useMemo(() => new Map<number, SubjectRow>(), [])
  const classroomById = useMemo(() => new Map<number, ClassroomRow>(), [])

  const onRefresh = () => { setRefreshing(true); void fetchData() }

  return {
    profiles, teachers, students, subjects: [], classrooms: [], enrollments: [], metrics, auditLogs,
    teacherById, studentById, subjectById, classroomById, portalContext,
    loading, refreshing, onRefresh, refresh: fetchData, version,
  }
}
