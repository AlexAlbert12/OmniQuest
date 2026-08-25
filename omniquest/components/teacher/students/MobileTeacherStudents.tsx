import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TeacherPageHeader from '../TeacherPageHeader';
import { withAlpha } from '../../../lib/color';
import {
  statusFilterOptions,
  sortOptions,
  type Classroom,
  type IconName,
  type MobileStudentsStats,
  type StudentRow,
  type StudentSortKey,
  type StudentStatusFilter,
  type Subject,
} from './types';
import { NoActivityQuickActions } from './TeacherStudentList';
import { formatRelativeDate, getStatusMeta } from './studentUtils';
import StudentProfileAvatar from './StudentProfileAvatar';
import { MobileEmptyState, MobileScreen, MobileSectionHeader } from '../../ui/mobile';
import VirtualizedStack from '../../ui/VirtualizedStack'
import TeacherBottomNav from '../TeacherBottomNav';
import AppDropdown from '../../ui/AppDropdown';

const MOBILE_STUDENTS_PAGE_SIZE = 5;

export default function MobileTeacherStudents({
  subjects,
  classroomOptions,
  selectedSubjectId,
  selectedClassroomId,
  selectedStatus,
  selectedSort,
  search,
  stats,
  visibleStudents,
  attentionStudents,
  refreshing,
  sendingBulkReminders,
  reminderStudentIds,
  onRefresh,
  onSelectSubject,
  onSelectClassroom,
  onSelectStatus,
  onSelectSort,
  onSearch,
  onExportStudents,
  onExportNoActivity,
  onSendReminder,
  onViewDetails,
  onAssignActivity,
  onOpenActions,
  onSendStudentReminder,
  onRequestPasswordRecovery,
  onNotifications,
  page,
  pageCount,
  total,
  pageSize,
  onPreviousPage,
  onNextPage,
}: {
  subjects: Subject[]
  classroomOptions: Classroom[]
  selectedSubjectId: number | 'all'
  selectedClassroomId: number | 'all'
  selectedStatus: StudentStatusFilter
  selectedSort: StudentSortKey
  search: string
  stats: MobileStudentsStats
  visibleStudents: StudentRow[]
  attentionStudents: StudentRow[]
  refreshing: boolean
  sendingBulkReminders: boolean
  reminderStudentIds: Record<string, boolean>
  onRefresh: () => void
  onSelectSubject: (value: number | 'all') => void
  onSelectClassroom: (value: number | 'all') => void
  onSelectStatus: (value: StudentStatusFilter) => void
  onSelectSort: (value: StudentSortKey) => void
  onSearch: (value: string) => void
  onExportStudents: () => void
  onExportNoActivity: () => void
  onSendReminder: () => void
  onViewDetails: (student: StudentRow) => void
  onAssignActivity: (student: StudentRow) => void
  onOpenActions: (student: StudentRow) => void
  onSendStudentReminder: (student: StudentRow) => void
  onRequestPasswordRecovery: (student: StudentRow) => void
  onNotifications: () => void
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const paginatedStudents = visibleStudents;
  const subjectOptions = [{ value: 'all' as const, label: 'Todos', icon: 'book-outline' as const }, ...subjects.map((subject) => ({ value: subject.id, label: subject.name, icon: 'book-outline' as const }))];
  const classOptions = [{ value: 'all' as const, label: 'Todas', icon: 'people-outline' as const }, ...classroomOptions.map((classroom) => ({ value: classroom.id, label: classroom.name, icon: 'people-outline' as const }))];
  const statusOptions = statusFilterOptions.map((option) => ({ value: option.value, label: `${option.label} (${getStatusCount(option.value, stats)})`, icon: 'pulse-outline' as const }));
  const orderOptions = sortOptions.map((option) => ({ value: option.value, label: option.label, icon: 'swap-vertical-outline' as const }));

  return (
    <MobileScreen
      contentLabel="Gestión de alumnos"
      bottomNav={<TeacherBottomNav active="students" />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
    >
      <TeacherPageHeader
        icon="people"
        isDesktop={false}
        title="Mis alumnos"
        titleNumberOfLines={1}
        compactMobileTitle
        subtitle="Prioriza quién necesita atención hoy."
        notificationOnPress={onNotifications}
        className="mb-5"
      />

      <View className="mb-4 flex-row gap-2">
        <DirectoryMetric icon="alert-circle" label="Atención" value={stats.attention} color="#F59E0B" />
        <DirectoryMetric icon="time-outline" label="Sin actividad" value={stats.noActivity} color="#38A7FF" />
        <DirectoryMetric icon="people" label="Total" value={stats.total} color="#8B5CF6" />
      </View>

      <MobileSectionHeader
        title="Necesitan atención"
        icon="medkit-outline"
        iconColor="#F59E0B"
        className="mb-3"
      />

      <View style={{ gap: 10 }}>
        {attentionStudents.slice(0, 3).map((student) => (
          <MobileAttentionStudentCard
            key={student.id}
            student={student}
            onViewDetails={onViewDetails}
            onAssignActivity={onAssignActivity}
          />
        ))}
        {attentionStudents.length === 0 ? (
          <View className="rounded-2xl border border-border-default bg-surface-default p-4">
            <Text className="text-[16px] font-black text-white">Todo bajo control</Text>
            <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
              No hay alumnos marcados como prioritarios con la selección actual.
            </Text>
          </View>
        ) : null}
        {attentionStudents.length > 0 && attentionStudents.length < stats.attention ? (
          <Text className="text-[12px] text-text-muted">Mostrando {Math.min(3, attentionStudents.length)} de {stats.attention} alumnos que necesitan atención.</Text>
        ) : null}
      </View>

      {stats.noActivity > 0 ? (
        <MobilePendingAccessBanner
          count={stats.noActivity}
          sendingReminder={sendingBulkReminders}
          onSendReminder={onSendReminder}
          onExport={onExportNoActivity}
        />
      ) : null}

      <View className="mt-6 mb-6 min-h-14 flex-row items-center rounded-2xl border border-border-default bg-surface-default px-4">
        <Ionicons name="search-outline" size={24} color="#C4D2E8" />
        <TextInput
          accessibilityLabel="Buscar alumno"
          accessibilityHint="Filtra el listado por nombre, usuario o correo"
          className="min-w-0 flex-1 px-3 text-[16px] text-white"
          placeholder="Buscar alumno..."
          placeholderTextColor="#7F92B2"
          value={search}
          onChangeText={onSearch}
        />
      </View>

      <View className="mb-5 flex-row items-end gap-1.5">
        <View className="min-w-0 flex-1">
          <AppDropdown<number | 'all'> label="Curso" compact role="teacher" accessibilityLabel="Seleccionar curso" value={selectedSubjectId} options={subjectOptions} onChange={onSelectSubject} />
        </View>
        <View className="min-w-0 flex-1">
          <AppDropdown<number | 'all'> label="Clase" compact role="teacher" accessibilityLabel="Seleccionar clase" value={selectedClassroomId} options={classOptions} onChange={onSelectClassroom} />
        </View>
        <View className="min-w-0 flex-1">
          <AppDropdown<StudentStatusFilter> label="Estado" compact role="teacher" accessibilityLabel="Filtrar alumnos por estado" value={selectedStatus} options={statusOptions} onChange={onSelectStatus} />
        </View>
        <View className="min-w-0 flex-1">
          <AppDropdown<StudentSortKey> label="Ordenar" compact role="teacher" accessibilityLabel="Ordenar alumnos" value={selectedSort} options={orderOptions} onChange={onSelectSort} />
        </View>
      </View>

      <MobileSectionHeader
        title="Listado"
        className="mb-3 mt-1"
      />

      <VirtualizedStack
        data={paginatedStudents}
        keyExtractor={(student) => student.id}
        renderItem={(student) => (
          <MobileTeacherStudentCard
            student={student}
            reminderBusy={Boolean(reminderStudentIds[student.id])}
            onViewDetails={onViewDetails}
            onAssignActivity={onAssignActivity}
            onOpenActions={onOpenActions}
            onSendReminder={onSendStudentReminder}
            onRequestPasswordRecovery={onRequestPasswordRecovery}
          />
        )}
        accessibilityLabel="Alumnos de la página"
      />

      <MobileStudentsPagination
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPrevious={onPreviousPage}
        onNext={onNextPage}
      />

      {visibleStudents.length === 0 ? (
        <MobileStudentsEmptyState />
      ) : null}
    </MobileScreen>
  );
}

function DirectoryMetric({
  color,
  icon,
  label,
  value,
}: {
  color: string
  icon: IconName
  label: string
  value: number
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="min-w-0 flex-1 rounded-xl border px-2.5 py-2.5"
      style={{ minHeight: 82, borderColor: withAlpha(color, '70'), backgroundColor: withAlpha(color, '18') }}
    >
      <View className="h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: withAlpha(color, '2E') }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text className="mt-1.5 text-[21px] font-black text-white" numberOfLines={1}>{value}</Text>
      <Text className="text-[10px] font-bold text-text-secondary" numberOfLines={1}>{label}</Text>
    </View>
  );
}

function MobilePendingAccessBanner({
  count,
  sendingReminder,
  onSendReminder,
  onExport,
}: {
  count: number
  sendingReminder: boolean
  onSendReminder: () => void
  onExport: () => void
}) {
  return (
    <View className="mt-5 rounded-2xl border border-border-default" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#0D223F', '#07162C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-3"
      >
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-selected">
          <Ionicons name="mail-unread-outline" size={20} color="#9FD6FF" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-black text-white">Sin actividad</Text>
          <Text className="mt-0.5 text-[12px] leading-4 text-text-secondary">
            {count} alumno{count === 1 ? '' : 's'} todavía no han iniciado actividad en la selección actual.
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exportar todos los alumnos sin actividad"
          accessibilityHint="Descarga el listado de alumnos pendientes de acceso"
          onPress={onExport}
          className="min-h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border-default bg-surface-default px-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="download-outline" size={18} color="#DDE7F4" />
          <Text className="text-[11px] font-black text-text-secondary">Exportar sin actividad</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sendingReminder ? 'Enviando recordatorios' : 'Enviar recordatorios'}
          accessibilityHint="Envía un recordatorio a los alumnos sin actividad"
          accessibilityState={{ disabled: sendingReminder, busy: sendingReminder }}
          onPress={onSendReminder}
          disabled={sendingReminder}
          className="min-h-10 flex-[1.25] flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-student px-2"
          style={({ pressed }) => ({ opacity: sendingReminder ? 0.62 : pressed ? 0.82 : 1 })}
        >
          {sendingReminder ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send-outline" size={18} color="#FFFFFF" />}
          <Text className="text-[12px] font-black text-white">{sendingReminder ? 'Enviando...' : `Recordar a ${count}`}</Text>
        </Pressable>
      </View>
      </LinearGradient>
    </View>
  );
}

function MobileAttentionStudentCard({
  student,
  onViewDetails,
  onAssignActivity,
}: {
  student: StudentRow
  onViewDetails: (student: StudentRow) => void
  onAssignActivity: (student: StudentRow) => void
}) {
  const status = getStatusMeta(student.status);
  const context = student.courseContexts[0];

  return (
    <View
      accessibilityLabel={`${student.alias}. ${status.label}. Precisión ${student.hasActivity ? `${student.accuracyPercent}%` : 'sin datos'}. Participación ${student.progress}%`}
      className="rounded-2xl border border-border-default bg-surface-default p-3"
    >
      <View className="flex-row items-center gap-3">
        <StudentProfileAvatar alias={student.alias} avatar={student.avatar} size={40} accentColor={status.color} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="min-w-0 flex-1 text-[15px] font-black text-white" numberOfLines={1} maxFontSizeMultiplier={2}>{student.alias}</Text>
            <Text className="text-[10px] font-black" style={{ color: status.color }} numberOfLines={1} maxFontSizeMultiplier={2}>{status.label}</Text>
          </View>
          <Text className="mt-0.5 text-[12px] text-text-secondary" numberOfLines={1} maxFontSizeMultiplier={2}>
            {context ? context.subjectName : 'Sin curso asignado'}
          </Text>
        </View>
      </View>
      <View className="mt-2 gap-2">
        <Text className="text-[12px] leading-4 text-text-secondary">
          Precisión {student.hasActivity ? `${student.accuracyPercent}%` : '—'} · Participación {student.progress}%
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver detalle de ${student.alias}`}
            accessibilityHint="Abre el resumen completo del alumno"
            onPress={() => onViewDetails(student)}
            className="min-h-9 flex-1 items-center justify-center rounded-xl bg-brand-teacher px-3 py-1.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Text className="text-[12px] font-black text-white">Ver detalle</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Asignar repaso a ${student.alias}`}
            accessibilityHint="Abre la creación de una actividad de refuerzo"
            onPress={() => onAssignActivity(student)}
            className="min-h-9 justify-center rounded-xl border border-border-default bg-surface-interactive px-3 py-1.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Text className="text-[12px] font-black text-brand-teacher">Repasar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MobileTeacherStudentCard({
  student,
  reminderBusy,
  onViewDetails,
  onAssignActivity,
  onOpenActions,
  onSendReminder,
  onRequestPasswordRecovery,
}: {
  student: StudentRow
  reminderBusy: boolean
  onViewDetails: (student: StudentRow) => void
  onAssignActivity: (student: StudentRow) => void
  onOpenActions: (student: StudentRow) => void
  onSendReminder: (student: StudentRow) => void
  onRequestPasswordRecovery: (student: StudentRow) => void
}) {
  const status = getStatusMeta(student.status);
  const context = student.courseContexts[0];
  const progressColor = student.progress >= 80 ? '#22D3A6' : student.status === 'needs_help' ? '#F59E0B' : status.color;

  return (
    <View className="rounded-2xl border border-border-default" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#0B1E38', '#06162C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-3"
      >
      <View className="flex-row items-start gap-3">
        <StudentProfileAvatar alias={student.alias} avatar={student.avatar} size={44} accentColor={progressColor} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start gap-2">
            <View className="min-w-0 flex-1">
              <Text className="text-[17px] font-black text-white" numberOfLines={1} maxFontSizeMultiplier={2}>{student.alias}</Text>
              <Text className="mt-0.5 text-[12px] leading-4 text-text-secondary" numberOfLines={1}>
                {context ? `${context.subjectName} · ${context.classroomName}` : student.handle}
              </Text>
            </View>
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: withAlpha(status.color, '2E') }}>
              <Text className="text-[10px] font-black" style={{ color: status.color }} numberOfLines={1} maxFontSizeMultiplier={2}>{status.label}</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mt-3 flex-row gap-2">
        <MobileStudentMiniMetric label="Precisión" value={student.hasActivity ? `${student.accuracyPercent}%` : '—'} color="#A879FF" icon="analytics" />
        <MobileStudentMiniMetric label="Participación" value={`${student.progress}%`} color={progressColor} icon="trending-up" />
      </View>

      <View className="mt-3 flex-row items-center justify-between gap-2 rounded-xl border border-border-default bg-surface-default px-3 py-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={15} color="#9FB2CE" />
          <Text className="text-[11px] text-text-muted" numberOfLines={1} maxFontSizeMultiplier={2}>Última actividad: {formatRelativeDate(student.lastActivityAt)}</Text>
        </View>
        <Text className="text-[12px] font-black" style={{ color: progressColor }}>{student.progress}%</Text>
      </View>

      {student.status === 'no_activity' ? (
        <NoActivityQuickActions
          student={student}
          reminderBusy={reminderBusy}
          onSendReminder={onSendReminder}
          onRequestPasswordRecovery={onRequestPasswordRecovery}
        />
      ) : null}

      <View className="mt-3 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${student.alias}`}
          accessibilityHint="Abre el resumen completo del alumno"
          onPress={() => onViewDetails(student)}
          className="min-h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-student px-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="eye-outline" size={17} color="#FFFFFF" />
          <Text className="font-black text-white">Ver detalle</Text>
        </Pressable>
        <Pressable
          onPress={() => onAssignActivity(student)}
          className="min-h-10 min-w-10 items-center justify-center rounded-xl border border-border-default bg-surface-default"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          accessibilityRole="button"
          accessibilityLabel={`Asignar repaso a ${student.alias}`}
          accessibilityHint="Abre la creación de una actividad de refuerzo"
        >
          <Ionicons name="locate-outline" size={18} color="#DDE7F4" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Más acciones para ${student.alias}`}
          accessibilityHint="Abre el menú de acciones del alumno"
          onPress={() => onOpenActions(student)}
          className="min-h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-surface-default"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#DDE7F4" />
        </Pressable>
      </View>
      </LinearGradient>
    </View>
  );
}

function MobileStudentMiniMetric({ label, value, color, icon }: { label: string; value: string; color: string; icon: IconName }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="min-w-0 flex-1 rounded-xl border px-3 py-2"
      style={{ borderColor: withAlpha(color, '70'), backgroundColor: withAlpha(color, '18') }}
    >
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={14} color={color} />
        <Text className="min-w-0 flex-1 text-[10px] font-bold text-text-secondary" numberOfLines={1}>{label}</Text>
      </View>
      <Text className="mt-1 text-[18px] font-black" style={{ color }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MobileStudentsPagination({
  page,
  pageCount,
  total,
  onPrevious,
  onNext,
  pageSize = MOBILE_STUDENTS_PAGE_SIZE,
}: {
  page: number
  pageCount: number
  total: number
  pageSize?: number
  onPrevious: () => void
  onNext: () => void
}) {
  if (total <= pageSize) return null;

  const start = page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  return (
    <View className="mt-4 flex-row items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-default p-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Página anterior de alumnos"
        accessibilityHint="Muestra los alumnos anteriores"
        accessibilityState={{ disabled: page === 0 }}
        onPress={onPrevious}
        disabled={page === 0}
        className="min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-default bg-surface-default"
        style={({ pressed }) => ({ opacity: page === 0 ? 0.45 : pressed ? 0.82 : 1 })}
      >
        <Ionicons name="chevron-back" size={20} color="#DDE7F4" />
      </Pressable>
      <View className="min-w-0 flex-1 items-center">
        <Text className="text-[14px] font-black text-white">{start}-{end} de {total}</Text>
        <Text className="mt-0.5 text-[12px] text-text-muted">Página {page + 1} de {pageCount}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Página siguiente de alumnos"
        accessibilityHint="Muestra los siguientes alumnos"
        accessibilityState={{ disabled: page >= pageCount - 1 }}
        onPress={onNext}
        disabled={page >= pageCount - 1}
        className="min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-default bg-surface-default"
        style={({ pressed }) => ({ opacity: page >= pageCount - 1 ? 0.45 : pressed ? 0.82 : 1 })}
      >
        <Ionicons name="chevron-forward" size={20} color="#DDE7F4" />
      </Pressable>
    </View>
  );
}

function MobileStudentsEmptyState() {
  return (
    <MobileEmptyState
      icon="people-outline"
      omniState="normal"
      omniSize={72}
      title="No hay alumnos para mostrar"
      description="Cambia los filtros o busca otro nombre para revisar la lista."
      color="#8B5CF6"
      className="mt-4"
    />
  );
}

function getStatusCount(status: StudentStatusFilter, stats: MobileStudentsStats) {
  if (status === 'all') return stats.total;
  if (status === 'attention') return stats.attention;
  if (status === 'active') return stats.active;
  if (status === 'excellent') return stats.excellent;
  if (status === 'inactive') return stats.inactive;
  if (status === 'no_activity') return stats.noActivity;
  if (status === 'needs_help') return stats.needsHelp;
  return 0;
}
