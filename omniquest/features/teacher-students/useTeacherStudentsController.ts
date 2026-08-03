import { useCallback, useMemo, useState } from 'react'
import { Alert, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { removeStudentFromClasses, resetStudentProgress, sendTeacherStudentMessage, signOutTeacherStudents } from './api'
import { buildStudentActivityRoute, buildStudentHistoryRoute, buildTeacherStudentPageView, buildTeacherStudentsCsv, parsePositiveNumberParam, parseStudentStatusParam } from './model'
import { useTeacherStudentsPage } from './useTeacherStudentsPage'
import type { ConfirmDialog, StudentRow } from './types'

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
  const showAlert = useCallback((title: string, message: string) => Alert.alert(title, message), [])

  const viewStudentDetails = useCallback((student: StudentRow) => {
    setActionStudent(null)
    setDetailStudent(student)
  }, [])

  const viewHistory = useCallback((student: StudentRow) => {
    setActionStudent(null)
    setDetailStudent(null)
    router.push(buildStudentHistoryRoute(student, directory.selectedSubjectId, directory.selectedClassroomId) as any)
  }, [directory.selectedClassroomId, directory.selectedSubjectId, router])

  const assignActivity = useCallback((student: StudentRow) => {
    const route = buildStudentActivityRoute(student, directory.selectedSubjectId, directory.selectedClassroomId)
    if (!route) {
      showAlert('Asignar repaso', 'Selecciona primero un curso o una clase para crear la actividad.')
      return
    }
    router.push(route as any)
  }, [directory.selectedClassroomId, directory.selectedSubjectId, router, showAlert])

  const removeFromClass = useCallback(async (student: StudentRow) => {
    try {
      await removeStudentFromClasses(student)
      await directory.reload()
      showAlert('Estudiante eliminado', `${student.alias} ha sido retirado de sus cursos y clases.`)
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudo eliminar al estudiante.')
    }
  }, [directory, showAlert])

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
      showAlert('Progreso reiniciado', `El progreso de ${student.alias} se ha reiniciado.`)
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudo reiniciar el progreso.')
    }
  }, [directory, showAlert])

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
      showAlert('Sin pendientes en esta página', 'No hay alumnos sin actividad en la página actual.')
      return
    }
    try {
      setSendingBulkReminders(true)
      const data = await sendTeacherStudentMessage(
        pageView.pendingStudents.map((student) => student.id),
        Array.from(new Set(pageView.pendingStudents.flatMap((student) => student.subjectIds))),
        'reminder',
      )
      showAlert('Recordatorios enviados', `${Number(data?.sent || 0)} envío(s) completado(s) desde la página actual.`)
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudieron enviar los recordatorios.')
    } finally {
      setSendingBulkReminders(false)
    }
  }, [pageView.pendingStudents, sendingBulkReminders, showAlert])

  const sendStudentMessage = useCallback(async (student: StudentRow, mode: 'reminder' | 'recovery') => {
    if (reminderStudentIds[student.id]) return
    try {
      setActionStudent(null)
      setReminderStudentIds((current) => ({ ...current, [student.id]: true }))
      await sendTeacherStudentMessage([student.id], student.subjectIds, mode)
      showAlert(
        mode === 'recovery' ? 'Enlace seguro enviado' : 'Recordatorio enviado',
        mode === 'recovery'
          ? `${student.alias} recibirá un enlace de recuperación de un solo uso.`
          : `${student.alias} recibirá un recordatorio para volver a practicar.`,
      )
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudo enviar el mensaje.')
    } finally {
      setReminderStudentIds((current) => ({ ...current, [student.id]: false }))
    }
  }, [reminderStudentIds, showAlert])

  const exportCurrentPage = useCallback(() => {
    if (!directory.students.length) {
      showAlert('Sin datos', 'No hay alumnos en la página actual para exportar.')
      return
    }
    if (Platform.OS !== 'web') {
      showAlert('Exportación disponible en web', 'La descarga CSV está disponible desde la versión web.')
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
  }, [directory.page, directory.students, showAlert])

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
    openNotifications: () => router.push('/(teacher)/notifications' as any),
    signOut: () => { void signOutTeacherStudents() },
  }
}
