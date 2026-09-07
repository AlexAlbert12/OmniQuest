import React from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
import PaginationControls from '../../ui/PaginationControls'
import VirtualizedStack from '../../ui/VirtualizedStack'
import {
  getGradeColor,
  getStudentStatus,
  getStudentStatusMeta,
  slugifyStudentName,
  type StudentReport,
  type StudentSortKey,
  type StudentStatusFilter,
} from '../../../lib/teacherSubjectAnalytics'
import { SubjectPanel, GradeDistributionBars, SubjectKpiCard } from './SubjectShared'
import { formatCount } from '../../../lib/formatCount'
import StudentProfileAvatar from '../students/StudentProfileAvatar'

const statusOptions: { value: StudentStatusFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'all', label: 'Todos', icon: 'people-outline' },
  { value: 'active', label: 'Activos', icon: 'checkmark-circle-outline' },
  { value: 'inactive', label: 'Inactivos', icon: 'time-outline' },
  { value: 'no_activity', label: 'Sin actividad', icon: 'pause-circle-outline' },
  { value: 'needs_help', label: 'Necesitan apoyo', icon: 'alert-circle-outline' },
]

const sortOptions: { value: StudentSortKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'xp', label: 'XP', icon: 'star-outline' },
  { value: 'progress', label: 'Progreso', icon: 'trending-up-outline' },
  { value: 'grade', label: 'Nota', icon: 'school-outline' },
  { value: 'recent', label: 'Actividad reciente', icon: 'time-outline' },
]

export function SubjectStudentsTab({
  activeThisWeek,
  attentionStudents,
  averageXp,
  bestStudent,
  enrollmentsCount,
  generatedXp,
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
  playedSessionsTotal,
  questionsCount,
  scorePerformanceCount,
  studentListRows,
  studentSearch,
  studentSortKey,
  studentStatusFilter,
  totalStudents,
  unassessedCount,
}: {
  isDesktop: boolean
  isWide: boolean
  enrollmentsCount: number
  studentListRows: StudentReport[]
  studentSearch: string
  studentStatusFilter: StudentStatusFilter
  studentSortKey: StudentSortKey
  activeThisWeek: number
  averageXp: number
  page: number
  pageSize: number
  questionsCount: number
  gradeDistribution: { label: string; color: string; count: number }[]
  scorePerformanceCount: number
  totalStudents: number
  unassessedCount: number
  generatedXp: number
  playedSessionsTotal: number
  bestStudent: StudentReport | null
  attentionStudents: StudentReport[]
  onStudentSearchChange: (value: string) => void
  onStudentStatusFilterChange: (value: StudentStatusFilter) => void
  onStudentSortKeyChange: (value: StudentSortKey) => void
  onImportStudents: () => void
  onPageChange: (page: number) => void
}) {
  const weeklyActivePercent = enrollmentsCount > 0 ? Math.round((activeThisWeek / enrollmentsCount) * 100) : 0
  const evaluatedDetail = scorePerformanceCount > 0 ? `${formatCount(scorePerformanceCount, 'evaluado', 'evaluados')} · ${unassessedCount} sin actividad` : `${unassessedCount} sin actividad`
  const activityCapacity = Math.max(enrollmentsCount * Math.max(questionsCount, 1), 1)

  return (
    <View className={isWide ? 'flex-row gap-6' : 'gap-6'}>
      <View className={isDesktop ? 'flex-[1.55] gap-5' : 'gap-5'}>
        <View className={isDesktop ? 'flex-row gap-4' : 'flex-row gap-2'}>
          <SubjectKpiCard isDesktop={isDesktop} icon="people" label="Alumnos inscritos" value={String(enrollmentsCount)} detail={evaluatedDetail} color="#8B5CF6" />
          <SubjectKpiCard isDesktop={isDesktop} icon="checkmark-circle" label="Activos esta semana" value={String(activeThisWeek)} detail={`${weeklyActivePercent}% del total`} color="#34D399" />
          <SubjectKpiCard isDesktop={isDesktop} icon="star" label="XP media" value={`${averageXp} XP`} detail="Media del alumnado matriculado" color="#3B82F6" />
          <SubjectKpiCard isDesktop={isDesktop} icon="trophy" label="Mejor alumno" value={`${bestStudent?.score ?? 0} XP`} detail={bestStudent?.name || 'Sin actividad'} color="#F59E0B" />
        </View>

        <View className="rounded-xl border border-border-default bg-surface-default p-4">
          <View className="mb-4">
            <View className="flex-row items-end gap-2">
              <View className={isWide ? 'min-w-[180px] flex-1' : 'min-w-0 flex-[1.35]'}>
                <Text className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-text-secondary">Buscar</Text>
                <View className="h-[42px] flex-row items-center rounded-xl border border-border-default bg-surface-raised px-3">
                <TextInput className="min-w-0 flex-1 text-[13px] text-white" placeholder="Buscar alumno..." placeholderTextColor="#60799C" value={studentSearch} onChangeText={onStudentSearchChange} />
                <Ionicons name="search-outline" size={17} color="#8FA7C7" />
                </View>
              </View>
              <View className={isWide ? 'w-[160px]' : 'min-w-0 flex-1'}>
                <AppDropdown<StudentStatusFilter> accessibilityLabel="Filtrar alumnos por estado" label="Estado" compact={!isWide} role="teacher" value={studentStatusFilter} options={statusOptions} onChange={onStudentStatusFilterChange} />
              </View>
              <View className={isWide ? 'w-[160px]' : 'min-w-0 flex-1'}>
                <AppDropdown<StudentSortKey> accessibilityLabel="Ordenar alumnos" label="Ordenar por" compact={!isWide} role="teacher" value={studentSortKey} options={sortOptions} onChange={onStudentSortKeyChange} />
              </View>
            </View>
            <View className={isWide ? 'mt-3 items-end' : 'mt-3'}>
              <AppButton label="Importar alumnos" icon="person-add-outline" role="teacher" fullWidth={!isWide} onPress={onImportStudents} />
            </View>
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

          <PaginationControls page={page} pageSize={pageSize} total={totalStudents} onPrevious={() => onPageChange(Math.max(0, page - 1))} onNext={() => onPageChange(page + 1)} />
          <Text className="mt-2 text-right text-[11px] text-text-muted">Mostrando {studentListRows.length} de {totalStudents} alumnos</Text>
        </View>
      </View>

      <View className={isWide ? 'w-[360px] shrink-0 gap-5' : 'gap-5'}>
        <SubjectPanel title="Distribución de notas">
          <GradeDistributionBars distribution={gradeDistribution} total={scorePerformanceCount} unassessed={unassessedCount} />
        </SubjectPanel>

        <SubjectPanel title="Actividad de la clase">
          <ProgressLine label="Activos esta semana" value={activeThisWeek} total={Math.max(enrollmentsCount, 1)} color="#3B82F6" />
          <ProgressLine label="Retos completados" value={playedSessionsTotal} total={activityCapacity} color="#3B82F6" />
          <ProgressLine label="XP generado" value={generatedXp} total={Math.max(generatedXp + 500, 1)} color="#3B82F6" />
        </SubjectPanel>

        <SubjectPanel title="Alumnos que necesitan atención">
          <View style={{ gap: 12 }}>
            {attentionStudents.map((student) => <StudentAttentionItem key={student.id} student={student} />)}
            {attentionStudents.length === 0 ? <Text className="text-[12px] text-text-muted">No hay alumnos en riesgo ahora mismo.</Text> : null}
          </View>
        </SubjectPanel>

        <View className="rounded-xl border border-border-default bg-surface-raised p-5">
          <View className="flex-row gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-teacher"><Ionicons name="bulb-outline" size={19} color="#FFFFFF" /></View>
            <View className="min-w-0 flex-1">
              <Text className="font-black text-white">Consejo para profesores</Text>
              <Text className="mt-2 text-[12px] leading-5 text-text-secondary">Revisa alumnos con baja participación y anímalos a completar retos pendientes.</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

function StudentTableHeader({ label, flex }: { label: string; flex: number }) {
  return <Text className="text-[10px] font-black uppercase text-text-muted" style={{ flex }}>{label}</Text>
}

function StudentClassRow({ student, index, mobile = false }: { student: StudentReport; index: number; mobile?: boolean }) {
  const status = getStudentStatus(student)
  const statusMeta = getStudentStatusMeta(status)
  const gradeColor = getGradeColor(student.grade)

  if (mobile) {
    return (
      <View className="rounded-2xl border border-border-default bg-surface-default p-4">
        <View className="flex-row items-start gap-3">
          <View>
            <StudentProfileAvatar alias={student.name} avatar={student.avatar} size={46} accentColor={index < 3 ? '#F59E0B' : '#38BDF8'} />
            <View className="absolute -bottom-1 -right-1 h-5 min-w-5 items-center justify-center rounded-full border border-background-primary bg-surface-selected px-1">
              <Text className="text-[9px] font-black text-white">{index + 1}</Text>
            </View>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-black text-white" numberOfLines={1}>{student.name}</Text>
            <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>@{slugifyStudentName(student.name)} · {formatRelative(student.lastActivity, index)}</Text>
          </View>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${statusMeta.color}24` }}><Text className="text-[11px] font-black" style={{ color: statusMeta.color }}>{statusMeta.label}</Text></View>
        </View>
        <View className="mt-4 h-2 overflow-hidden rounded-full bg-surface-interactive"><View className="h-full rounded-full bg-brand-teacher" style={{ width: `${student.participation}%` }} /></View>
        <View className="mt-4 flex-row flex-wrap gap-2">
          <StudentMobileStat label="Progreso" value={`${student.participation}%`} color="white" />
          <StudentMobileStat label="XP" value={`${student.score.toLocaleString('es-ES')}`} color="#09acf4" />
          <StudentMobileStat label="Partidas" value={String(student.playedSessions)} color="#FFFFFF" />
          <StudentMobileStat label="Nota" value={student.hasActivity ? student.grade.toFixed(1) : 'Sin evaluar'} color={student.hasActivity ? gradeColor : '#8FA7C7'} />
        </View>
      </View>
    )
  }

  return (
    <View className="flex-row flex-wrap items-center gap-y-3 border-b border-border-subtle px-2 py-4">
      <View className="min-w-[45px] flex-[0.35]"><View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: index < 3 ? '#F59E0B' : '#1E3356' }}><Text className="text-[11px] font-black text-white">{index + 1}</Text></View></View>
      <View className="min-w-[180px] flex-[1.4] flex-row items-center gap-3">
        <StudentProfileAvatar alias={student.name} avatar={student.avatar} size={40} />
        <View className="min-w-0 flex-1"><Text className="font-black text-white" numberOfLines={1}>{student.name}</Text><Text className="mt-1 text-[11px] text-text-muted" numberOfLines={1}>@{slugifyStudentName(student.name)}</Text></View>
      </View>
      <View className="min-w-[130px] flex-[1] flex-row items-center gap-3"><View className="h-2 flex-1 overflow-hidden rounded-full bg-surface-interactive"><View className="h-full rounded-full bg-brand-teacher" style={{ width: `${student.participation}%` }} /></View><Text className="w-10 text-right text-[12px] font-bold text-white">{student.participation}%</Text></View>
      <View className="min-w-[90px] flex-[0.75]"><Text className="text-[12px] font-black text-white">{student.score.toLocaleString('es-ES')} XP</Text></View>
      <Text className="min-w-[60px] flex-[0.55] text-[12px] font-bold text-white">{student.playedSessions}</Text>
      <View className="min-w-[90px] flex-[0.8]"><View className="self-start rounded-md border px-2 py-1" style={{ borderColor: student.hasActivity ? gradeColor : '#60799C' }}><Text className="text-[12px] font-black" style={{ color: student.hasActivity ? gradeColor : '#8FA7C7' }}>{student.hasActivity ? student.grade.toFixed(1) : '—'}</Text></View></View>
      <View className="min-w-[105px] flex-[0.85] flex-row items-center gap-2"><View className="h-2 w-2 rounded-full" style={{ backgroundColor: statusMeta.color }} /><Text className="text-[12px] font-semibold" style={{ color: statusMeta.color }}>{statusMeta.label}</Text></View>
      <Text className="min-w-[110px] flex-[0.9] text-[12px] text-text-secondary">{formatRelative(student.lastActivity, index)}</Text>
    </View>
  )
}

function StudentMobileStat({ label, value, color }: { label: string; value: string; color: string }) {
  return <View className="min-w-[92px] flex-1 rounded-xl border border-border-default bg-surface-default p-3"><Text className="text-[11px] font-semibold text-text-muted">{label}</Text><Text className="mt-1 text-[15px] font-black" style={{ color }} numberOfLines={1}>{value}</Text></View>
}

function ProgressLine({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return <View className="mb-4"><View className="mb-2 flex-row items-center justify-between gap-3"><Text className="text-[12px] font-semibold text-white">{label}</Text><Text className="text-[12px] text-text-secondary">{value.toLocaleString('es-ES')}</Text></View><View className="h-2 overflow-hidden rounded-full bg-surface-interactive"><View className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} /></View></View>
}

function StudentAttentionItem({ student }: { student: StudentReport }) {
  const reason = getAttentionReason(student)
  return (
    <View className="flex-row items-center gap-3">
      <StudentProfileAvatar alias={student.name} avatar={student.avatar} size={36} accentColor={reason.color} />
      <View className="min-w-0 flex-1"><Text className="text-[13px] font-bold text-white" numberOfLines={1}>{student.name}</Text><Text className="text-[11px] text-text-secondary">{reason.label}</Text></View>
      <View className="rounded-md border px-2 py-1" style={{ borderColor: reason.color }}><Text className="text-[11px] font-black" style={{ color: reason.color }}>{reason.value}</Text></View>
    </View>
  )
}

function getAttentionReason(student: StudentReport) {
  if (!student.hasActivity) return { label: 'Sin actividad', value: '—', color: '#8FA7C7' }
  if (student.grade < 5) return { label: 'Nota media baja', value: student.grade.toFixed(1), color: '#F43F5E' }
  if (student.participation < 35) return { label: 'Baja participación', value: `${student.participation}%`, color: '#F59E0B' }
  return { label: 'Requiere seguimiento', value: `${student.participation}%`, color: '#F59E0B' }
}

function formatRelative(value: string | null | undefined, index: number) {
  if (!value) return index < 2 ? 'Hoy' : 'Esta semana'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Reciente'
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
