import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { TeacherDigestFrequency } from '../../components/settings/SettingsTypes'
import { deactivateCurrentDevicePushToken, registerCurrentDeviceForPush } from '../../lib/pushNotifications'
import { supabase } from '../../lib/supabase'
import { getErrorMessage, isRecord } from '../../lib/typeGuards'

export type TeacherCourseNotificationPreference = {
  subjectId: number
  subjectName: string
  criticalEnabled: boolean
  informativeEnabled: boolean
  digestEnabled: boolean
  mutedUntil: string | null
}

export type TeacherDigestDelivery = {
  id: number
  frequency: TeacherDigestFrequency
  status: string
  periodStart: string
  periodEnd: string
  sentAt: string | null
  recipientEmail: string
  lastErrorMessage: string | null
}

export type TeacherCommunicationGlobal = {
  pushEnabled: boolean
  inactiveStudentAlerts: boolean
  openReviewAlerts: boolean
  auditAlerts: boolean
  mutedUntil: string | null
  digestFrequency: TeacherDigestFrequency
  digestHour: number
  digestWeekday: number
  lastDigestSentAt: string | null
  reminderEmail: string
}

const EMPTY_GLOBAL: TeacherCommunicationGlobal = {
  pushEnabled: false,
  inactiveStudentAlerts: true,
  openReviewAlerts: true,
  auditAlerts: true,
  mutedUntil: null,
  digestFrequency: 'daily',
  digestHour: 7,
  digestWeekday: 1,
  lastDigestSentAt: null,
  reminderEmail: '',
}

type GlobalPreferencePatch = Partial<Pick<TeacherCommunicationGlobal, 'pushEnabled' | 'inactiveStudentAlerts' | 'openReviewAlerts' | 'auditAlerts'>>

export function useTeacherCommunicationSettings() {
  const [global, setGlobal] = useState(EMPTY_GLOBAL)
  const [courses, setCourses] = useState<TeacherCourseNotificationPreference[]>([])
  const [history, setHistory] = useState<TeacherDigestDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [pushRegistrationStatus, setPushRegistrationStatus] = useState<'idle' | 'registered' | 'denied' | 'unsupported' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_teacher_notification_settings')
      if (rpcError) throw rpcError
      applySettingsPayload(data, setGlobal, setCourses, setHistory)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'No se pudieron cargar las preferencias docentes.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveGlobalPreferences = useCallback(async (patch: GlobalPreferencePatch) => {
    const resolved = { ...global, ...patch }
    const key = Object.keys(patch)[0] || 'alerts'
    setSavingKey(key)
    setError(null)
    try {
      if (patch.pushEnabled === true && !global.pushEnabled) {
        const registration = await registerCurrentDeviceForPush()
        setPushRegistrationStatus(registration.status)
        if (registration.status !== 'registered') throw new Error(registration.message || 'No se pudo registrar este dispositivo para notificaciones push.')
      }

      const { data, error: rpcError } = await supabase.rpc('set_teacher_notification_preferences', {
        p_push_enabled: resolved.pushEnabled,
        p_inactive_student_alerts: resolved.inactiveStudentAlerts,
        p_open_review_alerts: resolved.openReviewAlerts,
        p_sensitive_action_alerts: resolved.auditAlerts,
      })
      if (rpcError) throw rpcError
      applySettingsPayload(data, setGlobal, setCourses, setHistory)

      if (patch.pushEnabled === false && global.pushEnabled) {
        await deactivateCurrentDevicePushToken()
        setPushRegistrationStatus('idle')
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudieron guardar las alertas docentes.'))
      throw saveError
    } finally {
      setSavingKey(null)
    }
  }, [global])

  const saveDigest = useCallback(async (next: Partial<Pick<TeacherCommunicationGlobal, 'digestFrequency' | 'digestHour' | 'digestWeekday' | 'reminderEmail'>>) => {
    const resolved = { ...global, ...next }
    setSavingKey('digest')
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('set_teacher_digest_preference', {
        p_frequency: resolved.digestFrequency,
        p_recipient_email: resolved.reminderEmail || undefined,
        p_hour: resolved.digestHour,
        p_weekday: resolved.digestWeekday,
      })
      if (rpcError) throw rpcError
      applySettingsPayload(data, setGlobal, setCourses, setHistory)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar el resumen docente.'))
      throw saveError
    } finally {
      setSavingKey(null)
    }
  }, [global])

  const setMute = useCallback(async (until: string | null) => {
    setSavingKey('mute')
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('set_teacher_notifications_mute', { p_until: until ?? undefined })
      if (rpcError) throw rpcError
      applySettingsPayload(data, setGlobal, setCourses, setHistory)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo cambiar el silencio temporal.'))
      throw saveError
    } finally {
      setSavingKey(null)
    }
  }, [])

  const saveCourse = useCallback(async (subjectId: number, patch: Partial<TeacherCourseNotificationPreference>) => {
    const current = courses.find((course) => course.subjectId === subjectId)
    if (!current) return
    const next = { ...current, ...patch }
    setSavingKey(`course:${subjectId}`)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('set_teacher_course_notification_preference', {
        p_subject_id: subjectId,
        p_critical_enabled: next.criticalEnabled,
        p_informative_enabled: next.informativeEnabled,
        p_digest_enabled: next.digestEnabled,
        p_muted_until: next.mutedUntil ?? undefined,
      })
      if (rpcError) throw rpcError
      applySettingsPayload(data, setGlobal, setCourses, setHistory)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudieron guardar las preferencias del curso.'))
      throw saveError
    } finally {
      setSavingKey(null)
    }
  }, [courses])

  return {
    global,
    setGlobalDraft: setGlobal,
    courses,
    history,
    loading,
    savingKey,
    pushRegistrationStatus,
    error,
    refresh: load,
    saveGlobalPreferences,
    saveDigest,
    setMute,
    saveCourse,
  }
}

function applySettingsPayload(
  data: unknown,
  setGlobal: Dispatch<SetStateAction<TeacherCommunicationGlobal>>,
  setCourses: Dispatch<SetStateAction<TeacherCourseNotificationPreference[]>>,
  setHistory: Dispatch<SetStateAction<TeacherDigestDelivery[]>>,
) {
  const payload = isRecord(data) ? data : {}
  const globalPayload = isRecord(payload.global) ? payload.global : {}
  setGlobal((current) => ({
    ...current,
    pushEnabled: globalPayload.push_enabled === true,
    inactiveStudentAlerts: globalPayload.inactive_student_alerts !== false,
    openReviewAlerts: globalPayload.open_review_alerts !== false,
    auditAlerts: globalPayload.audit_alerts !== false,
    mutedUntil: typeof globalPayload.muted_until === 'string' ? globalPayload.muted_until : null,
    digestFrequency: normalizeFrequency(globalPayload.digest_frequency),
    digestHour: clamp(Number(globalPayload.digest_hour ?? current.digestHour), 0, 23),
    digestWeekday: clamp(Number(globalPayload.digest_weekday ?? current.digestWeekday), 1, 7),
    lastDigestSentAt: typeof globalPayload.last_digest_sent_at === 'string' ? globalPayload.last_digest_sent_at : null,
    reminderEmail: String(globalPayload.reminder_email ?? current.reminderEmail),
  }))
  if (Array.isArray(payload.courses)) setCourses(payload.courses.map(mapCourse))
  if (Array.isArray(payload.digest_history)) setHistory(payload.digest_history.map(mapHistory))
}

function mapCourse(value: unknown): TeacherCourseNotificationPreference {
  const row = isRecord(value) ? value : {}
  return {
    subjectId: Number(row.subject_id),
    subjectName: String(row.subject_name || 'Curso'),
    criticalEnabled: row.critical_enabled !== false,
    informativeEnabled: row.informative_enabled !== false,
    digestEnabled: row.digest_enabled !== false,
    mutedUntil: typeof row.muted_until === 'string' ? row.muted_until : null,
  }
}

function mapHistory(value: unknown): TeacherDigestDelivery {
  const row = isRecord(value) ? value : {}
  return {
    id: Number(row.id),
    frequency: normalizeFrequency(row.frequency),
    status: String(row.status || 'queued'),
    periodStart: String(row.period_start || new Date(0).toISOString()),
    periodEnd: String(row.period_end || new Date(0).toISOString()),
    sentAt: typeof row.sent_at === 'string' ? row.sent_at : null,
    recipientEmail: String(row.recipient_email || ''),
    lastErrorMessage: typeof row.last_error_message === 'string' ? row.last_error_message : null,
  }
}

function normalizeFrequency(value: unknown): TeacherDigestFrequency {
  return value === 'off' || value === 'weekly' ? value : 'daily'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max)
}
