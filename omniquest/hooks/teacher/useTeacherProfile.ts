import { useCallback, useMemo, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAppModal } from '../../components/AppModalProvider'
import { useAppToast } from '../../components/ui'

export type TeacherProfilePeriod = 30 | 90 | 365

export type TeacherProfileIdentity = {
  id: string
  alias: string
  avatar: string | null
  email: string
  createdAt: string
}

export type TeacherProfileMetrics = {
  activeCourses: number
  activeClassrooms: number
  enrolledStudents: number
  participatingStudents: number
  questionsCreated: number
  attempts: number
  correctAttempts: number
  accuracyPercent: number
  participationPercent: number
}

export type TeacherProfileSummary = {
  identity: TeacherProfileIdentity
  periodDays: number
  periodStart: string
  periodEnd: string
  metrics: TeacherProfileMetrics
  participationDescription: string
  participationNumerator: number
  participationDenominator: number
  primarySubjectId: number | null
}

export type TeacherRecentSubject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  createdAt: string
  classroomCount: number
  studentCount: number
}

export type TeacherRecentQuestion = {
  id: number
  text: string
  questionType: string
  subjectId: number
  subjectName: string
  createdAt: string
}

type LazyResourceState<T> = {
  items: T[]
  loading: boolean
  loaded: boolean
  error: string | null
  total: number
}

const EMPTY_SUMMARY: TeacherProfileSummary = {
  identity: {
    id: '',
    alias: 'Profesor',
    avatar: null,
    email: '',
    createdAt: new Date(0).toISOString(),
  },
  periodDays: 30,
  periodStart: new Date(0).toISOString(),
  periodEnd: new Date().toISOString(),
  metrics: {
    activeCourses: 0,
    activeClassrooms: 0,
    enrolledStudents: 0,
    participatingStudents: 0,
    questionsCreated: 0,
    attempts: 0,
    correctAttempts: 0,
    accuracyPercent: 0,
    participationPercent: 0,
  },
  participationDescription: 'Alumnos matriculados con al menos un intento durante el periodo seleccionado.',
  participationNumerator: 0,
  participationDenominator: 0,
  primarySubjectId: null,
}

const emptyLazyState = <T,>(): LazyResourceState<T> => ({
  items: [],
  loading: false,
  loaded: false,
  error: null,
  total: 0,
})

export function useTeacherProfile() {
  const { showModal } = useAppModal()
  const { showToast } = useAppToast()
  const [period, setPeriodState] = useState<TeacherProfilePeriod>(30)
  const [summary, setSummary] = useState<TeacherProfileSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<LazyResourceState<TeacherRecentSubject>>(emptyLazyState)
  const [questions, setQuestions] = useState<LazyResourceState<TeacherRecentQuestion>>(emptyLazyState)

  const loadSummary = useCallback(async (days: TeacherProfilePeriod, refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_teacher_profile_summary', {
        p_period_days: days,
      })
      if (rpcError) throw rpcError
      setSummary(mapSummary(data))
    } catch (loadError) {
      const message = getErrorMessage(loadError, 'No se pudo cargar el perfil docente.')
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    void loadSummary(period)
  }, [loadSummary, period]))

  const setPeriod = useCallback((next: TeacherProfilePeriod) => {
    setPeriodState(next)
    setSubjects(emptyLazyState())
    setQuestions(emptyLazyState())
  }, [])

  const loadRecentSubjects = useCallback(async (force = false) => {
    if (subjects.loading || (subjects.loaded && !force)) return
    setSubjects((current) => ({ ...current, loading: true, error: null }))
    try {
      const { data, error: rpcError } = await supabase.rpc('get_teacher_profile_recent_subjects_page', {
        p_limit: 6,
        p_offset: 0,
      })
      if (rpcError) throw rpcError
      const rows = (data || []) as Array<Record<string, unknown>>
      setSubjects({
        items: rows.map(mapRecentSubject),
        loading: false,
        loaded: true,
        error: null,
        total: Number(rows[0]?.total_count || 0),
      })
    } catch (loadError) {
      setSubjects((current) => ({
        ...current,
        loading: false,
        loaded: true,
        error: getErrorMessage(loadError, 'No se pudieron cargar los cursos recientes.'),
      }))
    }
  }, [subjects.loaded, subjects.loading])

  const loadRecentQuestions = useCallback(async (force = false) => {
    if (questions.loading || (questions.loaded && !force)) return
    setQuestions((current) => ({ ...current, loading: true, error: null }))
    try {
      const { data, error: rpcError } = await supabase.rpc('get_teacher_profile_recent_questions_page', {
        p_limit: 6,
        p_offset: 0,
      })
      if (rpcError) throw rpcError
      const rows = (data || []) as Array<Record<string, unknown>>
      setQuestions({
        items: rows.map(mapRecentQuestion),
        loading: false,
        loaded: true,
        error: null,
        total: Number(rows[0]?.total_count || 0),
      })
    } catch (loadError) {
      setQuestions((current) => ({
        ...current,
        loading: false,
        loaded: true,
        error: getErrorMessage(loadError, 'No se pudieron cargar las preguntas recientes.'),
      }))
    }
  }, [questions.loaded, questions.loading])

  const chooseProfessionalAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (permission.status !== 'granted') {
      showModal({
        title: 'Permiso requerido',
        message: 'Necesitamos acceso a la galería para elegir tu fotografía profesional.',
        variant: 'warning',
      })
      return
    }

    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    })
    if (selection.canceled || !selection.assets[0]?.uri || !summary.identity.id) return

    setUploadingAvatar(true)
    try {
      const imageResponse = await fetch(selection.assets[0].uri)
      if (!imageResponse.ok) throw new Error('No se pudo leer la imagen seleccionada.')
      const imageBlob = await imageResponse.blob()
      const path = `${summary.identity.id}.jpg`
      const upload = await supabase.storage.from('avatars').upload(path, imageBlob, {
        upsert: true,
        contentType: imageBlob.type || 'image/jpeg',
      })
      if (upload.error) throw upload.error

      const { data, error: functionError } = await supabase.functions.invoke('profile-update-avatar', {
        body: { avatarPath: path },
      })
      if (functionError) throw functionError
      const payload = (data || {}) as { avatar?: string | null; error?: string }
      if (payload.error) throw new Error(payload.error)

      setSummary((current) => ({
        ...current,
        identity: { ...current.identity, avatar: payload.avatar || null },
      }))
      showToast({
        title: 'Fotografía profesional actualizada',
        message: 'La imagen se mostrará en tus espacios docentes. No utiliza cosméticos del alumno.',
        variant: 'success',
      })
    } catch (uploadError) {
      showToast({
        title: 'No se pudo actualizar la fotografía',
        message: getErrorMessage(uploadError, 'Revisa la conexión y el archivo seleccionado.'),
        variant: 'danger',
      })
    } finally {
      setUploadingAvatar(false)
    }
  }, [showModal, showToast, summary.identity.id])

  const periodLabel = useMemo(() => {
    if (period === 30) return 'Últimos 30 días'
    if (period === 90) return 'Últimos 90 días'
    return 'Últimos 12 meses'
  }, [period])

  return {
    period,
    periodLabel,
    setPeriod,
    summary,
    loading,
    refreshing,
    uploadingAvatar,
    error,
    subjects,
    questions,
    refresh: () => loadSummary(period, true),
    loadRecentSubjects,
    loadRecentQuestions,
    chooseProfessionalAvatar,
  }
}

function mapSummary(value: unknown): TeacherProfileSummary {
  const payload = isObject(value) ? value : {}
  const identity = isObject(payload.profile) ? payload.profile : {}
  const metrics = isObject(payload.metrics) ? payload.metrics : {}
  const participation = isObject(payload.participation_definition) ? payload.participation_definition : {}

  return {
    identity: {
      id: String(identity.id || ''),
      alias: String(identity.alias || 'Profesor'),
      avatar: typeof identity.avatar === 'string' ? identity.avatar : null,
      email: String(identity.email || ''),
      createdAt: String(identity.created_at || new Date(0).toISOString()),
    },
    periodDays: Number(payload.period_days || 30),
    periodStart: String(payload.period_start || new Date(0).toISOString()),
    periodEnd: String(payload.period_end || new Date().toISOString()),
    metrics: {
      activeCourses: Number(metrics.active_courses || 0),
      activeClassrooms: Number(metrics.active_classrooms || 0),
      enrolledStudents: Number(metrics.enrolled_students || 0),
      participatingStudents: Number(metrics.participating_students || 0),
      questionsCreated: Number(metrics.questions_created || 0),
      attempts: Number(metrics.attempts || 0),
      correctAttempts: Number(metrics.correct_attempts || 0),
      accuracyPercent: Number(metrics.accuracy_percent || 0),
      participationPercent: Number(metrics.participation_percent || 0),
    },
    participationDescription: String(participation.description || EMPTY_SUMMARY.participationDescription),
    participationNumerator: Number(participation.numerator || 0),
    participationDenominator: Number(participation.denominator || 0),
    primarySubjectId: payload.primary_subject_id == null ? null : Number(payload.primary_subject_id),
  }
}

function mapRecentSubject(row: Record<string, unknown>): TeacherRecentSubject {
  return {
    id: Number(row.id),
    name: String(row.name || 'Curso'),
    description: typeof row.description === 'string' ? row.description : null,
    icon: typeof row.icon === 'string' ? row.icon : null,
    code: String(row.code || ''),
    createdAt: String(row.created_at || new Date().toISOString()),
    classroomCount: Number(row.classroom_count || 0),
    studentCount: Number(row.student_count || 0),
  }
}

function mapRecentQuestion(row: Record<string, unknown>): TeacherRecentQuestion {
  return {
    id: Number(row.id),
    text: String(row.text || 'Pregunta'),
    questionType: String(row.question_type || 'multiple'),
    subjectId: Number(row.subject_id),
    subjectName: String(row.subject_name || 'Curso'),
    createdAt: String(row.created_at || new Date().toISOString()),
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (isObject(error) && typeof error.message === 'string') return error.message
  return fallback
}
