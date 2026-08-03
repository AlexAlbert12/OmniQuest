import React, { useMemo } from 'react';
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
import { formatRelativeDate, getInitials, getStatusMeta } from './studentUtils';
import { MobileEmptyState, MobileMetricCard, MobileScreen, MobileSectionHeader } from '../../ui/mobile';
import VirtualizedStack from '../../ui/VirtualizedStack'
import TeacherBottomNav from '../TeacherBottomNav';

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
  students,
  visibleStudents,
  pendingStudents,
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
  students: StudentRow[]
  visibleStudents: StudentRow[]
  pendingStudents: StudentRow[]
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
  const selectedStatusLabel = statusFilterOptions.find((option) => option.value === selectedStatus)?.label || 'Todos';
  const selectedSortLabel = sortOptions.find((option) => option.value === selectedSort)?.label || 'Actividad reciente';
  const attentionStudents = useMemo(
    () => visibleStudents.filter((student) => student.status === 'needs_help' || student.status === 'inactive'),
    [visibleStudents]
  );
  const mobileStatusOptions = statusFilterOptions.filter((option) => (
    option.value === 'all'
    || option.value === 'active'
    || option.value === 'no_activity'
    || option.value === 'needs_help'
  ));
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const paginatedStudents = visibleStudents;

  return (
    <MobileScreen
      contentLabel="Gestión de alumnos"
      backgroundColor="#020B1B"
      bottomNav={<TeacherBottomNav active="students" />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
    >
      <TeacherPageHeader
        icon="people"
        isDesktop={false}
        title="Mis alumnos"
        subtitle="Prioriza quién necesita atención hoy."
        notificationOnPress={onNotifications}
        className="mb-5"
      />

      <View className="mb-5 flex-row gap-3">
        <MobileSelectBox
          label="Curso"
          value={selectedSubjectId}
          allLabel="Todos"
          options={subjects.map((subject) => ({ id: subject.id, label: subject.name }))}
          onChange={onSelectSubject}
        />
        <MobileSelectBox
          label="Clase"
          value={selectedClassroomId}
          allLabel="Todas"
          options={classroomOptions.map((classroom) => ({ id: classroom.id, label: classroom.name }))}
          onChange={onSelectClassroom}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filtro actual: ${selectedStatusLabel}`}
          accessibilityHint="Cambia al siguiente estado de alumno"
          onPress={() => onSelectStatus(getNextStringOption(statusFilterOptions, selectedStatus))}
          className="h-[74px] w-[68px] items-center justify-center rounded-2xl border border-border-default bg-surface-default"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="options-outline" size={25} color="#DDE7F4" />
        </Pressable>
      </View>

      <View className="mb-5 flex-row gap-3">
        <MobileMetricCard
          compact
          className="flex-1"
          icon="alert-circle"
          label="Atención"
          value={attentionStudents.length}
          color="#F59E0B"
          detail="prioridad"
        />
        <MobileMetricCard
          compact
          className="flex-1"
          icon="time-outline"
          label="Sin actividad"
          value={stats.noActivity}
          color="#38A7FF"
          detail="pendientes"
        />
        <MobileMetricCard
          compact
          className="flex-1"
          icon="people"
          label="Total"
          value={stats.total}
          color="#8B5CF6"
          detail="filtrados"
        />
      </View>

      <MobileSectionHeader
        title="Necesitan atención"
        actionLabel={attentionStudents.length > 0 ? 'Ver filtro' : undefined}
        onAction={attentionStudents.length > 0 ? () => onSelectStatus('needs_help') : undefined}
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
              No hay alumnos marcados como prioritarios con los filtros actuales.
            </Text>
          </View>
        ) : null}
      </View>

      {pendingStudents.length > 0 ? (
        <MobilePendingAccessBanner
          count={pendingStudents.length}
          sendingReminder={sendingBulkReminders}
          onSendReminder={onSendReminder}
          onExport={onExportStudents}
        />
      ) : null}

      <View className="mt-6 flex-row gap-3">
        <View className="min-h-14 min-w-0 flex-1 flex-row items-center rounded-2xl border border-border-default bg-surface-default px-4">
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir filtros. Filtro actual: ${selectedStatusLabel}`}
          accessibilityHint="Cambia al siguiente filtro de estado"
          onPress={() => onSelectStatus(getNextStringOption(statusFilterOptions, selectedStatus))}
          className="min-h-14 flex-row items-center gap-2 rounded-2xl border border-border-default bg-surface-default px-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="filter-outline" size={22} color="#DDE7F4" />
          <Text className="font-black text-text-secondary">Filtros</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        {mobileStatusOptions.map((option) => (
          <MobileStudentFilterChip
            key={option.value}
            label={option.value === 'all' ? `Todos (${stats.total})` : `${option.label} (${getStatusCount(option.value, visibleStudents, stats)})`}
            icon={getFilterIcon(option.value)}
            active={selectedStatus === option.value}
            color={getFilterColor(option.value)}
            onPress={() => onSelectStatus(option.value)}
          />
        ))}
      </View>

      <View className="mb-3 mt-4 flex-row items-center justify-between gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Orden actual: ${selectedSortLabel}`}
          accessibilityHint="Cambia al siguiente criterio de ordenación"
          onPress={() => onSelectSort(getNextStringOption(sortOptions, selectedSort))}
          className="min-w-0 flex-1 flex-row items-center rounded-2xl border border-border-default bg-surface-default px-4 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Text className="text-[15px] text-text-secondary">Ordenar: </Text>
          <Text className="min-w-0 flex-1 text-[15px] font-black text-white" numberOfLines={2} maxFontSizeMultiplier={2}>{selectedSortLabel}</Text>
          <Ionicons name="chevron-down" size={17} color="#AFC2DB" />
        </Pressable>
        <View className="rounded-2xl border border-border-default bg-surface-default px-4 py-3">
          <Text className="text-[13px] font-black text-brand-teacher">{visibleStudents.length} en esta página · {total} en total</Text>
        </View>
      </View>

      <MobileSectionHeader
        title="Listado"
        actionLabel="Exportar"
        onAction={onExportStudents}
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
        accessibilityLabel="Estudiantes de la página"
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

function MobileSelectBox({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string
  value: number | 'all'
  allLabel: string
  options: { id: number; label: string }[]
  onChange: (value: number | 'all') => void
}) {
  const selectedIndex = value === 'all' ? -1 : options.findIndex((option) => option.id === value);
  const nextValue = selectedIndex >= options.length - 1 ? 'all' : options[selectedIndex + 1]?.id ?? 'all';
  const selectedLabel = value === 'all' ? allLabel : options.find((option) => option.id === value)?.label || allLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${selectedLabel}`}
      accessibilityHint="Cambia a la siguiente opción disponible"
      onPress={() => onChange(nextValue)}
      className="min-h-[74px] min-w-0 flex-1 justify-center rounded-2xl border border-border-default bg-surface-default px-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-semibold text-text-muted">{label}</Text>
          <Text className="mt-1 text-[16px] font-bold text-white" numberOfLines={2} maxFontSizeMultiplier={2}>{selectedLabel}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color="#C4D2E8" />
      </View>
    </Pressable>
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
    <LinearGradient
      colors={['#0D223F', '#07162C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="mt-6 rounded-2xl border border-border-default p-4"
    >
      <View className="flex-row items-center gap-3">
        <View className="min-h-12 min-w-12 items-center justify-center rounded-full bg-surface-selected">
          <Ionicons name="mail-unread-outline" size={24} color="#9FD6FF" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[17px] font-black text-white">Sin actividad</Text>
          <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
            {count} alumno{count === 1 ? '' : 's'} importado{count === 1 ? '' : 's'} todavía no han iniciado actividad.
          </Text>
        </View>
      </View>
      <View className="mt-4 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exportar alumnos sin actividad"
          accessibilityHint="Descarga el listado de alumnos pendientes de acceso"
          onPress={onExport}
          className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-default"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="download-outline" size={18} color="#DDE7F4" />
          <Text className="font-black text-text-secondary">Exportar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sendingReminder ? 'Enviando recordatorios' : 'Enviar recordatorios'}
          accessibilityHint="Envía un recordatorio a los alumnos sin actividad"
          accessibilityState={{ disabled: sendingReminder, busy: sendingReminder }}
          onPress={onSendReminder}
          disabled={sendingReminder}
          className="min-h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl bg-brand-student"
          style={({ pressed }) => ({ opacity: sendingReminder ? 0.62 : pressed ? 0.82 : 1 })}
        >
          {sendingReminder ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send-outline" size={18} color="#FFFFFF" />}
          <Text className="font-black text-white">{sendingReminder ? 'Enviando...' : 'Recordatorio'}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function MobileStudentFilterChip({
  label,
  icon,
  active,
  color,
  onPress,
}: {
  label: string
  icon: IconName
  active: boolean
  color: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filtrar por ${label}`}
      accessibilityHint="Actualiza el listado de alumnos"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-2 rounded-2xl border px-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
        borderColor: active ? '#7C5CFF' : '#1D3760',
        backgroundColor: active ? '#6D47F6' : '#07162C',
      })}
    >
      <Ionicons name={icon} size={17} color={active ? '#FFFFFF' : color} />
      <Text className={`text-[13px] font-black ${active ? 'text-white' : 'text-text-secondary'}`} numberOfLines={2} maxFontSizeMultiplier={2}>{label}</Text>
    </Pressable>
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
      className="rounded-2xl border border-border-default bg-surface-default p-4"
    >
      <View className="flex-row items-center gap-3">
        <View className="min-h-12 min-w-12 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(status.color, '35') }}>
          <Text className="text-[17px] font-black text-white">{getInitials(student.alias)}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="min-w-0 flex-1 text-[17px] font-black text-white" numberOfLines={2} maxFontSizeMultiplier={2}>{student.alias}</Text>
            <Text className="text-[12px] font-black" style={{ color: status.color }} numberOfLines={2} maxFontSizeMultiplier={2}>{status.label}</Text>
          </View>
          <Text className="mt-1 text-[13px] text-text-secondary" numberOfLines={2} maxFontSizeMultiplier={2}>
            {context ? context.subjectName : 'Sin curso asignado'}
          </Text>
        </View>
      </View>
      <View className="mt-3 gap-3">
        <Text className="text-[13px] leading-5 text-text-secondary">
          Precisión {student.hasActivity ? `${student.accuracyPercent}%` : '—'} · Participación {student.progress}%
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver detalle de ${student.alias}`}
            accessibilityHint="Abre el resumen completo del alumno"
            onPress={() => onViewDetails(student)}
            className="min-h-10 flex-1 items-center justify-center rounded-xl bg-brand-teacher px-3 py-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Text className="text-[12px] font-black text-white">Ver detalle</Text>
          </Pressable>
          <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Asignar repaso a ${student.alias}`}
          accessibilityHint="Abre la creación de una actividad de refuerzo"
          onPress={() => onAssignActivity(student)}
          className="rounded-xl border border-border-default bg-surface-interactive px-3 py-2"
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
    <LinearGradient
      colors={['#0B1E38', '#06162C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="rounded-2xl border border-border-default p-4"
    >
      <View className="flex-row items-start gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(progressColor, '47') }}>
          <Text className="text-[21px] font-black text-white">{getInitials(student.alias)}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start gap-2">
            <View className="min-w-0 flex-1">
              <Text className="text-[20px] font-black text-white" numberOfLines={2} maxFontSizeMultiplier={2}>{student.alias}</Text>
              <Text className="mt-1 text-[14px] leading-5 text-text-secondary" numberOfLines={2}>
                {context ? `${context.subjectName} · ${context.classroomName}` : student.handle}
              </Text>
            </View>
            <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: withAlpha(status.color, '2E') }}>
              <Text className="text-[11px] font-black" style={{ color: status.color }} numberOfLines={2} maxFontSizeMultiplier={2}>{status.label}</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mt-4 flex-row gap-2">
        <MobileStudentMiniMetric label="Precisión" value={student.hasActivity ? `${student.accuracyPercent}%` : '—'} color="#A879FF" icon="analytics" />
        <MobileStudentMiniMetric label="Participación" value={`${student.progress}%`} color={progressColor} icon="trending-up" />
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-default p-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={15} color="#9FB2CE" />
          <Text className="text-[13px] text-text-muted" numberOfLines={2} maxFontSizeMultiplier={2}>Última actividad: {formatRelativeDate(student.lastActivityAt)}</Text>
        </View>
        <Text className="text-[13px] font-black" style={{ color: progressColor }}>{student.progress}%</Text>
      </View>

      {student.status === 'no_activity' ? (
        <NoActivityQuickActions
          student={student}
          reminderBusy={reminderBusy}
          onSendReminder={onSendReminder}
          onRequestPasswordRecovery={onRequestPasswordRecovery}
        />
      ) : null}

      <View className="mt-4 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${student.alias}`}
          accessibilityHint="Abre el resumen completo del alumno"
          onPress={() => onViewDetails(student)}
          className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-student px-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="eye-outline" size={17} color="#FFFFFF" />
          <Text className="font-black text-white">Ver detalle</Text>
        </Pressable>
        <Pressable
          onPress={() => onAssignActivity(student)}
          className="min-h-12 min-w-12 items-center justify-center rounded-xl border border-border-default bg-surface-default"
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
          className="min-h-12 w-12 items-center justify-center rounded-xl border border-border-default bg-surface-default"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#DDE7F4" />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function MobileStudentMiniMetric({ label, value, color, icon }: { label: string; value: string; color: string; icon: IconName }) {
  return (
    <MobileMetricCard
      className="flex-1 rounded-xl"
      color={color}
      compact
      icon={icon}
      label={label}
      value={value}
    />
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

function getNextStringOption<T extends string>(options: { value: T; label: string }[], current: T) {
  const selectedIndex = options.findIndex((option) => option.value === current);
  return (options[selectedIndex >= options.length - 1 ? 0 : selectedIndex + 1] || options[0]).value;
}

function getStatusCount(status: StudentStatusFilter, students: StudentRow[], stats: MobileStudentsStats) {
  if (status === 'all') return stats.total;
  if (status === 'active') return stats.active;
  if (status === 'no_activity') return stats.noActivity;
  if (status === 'needs_help') return stats.needsHelp;
  return students.filter((student) => student.status === status).length;
}

function getFilterIcon(status: StudentStatusFilter): IconName {
  if (status === 'active') return 'checkmark-circle';
  if (status === 'no_activity') return 'time-outline';
  if (status === 'needs_help') return 'medkit-outline';
  if (status === 'excellent') return 'sparkles-outline';
  if (status === 'inactive') return 'pause-circle-outline';
  return 'grid-outline';
}

function getFilterColor(status: StudentStatusFilter) {
  if (status === 'active') return '#22D3A6';
  if (status === 'no_activity') return '#9FD6FF';
  if (status === 'needs_help') return '#F59E0B';
  if (status === 'excellent') return '#38BDF8';
  if (status === 'inactive') return '#94A3B8';
  return '#B9A7FF';
}
