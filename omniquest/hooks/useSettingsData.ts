import { useCallback, useMemo, useState } from 'react'
import { Alert, Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useI18n, type AppLocale } from '../lib/i18n'
import { useAppHaptics } from '../lib/haptics'
import { deactivateCurrentDevicePushToken, registerCurrentDeviceForPush } from '../lib/pushNotifications'
import { getNextLevelProgress, getStudentLevel } from '../lib/studentLevel'
import { updateAnalyticsConsent } from '../lib/analytics'
import type { Database } from '../types/database.types'
import {
  REQUIRED_DESTRUCTIVE_CONFIRMATION,
  type DestructiveActionType,
} from '../components/settings/SettingsDangerZone'
import type {
  AppRole,
  NotificationFrequency,
  NotificationSettingKey,
  NotificationSettingsRow,
  NotificationSettingsState,
  PreferenceKey,
  ProfileVisibility,
  UserPreferencesRow,
  UserPreferencesState,
  UserProfile,
  TeacherNotificationSettingsRow,
  TeacherNotificationSettingsState,
} from '../components/settings/SettingsTypes'

type ExportTableName =
  | 'answers'
  | 'attempt_history'
  | 'classrooms'
  | 'enrollments'
  | 'notification_state'
  | 'questions'
  | 'student_badges'
  | 'subject_scores'
  | 'subject_topics'
  | 'subjects'
  | 'topic_scores'
  | 'user_notification_preferences'
  | 'user_preferences'
  | 'user_support_tickets'
type ExportTableRow<Table extends ExportTableName> = Database['public']['Tables'][Table]['Row']
type OptionalRowsResult<Row> = PromiseLike<{
  data: Row[] | null
  error: { code?: string } | null
}>
type OptionalRowsQuery<Row> = {
  eq: (column: string, value: string) => OptionalRowsResult<Row>
  in: (column: string, values: readonly (number | string)[]) => OptionalRowsResult<Row>
}

const LOGIN_ROUTE = '/(auth)/login' as Href

const DEFAULT_PREFERENCES: UserPreferencesState = {
  language: 'es-ES',
  timezone: 'Europe/Madrid',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  weekStart: 'monday',
  hapticsEnabled: true,
  analyticsEnabled: false,
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsState = {
  push: false,
  email: false,
  daily: false,
  activities: true,
  news: false,
  frequency: 'daily',
}

const DEFAULT_TEACHER_NOTIFICATION_SETTINGS: TeacherNotificationSettingsState = {
  reminderEmail: '',
  inactiveStudentAlerts: true,
  openReviewAlerts: true,
  sensitiveActionAlerts: true,
  digestFrequency: 'daily',
}

export const notificationFrequencyOptions: NotificationFrequency[] = ['instant', 'daily', 'weekly']

const notificationFrequencyLabels: Record<NotificationFrequency, string> = {
  instant: 'Inmediata',
  daily: 'Diaria',
  weekly: 'Semanal',
}

export const preferenceOptions: Record<PreferenceKey, string[]> = {
  language: ['es-ES', 'en-US'],
  timezone: ['Europe/Madrid', 'UTC', 'America/Mexico_City', 'America/Bogota'],
  dateFormat: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
  timeFormat: ['24h', '12h'],
  weekStart: ['monday', 'sunday'],
}

const preferenceLabels = {
  language: {
    'es-ES': '🇪🇸 Español',
    'en-US': '🇺🇸 English',
  },
  timezone: {
    'Europe/Madrid': '(GMT+02:00) Madrid, España',
    UTC: 'UTC',
    'America/Mexico_City': '(GMT-06:00) Ciudad de México',
    'America/Bogota': '(GMT-05:00) Bogotá',
  },
  dateFormat: {
    'DD/MM/YYYY': 'DD/MM/YYYY',
    'MM/DD/YYYY': 'MM/DD/YYYY',
    'YYYY-MM-DD': 'YYYY-MM-DD',
  },
  timeFormat: {
    '24h': '24 horas',
    '12h': '12 horas',
  },
  weekStart: {
    monday: 'Lunes',
    sunday: 'Domingo',
  },
} as const


function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204'
}

function isMissingPreferencesTableError(errorCode?: string) {
  return isMissingSchemaError(errorCode)
}

function isMissingNotificationPreferencesTableError(errorCode?: string) {
  return isMissingSchemaError(errorCode)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
  }
  return undefined
}

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

function toPreferenceState(row: UserPreferencesRow | null): UserPreferencesState {
  return {
    language: row?.language || DEFAULT_PREFERENCES.language,
    timezone: row?.timezone || DEFAULT_PREFERENCES.timezone,
    dateFormat: row?.date_format || DEFAULT_PREFERENCES.dateFormat,
    timeFormat: row?.time_format || DEFAULT_PREFERENCES.timeFormat,
    weekStart: row?.week_start || DEFAULT_PREFERENCES.weekStart,
    hapticsEnabled: row?.haptics_enabled ?? DEFAULT_PREFERENCES.hapticsEnabled,
    analyticsEnabled: row?.analytics_enabled ?? DEFAULT_PREFERENCES.analyticsEnabled,
  }
}

function toNotificationSettingsState(row: NotificationSettingsRow | null): NotificationSettingsState {
  const rowFrequency = row?.frequency as NotificationFrequency | null
  const frequency = rowFrequency && notificationFrequencyOptions.includes(rowFrequency)
    ? rowFrequency
    : DEFAULT_NOTIFICATION_SETTINGS.frequency

  return {
    push: row?.push_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.push,
    email: row?.email_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.email,
    daily: row?.daily_summary_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.daily,
    activities: row?.activity_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.activities,
    news: row?.news_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.news,
    frequency,
  }
}

function toTeacherNotificationSettingsState(
  row: TeacherNotificationSettingsRow | null,
  fallbackEmail: string,
): TeacherNotificationSettingsState {
  const digestFrequency = row?.teacher_digest_frequency
  return {
    reminderEmail: row?.teacher_reminder_email || fallbackEmail,
    inactiveStudentAlerts: row?.teacher_inactive_student_alerts ?? true,
    openReviewAlerts: row?.teacher_open_review_alerts ?? true,
    sensitiveActionAlerts: row?.teacher_sensitive_action_alerts ?? true,
    digestFrequency: digestFrequency === 'off' || digestFrequency === 'weekly' ? digestFrequency : 'daily',
  }
}

async function fetchProfileWithOptionalVisibility(targetUserId: string) {
  const profileWithVisibility = await supabase
    .from('profiles')
    .select('id, alias, avatar, points, role_id, visibility')
    .eq('id', targetUserId)
    .single()

  if (!profileWithVisibility.error) {
    return { result: profileWithVisibility, hasVisibility: true }
  }

  const profileWithoutVisibility = await supabase
    .from('profiles')
    .select('id, alias, avatar, points, role_id')
    .eq('id', targetUserId)
    .single()

  return { result: profileWithoutVisibility, hasVisibility: false }
}

export function useSettingsData({ forcedRole }: { forcedRole?: AppRole }) {
  const router = useRouter()
  const { locale, setLocale, t } = useI18n()
  const { setEnabled: setHapticsEnabled, selection: hapticSelection } = useAppHaptics()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [role, setRole] = useState<AppRole>(forcedRole || 'student')
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [name, setName] = useState('Alumno')
  const [email, setEmail] = useState('alumno@omniquest.com')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [lastSignInAt, setLastSignInAt] = useState<string | null>(null)
  const [emailConfirmedAt, setEmailConfirmedAt] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<UserPreferencesState>(DEFAULT_PREFERENCES)
  const [savingPreference, setSavingPreference] = useState<PreferenceKey | null>(null)
  const [savingHaptics, setSavingHaptics] = useState(false)
  const [savingAnalytics, setSavingAnalytics] = useState(false)
  const [openPreferenceKey, setOpenPreferenceKey] = useState<PreferenceKey | null>(null)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsState>(DEFAULT_NOTIFICATION_SETTINGS)
  const [teacherNotificationSettings, setTeacherNotificationSettings] = useState<TeacherNotificationSettingsState>(DEFAULT_TEACHER_NOTIFICATION_SETTINGS)
  const [savingTeacherNotificationKey, setSavingTeacherNotificationKey] = useState<keyof TeacherNotificationSettingsState | null>(null)
  const [pushRegistrationStatus, setPushRegistrationStatus] = useState<'idle' | 'registered' | 'denied' | 'unsupported' | 'error'>('idle')
  const [savingNotificationKey, setSavingNotificationKey] = useState<NotificationSettingKey | 'frequency' | null>(null)
  const [openNotificationFrequency, setOpenNotificationFrequency] = useState(false)
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility | null>(null)
  const [profileVisibilityAvailable, setProfileVisibilityAvailable] = useState(false)
  const [savingProfileVisibility, setSavingProfileVisibility] = useState(false)
  const [exportingData, setExportingData] = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [pendingDestructiveAction, setPendingDestructiveAction] = useState<DestructiveActionType | null>(null)
  const [destructiveConfirmationText, setDestructiveConfirmationText] = useState('')
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const isTeacher = role === 'teacher'
  const points = profile?.points ?? 0
  const alias = profile?.alias || (isTeacher ? 'Profesor' : 'Alumno')
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const userInitials = getInitials(name)
  const passwordChecks = useMemo(() => {
    const hasCurrentPassword = currentPassword.length > 0
    const hasMinimumLength = newPassword.length >= 8
    const hasConfirmation = confirmPassword.length > 0
    const passwordsMatch = hasConfirmation && newPassword === confirmPassword
    const isDifferentFromCurrent = newPassword.length > 0 && newPassword !== currentPassword

    return {
      hasCurrentPassword,
      hasMinimumLength,
      hasConfirmation,
      passwordsMatch,
      isDifferentFromCurrent,
      canSubmit: hasCurrentPassword && hasMinimumLength && passwordsMatch && isDifferentFromCurrent && !changingPassword,
    }
  }, [confirmPassword, currentPassword, changingPassword, newPassword])

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  const resetOwnStudentProgress = async (resetType: Exclude<DestructiveActionType, 'account'>) => {
    const { data, error } = await supabase.functions.invoke('student-reset-own-progress', {
      body: { resetType },
    })

    if (error) throw error
    const result = (data || {}) as { avatar?: string | null; error?: string; points?: number }
    if (result.error) throw new Error(result.error)
    return result
  }

  const resetOwnTeacherData = async (dataType: Exclude<DestructiveActionType, 'account'>) => {
    const resetType = dataType === 'all'
      ? 'all'
      : dataType === 'enrollments'
        ? 'teaching_data'
        : 'scores'

    const { data, error } = await supabase.functions.invoke('teacher-reset-own-data', {
      body: { resetType },
    })

    if (error) throw error
    const result = (data || {}) as { avatar?: string | null; error?: string; resetType?: string }
    if (result.error) throw new Error(result.error)
    return result
  }

  const selectOptionalRows = async <Table extends ExportTableName>(
    table: Table,
    column: keyof ExportTableRow<Table> & string,
    value: string
  ): Promise<ExportTableRow<Table>[]> => {
    const query = supabase.from(table).select('*') as unknown as OptionalRowsQuery<ExportTableRow<Table>>
    const { data, error } = await query.eq(column, value)
    if (error && !isMissingSchemaError(error.code)) {
      throw error
    }
    return error ? [] : data || []
  }

  const selectOptionalRowsIn = async <Table extends ExportTableName>(
    table: Table,
    column: keyof ExportTableRow<Table> & string,
    values: number[] | string[]
  ): Promise<ExportTableRow<Table>[]> => {
    if (values.length === 0) return []
    const query = supabase.from(table).select('*') as unknown as OptionalRowsQuery<ExportTableRow<Table>>
    const { data, error } = await query.in(column, values)
    if (error && !isMissingSchemaError(error.code)) {
      throw error
    }
    return error ? [] : data || []
  }

  const handleProfileVisibilityChange = async (visibility: ProfileVisibility) => {
    if (!userId || savingProfileVisibility) return
    if (!profileVisibilityAvailable) {
      showAlert(
        'Visibilidad no disponible',
        'La visibilidad del perfil no está disponible temporalmente. Inténtalo de nuevo más tarde.'
      )
      return
    }
    setSavingProfileVisibility(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ visibility })
        .eq('id', userId)

      if (error) throw error

      setProfileVisibility(visibility)
      showAlert(
        isTeacher ? 'Visibilidad actualizada' : 'Privacidad del ranking actualizada',
        isTeacher
          ? `Tu perfil ahora es ${visibility === 'public' ? 'público' : 'privado'}.`
          : visibility === 'public'
            ? 'Volverás a aparecer en las clasificaciones autorizadas.'
            : 'Ya no aparecerás ante otros usuarios en el ranking.'
      )
    } catch (error: unknown) {
      if (isMissingSchemaError(getErrorCode(error))) {
        setProfileVisibilityAvailable(false)
        setProfileVisibility(null)
        showAlert(
          'Visibilidad no disponible',
          'La visibilidad del perfil no está disponible temporalmente. Inténtalo de nuevo más tarde.'
        )
      } else {
        showAlert('Error', getErrorMessage(error) || 'No se pudo actualizar la visibilidad del perfil.')
      }
    } finally {
      setSavingProfileVisibility(false)
    }
  }

  const handleExportData = async () => {
    if (!userId) return

    setExportingData(true)
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError

      const notificationState = await selectOptionalRows('notification_state', 'user_id', userId)
      const userPreferences = await selectOptionalRows('user_preferences', 'user_id', userId)
      const notificationPreferences = await selectOptionalRows('user_notification_preferences', 'user_id', userId)

      let exportData: Record<string, unknown>

      if (isTeacher) {
        const { data: teacherSubjects, error: subjectsError } = await supabase
          .from('subjects')
          .select('*')
          .eq('teacher_id', userId)

        if (subjectsError) throw subjectsError

        const subjectIds = (teacherSubjects || [])
          .map((subject: { id: number | null }) => subject.id)
          .filter((id): id is number => typeof id === 'number')
        const questions = await selectOptionalRowsIn('questions', 'subject_id', subjectIds)
        const questionIds = questions
          .map((question: { id: number | null }) => question.id)
          .filter((id: number | null): id is number => typeof id === 'number')

        exportData = {
          exportDate: new Date().toISOString(),
          role: 'teacher',
          profile: profileData,
          subjects: teacherSubjects || [],
          classrooms: await selectOptionalRowsIn('classrooms', 'subject_id', subjectIds),
          topics: await selectOptionalRowsIn('subject_topics', 'subject_id', subjectIds),
          questions,
          answers: await selectOptionalRowsIn('answers', 'question_id', questionIds),
          enrollments: await selectOptionalRowsIn('enrollments', 'subject_id', subjectIds),
          subjectScores: await selectOptionalRowsIn('subject_scores', 'subject_id', subjectIds),
          topicScores: await selectOptionalRowsIn('topic_scores', 'subject_id', subjectIds),
          attempts: await selectOptionalRowsIn('attempt_history', 'question_id', questionIds),
          supportTickets: await selectOptionalRows('user_support_tickets', 'user_id', userId),
          notificationState,
          userPreferences,
          notificationPreferences,
        }
      } else {
        exportData = {
          exportDate: new Date().toISOString(),
          role: 'student',
          profile: profileData,
          subjectScores: await selectOptionalRows('subject_scores', 'student_id', userId),
          topicScores: await selectOptionalRows('topic_scores', 'student_id', userId),
          enrollments: await selectOptionalRows('enrollments', 'student_id', userId),
          attempts: await selectOptionalRows('attempt_history', 'student_id', userId),
          badges: await selectOptionalRows('student_badges', 'student_id', userId),
          supportTickets: await selectOptionalRows('user_support_tickets', 'user_id', userId),
          notificationState,
          userPreferences,
          notificationPreferences,
        }
      }

      const jsonData = JSON.stringify(exportData, null, 2)
      const fileName = `omniquest-${isTeacher ? 'profesor' : 'alumno'}-${new Date().toISOString().split('T')[0]}.json`

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonData], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showAlert('Datos exportados', 'Tus datos han sido descargados como archivo JSON.')
      } else {
        const exportDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory
        if (!exportDirectory) {
          throw new Error('No se pudo acceder al almacenamiento local para crear el archivo.')
        }

        const fileUri = `${exportDirectory}${fileName}`
        await FileSystem.writeAsStringAsync(fileUri, jsonData, {
          encoding: FileSystem.EncodingType.UTF8,
        })

        const sharingAvailable = await Sharing.isAvailableAsync()
        if (!sharingAvailable) {
          showAlert('Datos exportados', `Archivo generado en:\n${fileUri}`)
          return
        }

        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          UTI: 'public.json',
          dialogTitle: 'Exportar datos de OmniQuest',
        })
        showAlert('Datos exportados', 'Se ha generado un archivo JSON con tus datos.')
      }
    } catch (error: unknown) {
      showAlert('Error', getErrorMessage(error) || 'No se pudieron exportar los datos.')
    } finally {
      setExportingData(false)
    }
  }

  const executeDeletePartialData = async (dataType: Exclude<DestructiveActionType, 'account'>) => {
    if (!userId) return

    setDeletingData(true)
    try {
      if (!isTeacher) {
        const result = await resetOwnStudentProgress(dataType)

        if (dataType === 'scores' || dataType === 'all') {
          setProfile(prev => prev ? { ...prev, points: result.points ?? 0 } : null)
        }

        if (dataType === 'all') {
          setPreferences(DEFAULT_PREFERENCES)
          setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS)
          setProfile(prev => prev ? { ...prev, points: result.points ?? 0, avatar: result.avatar ?? null } : null)
        }

        showAlert('Datos eliminados', 'Los datos seleccionados han sido eliminados correctamente.')
        return
      }

      const result = await resetOwnTeacherData(dataType)

      if (dataType === 'enrollments' || dataType === 'all') {
        setSubjectsCount(0)
      }

      if (dataType === 'all') {
        setPreferences(DEFAULT_PREFERENCES)
        setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS)
        setProfile(prev => prev ? { ...prev, avatar: result.avatar ?? null } : null)
      }

      showAlert('Datos eliminados', 'Los datos seleccionados han sido eliminados correctamente.')
    } catch (error: unknown) {
      showAlert('Error', getErrorMessage(error) || 'No se pudieron eliminar los datos.')
    } finally {
      setDeletingData(false)
    }
  }

  const handleDeletePartialData = (dataType: Exclude<DestructiveActionType, 'account'>) => {
    setDestructiveConfirmationText('')
    setPendingDestructiveAction(dataType)
  }

  const showPrivacyCenter = () => {
    const privacyInfo = [
      '• Tu privacidad es nuestra prioridad',
      '• Recopilamos solo datos necesarios para el funcionamiento de la app',
      '• Tus datos se almacenan de forma segura y encriptada',
      '• Puedes exportar o eliminar tus datos en cualquier momento',
      '• No compartimos tus datos con terceros sin tu consentimiento',
      '• Puedes controlar la visibilidad de tu perfil',
      '• Contacta con soporte si tienes preguntas sobre privacidad',
    ].join('\n')

    showAlert('Centro de Privacidad', privacyInfo)
  }

  const formatPreferenceLabel = (key: PreferenceKey, value: string) => {
    if (key === 'language') {
      return value === 'en-US' ? t('settings.language.english') : t('settings.language.spanish')
    }
    const labelsByKey = preferenceLabels[key] as Record<string, string>
    return labelsByKey[value] || value
  }

  const formatNotificationFrequencyLabel = (value: NotificationFrequency) => {
    return notificationFrequencyLabels[value] || value
  }

  const savePreferences = async (targetUserId: string, next: UserPreferencesState) => {
    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: targetUserId,
        language: next.language,
        timezone: next.timezone,
        date_format: next.dateFormat,
        time_format: next.timeFormat,
        week_start: next.weekStart,
        haptics_enabled: next.hapticsEnabled,
        analytics_enabled: next.analyticsEnabled,
      },
      { onConflict: 'user_id' }
    )

    if (error) throw error
  }

  const saveNotificationSettings = async (
    targetUserId: string,
    next: NotificationSettingsState,
    teacherNext: TeacherNotificationSettingsState = teacherNotificationSettings,
  ) => {
    const { error } = await supabase.from('user_notification_preferences').upsert(
      {
        user_id: targetUserId,
        push_enabled: next.push,
        email_enabled: next.email,
        daily_summary_enabled: next.daily,
        activity_enabled: next.activities,
        news_enabled: next.news,
        frequency: next.frequency,
        teacher_reminder_email: teacherNext.reminderEmail.trim() || null,
        teacher_inactive_student_alerts: teacherNext.inactiveStudentAlerts,
        teacher_open_review_alerts: teacherNext.openReviewAlerts,
        teacher_sensitive_action_alerts: teacherNext.sensitiveActionAlerts,
        teacher_digest_frequency: teacherNext.digestFrequency,
      },
      { onConflict: 'user_id' }
    )

    if (error) throw error
  }

  const fetchSettings = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session

      if (!session) {
        router.replace(LOGIN_ROUTE)
        return
      }

      setUserId(session.user.id)
      setEmail(session.user.email || 'alumno@omniquest.com')
      setLastSignInAt(session.user.last_sign_in_at || null)
      setEmailConfirmedAt(session.user.email_confirmed_at || session.user.confirmed_at || null)

      const [profileFetch, preferencesResult, subjectsResult] = await Promise.all([
        fetchProfileWithOptionalVisibility(session.user.id),
        supabase
          .from('user_preferences')
          .select('language, timezone, date_format, time_format, week_start, haptics_enabled, analytics_enabled, analytics_consent_updated_at')
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase.from('subjects').select('id').eq('teacher_id', session.user.id).eq('is_archived', false),
      ])

      let notificationSettingsResult = await supabase
        .from('user_notification_preferences')
        .select('push_enabled, email_enabled, daily_summary_enabled, activity_enabled, news_enabled, frequency, teacher_reminder_email, teacher_inactive_student_alerts, teacher_open_review_alerts, teacher_sensitive_action_alerts, teacher_digest_frequency')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (notificationSettingsResult.error?.code === '42703' || notificationSettingsResult.error?.code === 'PGRST204') {
        notificationSettingsResult = await supabase
          .from('user_notification_preferences')
          .select('push_enabled, email_enabled, daily_summary_enabled, activity_enabled, news_enabled, frequency')
          .eq('user_id', session.user.id)
          .maybeSingle() as typeof notificationSettingsResult
      }

      const profileResult = profileFetch.result
      if (profileResult.error && profileResult.error.code !== 'PGRST116') throw profileResult.error
      if (preferencesResult.error && !isMissingPreferencesTableError(preferencesResult.error.code)) {
        throw preferencesResult.error
      }
      if (notificationSettingsResult.error && !isMissingNotificationPreferencesTableError(notificationSettingsResult.error.code)) {
        throw notificationSettingsResult.error
      }
      if (subjectsResult.error) throw subjectsResult.error

      const nextProfile = profileResult.data as UserProfile | null
      setProfile(nextProfile)
      setProfileVisibilityAvailable(profileFetch.hasVisibility)
      setProfileVisibility(profileFetch.hasVisibility ? nextProfile?.visibility || 'public' : null)
      const detectedRole = forcedRole || (nextProfile?.role_id === 'teacher' ? 'teacher' : 'student')
      setRole(detectedRole)
      setName(nextProfile?.alias || (detectedRole === 'teacher' ? 'Profesor' : 'Alumno'))

      const teacherSubjectIds = (subjectsResult.data || [])
        .map((subject: { id: number | null }) => subject.id)
        .filter((id): id is number => typeof id === 'number')

      setSubjectsCount(teacherSubjectIds.length)

      const nextPreferences = toPreferenceState((preferencesResult.data as UserPreferencesRow | null) || null)
      setPreferences(nextPreferences)
      void setHapticsEnabled(nextPreferences.hapticsEnabled)
      if (nextPreferences.language === 'es-ES' || nextPreferences.language === 'en-US') {
        void setLocale(nextPreferences.language as AppLocale)
      }
      setNotificationSettings(
        toNotificationSettingsState((notificationSettingsResult.data as NotificationSettingsRow | null) || null)
      )
      setTeacherNotificationSettings(
        toTeacherNotificationSettingsState(
          (notificationSettingsResult.data as (NotificationSettingsRow & TeacherNotificationSettingsRow) | null) || null,
          session.user.email || '',
        )
      )
    } catch (error: unknown) {
      console.error('Error cargando configuración:', getErrorMessage(error))
      showAlert('No se pudo cargar la configuración', 'Inténtalo de nuevo en unos segundos.')
    } finally {
      setLoading(false)
    }
  }, [forcedRole, router, setHapticsEnabled, setLocale])

  useFocusEffect(
    useCallback(() => {
      fetchSettings()
    }, [fetchSettings])
  )

  const handleSaveProfile = async () => {
    if (!profile?.id) return

    try {
      setSaving(true)
      const cleanName = name.trim() || (isTeacher ? 'Profesor' : 'Alumno')
      if (cleanName.length < 3) {
        showAlert('Alias demasiado corto', 'El nombre visible debe tener al menos 3 caracteres.')
        return
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: { alias: cleanName },
      })

      if (authError) throw authError

      const { error } = await supabase.from('profiles').update({ alias: cleanName }).eq('id', profile.id)
      if (error) throw error
      setName(cleanName)
      setProfile({ ...profile, alias: cleanName })
      showAlert('Perfil actualizado', `Tu información de ${isTeacher ? 'profesor' : 'alumno'} se ha actualizado correctamente.`)
    } catch (error: unknown) {
      console.error('Error actualizando perfil:', getErrorMessage(error))
      showAlert('No se pudo guardar', 'Revisa la conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!email || !passwordChecks.hasCurrentPassword) {
      showAlert('Falta la contraseña actual', 'Escribe tu contraseña actual para verificar que eres tú.')
      return
    }

    if (!passwordChecks.hasMinimumLength) {
      showAlert('Contraseña demasiado corta', 'La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (!passwordChecks.passwordsMatch) {
      showAlert('Las contraseñas no coinciden', 'Revisa la confirmación de la nueva contraseña.')
      return
    }

    if (!passwordChecks.isDifferentFromCurrent) {
      showAlert('Usa una contraseña diferente', 'La nueva contraseña debe ser distinta de la contraseña actual.')
      return
    }

    try {
      setChangingPassword(true)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })

      if (signInError) {
        throw new Error('La contraseña actual no es correcta.')
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
      showAlert('Contraseña actualizada', 'Tu contraseña se ha actualizado correctamente.')
    } catch (error: unknown) {
      showAlert('No se pudo actualizar', getErrorMessage(error) || 'Inténtalo de nuevo.')
    } finally {
      setChangingPassword(false)
    }
  }

  const executeDeleteAccount = async () => {
    try {
      setDeletingAccount(true)
      const { data, error } = await supabase.rpc('request_account_deletion')

      if (error) {
        throw new Error(error.message || 'No se pudo registrar la solicitud de borrado.')
      }
      const request = data && typeof data === 'object' && !Array.isArray(data)
        ? data as { scheduled_for?: string }
        : {}
      const scheduledFor = request.scheduled_for
        ? new Date(request.scheduled_for).toLocaleString(locale)
        : 'dentro de 7 días'
      showAlert(
        'Solicitud registrada',
        `Tu cuenta está programada para borrarse ${scheduledFor}. Puedes cancelar la solicitud desde Datos antes de esa fecha.`
      )
    } catch (error: unknown) {
      showAlert(
        'No se pudo solicitar el borrado',
        getErrorMessage(error) || 'No se pudo registrar la solicitud. Inténtalo de nuevo.'
      )
    } finally {
      setDeletingAccount(false)
    }
  }

  const handleDeleteAccount = () => {
    setDestructiveConfirmationText('')
    setPendingDestructiveAction('account')
  }

  const closeDestructiveConfirmation = () => {
    setPendingDestructiveAction(null)
    setDestructiveConfirmationText('')
  }

  const confirmDestructiveAction = async () => {
    if (!pendingDestructiveAction || destructiveConfirmationText.trim() !== REQUIRED_DESTRUCTIVE_CONFIRMATION) return

    const action = pendingDestructiveAction
    closeDestructiveConfirmation()

    if (action === 'account') {
      await executeDeleteAccount()
      return
    }

    await executeDeletePartialData(action)
  }

  const executeSignOut = async () => {
    await deactivateCurrentDevicePushToken().catch(() => undefined)
    await supabase.auth.signOut()
    router.replace(LOGIN_ROUTE)
  }

  const handleSignOut = () => {
    setShowSignOutConfirm(true)
  }

  const updateNotificationToggle = async (key: NotificationSettingKey) => {
    if (!userId) {
      showAlert('Sesión no disponible', 'No se pudo identificar el usuario para guardar notificaciones.')
      return
    }

    const previous = notificationSettings
    const next = { ...previous, [key]: !previous[key] }

    setNotificationSettings(next)
    setSavingNotificationKey(key)

    try {
      if (key === 'push' && next.push) {
        const registration = await registerCurrentDeviceForPush()
        setPushRegistrationStatus(registration.status)
        if (registration.status !== 'registered') {
          throw new Error(registration.message || 'No se pudo registrar este dispositivo para notificaciones push.')
        }
      }

      await saveNotificationSettings(userId, next)

      if (key === 'push' && !next.push) {
        await deactivateCurrentDevicePushToken()
        setPushRegistrationStatus('idle')
      }
    } catch (error: unknown) {
      setNotificationSettings(previous)
      if (isMissingNotificationPreferencesTableError(getErrorCode(error))) {
        showAlert(
          'Configuración pendiente',
          'Las preferencias de notificaciones no están disponibles temporalmente. Inténtalo de nuevo más tarde.'
        )
      } else {
        showAlert('No se pudo guardar', getErrorMessage(error) || 'No se pudieron guardar tus notificaciones.')
      }
    } finally {
      setSavingNotificationKey(null)
    }
  }

  const toggleNotificationFrequencyMenu = () => {
    setOpenPreferenceKey(null)
    setOpenNotificationFrequency((current) => !current)
  }

  const selectNotificationFrequency = async (value: NotificationFrequency) => {
    if (!userId) {
      showAlert('Sesión no disponible', 'No se pudo identificar el usuario para guardar notificaciones.')
      return
    }

    const previous = notificationSettings
    if (previous.frequency === value) {
      setOpenNotificationFrequency(false)
      return
    }

    const next = { ...previous, frequency: value }
    setOpenNotificationFrequency(false)
    setNotificationSettings(next)
    setSavingNotificationKey('frequency')

    try {
      await saveNotificationSettings(userId, next)
    } catch (error: unknown) {
      setNotificationSettings(previous)
      if (isMissingNotificationPreferencesTableError(getErrorCode(error))) {
        showAlert(
          'Configuración pendiente',
          'Las preferencias de notificaciones no están disponibles temporalmente. Inténtalo de nuevo más tarde.'
        )
      } else {
        showAlert('No se pudo guardar', getErrorMessage(error) || 'No se pudieron guardar tus notificaciones.')
      }
    } finally {
      setSavingNotificationKey(null)
    }
  }

  const updateTeacherNotificationPreference = async <Key extends keyof TeacherNotificationSettingsState>(
    key: Key,
    value: TeacherNotificationSettingsState[Key],
  ) => {
    if (!userId) {
      showAlert('Sesión no disponible', 'No se pudo identificar el profesor para guardar las preferencias.')
      return false
    }

    if (key === 'reminderEmail') {
      const reminderEmail = String(value).trim()
      if (reminderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reminderEmail)) {
        showAlert('Correo no válido', 'Introduce un correo válido para recibir recordatorios docentes.')
        return false
      }
      value = reminderEmail as TeacherNotificationSettingsState[Key]
    }

    const previous = teacherNotificationSettings
    const next = { ...previous, [key]: value }
    setTeacherNotificationSettings(next)
    setSavingTeacherNotificationKey(key)

    try {
      await saveNotificationSettings(userId, notificationSettings, next)
      return true
    } catch (error: unknown) {
      setTeacherNotificationSettings(previous)
      if (isMissingNotificationPreferencesTableError(getErrorCode(error))) {
        showAlert('Preferencia no disponible', 'Estas preferencias no se pueden guardar temporalmente. Inténtalo de nuevo más tarde.')
      } else {
        showAlert('No se pudo guardar', getErrorMessage(error) || 'No se pudieron guardar las preferencias docentes.')
      }
      return false
    } finally {
      setSavingTeacherNotificationKey(null)
    }
  }

  const togglePreferenceMenu = (key: PreferenceKey) => {
    setOpenNotificationFrequency(false)
    setOpenPreferenceKey((current) => (current === key ? null : key))
  }

  const selectPreference = async (key: PreferenceKey, value: string) => {
    if (!userId) {
      showAlert('Sesión no disponible', 'No se pudo identificar el usuario para guardar preferencias.')
      return
    }

    setOpenPreferenceKey(null)
    const previousPreferences = preferences
    if (previousPreferences[key] === value) return
    const nextPreferences = { ...previousPreferences, [key]: value }

    setPreferences(nextPreferences)
    setSavingPreference(key)

    try {
      await savePreferences(userId, nextPreferences)
      if (key === 'language' && (value === 'es-ES' || value === 'en-US')) {
        await setLocale(value as AppLocale)
      }
    } catch (error: unknown) {
      setPreferences(previousPreferences)
      if (key === 'language') await setLocale(locale)
      if (isMissingPreferencesTableError(getErrorCode(error))) {
        showAlert(
          'Configuración pendiente',
          'Estas preferencias no están disponibles temporalmente. Inténtalo de nuevo más tarde.'
        )
      } else {
        showAlert('No se pudo guardar', getErrorMessage(error) || 'No se pudieron guardar tus preferencias.')
      }
    } finally {
      setSavingPreference(null)
    }
  }

  const updateHapticsEnabled = async (enabled: boolean) => {
    if (!userId || savingHaptics) return

    const previousPreferences = preferences
    const nextPreferences = { ...previousPreferences, hapticsEnabled: enabled }
    setPreferences(nextPreferences)
    setSavingHaptics(true)
    await setHapticsEnabled(enabled)

    try {
      await savePreferences(userId, nextPreferences)
      if (enabled) void hapticSelection()
    } catch (error: unknown) {
      setPreferences(previousPreferences)
      await setHapticsEnabled(previousPreferences.hapticsEnabled)
      if (isMissingPreferencesTableError(getErrorCode(error))) {
        showAlert(
          'Configuración pendiente',
          'La respuesta táctil no se puede actualizar temporalmente. Inténtalo de nuevo más tarde.'
        )
      } else {
        showAlert('No se pudo guardar', getErrorMessage(error) || 'No se pudo actualizar la respuesta táctil.')
      }
    } finally {
      setSavingHaptics(false)
    }
  }

  const updateAnalyticsEnabled = async (enabled: boolean) => {
    if (!userId || savingAnalytics) return

    const previousPreferences = preferences
    setPreferences({ ...previousPreferences, analyticsEnabled: enabled })
    setSavingAnalytics(true)

    try {
      const saved = await updateAnalyticsConsent(enabled)
      setPreferences((current) => ({ ...current, analyticsEnabled: saved }))
    } catch (error: unknown) {
      setPreferences(previousPreferences)
      showAlert('No se pudo guardar', getErrorMessage(error) || 'No se pudo actualizar el consentimiento de analítica.')
    } finally {
      setSavingAnalytics(false)
    }
  }

  return {
    alias,
    changingPassword,
    closeDestructiveConfirmation,
    confirmDestructiveAction,
    confirmPassword,
    currentPassword,
    deletingAccount,
    deletingData,
    destructiveConfirmationText,
    email,
    emailConfirmedAt,
    executeSignOut,
    exportingData,
    formatNotificationFrequencyLabel,
    formatPreferenceLabel,
    handleChangePassword,
    handleDeleteAccount,
    handleDeletePartialData,
    handleExportData,
    handleProfileVisibilityChange,
    handleSaveProfile,
    handleSignOut,
    isTeacher,
    lastSignInAt,
    level,
    loading,
    name,
    newPassword,
    nextLevelProgress,
    notificationFrequencyOptions,
    notificationSettings,
    teacherNotificationSettings,
    pushRegistrationStatus,
    openNotificationFrequency,
    openPreferenceKey,
    passwordChecks,
    pendingDestructiveAction,
    points,
    preferenceOptions,
    preferences,
    profile,
    profileVisibility,
    profileVisibilityAvailable,
    role,
    saving,
    savingNotificationKey,
    savingTeacherNotificationKey,
    savingPreference,
    savingProfileVisibility,
    savingHaptics,
    savingAnalytics,
    selectNotificationFrequency,
    selectPreference,
    setConfirmPassword,
    setCurrentPassword,
    setDestructiveConfirmationText,
    setName,
    setNewPassword,
    setShowConfirmPassword,
    setShowCurrentPassword,
    setShowNewPassword,
    setShowSignOutConfirm,
    showAlert,
    showConfirmPassword,
    showCurrentPassword,
    showNewPassword,
    showPrivacyCenter,
    showSignOutConfirm,
    subjectsCount,
    toggleNotificationFrequencyMenu,
    togglePreferenceMenu,
    updateNotificationToggle,
    updateTeacherNotificationPreference,
    updateHapticsEnabled,
    updateAnalyticsEnabled,
    userInitials,
  }
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'AL'
}
