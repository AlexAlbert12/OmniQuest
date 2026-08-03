import { useCallback, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { removeStudentFromClasses, resetStudentProgress, sendTeacherStudentMessage, signOutTeacherStudents } from './api'
import { buildStudentActivityRoute, buildStudentHistoryRoute, buildTeacherStudentPageView, buildTeacherStudentsCsv, parsePositiveNumberParam, parseStudentStatusParam } from './model'
import { useTeacherStudentsPage } from './useTeacherStudentsPage'
import type { ConfirmDialog, StudentRow } from './types'
import { useAppFeedback } from '../../hooks/useAppFeedback'

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
  const pageView = useMemo(() => buildTeacherStudentPageView(directory.students, directory.summary), [directory.students, directory.summary])
  const feedback = useAppFeedback()

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
      await resetStudentProgress(student)
      await directory.reload()
      feedback.success('Progreso reiniciado', `El progreso de ${student.alias} se ha reiniciado.`)
    } catch (error) {
      feedback.error('No se pudo reiniciar el progreso', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    }
  }, [directory, feedback])

  const requestResetProgress = useCallback((student: StudentRow) => {
    setActionStudent(null)
    setConfirmDialog({
      title: 'Reiniciar progreso',
      message: `Se eliminarán las puntuaciones y los intentos de ${student.alias} en sus cursos actuales.`,
      confirmLabel: 'Reiniciar',
      destructive: true,
      onConfirm: () => { void resetProgress(student) },
    })
  }, [resetProgress])

  const sendBulkReminder = useCallback(async () => {
    if (!pageView.pendingStudents.length || sendingBulkReminders) {
      feedback.warning('Sin pendientes en esta página', 'No hay alumnos sin actividad en la página actual.')
      return
    }
    try {
      setSendingBulkReminders(true)
      const data = await sendTeacherStudentMessage(
        pageView.pendingStudents.map((student) => student.id),
        Array.from(new Set(pageView.pendingStudents.flatMap((student) => student.subjectIds))),
        'reminder',
      )
      feedback.success('Recordatorios enviados', `${Number(data?.sent || 0)} envío(s) completado(s) desde la página actual.`)
    } catch (error) {
      feedback.error('No se pudieron enviar los recordatorios', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
    } finally {
      setSendingBulkReminders(false)
    }
  }, [pageView.pendingStudents, sendingBulkReminders, feedback])

  const sendStudentMessage = useCallback(async (student: StudentRow, mode: 'reminder' | 'recovery') => {
    if (reminderStudentIds[student.id]) return
    try {
      setActionStudent(null)
      setReminderStudentIds((current) => ({ ...current, [student.id]: true }))
      await sendTeacherStudentMessage([student.id], student.subjectIds, mode)
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
  }, [reminderStudentIds, feedback])

  const exportCurrentPage = useCallback(() => {
    if (!directory.students.length) {
      feedback.warning('Sin datos', 'No hay alumnos en la página actual para exportar.')
      return
    }
    if (Platform.OS !== 'web') {
      feedback.warning('Exportación disponible en web', 'La descarga CSV está disponible desde la versión web.')
      return
    }
    const blob = new Blob([`\uFEFF${buildTeacherStudentsCsv(directory.students)}`], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `omniquest_estudiantes_pagina_${directory.page + 1}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }, [directory.page, directory.students, feedback])

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
    exportCurrentPage,
    openNotifications,
    signOut,
  }
}
