import OmniLoadingScreen from '../../components/ui/OmniLoadingScreen'
import React from 'react'
import { RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import { useTeacherStudentsController } from './useTeacherStudentsController'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import AppButton from '../../components/ui/AppButton'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import AppTabs from '../../components/ui/AppTabs'
import MobileTeacherStudents from '../../components/teacher/students/MobileTeacherStudents'
import { StudentActionsModal, StudentDetailModal, ConfirmModal } from '../../components/teacher/students/StudentModals'
import { CycleSelectButton, MetricCard, StudentPaginationControls } from '../../components/teacher/students/TeacherStudentList'
import TeacherStudentsDesktopTable, { TeacherStudentPrioritySections } from '../../components/teacher/students/TeacherStudentsDesktop'
import { statusFilterOptions, sortOptions, type StudentSortKey, type StudentStatusFilter } from './types'

export default function TeacherStudentsScreen() {
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isDesktop = width >= 1080
  const isWide = width >= 900
  const pageSize = isDesktop ? 12 : 5
  const {
    directory, needsAttention, pendingStudents, stats, actionStudent, detailStudent, confirmDialog,
    reminderStudentIds, sendingBulkReminders, setActionStudent, setDetailStudent, setConfirmDialog,
    viewStudentDetails, viewHistory, assignActivity, requestRemoveFromClass, requestResetProgress,
    sendBulkReminder, sendStudentMessage, exportCurrentSelection, exportNoActivity, xpScopeLabel, openNotifications, signOut,
  } = useTeacherStudentsController(pageSize)

  if (directory.loading) return <OmniLoadingScreen />

  const sharedModalProps = (
    <>
      <StudentActionsModal
        student={actionStudent}
        visible={Boolean(actionStudent)}
        reminderBusy={actionStudent ? Boolean(reminderStudentIds[actionStudent.id]) : false}
        onClose={() => setActionStudent(null)}
        onViewDetails={viewStudentDetails}
        onViewHistory={viewHistory}
        onRemoveFromClass={requestRemoveFromClass}
        onResetProgress={requestResetProgress}
        onSendReminder={(student) => { void sendStudentMessage(student, 'reminder') }}
        onRequestPasswordRecovery={(student) => { void sendStudentMessage(student, 'recovery') }}
        onAssignActivity={(student) => { setActionStudent(null); assignActivity(student) }}
      />
      <StudentDetailModal
        student={detailStudent}
        visible={Boolean(detailStudent)}
        reminderBusy={detailStudent ? Boolean(reminderStudentIds[detailStudent.id]) : false}
        onClose={() => setDetailStudent(null)}
        onAssignActivity={(student) => { setDetailStudent(null); assignActivity(student) }}
        onViewHistory={viewHistory}
        onRemoveFromClass={requestRemoveFromClass}
        onSendReminder={(student) => { void sendStudentMessage(student, 'reminder') }}
        onRequestPasswordRecovery={(student) => { void sendStudentMessage(student, 'recovery') }}
        xpLabel={xpScopeLabel}
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
          visibleStudents={directory.students}
          attentionStudents={needsAttention}
          refreshing={directory.refreshing}
          sendingBulkReminders={sendingBulkReminders}
          reminderStudentIds={reminderStudentIds}
          onRefresh={directory.refresh}
          onSelectSubject={directory.setSelectedSubjectId}
          onSelectClassroom={directory.setSelectedClassroomId}
          onSelectStatus={directory.setSelectedStatus}
          onSelectSort={directory.setSelectedSort}
          onSearch={directory.setSearch}
          onExportStudents={exportCurrentSelection}
          onExportNoActivity={exportNoActivity}
          onSendReminder={() => { void sendBulkReminder() }}
          onViewDetails={viewStudentDetails}
          onAssignActivity={assignActivity}
          onOpenActions={setActionStudent}
          onSendStudentReminder={(student) => { void sendStudentMessage(student, 'reminder') }}
          onRequestPasswordRecovery={(student) => { void sendStudentMessage(student, 'recovery') }}
          onNotifications={() => openNotifications()}
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
        <TeacherSidebar activeSection="students" subjectsCount={directory.subjects.length} onSignOut={signOut} />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={directory.refreshing} onRefresh={directory.refresh} tintColor={tokens.brand.teacher} />}
        >
          <TeacherPageHeader
            icon="people"
            isDesktop
            title="Alumnos"
            subtitle="Consulta y realiza el seguimiento de tus alumnos."
            notificationOnPress={() => openNotifications()}
          />

          {directory.error ? <AppStatusBanner variant="danger" title="No se pudo cargar el directorio" message={directory.error} actionLabel="Reintentar" onAction={directory.reload} /> : null}

          <View className="mb-4 mt-4 rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
            <View style={{ gap: 12 }}>
              <View className="flex-row flex-wrap items-center gap-3" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <CycleSelectButton label="Curso" value={directory.selectedSubjectId} allLabel="Todos" options={directory.subjects.map((subject) => ({ id: subject.id, label: subject.name }))} onChange={directory.setSelectedSubjectId} />
                <CycleSelectButton label="Clase" value={directory.selectedClassroomId} allLabel="Todas" options={directory.classroomOptions.map((classroom) => ({ id: classroom.id, label: classroom.name }))} onChange={directory.setSelectedClassroomId} />
                <View className="h-12 min-w-[300px] flex-1 flex-row items-center rounded-xl border px-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
                  <TextInput accessibilityLabel="Buscar alumno, curso o clase" className="min-w-0 flex-1" style={{ color: tokens.text.primary }} placeholder="Buscar alumno, curso o clase..." placeholderTextColor={tokens.text.muted} value={directory.search} onChangeText={directory.setSearch} />
                  <Ionicons name="search-outline" size={20} color={tokens.text.muted} />
                </View>
                <AppButton label="Exportar selección" icon="download-outline" variant="secondary" disabled={!stats.total} onPress={exportCurrentSelection} />
              </View>
              <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 12 }}>
                <View className="min-w-0 flex-1">
                  <Text className="mb-2 text-[10px] font-black uppercase" style={{ color: tokens.text.muted }}>Estado</Text>
                  <AppTabs<StudentStatusFilter> compact role="teacher" accessibilityLabel="Filtrar alumnos por estado" items={statusFilterOptions.map((option) => ({ key: option.value, label: option.label }))} value={directory.selectedStatus} onChange={directory.setSelectedStatus} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="mb-2 text-[10px] font-black uppercase" style={{ color: tokens.text.muted }}>Ordenar</Text>
                  <AppTabs<StudentSortKey> compact role="teacher" accessibilityLabel="Ordenar alumnos" items={sortOptions.map((option) => ({ key: option.value, label: option.label }))} value={directory.selectedSort} onChange={directory.setSelectedSort} />
                </View>
              </View>
            </View>
          </View>

          <View className={isWide ? 'flex-row flex-wrap gap-4' : 'gap-4'}>
            <MetricCard semantic="student" title="Total alumnos" value={String(stats.total)} detail="Alumnos en la selección actual" />
            <MetricCard semantic="attention" title="Necesitan atención" value={String(stats.attention)} detail="Baja precisión o inactividad prolongada" />
            <MetricCard icon="time-outline" title="Sin actividad" value={String(stats.noActivity)} detail="Pendientes de empezar" color={tokens.semantic.info} />
            <MetricCard semantic="success" title="Con actividad" value={String(stats.withActivity)} detail={`${stats.active} activos · ${stats.excellent} excelentes · ${stats.attention} en seguimiento`} />
          </View>

          <TeacherStudentPrioritySections attentionStudents={needsAttention} attentionTotal={stats.attention} noActivityStudents={pendingStudents} noActivityTotal={stats.noActivity} onViewDetails={viewStudentDetails} onSendReminder={(student) => { void sendStudentMessage(student, 'reminder') }} />

          <View className="mt-5">
            <View className="mb-4 flex-row items-end justify-between gap-3">
              <View>
                <Text className="text-[20px] font-black" style={{ color: tokens.text.primary }}>Listado de alumnos</Text>
                <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>Consulta y gestiona los alumnos según los filtros seleccionados.</Text>
              </View>
              <Text className="text-[12px] font-black" style={{ color: tokens.brand.teacher }}>{directory.students.length} de {directory.total}</Text>
            </View>
            {directory.students.length ? (
              <TeacherStudentsDesktopTable students={directory.students} onViewDetails={viewStudentDetails} onViewHistory={viewHistory} onAssignActivity={assignActivity} onOpenActions={setActionStudent} />
            ) : (
              <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
                <Ionicons name="people-outline" size={48} color={tokens.text.muted} />
                <Text className="mt-3 font-bold" style={{ color: tokens.text.primary }}>No hay alumnos para mostrar</Text>
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

