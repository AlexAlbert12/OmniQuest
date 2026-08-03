import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MobileMetricCard from '../../ui/mobile/MobileMetricCard'
import PaginationControls from '../../ui/PaginationControls'
import VirtualizedStack from '../../ui/VirtualizedStack'
import {
  getGradeColor,
  getInitials,
  getNextStudentSortKey,
  getNextStudentStatusFilter,
  getStudentSortLabel,
  getStudentStatus,
  getStudentStatusFilterLabel,
  getStudentStatusMeta,
  slugifyStudentName,
  type StudentReport,
  type StudentSortKey,
  type StudentStatusFilter,
  type SubjectScore,
} from '../../../lib/teacherSubjectAnalytics';
import { SubjectPanel, GradeDistributionBars, type IconName } from './SubjectShared';

export function SubjectStudentsTab({
  averageXp,
  enrollmentsCount,
  gradeDistribution,
  isDesktop,
  isWide,
  onImportStudents,
  onPageChange,
  onStudentSearchChange,
  onStudentSortKeyChange,
  onStudentStatusFilterChange,
  page,
  pageSize,
  questionsCount,
  reportParticipation,
  scorePerformanceCount,
  scores,
  studentListRows,
  studentReportRows,
  studentSearch,
  studentSortKey,
  studentStatusFilter,
  totalStudents,
}: {
  isDesktop: boolean
  isWide: boolean
  enrollmentsCount: number
  studentReportRows: StudentReport[]
  studentListRows: StudentReport[]
  studentSearch: string
  studentStatusFilter: StudentStatusFilter
  studentSortKey: StudentSortKey
  reportParticipation: number
  averageXp: number
  page: number
  pageSize: number
  questionsCount: number
  scores: SubjectScore[]
  gradeDistribution: { label: string; color: string; count: number }[]
  scorePerformanceCount: number
  totalStudents: number
  onStudentSearchChange: (value: string) => void
  onStudentStatusFilterChange: (value: StudentStatusFilter) => void
  onStudentSortKeyChange: (value: StudentSortKey) => void
  onImportStudents: () => void
  onPageChange: (page: number) => void
}) {
  const activeStudents = studentReportRows.filter((student) => getStudentStatus(student) === 'active').length;
  const studentsNeedingAttention = studentReportRows.filter((student) => getStudentStatus(student) === 'needs_help');
  const bestStudent = studentReportRows.find((student) => student.hasActivity);
  const generatedXp = scores.reduce((total, score) => total + (score.max_score ?? 0), 0);

  return (
    <View className={isDesktop ? 'flex-row gap-6' : 'gap-6'}>
      <View className={isDesktop ? 'flex-[1.55] gap-5' : 'gap-5'}>
        <View className={isWide ? 'flex-row gap-4' : 'gap-4'}>
          <StudentMetricCard icon="people" label="Alumnos inscritos" value={String(enrollmentsCount)} detail={`${studentReportRows.length} en esta página`} color="#8B5CF6" />
          <StudentMetricCard icon="checkmark-circle" label="Activos esta semana" value={String(activeStudents)} detail={`${reportParticipation}% del total`} color="#34D399" />
          <StudentMetricCard icon="star" label="XP media de la clase" value={`${averageXp} XP`} detail="Media de puntos con bonus" color="#3B82F6" />
          <StudentMetricCard icon="trophy" label="Mejor en esta página" value={`${bestStudent?.score ?? 0} XP`} detail={bestStudent?.name || 'Sin actividad'} color="#F59E0B" />
        </View>

        <View className="rounded-xl border border-border-default bg-surface-default p-4">
          <View className="mb-4 flex-row flex-wrap items-center gap-3">
            <View className="h-11 min-w-[220px] flex-1 flex-row items-center rounded-lg border border-border-default bg-surface-default px-3">
              <TextInput
                className="min-w-0 flex-1 text-[13px] text-white"
                placeholder="Buscar alumno..."
                placeholderTextColor="#60799C"
                value={studentSearch}
                onChangeText={onStudentSearchChange}
              />
              <Ionicons name="search-outline" size={17} color="#8FA7C7" />
            </View>
            <InlineSelect
              label={`Estado: ${getStudentStatusFilterLabel(studentStatusFilter)}`}
              icon="chevron-down"
              onPress={() => onStudentStatusFilterChange(getNextStudentStatusFilter(studentStatusFilter))}
            />
            <InlineSelect
              label={`Ordenar por: ${getStudentSortLabel(studentSortKey)}`}
              icon="chevron-down"
              onPress={() => onStudentSortKeyChange(getNextStudentSortKey(studentSortKey))}
            />
            <Pressable
              onPress={onImportStudents}
              className="h-11 flex-row items-center gap-2 rounded-lg px-4"
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: '#6D5AF6',
                backgroundColor: '#111B3D',
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Ionicons name="person-add-outline" size={17} color="#C4B5FD" />
              <Text className="text-[12px] font-black text-brand-teacher">Importar alumnos</Text>
            </Pressable>
          </View>

          <View className="hidden flex-row border-b border-border-default px-2 pb-3 md:flex">
            <StudentTableHeader label="Pos." flex={0.35} />
            <StudentTableHeader label="Alumno" flex={1.4} />
            <StudentTableHeader label="Progreso" flex={1} />
            <StudentTableHeader label="XP" flex={0.75} />
            <StudentTableHeader label="Retos" flex={0.55} />
            <StudentTableHeader label="Nota media" flex={0.8} />
            <StudentTableHeader label="Estado" flex={0.85} />
            <StudentTableHeader label="Última actividad" flex={0.9} />
          </View>

          <VirtualizedStack
            data={studentListRows}
            keyExtractor={(student) => student.id}
            renderItem={(student, index) => <StudentClassRow student={student} index={(page * pageSize) + index} mobile={!isWide} />}
            emptyComponent={(
              <View className="items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-default p-8">
                <Ionicons name="people-outline" size={44} color="#64748B" />
                <Text className="mt-3 text-center font-bold text-white">No hay alumnos para mostrar</Text>
                <Text className="mt-1 text-center text-[12px] text-text-muted">Comparte el código de la clase o cambia los filtros.</Text>
              </View>
            )}
            accessibilityLabel="Alumnos del curso"
          />

          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={totalStudents}
            onPrevious={() => onPageChange(Math.max(0, page - 1))}
            onNext={() => onPageChange(page + 1)}
          />
          <Text className="mt-2 text-right text-[11px] text-text-muted">
            Mostrando {studentListRows.length} de {totalStudents} alumnos
          </Text>
        </View>
      </View>

      <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
        <SubjectPanel title="Distribución de notas">
          <GradeDistributionBars distribution={gradeDistribution} total={scorePerformanceCount} />
        </SubjectPanel>

        <SubjectPanel title="Actividad de la clase">
          <ProgressLine label="Alumnos activos" value={activeStudents} total={Math.max(studentReportRows.length, 1)} color="#8B5CF6" />
          <ProgressLine label="Retos completados" value={studentReportRows.reduce((total, student) => total + student.playedSessions, 0)} total={Math.max(studentReportRows.length * Math.max(questionsCount, 1), 1)} color="#7C5CFF" />
          <ProgressLine label="XP generado" value={generatedXp} total={Math.max(generatedXp + 500, 1)} color="#3B82F6" />
        </SubjectPanel>

        <SubjectPanel title="Alumnos que necesitan atención" actionLabel="Ver todo">
          <View style={{ gap: 12 }}>
            {studentsNeedingAttention.slice(0, 4).map((student) => (
              <StudentAttentionItem key={student.id} student={student} />
            ))}
            {studentsNeedingAttention.length === 0 ? (
              <Text className="text-[12px] text-text-muted">No hay alumnos en riesgo ahora mismo.</Text>
            ) : null}
          </View>
        </SubjectPanel>

        <View className="rounded-xl border border-border-default bg-surface-raised p-5">
          <View className="flex-row gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-teacher">
              <Ionicons name="bulb-outline" size={19} color="#FFFFFF" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-black text-white">Consejo para profesores</Text>
              <Text className="mt-2 text-[12px] leading-5 text-text-secondary">
                Revisa alumnos con baja participación y anímalos a completar retos pendientes.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function StudentMetricCard({ icon, label, value, detail, color }: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  detail?: string
  color: string
}) {
  return (
    <MobileMetricCard
      className="min-w-[190px] flex-1"
      color={color}
      detail={detail}
      icon={icon}
      label={label}
      value={value}
    />
  )
}

function InlineSelect({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-11 flex-row items-center gap-2 rounded-lg border border-border-default bg-surface-default px-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <Text className="text-[12px] font-semibold text-text-secondary">{label}</Text>
      <Ionicons name={icon} size={15} color="#8FA7C7" />
    </Pressable>
  );
}

function StudentTableHeader({ label, flex }: { label: string; flex: number }) {
  return (
    <Text className="text-[10px] font-black uppercase text-text-muted" style={{ flex }}>
      {label}
    </Text>
  );
}

function StudentClassRow({ student, index, mobile = false }: { student: StudentReport; index: number; mobile?: boolean }) {
  const status = getStudentStatus(student);
  const statusMeta = getStudentStatusMeta(status);
  const gradeColor = getGradeColor(student.grade);

  if (mobile) {
    return (
      <View className="rounded-2xl border border-border-default bg-surface-default p-4">
        <View className="flex-row items-start gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: index < 3 ? '#F59E0B' : '#1E3356' }}>
            <Text className="text-[12px] font-black text-white">{index + 1}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-black text-white" numberOfLines={1}>{student.name}</Text>
            <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>@{slugifyStudentName(student.name)} · {formatRelative(student.lastActivity, index)}</Text>
          </View>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${statusMeta.color}24` }}>
            <Text className="text-[11px] font-black" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
          </View>
        </View>

        <View className="mt-4 h-2 overflow-hidden rounded-full bg-surface-interactive">
          <View className="h-full rounded-full bg-brand-teacher" style={{ width: `${student.participation}%` }} />
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          <StudentMobileStat label="Progreso" value={`${student.participation}%`} color="#7C5CFF" />
          <StudentMobileStat label="XP" value={`${student.score.toLocaleString('es-ES')}`} color="#3B82F6" />
          <StudentMobileStat label="Retos" value={String(student.playedSessions)} color="#A78BFA" />
          <StudentMobileStat label="Nota" value={student.hasActivity ? student.grade.toFixed(1) : '-'} color={gradeColor} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap items-center gap-y-3 border-b border-border-subtle px-2 py-4">
      <View className="min-w-[45px] flex-[0.35]">
        <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: index < 3 ? '#F59E0B' : '#1E3356' }}>
          <Text className="text-[11px] font-black text-white">{index + 1}</Text>
        </View>
      </View>
      <View className="min-w-[180px] flex-[1.4] flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-selected">
          <Text className="font-black text-semantic-info">{getInitials(student.name)}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black text-white" numberOfLines={1}>{student.name}</Text>
          <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>@{slugifyStudentName(student.name)}</Text>
        </View>
      </View>
      <View className="min-w-[130px] flex-[1] flex-row items-center gap-3">
        <View className="h-2 flex-1 overflow-hidden rounded-full bg-surface-interactive">
          <View className="h-full rounded-full bg-brand-teacher" style={{ width: `${student.participation}%` }} />
        </View>
        <Text className="w-10 text-right text-[12px] font-bold text-white">{student.participation}%</Text>
      </View>
      <View className="min-w-[90px] flex-[0.75]">
        <Text className="text-[12px] font-black text-white">{student.score.toLocaleString('es-ES')} XP</Text>
      </View>
      <Text className="min-w-[60px] flex-[0.55] text-[12px] font-bold text-white">{student.playedSessions}</Text>
      <View className="min-w-[90px] flex-[0.8]">
        <View className="self-start rounded-md border px-2 py-1" style={{ borderColor: gradeColor }}>
          <Text className="text-[12px] font-black" style={{ color: gradeColor }}>
            {student.hasActivity ? student.grade.toFixed(1) : '-'}
          </Text>
        </View>
      </View>
      <View className="min-w-[105px] flex-[0.85] flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: statusMeta.color }} />
        <Text className="text-[12px] font-semibold" style={{ color: statusMeta.color }}>{statusMeta.label}</Text>
      </View>
      <Text className="min-w-[110px] flex-[0.9] text-[12px] text-text-secondary">
        {formatRelative(student.lastActivity, index)}
      </Text>
    </View>
  );
}

function StudentMobileStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="min-w-[92px] flex-1 rounded-xl border border-border-default bg-surface-default p-3">
      <Text className="text-[11px] font-semibold text-text-muted">{label}</Text>
      <Text className="mt-1 text-[15px] font-black" style={{ color }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ProgressLine({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between gap-3">
        <Text className="text-[12px] font-semibold text-white">{label}</Text>
        <Text className="text-[12px] text-text-secondary">{value.toLocaleString('es-ES')}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-surface-interactive">
        <View className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function StudentAttentionItem({ student }: { student: StudentReport }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-selected">
        <Text className="text-[12px] font-black text-semantic-info">{getInitials(student.name)}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-bold text-white" numberOfLines={1}>{student.name}</Text>
        <Text className="text-[11px] text-text-secondary">{student.hasActivity ? 'Baja nota media' : 'Sin actividad'}</Text>
      </View>
      <View className="rounded-md border border-semantic-danger px-2 py-1">
        <Text className="text-[11px] font-black text-semantic-danger">{student.hasActivity ? student.grade.toFixed(1) : '0%'}</Text>
      </View>
    </View>
  );
}

function formatRelative(value: string | null | undefined, index: number) {
  if (!value) return index < 2 ? 'Hoy' : 'Esta semana';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Reciente';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
