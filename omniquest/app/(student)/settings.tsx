import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AppConfirmModal from '../../components/AppConfirmModal'
import { supabase } from '../../lib/supabase'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import StudentSidebar from '../../components/student/StudentSidebar'
import BrandLogo from '../../components/BrandLogo'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import NotificationBadge from '../../components/NotificationBadge'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import {
  DestructiveConfirmModal,
  REQUIRED_DESTRUCTIVE_CONFIRMATION,
  SecurityDangerCard,
  type DestructiveActionType,
} from '../../components/settings/SettingsDangerZone'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'

type IconName = keyof typeof Ionicons.glyphMap
type AppRole = 'student' | 'teacher'
type PreferenceKey = 'language' | 'timezone' | 'dateFormat' | 'timeFormat' | 'weekStart'
type NotificationSettingKey = 'push' | 'email' | 'daily' | 'activities' | 'news'
type NotificationFrequency = 'instant' | 'daily' | 'weekly'
type SettingsMenuSectionKey = | 'general' | 'profile' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'security' | 'about'
type SettingsAnchorKey = | 'general' | 'profile' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'security' | 'about'
type ProfileVisibility = 'public' | 'private'
type SettingsMenuVariant = 'side' | 'tabs' | 'chips'

type UserProfile = {
  id: string
  alias: string | null
  avatar: string | null
  points: number | null
  role_id?: string | null
  visibility?: ProfileVisibility | null
}

type UserPreferencesState = {
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  weekStart: string
}

type UserPreferencesRow = {
  language: string | null
  timezone: string | null
  date_format: string | null
  time_format: string | null
  week_start: string | null
}

type NotificationSettingsState = {
  push: boolean
  email: boolean
  daily: boolean
  activities: boolean
  news: boolean
  frequency: NotificationFrequency
}

type NotificationSettingsRow = {
  push_enabled: boolean | null
  email_enabled: boolean | null
  daily_summary_enabled: boolean | null
  activity_enabled: boolean | null
  news_enabled: boolean | null
  frequency: string | null
}

const DEFAULT_PREFERENCES: UserPreferencesState = {
  language: 'es-ES',
  timezone: 'Europe/Madrid',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  weekStart: 'monday',
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsState = {
  push: false,
  email: false,
  daily: false,
  activities: true,
  news: false,
  frequency: 'daily',
}

function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204'
}

function isMissingPreferencesTableError(errorCode?: string) {
  return isMissingSchemaError(errorCode)
}

function isMissingNotificationPreferencesTableError(errorCode?: string) {
  return isMissingSchemaError(errorCode)
}

const notificationFrequencyOptions: NotificationFrequency[] = ['instant', 'daily', 'weekly']

const notificationFrequencyLabels: Record<NotificationFrequency, string> = {
  instant: 'Inmediata',
  daily: 'Diaria',
  weekly: 'Semanal',
}

const preferenceOptions: Record<PreferenceKey, string[]> = {
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

const studentSettingsSections: { key: SettingsMenuSectionKey; label: string; icon: IconName; anchor: SettingsAnchorKey }[] = [
  { key: 'general', label: 'General', icon: 'settings-outline', anchor: 'general' },
  { key: 'profile', label: 'Perfil', icon: 'person-outline', anchor: 'profile' },
  { key: 'preferences', label: 'Idioma y región', icon: 'globe-outline', anchor: 'preferences' },
  { key: 'notifications', label: 'Notificaciones', icon: 'notifications-outline', anchor: 'notifications' },
  { key: 'privacy', label: 'Privacidad', icon: 'shield-checkmark-outline', anchor: 'privacy' },
  { key: 'data', label: 'Datos', icon: 'server-outline', anchor: 'data' },
  { key: 'security', label: 'Seguridad', icon: 'lock-closed-outline', anchor: 'security' },
  { key: 'about', label: 'Acerca de', icon: 'information-circle-outline', anchor: 'about' },
]

const teacherSettingsSections: { key: SettingsMenuSectionKey; label: string; icon: IconName; anchor: SettingsAnchorKey }[] = [
  ...studentSettingsSections,
]

const accentColors = ['#7C5CFF', '#3B82F6', '#38BDF8', '#58D17A', '#F6A64A', '#EF5350', '#D94A9A'] as const

export function UnifiedSettingsScreen({ forcedRole, securityOnly = false }: { forcedRole?: AppRole; securityOnly?: boolean }) {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const { section } = useLocalSearchParams<{ section?: string }>()
  const { theme, accentColor, setAccentColor } = useAppTheme()
  const scrollRef = useRef<ScrollView | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [role, setRole] = useState<AppRole>(forcedRole || 'student')
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [classroomsCount, setClassroomsCount] = useState(0)
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
  const [openPreferenceKey, setOpenPreferenceKey] = useState<PreferenceKey | null>(null)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsState>(DEFAULT_NOTIFICATION_SETTINGS)
  const [savingNotificationKey, setSavingNotificationKey] = useState<NotificationSettingKey | 'frequency' | null>(null)
  const [openNotificationFrequency, setOpenNotificationFrequency] = useState(false)
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsMenuSectionKey>('general')
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility | null>(null)
  const [profileVisibilityAvailable, setProfileVisibilityAvailable] = useState(false)
  const [exportingData, setExportingData] = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [pendingDestructiveAction, setPendingDestructiveAction] = useState<DestructiveActionType | null>(null)
  const [destructiveConfirmationText, setDestructiveConfirmationText] = useState('')
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const isDesktop = width >= 1080
  const isTeacher = role === 'teacher'
  const isDark = theme === 'dark'
  const settingsSections = isTeacher ? teacherSettingsSections : studentSettingsSections
  const points = profile?.points ?? 0
  const alias = profile?.alias || (isTeacher ? 'Profesor' : 'Alumno')
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const userInitials = getInitials(name)
  const isLargeDesktop = width >= 1280
  const isMediumSettings = width >= 760
  const settingsMenuVariant: SettingsMenuVariant = isLargeDesktop ? 'side' : isMediumSettings ? 'tabs' : 'chips'
  const settingsHorizontalPadding = isDesktop ? 28 : 16
  const passwordChecks = useMemo(() => {
    const hasCurrentPassword = currentPassword.length > 0
    const hasMinimumLength = newPassword.length >= 6
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

  useEffect(() => {
    if (!settingsSections.some((section) => section.key === activeSettingsSection)) {
      setActiveSettingsSection('general')
    }
  }, [activeSettingsSection, settingsSections])

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  const fetchProfileWithOptionalVisibility = async (targetUserId: string) => {
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

  const deleteOptionalRows = async (table: string, column: string, value: string) => {
    const { error } = await (supabase.from(table as any) as any).delete().eq(column, value)
    if (error && !isMissingSchemaError(error.code)) {
      throw error
    }
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

  const selectOptionalRows = async (table: string, column: string, value: string) => {
    const { data, error } = await (supabase.from(table as any) as any).select('*').eq(column, value)
    if (error && !isMissingSchemaError(error.code)) {
      throw error
    }
    return error ? [] : data || []
  }

  const selectOptionalRowsIn = async (table: string, column: string, values: number[] | string[]) => {
    if (values.length === 0) return []
    const { data, error } = await (supabase.from(table as any) as any).select('*').in(column, values)
    if (error && !isMissingSchemaError(error.code)) {
      throw error
    }
    return error ? [] : data || []
  }

  const getTeacherSubjectIds = async (teacherId: string) => {
    const { data, error } = await supabase
      .from('subjects')
      .select('id')
      .eq('teacher_id', teacherId)

    if (error) throw error
    return (data || [])
      .map((subject: { id: number | null }) => subject.id)
      .filter((id): id is number => typeof id === 'number')
  }

  const getQuestionIdsForSubjects = async (subjectIds: number[]) => {
    if (subjectIds.length === 0) return []

    const { data, error } = await supabase
      .from('questions')
      .select('id')
      .in('subject_id', subjectIds)

    if (error) throw error
    return (data || [])
      .map((question: { id: number | null }) => question.id)
      .filter((id): id is number => typeof id === 'number')
  }

  const deleteTeacherClassProgress = async (teacherId: string) => {
    const subjectIds = await getTeacherSubjectIds(teacherId)
    const questionIds = await getQuestionIdsForSubjects(subjectIds)

    if (questionIds.length > 0) {
      const { error: attemptsError } = await supabase
        .from('attempt_history')
        .delete()
        .in('question_id', questionIds)
      if (attemptsError && !isMissingSchemaError(attemptsError.code)) throw attemptsError
    }

    if (subjectIds.length > 0) {
      const { error: topicScoresError } = await supabase
        .from('topic_scores')
        .delete()
        .in('subject_id', subjectIds)
      if (topicScoresError && !isMissingSchemaError(topicScoresError.code)) throw topicScoresError

      const { error: subjectScoresError } = await supabase
        .from('subject_scores')
        .delete()
        .in('subject_id', subjectIds)
      if (subjectScoresError && !isMissingSchemaError(subjectScoresError.code)) throw subjectScoresError
    }
  }

  const deleteTeacherTeachingData = async (teacherId: string) => {
    const subjectIds = await getTeacherSubjectIds(teacherId)
    const questionIds = await getQuestionIdsForSubjects(subjectIds)

    if (questionIds.length > 0) {
      const { error: attemptsError } = await supabase
        .from('attempt_history')
        .delete()
        .in('question_id', questionIds)
      if (attemptsError && !isMissingSchemaError(attemptsError.code)) throw attemptsError

      const { error: answersError } = await supabase
        .from('answers')
        .delete()
        .in('question_id', questionIds)
      if (answersError && !isMissingSchemaError(answersError.code)) throw answersError
    }

    if (subjectIds.length > 0) {
      const { error: topicScoresError } = await supabase
        .from('topic_scores')
        .delete()
        .in('subject_id', subjectIds)
      if (topicScoresError && !isMissingSchemaError(topicScoresError.code)) throw topicScoresError

      const { error: subjectScoresError } = await supabase
        .from('subject_scores')
        .delete()
        .in('subject_id', subjectIds)
      if (subjectScoresError && !isMissingSchemaError(subjectScoresError.code)) throw subjectScoresError

      const { error: enrollmentsError } = await supabase
        .from('enrollments')
        .delete()
        .in('subject_id', subjectIds)
      if (enrollmentsError && !isMissingSchemaError(enrollmentsError.code)) throw enrollmentsError

      const { error: classroomsError } = await supabase
        .from('classrooms')
        .delete()
        .in('subject_id', subjectIds)
      if (classroomsError && !isMissingSchemaError(classroomsError.code)) throw classroomsError

      const { error: questionsError } = await supabase
        .from('questions')
        .delete()
        .in('subject_id', subjectIds)
      if (questionsError && !isMissingSchemaError(questionsError.code)) throw questionsError

      const { error: topicsError } = await supabase
        .from('subject_topics')
        .delete()
        .in('subject_id', subjectIds)
      if (topicsError && !isMissingSchemaError(topicsError.code)) throw topicsError
    }

    const { error: subjectsError } = await supabase
      .from('subjects')
      .delete()
      .eq('teacher_id', teacherId)
    if (subjectsError) throw subjectsError
  }

  const handleProfileVisibilityChange = async (visibility: ProfileVisibility) => {
    if (!userId) return
    if (!profileVisibilityAvailable) {
      showAlert(
        'Visibilidad no disponible',
        'La columna profiles.visibility no aparece en el esquema actual. Añade la columna y regenera los tipos antes de activar esta preferencia.'
      )
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ visibility })
        .eq('id', userId)

      if (error) throw error

      setProfileVisibility(visibility)
      showAlert('Visibilidad actualizada', `Tu perfil ahora es ${visibility === 'public' ? 'público' : 'privado'}.`)
    } catch (error: any) {
      if (isMissingSchemaError(error?.code)) {
        setProfileVisibilityAvailable(false)
        setProfileVisibility(null)
        showAlert(
          'Visibilidad no disponible',
          'La columna profiles.visibility no está disponible todavía. Añádela en Supabase y regenera types/database.types.ts.'
        )
      } else {
        showAlert('Error', error.message || 'No se pudo actualizar la visibilidad del perfil.')
      }
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

      let exportData: Record<string, any>

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
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudieron exportar los datos.')
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

      if (dataType === 'scores') {
        await deleteTeacherClassProgress(userId)
      }

      if (dataType === 'all') {
        await deleteTeacherTeachingData(userId)
        await deleteOptionalRows('notification_state', 'user_id', userId)
        await deleteOptionalRows('user_preferences', 'user_id', userId)
        await deleteOptionalRows('user_notification_preferences', 'user_id', userId)

        const avatarPaths = getAvatarStoragePaths(userId, profile?.avatar)
        if (avatarPaths.length > 0) {
          const { error: storageError } = await supabase.storage.from('avatars').remove(avatarPaths)
          if (storageError && !isMissingSchemaError((storageError as any).code)) throw storageError
        }

        const { data, error: avatarError } = await supabase.functions.invoke('profile-update-avatar', {
          body: { clear: true },
        })
        if (avatarError) throw avatarError
        if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error)

        setPreferences(DEFAULT_PREFERENCES)
        setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS)
        setProfile(prev => prev ? { ...prev, avatar: null } : null)
        setSubjectsCount(0)
        setClassroomsCount(0)
      }

      showAlert('Datos eliminados', 'Los datos seleccionados han sido eliminados correctamente.')
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudieron eliminar los datos.')
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
    const labelsByKey = preferenceLabels[key] as Record<string, string>
    return labelsByKey[value] || value
  }

  const toPreferenceState = (row: UserPreferencesRow | null): UserPreferencesState => ({
    language: row?.language || DEFAULT_PREFERENCES.language,
    timezone: row?.timezone || DEFAULT_PREFERENCES.timezone,
    dateFormat: row?.date_format || DEFAULT_PREFERENCES.dateFormat,
    timeFormat: row?.time_format || DEFAULT_PREFERENCES.timeFormat,
    weekStart: row?.week_start || DEFAULT_PREFERENCES.weekStart,
  })

  const toNotificationSettingsState = (row: NotificationSettingsRow | null): NotificationSettingsState => {
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

  const formatNotificationFrequencyLabel = (value: NotificationFrequency) => {
    return notificationFrequencyLabels[value] || value
  }

  const handleMenuSectionPress = (section: { key: SettingsMenuSectionKey; anchor: SettingsAnchorKey }) => {
    setActiveSettingsSection(section.key)
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }

  useEffect(() => {
    if (!section) return

    const exists = settingsSections.some((item) => item.key === section)
    if (exists) {
      setActiveSettingsSection(section as SettingsMenuSectionKey)
    }
  }, [section, settingsSections])

  const savePreferences = async (targetUserId: string, next: UserPreferencesState) => {
    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: targetUserId,
        language: next.language,
        timezone: next.timezone,
        date_format: next.dateFormat,
        time_format: next.timeFormat,
        week_start: next.weekStart,
      },
      { onConflict: 'user_id' }
    )

    if (error) throw error
  }

  const saveNotificationSettings = async (targetUserId: string, next: NotificationSettingsState) => {
    const { error } = await supabase.from('user_notification_preferences').upsert(
      {
        user_id: targetUserId,
        push_enabled: next.push,
        email_enabled: next.email,
        daily_summary_enabled: next.daily,
        activity_enabled: next.activities,
        news_enabled: next.news,
        frequency: next.frequency,
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
        router.replace('/(auth)/login' as any)
        return
      }

      setUserId(session.user.id)
      setEmail(session.user.email || 'alumno@omniquest.com')
      setLastSignInAt(session.user.last_sign_in_at || null)
      setEmailConfirmedAt(session.user.email_confirmed_at || session.user.confirmed_at || null)

      const [profileFetch, preferencesResult, notificationSettingsResult, subjectsResult] = await Promise.all([
        fetchProfileWithOptionalVisibility(session.user.id),
        supabase
          .from('user_preferences')
          .select('language, timezone, date_format, time_format, week_start')
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase
          .from('user_notification_preferences')
          .select('push_enabled, email_enabled, daily_summary_enabled, activity_enabled, news_enabled, frequency')
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase.from('subjects').select('id').eq('teacher_id', session.user.id).eq('is_archived', false),
      ])

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

      if (detectedRole === 'teacher' && teacherSubjectIds.length > 0) {
        const { count: classroomsCountResult, error: classroomsCountError } = await supabase
          .from('classrooms')
          .select('id', { count: 'exact', head: true })
          .in('subject_id', teacherSubjectIds)
          .neq('active', false)

        if (classroomsCountError && !isMissingSchemaError(classroomsCountError.code)) {
          throw classroomsCountError
        }

        setClassroomsCount(classroomsCountResult || 0)
      } else {
        setClassroomsCount(0)
      }

      setPreferences(toPreferenceState((preferencesResult.data as UserPreferencesRow | null) || null))
      setNotificationSettings(
        toNotificationSettingsState((notificationSettingsResult.data as NotificationSettingsRow | null) || null)
      )
    } catch (error: any) {
      console.error('Error cargando configuración:', error.message)
      showAlert('No se pudo cargar la configuración', 'Inténtalo de nuevo en unos segundos.')
    } finally {
      setLoading(false)
    }
  }, [forcedRole, router])

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
    } catch (error: any) {
      console.error('Error actualizando perfil:', error.message)
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
    } catch (error: any) {
      showAlert('No se pudo actualizar', error.message || 'Inténtalo de nuevo.')
    } finally {
      setChangingPassword(false)
    }
  }

  const executeDeleteAccount = async () => {
    try {
      setDeletingAccount(true)
      const { error } = await supabase.functions.invoke('delete-account', {
        body: {},
      })

      if (error) {
        throw new Error(error.message || 'No se pudo completar el borrado en el servidor.')
      }

      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.warn('No se pudo cerrar sesión tras borrar cuenta:', signOutError.message)
      }
      showAlert('Cuenta borrada', 'Tu cuenta se ha eliminado correctamente.')
      router.replace('/(auth)/login' as any)
    } catch (error: any) {
      showAlert(
        'No se pudo borrar la cuenta',
        error.message || 'No se pudo eliminar tu cuenta completa. Revisa la función delete-account de Supabase.'
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
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
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
      await saveNotificationSettings(userId, next)
    } catch (error: any) {
      setNotificationSettings(previous)
      if (isMissingNotificationPreferencesTableError(error?.code)) {
        showAlert(
          'Configuración pendiente',
          'Falta la tabla user_notification_preferences en Supabase. Aplica la migración para guardar notificaciones.'
        )
      } else {
        showAlert('No se pudo guardar', error.message || 'No se pudieron guardar tus notificaciones.')
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
    } catch (error: any) {
      setNotificationSettings(previous)
      if (isMissingNotificationPreferencesTableError(error?.code)) {
        showAlert(
          'Configuración pendiente',
          'Falta la tabla user_notification_preferences en Supabase. Aplica la migración para guardar notificaciones.'
        )
      } else {
        showAlert('No se pudo guardar', error.message || 'No se pudieron guardar tus notificaciones.')
      }
    } finally {
      setSavingNotificationKey(null)
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
    } catch (error: any) {
      setPreferences(previousPreferences)
      if (isMissingPreferencesTableError(error?.code)) {
        showAlert(
          'Configuración pendiente',
          'Falta la tabla user_preferences en Supabase. Aplica la migración para guardar estas preferencias.'
        )
      } else {
        showAlert('No se pudo guardar', error.message || 'No se pudieron guardar tus preferencias.')
      }
    } finally {
      setSavingPreference(null)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: isDark ? '#061126' : '#0F2442' }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando configuración...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#061126' : '#0F2442' }}>
      <View className="flex-1 flex-row">
        {isDesktop ? (
          isTeacher ? (
            <TeacherSidebar
              activeSection="settings"
              subjectsCount={subjectsCount}
              onSignOut={handleSignOut}
              alias={alias}
              avatar={profile?.avatar}
            />
          ) : (
            <StudentSidebar
              activeSection="settings"
              alias={alias}
              avatar={profile?.avatar}
              level={level}
              points={points}
              nextLevelProgress={nextLevelProgress}
              onSignOut={handleSignOut}
            />
          )
        ) : null}

        <View className="flex-1">
          <View
            style={{
              paddingHorizontal: settingsHorizontalPadding,
              paddingTop: isDesktop ? 24 : 18,
            }}
          >
            <View className="mb-4 flex-row flex-wrap items-start justify-between gap-4">
              <View className="min-w-[260px] flex-1">
                {!isDesktop ? <BrandLogo size={30} style={{ marginBottom: 12 }} /> : null}

                <View className="flex-row items-center gap-3">
                  <Ionicons name={securityOnly ? 'lock-closed' : 'settings'} size={40} color="#9FD6FF" />
                  <Text className={`${isDesktop ? 'text-[40px]' : 'text-[32px]'} flex-shrink font-black text-white`} numberOfLines={1}>
                    {securityOnly ? 'Seguridad' : 'Configuración'}
                  </Text>
                </View>

                <Text className="mt-2 text-[13px] text-[#B7C4D7]">
                  {securityOnly
                    ? 'Gestiona acceso, contraseña y acciones críticas de tu cuenta.'
                    : `Personaliza tu experiencia y controla tu cuenta de ${isTeacher ? 'profesor' : 'alumno'}.`}
                </Text>
              </View>

              <View className="flex-row items-center gap-3">
                <NotificationBadge
                  audience={isTeacher ? 'teacher' : 'student'}
                  onPress={() => router.push((isTeacher ? '/(teacher)/notifications' : '/(student)/notifications') as any)}
                />
                {!isTeacher ? <StudentHeaderAvatar /> : null}
              </View>
            </View>

            {!securityOnly && settingsMenuVariant !== 'side' ? (
              <SettingsMenu
                variant={settingsMenuVariant}
                onSignOut={handleSignOut}
                activeSection={activeSettingsSection}
                onSectionPress={handleMenuSectionPress}
                sections={settingsSections}
              />
            ) : null}
          </View>

          <View
            className={settingsMenuVariant === 'side' ? 'flex-1 flex-row gap-5' : 'flex-1'}
            style={{
              paddingHorizontal: settingsHorizontalPadding,
              paddingTop: 16,
            }}
          >
            {!securityOnly && settingsMenuVariant === 'side' ? (
              <SettingsMenu
                variant="side"
                onSignOut={handleSignOut}
                activeSection={activeSettingsSection}
                onSectionPress={handleMenuSectionPress}
                sections={settingsSections}
              />
            ) : null}

            <ScrollView
              ref={scrollRef}
              className="flex-1"
              contentContainerStyle={{ paddingBottom: isDesktop || isTeacher ? 96 : 124 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-5">
                {!securityOnly && activeSettingsSection === 'general' ? (
                  <Panel title="Configuración general">
                    <View className="gap-4">
                      <ActionRow
                        icon="person-outline"
                        title="Editar perfil"
                        description="Actualiza tu alias, idioma preferido y datos básicos."
                        onPress={() => setActiveSettingsSection('profile')}
                      />
                      <ActionRow
                        icon="globe-outline"
                        title="Idioma y región"
                        description="Ajusta idioma, zona horaria, fecha, hora e inicio de semana."
                        onPress={() => setActiveSettingsSection('preferences')}
                      />
                      <ActionRow
                        icon="notifications-outline"
                        title="Preferencias de notificación"
                        description="Configura avisos, resumen diario y novedades."
                        onPress={() => setActiveSettingsSection('notifications')}
                      />
                      <ActionRow
                        icon="shield-checkmark-outline"
                        title="Privacidad"
                        description="Controla la visibilidad de tu perfil y revisa el centro de privacidad."
                        onPress={() => setActiveSettingsSection('privacy')}
                      />
                      <ActionRow
                        icon="server-outline"
                        title="Datos"
                        description="Exporta o elimina datos asociados a tu cuenta."
                        onPress={() => setActiveSettingsSection('data')}
                      />
                      <ActionRow
                        icon="lock-closed-outline"
                        title="Seguridad"
                        description="Cambia tu contraseña o revisa el estado de tu cuenta."
                        onPress={() => setActiveSettingsSection('security')}
                      />
                      {!isDesktop ? (
                        <ActionRow
                          icon="log-out-outline"
                          title="Cerrar sesión"
                          description="Salir de tu cuenta en este dispositivo."
                          onPress={handleSignOut}
                        />
                      ) : null}
                    </View>
                  </Panel>
                ) : null}

                {!securityOnly && activeSettingsSection === 'profile' ? (
                  <Panel title={`Información del ${isTeacher ? 'profesor' : 'alumno'}`}>
                    <View className={width >= 520 ? 'flex-row gap-5' : 'gap-4'}>
                      <View className="items-center">
                        <View className="h-24 w-24 items-center justify-center rounded-full bg-[#4E3CB7]">
                          <Text className="text-[28px] font-black text-white">{userInitials}</Text>
                        </View>
                        <Pressable
                          onPress={handleSaveProfile}
                          disabled={saving}
                          className="mt-5 rounded-lg px-5 py-3"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Text className="text-[12px] font-bold text-white">{saving ? 'Guardando...' : 'Guardar perfil'}</Text>
                        </Pressable>
                      </View>

                      <View className="min-w-0 flex-1 gap-3">
                        <Field label="Alias">
                          <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder={isTeacher ? 'Profesor' : 'Alumno'}
                            placeholderTextColor="#64748B"
                            className="rounded-lg border border-[#183052] bg-[#071A32] px-4 py-3 text-[13px] text-white"
                          />
                        </Field>
                        <Field label="Correo electrónico">
                          <TextInput
                            value={email}
                            editable={false}
                            placeholderTextColor="#64748B"
                            className="rounded-lg border border-[#183052] bg-[#071A32] px-4 py-3 text-[13px] text-[#B7C4D7]"
                          />
                        </Field>
                        <Field label="Idioma preferido">
                          <SelectPill
                            value={formatPreferenceLabel('language', preferences.language)}
                            selectedValue={preferences.language}
                            open={openPreferenceKey === 'language'}
                            onToggle={() => togglePreferenceMenu('language')}
                            options={preferenceOptions.language}
                            onSelect={(value) => void selectPreference('language', value)}
                            optionLabel={(value) => formatPreferenceLabel('language', value)}
                            disabled={Boolean(savingPreference)}
                            loading={savingPreference === 'language'}
                          />
                        </Field>
                      </View>
                    </View>
                    <View className="mt-4 border-t border-[#13284A] pt-4">
                      <ActionRow
                        icon="lock-closed-outline"
                        title="Gestionar seguridad"
                        description="Cambiar contraseña y revisar acciones críticas de la cuenta."
                        onPress={() => router.push((isTeacher ? '/(teacher)/security' : '/(student)/security') as any)}
                      />
                    </View>
                  </Panel>
                ) : null}

                {!securityOnly && activeSettingsSection === 'preferences' ? (
                  <Panel title="Idioma y región">
                    <View className="mb-4 rounded-lg border border-[#183052] bg-[#071A32] p-3">
                      <Text className="text-[12px] font-bold text-white">Color de acento</Text>
                      <Text className="mt-1 text-[12px] text-[#AFC2DB]">
                        El modo visual está optimizado en oscuro para mantener consistencia en toda la app.
                      </Text>
                      <View className="mt-2 flex-row flex-wrap gap-3">
                        {accentColors.map((color) => (
                          <Pressable
                            key={color}
                            onPress={() => setAccentColor(color)}
                            className="h-8 w-8 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: color,
                              borderWidth: accentColor === color ? 2 : 0,
                              borderColor: '#DDE7F4',
                            }}
                          >
                            {accentColor === color ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <PreferenceRow
                      label="Zona horaria"
                      value={formatPreferenceLabel('timezone', preferences.timezone)}
                      selectedValue={preferences.timezone}
                      open={openPreferenceKey === 'timezone'}
                      onToggle={() => togglePreferenceMenu('timezone')}
                      options={preferenceOptions.timezone}
                      onSelect={(value) => void selectPreference('timezone', value)}
                      optionLabel={(value) => formatPreferenceLabel('timezone', value)}
                      disabled={Boolean(savingPreference)}
                      loading={savingPreference === 'timezone'}
                    />
                    <PreferenceRow
                      label="Formato de fecha"
                      value={formatPreferenceLabel('dateFormat', preferences.dateFormat)}
                      selectedValue={preferences.dateFormat}
                      open={openPreferenceKey === 'dateFormat'}
                      onToggle={() => togglePreferenceMenu('dateFormat')}
                      options={preferenceOptions.dateFormat}
                      onSelect={(value) => void selectPreference('dateFormat', value)}
                      optionLabel={(value) => formatPreferenceLabel('dateFormat', value)}
                      disabled={Boolean(savingPreference)}
                      loading={savingPreference === 'dateFormat'}
                    />
                    <PreferenceRow
                      label="Formato de hora"
                      value={formatPreferenceLabel('timeFormat', preferences.timeFormat)}
                      selectedValue={preferences.timeFormat}
                      open={openPreferenceKey === 'timeFormat'}
                      onToggle={() => togglePreferenceMenu('timeFormat')}
                      options={preferenceOptions.timeFormat}
                      onSelect={(value) => void selectPreference('timeFormat', value)}
                      optionLabel={(value) => formatPreferenceLabel('timeFormat', value)}
                      disabled={Boolean(savingPreference)}
                      loading={savingPreference === 'timeFormat'}
                    />
                    <PreferenceRow
                      label="Inicio de semana"
                      value={formatPreferenceLabel('weekStart', preferences.weekStart)}
                      selectedValue={preferences.weekStart}
                      open={openPreferenceKey === 'weekStart'}
                      onToggle={() => togglePreferenceMenu('weekStart')}
                      options={preferenceOptions.weekStart}
                      onSelect={(value) => void selectPreference('weekStart', value)}
                      optionLabel={(value) => formatPreferenceLabel('weekStart', value)}
                      disabled={Boolean(savingPreference)}
                      loading={savingPreference === 'weekStart'}
                    />
                  </Panel>
                ) : null}

                {!securityOnly && activeSettingsSection === 'notifications' ? (
                  <Panel title="Notificaciones">
                    <View className="mb-4 rounded-lg border border-[#183052] bg-[#071A32] p-3">
                      <Text className="text-[12px] font-bold text-white">Preferencias guardadas</Text>
                      <Text className="mt-1 text-[13px] text-[#AFC2DB]">
                        Estos ajustes preparan tus canales preferidos. El envío automático por push/email todavía no está conectado.
                      </Text>
                      <View className="mt-3">
                        <PreferenceRow
                          label="Frecuencia"
                          value={formatNotificationFrequencyLabel(notificationSettings.frequency)}
                          selectedValue={notificationSettings.frequency}
                          open={openNotificationFrequency}
                          onToggle={toggleNotificationFrequencyMenu}
                          options={notificationFrequencyOptions}
                          onSelect={(value) => void selectNotificationFrequency(value as NotificationFrequency)}
                          optionLabel={(value) => formatNotificationFrequencyLabel(value as NotificationFrequency)}
                          disabled={Boolean(savingNotificationKey)}
                          loading={savingNotificationKey === 'frequency'}
                        />
                      </View>
                    </View>
                    <NotificationRow
                      icon="notifications-outline"
                      title="Preferencia push"
                      description="Se guardará para activar avisos push cuando el servicio esté disponible."
                      enabled={notificationSettings.push}
                      onPress={() => void updateNotificationToggle('push')}
                      disabled={Boolean(savingNotificationKey)}
                      loading={savingNotificationKey === 'push'}
                    />
                    <NotificationRow
                      icon="mail-outline"
                      title="Preferencia por email"
                      description="Se guardará para futuros resúmenes y avisos por correo."
                      enabled={notificationSettings.email}
                      onPress={() => void updateNotificationToggle('email')}
                      disabled={Boolean(savingNotificationKey)}
                      loading={savingNotificationKey === 'email'}
                    />
                    <NotificationRow
                      icon="calendar-outline"
                      title="Resumen diario"
                      description="Preferencia para futuros resúmenes de progreso."
                      enabled={notificationSettings.daily}
                      onPress={() => void updateNotificationToggle('daily')}
                      disabled={Boolean(savingNotificationKey)}
                      loading={savingNotificationKey === 'daily'}
                    />
                    <NotificationRow
                      icon="clipboard-outline"
                      title="Actividades y preguntas"
                      description="Controla avisos de cursos, logros, inscripciones y señales de aprendizaje."
                      enabled={notificationSettings.activities}
                      onPress={() => void updateNotificationToggle('activities')}
                      disabled={Boolean(savingNotificationKey)}
                      loading={savingNotificationKey === 'activities'}
                    />
                    <NotificationRow
                      icon="megaphone-outline"
                      title="Actualizaciones y novedades"
                      description="Controla avisos informativos y novedades generales de OmniQuest."
                      enabled={notificationSettings.news}
                      onPress={() => void updateNotificationToggle('news')}
                      disabled={Boolean(savingNotificationKey)}
                      loading={savingNotificationKey === 'news'}
                    />
                    <FooterLink
                      label="Preferencias aplicadas en servidor"
                      onPress={() => showAlert('Notificaciones', 'OmniQuest respeta Actividades y Novedades al crear nuevas notificaciones. Push, email y resúmenes quedan guardados para canales futuros.')}
                    />
                  </Panel>
                ) : null}

                {!securityOnly && activeSettingsSection === 'privacy' ? (
                  <Panel title="Privacidad">
                    <View className="mb-4 rounded-lg border border-[#183052] bg-[#071A32] p-4">
                      <View className="flex-row flex-wrap items-center justify-between gap-3">
                        <View className="min-w-0 flex-1">
                          <Text className="font-bold text-white">Visibilidad del perfil</Text>
                          <Text className="mt-1 text-[12px] text-[#AFC2DB]">
                            {isTeacher
                              ? 'Decide cómo se muestra tu perfil docente dentro de OmniQuest.'
                              : 'Decide si otros estudiantes pueden ver tu perfil en rankings y logros.'}
                          </Text>
                        </View>

                        <View className="flex-row gap-2">
                          <Pressable
                            onPress={() => handleProfileVisibilityChange('public')}
                            disabled={!profileVisibilityAvailable}
                            className="rounded-lg border px-3 py-2"
                            style={{
                              borderColor: profileVisibility === 'public' ? accentColor : '#2A456A',
                              backgroundColor: profileVisibility === 'public' ? withAlpha(accentColor, '24') : '#0A2042',
                            }}
                          >
                            <Text className="text-[12px] font-semibold text-white">Público</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => handleProfileVisibilityChange('private')}
                            disabled={!profileVisibilityAvailable}
                            className="rounded-lg border px-3 py-2"
                            style={{
                              borderColor: profileVisibility === 'private' ? accentColor : '#2A456A',
                              backgroundColor: profileVisibility === 'private' ? withAlpha(accentColor, '24') : '#0A2042',
                            }}
                          >
                            <Text className="text-[12px] font-semibold text-white">Privado</Text>
                          </Pressable>
                        </View>
                      </View>

                      {!profileVisibilityAvailable ? (
                        <Text className="mt-3 text-[12px] leading-5 text-[#FBBF24]">
                          Esta preferencia no se guardará hasta aplicar la migración y regenerar types/database.types.ts.
                        </Text>
                      ) : null}
                    </View>

                    <View className="rounded-xl border border-[#4733B7] bg-[#151A47] p-4">
                      <View className="flex-row gap-3">
                        <Ionicons name="shield-checkmark-outline" size={22} color={accentColor} />
                        <View className="min-w-0 flex-1">
                          <Text className="font-black text-white">Tu privacidad es importante</Text>
                          <Text className="mt-1 text-[12px] leading-5 text-[#B7C4D7]">
                            Protegemos tu información y tu historial académico.
                          </Text>
                          <Pressable onPress={showPrivacyCenter} className="mt-2 flex-row items-center gap-1">
                            <Text className="text-[12px] font-bold text-[#A78BFA]">Centro de privacidad</Text>
                            <Ionicons name="open-outline" size={13} color="#A78BFA" />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </Panel>
                ) : null}

                {!securityOnly && activeSettingsSection === 'data' ? (
                  <Panel title="Datos">
                    <ActionRow
                      icon="download-outline"
                      title="Exportar datos"
                      description={
                        isTeacher
                          ? 'Descarga perfil, cursos, clases, temas, preguntas, respuestas, inscripciones, puntuaciones, preferencias y notificaciones.'
                          : 'Descarga una copia de todos tus datos personales.'
                      }
                      onPress={handleExportData}
                      disabled={exportingData}
                      loading={exportingData}
                    />

                    <View className="mt-4 rounded-lg border border-[#183052] bg-[#071A32] p-4">
                      <Text className="font-bold text-white">Zona de datos</Text>
                      <Text className="mb-3 mt-1 text-[12px] text-[#AFC2DB]">
                        {isTeacher
                          ? 'Puedes limpiar progreso o reiniciar por completo tu espacio docente. Estas acciones no se pueden deshacer.'
                          : 'Elimina selectivamente progreso, cursos o preferencias guardadas. Estas acciones no se pueden deshacer.'}
                      </Text>

                      <View className="gap-2">
                        <Pressable
                          onPress={() => handleDeletePartialData('scores')}
                          disabled={deletingData}
                          className="flex-row items-center justify-between rounded-lg border border-[#BE123C] bg-[#7F1D1D33] p-3"
                          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
                        >
                          <View className="flex-row items-center gap-3">
                            <Ionicons name="trash-outline" size={16} color="#FB7185" />
                            <View className="min-w-0 flex-1">
                              <Text className="text-[13px] font-semibold text-white">
                                {isTeacher ? 'Eliminar progreso de alumnos' : 'Eliminar puntuaciones'}
                              </Text>
                              <Text className="mt-1 text-[12px] text-[#FECACA]">
                                {isTeacher
                                  ? 'Borra puntuaciones e intentos de alumnos en tus cursos.'
                                  : 'Borra tus puntuaciones y reinicia tu XP global.'}
                              </Text>
                            </View>
                          </View>

                          {deletingData ? (
                            <ActivityIndicator size="small" color="#FB7185" />
                          ) : (
                            <Ionicons name="chevron-forward" size={16} color="#FB7185" />
                          )}
                        </Pressable>

                        {!isTeacher ? (
                          <Pressable
                            onPress={() => handleDeletePartialData('enrollments')}
                            disabled={deletingData}
                            className="flex-row items-center justify-between rounded-lg border border-[#BE123C] bg-[#7F1D1D33] p-3"
                            style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
                          >
                            <View className="flex-row items-center gap-3">
                              <Ionicons name="exit-outline" size={16} color="#FB7185" />
                              <Text className="text-[13px] font-semibold text-white">Salir de todos los cursos</Text>
                            </View>

                            {deletingData ? (
                              <ActivityIndicator size="small" color="#FB7185" />
                            ) : (
                              <Ionicons name="chevron-forward" size={16} color="#FB7185" />
                            )}
                          </Pressable>
                        ) : null}

                        <Pressable
                          onPress={() => handleDeletePartialData('all')}
                          disabled={deletingData}
                          className="flex-row items-center justify-between rounded-lg border border-[#BE123C] bg-[#7F1D1D33] p-3"
                          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
                        >
                          <View className="flex-row items-center gap-3">
                            <Ionicons name="warning-outline" size={16} color="#FB7185" />
                            <View className="min-w-0 flex-1">
                              <Text className="text-[13px] font-semibold text-white">
                                {isTeacher ? 'Eliminar todos mis datos docentes' : 'Eliminar datos de uso'}
                              </Text>
                              <Text className="mt-1 text-[12px] text-[#FECACA]">
                                {isTeacher
                                  ? 'Borra cursos, clases, temas, preguntas, respuestas, inscripciones, puntuaciones, intentos, preferencias, notificaciones y avatar.'
                                  : 'Borra progreso, intentos, preferencias, notificaciones y avatar.'}
                              </Text>
                            </View>
                          </View>

                          {deletingData ? (
                            <ActivityIndicator size="small" color="#FB7185" />
                          ) : (
                            <Ionicons name="chevron-forward" size={16} color="#FB7185" />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </Panel>
                ) : null}

                {securityOnly || activeSettingsSection === 'security' ? (
                  <Panel title="Seguridad">
                    {!securityOnly ? (
                      <ActionRow
                        icon="lock-closed-outline"
                        title="Gestionar seguridad"
                        description="Cambiar contraseña y borrar cuenta en una pantalla dedicada."
                        onPress={() => router.push((isTeacher ? '/(teacher)/security' : '/(student)/security') as any)}
                      />
                    ) : (
                      <View className="gap-4">
                        <SecurityPasswordCard
                          accentColor={accentColor}
                          currentPassword={currentPassword}
                          newPassword={newPassword}
                          confirmPassword={confirmPassword}
                          showCurrentPassword={showCurrentPassword}
                          showNewPassword={showNewPassword}
                          showConfirmPassword={showConfirmPassword}
                          changingPassword={changingPassword}
                          checks={passwordChecks}
                          onCurrentPasswordChange={setCurrentPassword}
                          onNewPasswordChange={setNewPassword}
                          onConfirmPasswordChange={setConfirmPassword}
                          onToggleCurrentPassword={() => setShowCurrentPassword((value) => !value)}
                          onToggleNewPassword={() => setShowNewPassword((value) => !value)}
                          onToggleConfirmPassword={() => setShowConfirmPassword((value) => !value)}
                          onSubmit={handleChangePassword}
                        />

                        <SecurityAccountStatusCard
                          email={email}
                          emailConfirmedAt={emailConfirmedAt}
                          lastSignInAt={lastSignInAt}
                          onSignOut={handleSignOut}
                        />

                        <SecurityDangerCard
                          deletingAccount={deletingAccount}
                          onDeleteAccount={handleDeleteAccount}
                        />
                      </View>
                    )}
                  </Panel>
                ) : null}

                {!securityOnly && activeSettingsSection === 'about' ? (
                  <Panel title="Acerca de OmniQuest">
                    <View className="gap-4">
                      <Text className="text-[13px] leading-5 text-[#AFC2DB]">
                        OmniQuest es una plataforma educativa gamificada para practicar contenidos mediante cursos, clases, temas y preguntas interactivas.
                      </Text>

                      <View className="rounded-xl border border-[#183052] bg-[#071A32] p-4">
                        <Text className="text-[12px] text-[#8FA7C7]">Versión</Text>
                        <Text className="mt-1 font-black text-white">1.0.0</Text>
                      </View>

                      <ActionRow
                        icon="help-circle-outline"
                        title="Centro de ayuda"
                        description="Consulta ayuda, soporte y preguntas frecuentes."
                        onPress={() => router.push((isTeacher ? '/(teacher)/help-center' : '/(student)/help-center') as any)}
                      />
                    </View>
                  </Panel>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      <DestructiveConfirmModal
        visible={Boolean(pendingDestructiveAction)}
        action={pendingDestructiveAction}
        isTeacher={isTeacher}
        value={destructiveConfirmationText}
        busy={deletingData || deletingAccount}
        onChangeText={setDestructiveConfirmationText}
        onCancel={closeDestructiveConfirmation}
        onConfirm={() => void confirmDestructiveAction()}
      />
      <AppConfirmModal
        visible={showSignOutConfirm}
        variant="warning"
        title="¿Cerrar sesión?"
        message="Saldrás de tu cuenta en este dispositivo. Podrás volver a entrar con tu correo y contraseña."
        cancelLabel="Cancelar"
        confirmLabel="Cerrar sesión"
        onCancel={() => setShowSignOutConfirm(false)}
        onConfirm={() => {
          setShowSignOutConfirm(false)
          void executeSignOut()
        }}
      />

      {!securityOnly && !isDesktop && !isTeacher ? <StudentBottomNav active="settings" /> : null}
    </View>
  )
}

export default function StudentSettingsScreen() {
  return <UnifiedSettingsScreen />
}

type PasswordChecks = {
  hasCurrentPassword: boolean
  hasMinimumLength: boolean
  hasConfirmation: boolean
  passwordsMatch: boolean
  isDifferentFromCurrent: boolean
  canSubmit: boolean
}

function SecurityPasswordCard({
  accentColor,
  currentPassword,
  newPassword,
  confirmPassword,
  showCurrentPassword,
  showNewPassword,
  showConfirmPassword,
  changingPassword,
  checks,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onToggleCurrentPassword,
  onToggleNewPassword,
  onToggleConfirmPassword,
  onSubmit,
}: {
  accentColor: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
  showCurrentPassword: boolean
  showNewPassword: boolean
  showConfirmPassword: boolean
  changingPassword: boolean
  checks: PasswordChecks
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onToggleCurrentPassword: () => void
  onToggleNewPassword: () => void
  onToggleConfirmPassword: () => void
  onSubmit: () => void
}) {
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
      <View className="mb-4 flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#10233F]">
          <Ionicons name="key-outline" size={20} color="#9FD6FF" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-white">Cambiar contraseña</Text>
          <Text className="mt-1 text-[12px] leading-5 text-[#AFC2DB]">
            Verificaremos tu contraseña actual antes de guardar la nueva.
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <PasswordInput
          value={currentPassword}
          onChangeText={onCurrentPasswordChange}
          visible={showCurrentPassword}
          onToggleVisible={onToggleCurrentPassword}
          placeholder="Contraseña actual"
          autoComplete="current-password"
          textContentType="password"
        />
        <PasswordInput
          value={newPassword}
          onChangeText={onNewPasswordChange}
          visible={showNewPassword}
          onToggleVisible={onToggleNewPassword}
          placeholder="Nueva contraseña"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PasswordInput
          value={confirmPassword}
          onChangeText={onConfirmPasswordChange}
          visible={showConfirmPassword}
          onToggleVisible={onToggleConfirmPassword}
          placeholder="Confirmar nueva contraseña"
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </View>

      <View className="mt-4 rounded-xl border border-[#183052] bg-[#071A32] p-3">
        <Text className="mb-3 text-[12px] font-black uppercase tracking-[1px] text-[#8FA7C7]">
          Requisitos
        </Text>
        <PasswordRuleRow valid={checks.hasCurrentPassword} label="Contraseña actual indicada" />
        <PasswordRuleRow valid={checks.hasMinimumLength} label="Mínimo 6 caracteres" />
        <PasswordRuleRow valid={checks.passwordsMatch} label="Las contraseñas coinciden" />
        <PasswordRuleRow valid={checks.isDifferentFromCurrent} label="La nueva contraseña es diferente" />
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={!checks.canSubmit}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-xl px-5 py-4"
        style={({ pressed }) => ({
          backgroundColor: accentColor,
          opacity: !checks.canSubmit ? 0.5 : pressed ? 0.86 : 1,
        })}
      >
        {changingPassword ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
            <Text className="text-[14px] font-black text-white">Actualizar contraseña</Text>
          </>
        )}
      </Pressable>
    </View>
  )
}

function PasswordInput({
  value,
  onChangeText,
  visible,
  onToggleVisible,
  placeholder,
  autoComplete,
  textContentType,
}: {
  value: string
  onChangeText: (value: string) => void
  visible: boolean
  onToggleVisible: () => void
  placeholder: string
  autoComplete?: any
  textContentType?: any
}) {
  return (
    <View className="flex-row items-center rounded-xl border border-[#183052] bg-[#071A32] px-4">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={textContentType}
        className="min-w-0 flex-1 py-3 text-[13px] text-white"
      />
      <Pressable onPress={onToggleVisible} className="ml-3 h-9 w-9 items-center justify-center rounded-full bg-[#10233F]">
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color="#AFC2DB" />
      </Pressable>
    </View>
  )
}

function PasswordRuleRow({ valid, label }: { valid: boolean; label: string }) {
  return (
    <View className="mb-2 flex-row items-center gap-2">
      <View
        className="h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: valid ? '#22C55E24' : '#20375E' }}
      >
        <Ionicons name={valid ? 'checkmark' : 'ellipse-outline'} size={13} color={valid ? '#22C55E' : '#8FA7C7'} />
      </View>
      <Text className={`text-[12px] font-semibold ${valid ? 'text-[#BBF7D0]' : 'text-[#8FA7C7]'}`}>
        {label}
      </Text>
    </View>
  )
}

function SecurityAccountStatusCard({
  email,
  emailConfirmedAt,
  lastSignInAt,
  onSignOut,
}: {
  email: string
  emailConfirmedAt: string | null
  lastSignInAt: string | null
  onSignOut: () => void
}) {
  const verified = Boolean(emailConfirmedAt)

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
      <View className="mb-4 flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#10233F]">
          <Ionicons name="shield-checkmark-outline" size={21} color={verified ? '#22C55E' : '#F6A64A'} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-white">Estado de la cuenta</Text>
          <Text className="mt-1 text-[12px] leading-5 text-[#AFC2DB]">
            Información útil para revisar el acceso y la verificación de tu cuenta.
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <SecurityStatusRow
          icon={verified ? 'checkmark-circle' : 'alert-circle'}
          title="Correo verificado"
          value={verified ? 'Verificado' : 'Pendiente de verificación'}
          description={email}
          color={verified ? '#22C55E' : '#F6A64A'}
        />
        <SecurityStatusRow
          icon="time-outline"
          title="Último inicio de sesión"
          value={formatSecurityDate(lastSignInAt)}
          description="Última sesión registrada por Supabase Auth."
          color="#9FD6FF"
        />
      </View>

      <Pressable
        onPress={onSignOut}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-[#334155] bg-[#071A32] px-5 py-4"
        style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
      >
        <Ionicons name="log-out-outline" size={18} color="#F87171" />
        <Text className="text-[13px] font-black text-[#F87171]">Cerrar sesión en este dispositivo</Text>
      </Pressable>
    </View>
  )
}

function SecurityStatusRow({
  icon,
  title,
  value,
  description,
  color,
}: {
  icon: IconName
  title: string
  value: string
  description: string
  color: string
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-[#183052] bg-[#071A32] p-3">
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '22') }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[12px] font-bold text-[#8FA7C7]">{title}</Text>
        <Text className="mt-1 text-[13px] font-black text-white">{value}</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>{description}</Text>
      </View>
    </View>
  )
}

function SettingsMenu({
  variant,
  onSignOut,
  activeSection,
  onSectionPress,
  sections,
}: {
  variant: SettingsMenuVariant
  onSignOut: () => void
  activeSection: SettingsMenuSectionKey
  onSectionPress: (section: { key: SettingsMenuSectionKey; anchor: SettingsAnchorKey }) => void
  sections: { key: SettingsMenuSectionKey; label: string; icon: IconName; anchor: SettingsAnchorKey }[]
}) {
  const { accentColor } = useAppTheme()

  const renderMenuItem = (section: {
    key: SettingsMenuSectionKey
    label: string
    icon: IconName
    anchor: SettingsAnchorKey
  }) => {
    const active = section.key === activeSection
    const isChip = variant === 'chips'

    return (
      <Pressable
        key={section.key}
        onPress={() => onSectionPress(section)}
        className={`flex-row items-center gap-2 border ${isChip ? 'min-h-[44px] rounded-full px-4 py-3' : 'rounded-xl px-4 py-3'
          }`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.82 : 1,
          borderColor: active ? accentColor : '#183052',
          backgroundColor: active ? withAlpha(accentColor, '24') : '#071A32',
        })}
      >
        {isChip ? null : (
          <Ionicons
            name={section.icon}
            size={16}
            color={active ? accentColor : '#AFC2DB'}
          />
        )}

        <Text
          className={`text-[12px] font-black ${active ? 'text-white' : 'text-[#B7C4D7]'
            }`}
          numberOfLines={1}
        >
          {section.label}
        </Text>
      </Pressable>
    )
  }

  if (variant === 'side') {
    return (
      <View className="w-[220px] self-start rounded-xl border border-[#183052] bg-[#07162D] p-3">
        <View className="gap-1">
          {sections.map(renderMenuItem)}
        </View>

        <Pressable
          onPress={onSignOut}
          className="mt-4 flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#071326] px-3 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="log-out-outline" size={15} color="#F87171" />
          <Text className="text-[12px] font-bold text-[#F87171]">Cerrar sesión</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="rounded-xl border border-[#183052] bg-[#07162D] p-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 8,
          paddingRight: 8,
        }}
      >
        {sections.map(renderMenuItem)}
      </ScrollView>
    </View>
  )
}

function Panel({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <View className={`rounded-xl border border-[#183052] bg-[#07162D] p-5 ${className}`}>
      <Text className="mb-4 text-[16px] font-black text-white">{title}</Text>
      {children}
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-2 text-[13px] font-semibold text-[#B7C4D7]">{label}</Text>
      {children}
    </View>
  )
}

function SelectPill({
  value,
  selectedValue,
  open = false,
  onToggle,
  options,
  onSelect,
  optionLabel,
  disabled = false,
  loading = false,
}: {
  value: string
  selectedValue: string
  open?: boolean
  onToggle: () => void
  options: string[]
  onSelect: (value: string) => void
  optionLabel: (value: string) => string
  disabled?: boolean
  loading?: boolean
}) {
  const { accentColor } = useAppTheme()

  return (
    <View>
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        className="flex-row items-center justify-between rounded-lg border border-[#183052] bg-[#071A32] px-4 py-3"
        style={({ pressed }) => ({
          opacity: disabled ? 0.7 : pressed ? 0.86 : 1,
        })}
      >
        <Text className="min-w-0 flex-1 text-[13px] font-semibold text-white">{value}</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#AFC2DB" />
        ) : (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#AFC2DB" />
        )}
      </Pressable>

      {open ? (
        <View className="mt-2 overflow-hidden rounded-lg border border-[#243E63] bg-[#0A2042]">
          {options.map((option, index) => (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              className={`flex-row items-center justify-between px-4 py-3 ${index < options.length - 1 ? 'border-b border-[#1B3357]' : ''}`}
            >
              <Text className="min-w-0 flex-1 text-[13px] text-[#DDE7F4]">{optionLabel(option)}</Text>
              {option === selectedValue ? (
                <Ionicons name="checkmark" size={16} color={accentColor} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function PreferenceRow({
  label,
  value,
  selectedValue,
  open = false,
  onToggle,
  options,
  onSelect,
  optionLabel,
  disabled = false,
  loading = false,
}: {
  label: string
  value: string
  selectedValue: string
  open?: boolean
  onToggle: () => void
  options: string[]
  onSelect: (value: string) => void
  optionLabel: (value: string) => string
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <View className="mb-4 flex-row items-start gap-4">
      <Text className="w-[125px] text-[12px] font-semibold text-[#B7C4D7]">{label}</Text>
      <View className="min-w-0 flex-1">
        <SelectPill
          value={value}
          selectedValue={selectedValue}
          open={open}
          onToggle={onToggle}
          options={options}
          onSelect={onSelect}
          optionLabel={optionLabel}
          disabled={disabled}
          loading={loading}
        />
      </View>
    </View>
  )
}

function NotificationRow({
  icon,
  title,
  description,
  enabled,
  onPress,
  disabled = false,
  loading = false,
}: {
  icon: IconName
  title: string
  description: string
  enabled: boolean
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}) {
  const { accentColor } = useAppTheme()

  return (
    <View className="flex-row items-center gap-3 border-b border-[#13284A] py-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#10233F]">
        <Ionicons name={icon} size={18} color="#AFC2DB" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]">{description}</Text>
      </View>
      <View className="items-end">
        {loading ? <ActivityIndicator size="small" color="#AFC2DB" /> : null}
        <Switch
          value={enabled}
          onValueChange={onPress}
          disabled={disabled || loading}
          trackColor={{ false: '#223554', true: accentColor }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  )
}

function ActionRow({
  icon,
  title,
  description,
  onPress,
  disabled = false,
  loading = false,
}: {
  icon: IconName
  title: string
  description: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      className={`flex-row items-center gap-3 border-b border-[#13284A] py-3 ${disabled || loading ? 'opacity-50' : ''}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#10233F]">
        {loading ? (
          <ActivityIndicator size="small" color="#AFC2DB" />
        ) : (
          <Ionicons name={icon} size={18} color="#AFC2DB" />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className={`font-bold ${disabled || loading ? 'text-[#AFC2DB]' : 'text-white'}`}>{title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]">{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#AFC2DB" />
    </Pressable>
  )
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { accentColor } = useAppTheme()

  return (
    <Pressable onPress={onPress} className="mt-2 flex-row items-center justify-between py-2">
      <Text className="text-[12px] font-semibold" style={{ color: accentColor }}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={accentColor} />
    </Pressable>
  )
}

function formatSecurityDate(value: string | null) {
  if (!value) return 'Sin registro disponible'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin registro disponible'

  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'AL'
}

function getAvatarStoragePaths(userId: string, avatar: string | null | undefined) {
  const fallbackPaths = [`${userId}.jpg`, `${userId}.jpeg`, `${userId}.png`, `${userId}.webp`]
  if (!avatar) return fallbackPaths

  const decodedAvatar = decodeURIComponent(avatar)
  const storageMarker = '/avatars/'
  const markerIndex = decodedAvatar.indexOf(storageMarker)
  const avatarPath = markerIndex >= 0
    ? decodedAvatar.slice(markerIndex + storageMarker.length).split('?')[0]
    : decodedAvatar.split('?')[0]

  return Array.from(new Set([avatarPath, ...fallbackPaths].filter(Boolean)))
}
