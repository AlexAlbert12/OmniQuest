import { useCallback, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { fetchTeacherStudentsPage, removeStudentFromClasses, resetStudentProgress, sendTeacherStudentMessage, signOutTeacherStudents } from './api'
import { buildStudentActivityRoute, buildStudentHistoryRoute, buildTeacherStudentPageView, parsePositiveNumberParam, parseStudentStatusParam } from './model'
import { useTeacherStudentsPage } from './useTeacherStudentsPage'
import type { ConfirmDialog, StudentRow, StudentStatusFilter } from './types'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { exportTeacherStudentsXlsx } from './export'

export function useTeacherStudentsController(pageSize: number) {
  const router = useRouter()
  const params = useLocalSearchParams<{ subjectId?: string; classroomId?: string; status?: string }>()
  const directory = useTeacherStudentsPage({
    initialSubjectId: parsePositiveNumberParam(params.subjectId) || 'all',
    initialClassroomId: parsePositiveNumberParam(params.classroomId) || 'all',
    initialStatus: parseStudentStatusParam(params.status),
    pageSize,
  })
  const [actionStudent, setActionStudent] = useState<StudentRow | null>(null)
  const [detailStudent, setDetailStudent] = useState<StudentRow | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [reminderStudentIds, setReminderStudentIds] = useState<Record<string, boolean>>({})
  const [sendingBulkReminders, setSendingBulkReminders] = useState(false)
  const pageView = useMemo(() => buildTeacherStudentPageView(directory.students, directory.summary, directory.attention, directory.pending), [directory.attention, directory.pending, directory.students, directory.summary])
  const feedback = useAppFeedback()
  const selectedClassroomId = directory.selectedClassroomId === 'all' ? null : directory.selectedClassroomId
  const selectedSubject = directory.selectedSubjectId === 'all' ? null : directory.subjects.find((subject) => subject.id === directory.selectedSubjectId) || null
  const selectedClassroom = selectedClassroomId === null ? null : directory.classrooms.find((classroom) => classroom.id === selectedClassroomId) || null
  const selectedClassroomSubject = selectedClassroom ? directory.subjects.find((subject) => subject.id === selectedClassroom.subject_id) || null : null
  const scopeSubjectName = selectedSubject?.name || selectedClassroomSubject?.name || null
  const scopeLabel = selectedClassroom ? `${scopeSubjectName || 'Curso'} · ${selectedClassroom.name}` : scopeSubjectName || 'todos los cursos mostrados'
  const xpScopeLabel = selectedClassroom ? `Puntuación en ${scopeLabel}` : scopeSubjectName ? `Puntuación en ${scopeSubjectName}` : 'Puntuación en cursos seleccionados'

  const loadAllStudents = useCallback(async (statusOverride?: StudentStatusFilter) => {
    const collected: StudentRow[] = []
    const batchSize = 100
    let page = 0
    let expectedTotal = Number.POSITIVE_INFINITY
    while (collected.length < expectedTotal) {
      const payload = await fetchTeacherStudentsPage({
        subjectId: directory.selectedSubjectId,
        classroomId: directory.selectedClassroomId,
        status: statusOverride || directory.selectedStatus,
        search: directory.search.trim(),
        order: directory.selectedSort,
        page,
        pageSize: batchSize,
      })
      const items = payload.items || []
      expectedTotal = Number(payload.total || 0)
      collected.push(...items)
      if (items.length === 0 || items.length < batchSize) break
      page += 1
    }
    return collected
  }, [directory.search, directory.selectedClassroomId, directory.selectedSort, directory.selectedStatus, directory.selectedSubjectId])

  const viewStudentDetails = useCallback((student: StudentRow) => {
    setActionStudent(null)
    setDetailStudent(student)
  }, [])

  const viewHistory = useCallback((student: StudentRow) => {
    setActionStudent(null)
    setDetailStudent(null)
    router.push(buildStudentHistoryRoute(student, directory.selectedSubjectId, directory.selectedClassroomId) as Href)
  }, [directory.selectedClassroomId, directory.selectedSubjectId, router])

  const assignActivity = useCallback((student: StudentRow) => {
    const route = buildStudentActivityRoute(student, directory.selectedSubjectId, directory.selectedClassroomId)
    if (!route) {
      feedback.warning('Asignar repaso', 'Selecciona primero un curso o una clase para crear la actividad.')
      return
    }
    router.push(route as Href)
  }, [directory.selectedClassroomId, directory.selectedSubjectId, router, feedback])

  const removeFromClass = useCallback(async (student: StudentRow) => {
    try {
      await removeStudentFromClasses(student)
      await directory.reload()
      feedback.success('Estudiante eliminado', `${student.alias} ha sido retirado de sus cursos y clases.`)
    } catch (error) {
      feedback.error('No se pudo eliminar al estudiante', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    }
  }, [directory, feedback])

  const requestRemoveFromClass = useCallback((student: StudentRow) => {
    setActionStudent(null)
    setDetailStudent(null)
    setConfirmDialog({
      title: 'Quitar de clase',
      message: `Se retirará a ${student.alias} de sus cursos y clases actuales.`,
      confirmLabel: 'Sí, quitar',
      destructive: true,
      onConfirm: () => { void removeFromClass(student) },
    })
  }, [removeFromClass])

  const resetProgress = useCallback(async (student: StudentRow) => {
    try {
      await resetStudentProgress(student, selectedClassroomId)
      await directory.reload()
      feedback.success('Progreso reiniciado', `El progreso de ${student.alias} se ha reiniciado en ${scopeLabel}.`)
    } catch (error) {
      feedback.error('No se pudo reiniciar el progreso', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    }
  }, [directory, feedback, scopeLabel, selectedClassroomId])

  const requestResetProgress = useCallback((student: StudentRow) => {
    setActionStudent(null)
    setConfirmDialog({
      title: 'Reiniciar progreso',
      message: `Se eliminarán las puntuaciones y los intentos de ${student.alias} en ${scopeLabel}.`,
      confirmLabel: 'Reiniciar',
      destructive: true,
      onConfirm: () => { void resetProgress(student) },
    })
  }, [resetProgress, scopeLabel])

  const sendBulkReminder = useCallback(async () => {
    if (sendingBulkReminders) return
    try {
      setSendingBulkReminders(true)
      const pendingStudents = await loadAllStudents('no_activity')
      if (!pendingStudents.length) {
        feedback.warning('Sin alumnos pendientes', 'No hay alumnos sin actividad en la selección actual.')
        return
      }
      const data = await sendTeacherStudentMessage(
        pendingStudents.map((student) => student.id),
        Array.from(new Set(pendingStudents.flatMap((student) => student.subjectIds))),
        'reminder',
        selectedClassroomId,
      )
      feedback.success('Recordatorios enviados', `${Number(data?.sent || 0)} de ${pendingStudents.length} alumnos sin actividad recibieron el recordatorio.`)
    } catch (error) {
      feedback.error('No se pudieron enviar los recordatorios', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    } finally {
      setSendingBulkReminders(false)
    }
  }, [feedback, loadAllStudents, selectedClassroomId, sendingBulkReminders])

  const sendStudentMessage = useCallback(async (student: StudentRow, mode: 'reminder' | 'recovery') => {
    if (reminderStudentIds[student.id]) return
    try {
      setActionStudent(null)
      setReminderStudentIds((current) => ({ ...current, [student.id]: true }))
      await sendTeacherStudentMessage([student.id], student.subjectIds, mode, selectedClassroomId)
      feedback.success(
        mode === 'recovery' ? 'Enlace seguro enviado' : 'Recordatorio enviado',
        mode === 'recovery'
          ? `${student.alias} recibirá un enlace de recuperación de un solo uso.`
          : `${student.alias} recibirá un recordatorio para volver a practicar.`,
      )
    } catch (error) {
      feedback.error('No se pudo enviar el mensaje', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    } finally {
      setReminderStudentIds((current) => ({ ...current, [student.id]: false }))
    }
  }, [feedback, reminderStudentIds, selectedClassroomId])

  const exportStudents = useCallback(async (statusOverride?: StudentStatusFilter) => {
    if (Platform.OS !== 'web') {
      feedback.warning('Exportación disponible en web', 'La descarga del informe de alumnos está disponible desde la versión web.')
      return
    }
    try {
      const students = await loadAllStudents(statusOverride)
      if (!students.length) {
        feedback.warning('Sin datos', 'No hay alumnos en la selección actual para exportar.')
        return
      }
      const exportStatus = statusOverride || directory.selectedStatus
      const exportedAt = new Date()
      const result = await exportTeacherStudentsXlsx(students, {
        subjectName: scopeSubjectName,
        classroomName: selectedClassroom?.name || null,
        scopeLabel,
        scoreScopeLabel: xpScopeLabel,
        status: exportStatus,
        sort: directory.selectedSort,
        search: directory.search.trim(),
        exportedAt,
        kind: statusOverride === 'no_activity' ? 'no_activity' : 'selection',
      })
      feedback.success('Informe exportado', `Se han exportado ${result.count} alumno${result.count === 1 ? '' : 's'} en formato Excel.`)
    } catch (error) {
      feedback.error('No se pudo exportar', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    }
  }, [directory.search, directory.selectedSort, directory.selectedStatus, feedback, loadAllStudents, scopeLabel, scopeSubjectName, selectedClassroom?.name, xpScopeLabel])

  const exportCurrentSelection = useCallback(() => { void exportStudents() }, [exportStudents])
  const exportNoActivity = useCallback(() => { void exportStudents('no_activity') }, [exportStudents])

  const openNotifications = useCallback(() => router.push('/(teacher)/notifications' as Href), [router])
  const signOut = useCallback(() => { void signOutTeacherStudents() }, [])

  return {
    directory,
    ...pageView,
    actionStudent,
    detailStudent,
    confirmDialog,
    reminderStudentIds,
    sendingBulkReminders,
    setActionStudent,
    setDetailStudent,
    setConfirmDialog,
    viewStudentDetails,
    viewHistory,
    assignActivity,
    requestRemoveFromClass,
    requestResetProgress,
    sendBulkReminder,
    sendStudentMessage,
    exportCurrentSelection,
    exportNoActivity,
    xpScopeLabel,
    openNotifications,
    signOut,
  }
}
