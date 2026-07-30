import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAppTheme } from '../../lib/appTheme'
import { useTeacherStudentsPage } from '../../hooks/teacher/useTeacherStudentsPage'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import AppButton from '../../components/ui/AppButton'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import AppTabs from '../../components/ui/AppTabs'
import MobileTeacherStudents from '../../components/teacher/students/MobileTeacherStudents'
import { StudentActionsModal, StudentDetailModal, ConfirmModal } from '../../components/teacher/students/StudentModals'
import { CycleSelectButton, MetricCard, StudentPaginationControls } from '../../components/teacher/students/TeacherStudentList'
import TeacherStudentsDesktopTable, { TeacherStudentPrioritySections } from '../../components/teacher/students/TeacherStudentsDesktop'
import {
  statusFilterOptions,
  sortOptions,
  type ConfirmDialog,
  type StudentRow,
  type StudentSortKey,
  type StudentStatusFilter,
  type TeacherActionResult,
} from '../../components/teacher/students/types'
import { formatDate } from '../../components/teacher/students/studentUtils'

export default function TeacherStudentsScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const { tokens } = useAppTheme()
  const params = useLocalSearchParams<{ subjectId?: string; classroomId?: string; status?: string }>()
  const isDesktop = width >= 1080
  const isWide = width >= 900
  const pageSize = isDesktop ? 12 : 5
  const directory = useTeacherStudentsPage({
    initialSubjectId: parseNumberParam(params.subjectId) || 'all',
    initialClassroomId: parseNumberParam(params.classroomId) || 'all',
    initialStatus: parseStatusParam(params.status),
    pageSize,
  })

  const [actionStudent, setActionStudent] = useState<StudentRow | null>(null)
  const [detailStudent, setDetailStudent] = useState<StudentRow | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [reminderStudentIds, setReminderStudentIds] = useState<Record<string, boolean>>({})
  const [sendingBulkReminders, setSendingBulkReminders] = useState(false)

  const needsAttention = useMemo(
    () => directory.students.filter((student) => student.status === 'needs_help' || student.status === 'inactive'),
    [directory.students],
  )
  const pendingStudents = useMemo(
    () => directory.students.filter((student) => student.status === 'no_activity'),
    [directory.students],
  )
  const stats = {
    total: directory.summary.total,
    active: directory.summary.active,
    noActivity: directory.summary.noActivity,
    needsHelp: directory.summary.needsHelp,
    withActivity: directory.summary.withActivity,
    averageXp: directory.summary.averageXp,
    averageGrade: directory.summary.averageGrade,
    averageAccuracy: directory.summary.averageAccuracy,
    completedChallenges: directory.summary.completedChallenges,
  }

  const showAlert = (title: string, message: string) => Alert.alert(title, message)
  const invokeTeacherAction = async <T extends TeacherActionResult>(functionName: string, body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.functions.invoke(functionName, { body })
    if (error) throw error
    const result = (data || {}) as T
    if (result.error) throw new Error(result.error)
    return result
  }

  const handleViewStudentDetails = (student: StudentRow) => {
    setActionStudent(null)
    setDetailStudent(student)
  }

  const handleViewHistory = (student: StudentRow) => {
    setActionStudent(null)
    setDetailStudent(null)
    router.push({
      pathname: '/(teacher)/student/[id]/history',
      params: {
        id: student.id,
        ...(directory.selectedSubjectId !== 'all' ? { subjectId: String(directory.selectedSubjectId) } : {}),
        ...(directory.selectedClassroomId !== 'all' ? { classroomId: String(directory.selectedClassroomId) } : {}),
      },
    } as any)
  }

  const handleAssignActivity = (student: StudentRow) => {
    const subjectId = directory.selectedSubjectId !== 'all' ? directory.selectedSubjectId : student.subjectIds[0]
    const classroomId = directory.selectedClassroomId !== 'all' ? directory.selectedClassroomId : student.classroomIds[0]
    if (!subjectId) {
      showAlert('Asignar repaso', 'Selecciona primero un curso o una clase para crear la actividad.')
      return
    }
    router.push({
      pathname: '/(teacher)/subject/add-question',
      params: { subjectId: String(subjectId), ...(classroomId ? { classroomId: String(classroomId) } : {}) },
    } as any)
  }

  const handleRemoveFromClass = async (student: StudentRow) => {
    try {
      await invokeTeacherAction('teacher-remove-student-from-class', {
        studentId: student.id,
        subjectIds: student.subjectIds,
        classroomIds: student.classroomIds,
      })
      await directory.reload()
      showAlert('Estudiante eliminado', `${student.alias} ha sido retirado de sus cursos y clases.`)
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudo eliminar al estudiante.')
    }
  }

  const requestRemoveFromClass = (student: StudentRow) => {
    setActionStudent(null)
    setDetailStudent(null)
    setConfirmDialog({
      title: 'Quitar de clase',
      message: `Se retirará a ${student.alias} de sus cursos y clases actuales.`,
      confirmLabel: 'Sí, quitar',
      destructive: true,
      onConfirm: () => { void handleRemoveFromClass(student) },
    })
  }

  const handleResetProgress = async (student: StudentRow) => {
    try {
      await invokeTeacherAction('teacher-reset-student-progress', { studentId: student.id, subjectIds: student.subjectIds })
      await directory.reload()
      showAlert('Progreso reiniciado', `El progreso de ${student.alias} se ha reiniciado.`)
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudo reiniciar el progreso.')
    }
  }

  const requestResetProgress = (student: StudentRow) => {
    setActionStudent(null)
    setConfirmDialog({
      title: 'Reiniciar progreso',
      message: `Se eliminarán las puntuaciones y los intentos de ${student.alias} en sus cursos actuales.`,
      confirmLabel: 'Reiniciar',
      destructive: true,
      onConfirm: () => { void handleResetProgress(student) },
    })
  }

  const sendReminder = async (studentIds: string[], subjectIds: number[], mode: 'reminder' | 'recovery') => {
    const body = mode === 'recovery'
      ? { studentIds, subjectIds, mode: 'recovery' as const }
      : { studentIds, subjectIds, mode: 'reminder' as const }
    const { data, error } = await supabase.functions.invoke('teacher-student-reminder', { body })
    if (error) throw new Error(error.message || 'No se pudo enviar el mensaje.')
    const failed = Number((data as any)?.failed || 0)
    if (failed > 0 && studentIds.length === 1) throw new Error((data as any)?.results?.[0]?.error || 'No se pudo enviar el mensaje.')
    return data as any
  }

  const handleSendReminder = async () => {
    if (!pendingStudents.length || sendingBulkReminders) {
      showAlert('Sin pendientes en esta página', 'No hay alumnos sin actividad en la página actual.')
      return
    }
    try {
      setSendingBulkReminders(true)
      const data = await sendReminder(
        pendingStudents.map((student) => student.id),
        Array.from(new Set(pendingStudents.flatMap((student) => student.subjectIds))),
        'reminder',
      )
      showAlert('Recordatorios enviados', `${Number(data?.sent || 0)} envío(s) completado(s) desde la página actual.`)
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'No se pudieron enviar los recordatorios.')
    } finally {
      setSendingBulkReminders(false)
    }
  }

  const handleStudentMessage = async (student: StudentRow, mode: 'reminder' | 'recovery') => {
    if (reminderStudentIds[student.id]) return
    try {
      setActionStudent(null)
      setReminderStudentIds((current) => ({ ...current, [student.id]: true }))
      await sendReminder([student.id], student.subjectIds, mode)
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
  }

  const handleExportStudentsCsv = () => {
    if (!directory.students.length) {
      showAlert('Sin datos', 'No hay alumnos en la página actual para exportar.')
      return
    }
    if (Platform.OS !== 'web') {
      showAlert('Exportación disponible en web', 'La descarga CSV está disponible desde la versión web.')
      return
    }
    const rows = directory.students.map((student) => [
      student.id,
      student.alias,
      student.subjectScore,
      student.globalPoints,
      student.accuracyPercent,
      student.participation,
      student.questions,
      student.status,
      student.lastActivityAt ? formatDate(student.lastActivityAt) : 'Sin actividad',
      student.subjectNames.join(' | '),
      student.classroomNames.join(' | '),
    ])
    const csv = [['ID', 'Alias', 'XP curso', 'XP global', 'Precisión', 'Participación', 'Preguntas', 'Estado', 'Última actividad', 'Cursos', 'Clases'], ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `omniquest_estudiantes_pagina_${directory.page + 1}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  if (directory.loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: tokens.background.primary }}>
        <ActivityIndicator size="large" color={tokens.brand.teacher} />
        <Text className="mt-4" style={{ color: tokens.text.muted }}>Cargando una página de alumnos...</Text>
      </View>
    )
  }

  const sharedModalProps = (
    <>
      <StudentActionsModal
        student={actionStudent}
        visible={Boolean(actionStudent)}
        reminderBusy={actionStudent ? Boolean(reminderStudentIds[actionStudent.id]) : false}
        onClose={() => setActionStudent(null)}
        onViewDetails={handleViewStudentDetails}
        onViewHistory={handleViewHistory}
        onRemoveFromClass={requestRemoveFromClass}
        onResetProgress={requestResetProgress}
        onSendReminder={(student) => { void handleStudentMessage(student, 'reminder') }}
        onRequestPasswordRecovery={(student) => { void handleStudentMessage(student, 'recovery') }}
        onAssignActivity={(student) => { setActionStudent(null); handleAssignActivity(student) }}
      />
      <StudentDetailModal
        student={detailStudent}
        visible={Boolean(detailStudent)}
        reminderBusy={detailStudent ? Boolean(reminderStudentIds[detailStudent.id]) : false}
        onClose={() => setDetailStudent(null)}
        onAssignActivity={(student) => { setDetailStudent(null); handleAssignActivity(student) }}
        onViewHistory={handleViewHistory}
        onRemoveFromClass={requestRemoveFromClass}
        onSendReminder={(student) => { void handleStudentMessage(student, 'reminder') }}
        onRequestPasswordRecovery={(student) => { void handleStudentMessage(student, 'recovery') }}
      />
      <ConfirmModal dialog={confirmDialog} visible={Boolean(confirmDialog)} onClose={() => setConfirmDialog(null)} />
    </>
  )

  if (!isDesktop) {
    return (
      <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
        <MobileTeacherStudents
          subjects={directory.subjects}
          classroomOptions={directory.classroomOptions}
          selectedSubjectId={directory.selectedSubjectId}
          selectedClassroomId={directory.selectedClassroomId}
          selectedStatus={directory.selectedStatus}
          selectedSort={directory.selectedSort}
          search={directory.search}
          stats={stats}
          students={directory.students}
          visibleStudents={directory.students}
          pendingStudents={pendingStudents}
          refreshing={directory.refreshing}
          sendingBulkReminders={sendingBulkReminders}
          reminderStudentIds={reminderStudentIds}
          onRefresh={directory.refresh}
          onSelectSubject={directory.setSelectedSubjectId}
          onSelectClassroom={directory.setSelectedClassroomId}
          onSelectStatus={directory.setSelectedStatus}
          onSelectSort={directory.setSelectedSort}
          onSearch={directory.setSearch}
          onExportStudents={handleExportStudentsCsv}
          onSendReminder={() => { void handleSendReminder() }}
          onViewDetails={handleViewStudentDetails}
          onAssignActivity={handleAssignActivity}
          onOpenActions={setActionStudent}
          onSendStudentReminder={(student) => { void handleStudentMessage(student, 'reminder') }}
          onRequestPasswordRecovery={(student) => { void handleStudentMessage(student, 'recovery') }}
          onNotifications={() => router.push('/(teacher)/notifications' as any)}
          page={directory.page}
          pageCount={directory.pageCount}
          total={directory.total}
          pageSize={directory.pageSize}
          onPreviousPage={() => directory.setPage(Math.max(0, directory.page - 1))}
          onNextPage={() => directory.setPage(Math.min(directory.pageCount - 1, directory.page + 1))}
        />
        {sharedModalProps}
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <View className="flex-1 flex-row">
        <TeacherSidebar activeSection="students" subjectsCount={directory.subjects.length} onSignOut={() => supabase.auth.signOut()} />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={directory.refreshing} onRefresh={directory.refresh} tintColor={tokens.brand.teacher} />}
        >
          <TeacherPageHeader
            icon="people"
            isDesktop
            title="Estudiantes"
            subtitle="Paginación y métricas calculadas en servidor para no descargar todo el historial."
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
          />

          {directory.error ? <AppStatusBanner variant="danger" title="No se pudo cargar el directorio" message={directory.error} actionLabel="Reintentar" onAction={directory.reload} /> : null}

          <View className="mb-4 mt-4 rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
            <View style={{ gap: 12 }}>
              <View className="flex-row flex-wrap items-center gap-3" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <CycleSelectButton label="Curso" value={directory.selectedSubjectId} allLabel="Todos" options={directory.subjects.map((subject) => ({ id: subject.id, label: subject.name }))} onChange={directory.setSelectedSubjectId} />
                <CycleSelectButton label="Clase" value={directory.selectedClassroomId} allLabel="Todas" options={directory.classroomOptions.map((classroom) => ({ id: classroom.id, label: classroom.name }))} onChange={directory.setSelectedClassroomId} />
                <View className="h-12 min-w-[300px] flex-1 flex-row items-center rounded-xl border px-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
                  <TextInput accessibilityLabel="Buscar estudiante, curso o clase" className="min-w-0 flex-1" style={{ color: tokens.text.primary }} placeholder="Buscar estudiante, curso o clase..." placeholderTextColor={tokens.text.muted} value={directory.search} onChangeText={directory.setSearch} />
                  <Ionicons name="search-outline" size={20} color={tokens.text.muted} />
                </View>
                <AppButton label="Exportar página" icon="download-outline" variant="secondary" disabled={!directory.students.length} onPress={handleExportStudentsCsv} />
              </View>
              <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 12 }}>
                <View className="min-w-0 flex-1">
                  <Text className="mb-2 text-[10px] font-black uppercase" style={{ color: tokens.text.muted }}>Estado</Text>
                  <AppTabs<StudentStatusFilter> compact role="teacher" accessibilityLabel="Filtrar estudiantes por estado" items={statusFilterOptions.map((option) => ({ key: option.value, label: option.label }))} value={directory.selectedStatus} onChange={directory.setSelectedStatus} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="mb-2 text-[10px] font-black uppercase" style={{ color: tokens.text.muted }}>Ordenar</Text>
                  <AppTabs<StudentSortKey> compact role="teacher" accessibilityLabel="Ordenar estudiantes" items={sortOptions.map((option) => ({ key: option.value, label: option.label }))} value={directory.selectedSort} onChange={directory.setSelectedSort} />
                </View>
              </View>
            </View>
          </View>

          <View className={isWide ? 'flex-row flex-wrap gap-4' : 'gap-4'}>
            <MetricCard semantic="student" title="Total estudiantes" value={String(stats.total)} detail="Calculado por la RPC" />
            <MetricCard semantic="attention" title="Necesitan atención" value={String(stats.needsHelp)} detail="Apoyo o inactividad" />
            <MetricCard icon="time-outline" title="Sin actividad" value={String(stats.noActivity)} detail="Pendientes de empezar" color={tokens.semantic.info} />
            <MetricCard semantic="success" title="Con actividad" value={String(stats.withActivity)} detail={`${stats.active} activos o excelentes`} />
          </View>

          <TeacherStudentPrioritySections attentionStudents={needsAttention} noActivityStudents={pendingStudents} onViewDetails={handleViewStudentDetails} onSendReminder={(student) => { void handleStudentMessage(student, 'reminder') }} />

          <View className="mt-5">
            <View className="mb-4 flex-row items-end justify-between gap-3">
              <View>
                <Text className="text-[20px] font-black" style={{ color: tokens.text.primary }}>Listado paginado</Text>
                <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>La base de datos devuelve únicamente esta página y sus agregados.</Text>
              </View>
              <Text className="text-[12px] font-black" style={{ color: tokens.brand.teacher }}>{directory.students.length} de {directory.total}</Text>
            </View>
            {directory.students.length ? (
              <TeacherStudentsDesktopTable students={directory.students} onViewDetails={handleViewStudentDetails} onViewHistory={handleViewHistory} onAssignActivity={handleAssignActivity} onOpenActions={setActionStudent} />
            ) : (
              <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
                <Ionicons name="people-outline" size={48} color={tokens.text.muted} />
                <Text className="mt-3 font-bold" style={{ color: tokens.text.primary }}>No hay estudiantes para mostrar</Text>
              </View>
            )}
            <StudentPaginationControls page={directory.page} pageCount={directory.pageCount} total={directory.total} pageSize={directory.pageSize} onPrevious={() => directory.setPage(Math.max(0, directory.page - 1))} onNext={() => directory.setPage(Math.min(directory.pageCount - 1, directory.page + 1))} />
          </View>
        </ScrollView>
      </View>
      {sharedModalProps}
    </View>
  )
}

function parseNumberParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value
  const number = Number(raw)
  return Number.isFinite(number) && number > 0 ? number : null
}

function parseStatusParam(value?: string | string[]): StudentStatusFilter {
  const raw = Array.isArray(value) ? value[0] : value
  return statusFilterOptions.some((option) => option.value === raw) ? raw as StudentStatusFilter : 'all'
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
