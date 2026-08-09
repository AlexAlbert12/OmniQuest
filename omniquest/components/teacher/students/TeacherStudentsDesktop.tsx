import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import AppPressable from '../../ui/AppPressable'
import VirtualizedStack from '../../ui/VirtualizedStack'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { StudentRow } from './types'
import { formatRelativeDate, getInitials, getStatusMeta } from './studentUtils'

export function TeacherStudentPrioritySections({
  attentionStudents,
  noActivityStudents,
  onViewDetails,
  onSendReminder,
}: {
  attentionStudents: StudentRow[]
  noActivityStudents: StudentRow[]
  onViewDetails: (student: StudentRow) => void
  onSendReminder: (student: StudentRow) => void
}) {
  return (
    <View className="mt-5 gap-5">
      <PrioritySection
        title="Necesitan atención"
        description="Baja precisión, poca participación o evolución descendente."
        icon="warning-outline"
        color="#F59E0B"
        students={attentionStudents.slice(0, 4)}
        emptyMessage="No hay alumnos prioritarios con los filtros actuales."
        onViewDetails={onViewDetails}
      />
      <PrioritySection
        title="Sin actividad"
        description="Alumnos importados o matriculados que todavía no han comenzado."
        icon="time-outline"
        color="#38BDF8"
        students={noActivityStudents.slice(0, 4)}
        emptyMessage="Todos los alumnos visibles han iniciado actividad."
        actionLabel="Recordar"
        onAction={onSendReminder}
        onViewDetails={onViewDetails}
      />
    </View>
  )
}

function PrioritySection({
  title,
  description,
  icon,
  color,
  students,
  emptyMessage,
  actionLabel,
  onAction,
  onViewDetails,
}: {
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  students: StudentRow[]
  emptyMessage: string
  actionLabel?: string
  onAction?: (student: StudentRow) => void
  onViewDetails: (student: StudentRow) => void
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(color, '24') }}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>{title}</Text>
          <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>{description}</Text>
        </View>
        <View className="rounded-full px-3 py-1" style={{ backgroundColor: withAlpha(color, '20') }}>
          <Text className="text-[12px] font-black" style={{ color }}>{students.length}</Text>
        </View>
      </View>

      {students.length > 0 ? (
        <View className="mt-4 flex-row flex-wrap gap-3">
          {students.map((student) => {
            const status = getStatusMeta(student.status)
            const mainCourse = student.courseContexts[0]
            return (
              <View
                key={student.id}
                className="min-w-[250px] flex-1 rounded-xl border p-3"
                style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '24') }}>
                    <Text className="font-black" style={{ color: tokens.text.primary }}>{getInitials(student.alias)}</Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-[14px] font-black" style={{ color: tokens.text.primary }}>{student.alias}</Text>
                    <Text numberOfLines={1} className="mt-0.5 text-[11px]" style={{ color: tokens.text.secondary }}>
                      {mainCourse ? `${mainCourse.subjectName} · ${mainCourse.classroomName}` : 'Sin curso asignado'}
                    </Text>
                  </View>
                  <View className="rounded-full px-2 py-1" style={{ backgroundColor: withAlpha(status.color, '20') }}>
                    <Text className="text-[10px] font-black" style={{ color: status.color }}>{status.label}</Text>
                  </View>
                </View>
                <View className="mt-3 flex-row gap-2">
                  <AppButton label="Ver detalle" size="sm" role="teacher" onPress={() => onViewDetails(student)} />
                  {actionLabel && onAction ? (
                    <AppButton label={actionLabel} size="sm" icon="send-outline" variant="secondary" onPress={() => onAction(student)} />
                  ) : null}
                </View>
              </View>
            )
          })}
        </View>
      ) : (
        <Text className="mt-4 text-[13px]" style={{ color: tokens.text.muted }}>{emptyMessage}</Text>
      )}
    </View>
  )
}

export default function TeacherStudentsDesktopTable({
  students,
  onViewDetails,
  onViewHistory,
  onAssignActivity,
  onOpenActions,
}: {
  students: StudentRow[]
  onViewDetails: (student: StudentRow) => void
  onViewHistory: (student: StudentRow) => void
  onAssignActivity: (student: StudentRow) => void
  onOpenActions: (student: StudentRow) => void
}) {
  const { tokens } = useAppTheme()
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  return (
    <View className="overflow-hidden rounded-2xl border" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="flex-row items-center border-b px-4 py-3" style={{ borderBottomColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
        <HeaderCell className="flex-[1.5]" label="Alumno" />
        <HeaderCell className="flex-1" label="Estado" />
        <HeaderCell className="flex-[1.4]" label="Curso" />
        <HeaderCell className="w-[112px]" label="Precisión" />
        <HeaderCell className="w-[120px]" label="Participación" />
        <View className="w-[132px]" />
      </View>

      <VirtualizedStack
        data={students}
        keyExtractor={(student) => student.id}
        gap={0}
        renderItem={(student, index) => {
          const expanded = expandedStudentId === student.id
          const status = getStatusMeta(student.status)
          const mainCourse = student.courseContexts[0]
          return (
          <View style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: tokens.border.default }}>
            <AppPressable
              accessibilityLabel={`${student.alias}. ${status.label}. Abrir resumen`}
              accessibilityState={{ expanded }}
              onPress={() => setExpandedStudentId(expanded ? null : student.id)}
              className="min-h-[72px] flex-row items-center px-4 py-3"
              style={({ pressed }) => ({ backgroundColor: pressed || expanded ? tokens.surface.interactive : tokens.surface.default })}
            >
              <View className="min-w-0 flex-[1.5] flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(tokens.brand.teacher, '24') }}>
                  <Text className="font-black" style={{ color: tokens.text.primary }}>{getInitials(student.alias)}</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-[14px] font-black" style={{ color: tokens.text.primary }}>{student.alias}</Text>
                  <Text className="mt-0.5 text-[11px]" style={{ color: tokens.text.muted }}>{formatRelativeDate(student.lastActivityAt)}</Text>
                </View>
              </View>
              <View className="min-w-0 flex-1 items-start">
                <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: withAlpha(status.color, '20') }}>
                  <Text className="text-[10px] font-black" style={{ color: status.color }}>{status.label}</Text>
                </View>
              </View>
              <Text numberOfLines={2} className="min-w-0 flex-[1.4] pr-3 text-[12px] font-semibold" style={{ color: tokens.text.secondary }}>
                {mainCourse ? `${mainCourse.subjectName}\n${mainCourse.classroomName}` : 'Sin curso asignado'}
              </Text>
              <ValueCell value={student.hasActivity ? `${student.accuracyPercent}%` : '—'} color={student.hasActivity ? tokens.semantic.info : tokens.text.muted} />
              <View className="w-[120px] pr-3">
                <Text className="text-right text-[13px] font-black" style={{ color: tokens.semantic.success }}>{student.progress}%</Text>
                <View className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: tokens.background.primary }}>
                  <View className="h-full rounded-full" style={{ width: `${Math.max(2, student.progress)}%`, backgroundColor: tokens.semantic.success }} />
                </View>
              </View>
              <View className="w-[132px] flex-row items-center justify-end gap-2">
                <AppButton label="Ver detalle" size="sm" role="teacher" onPress={() => onViewDetails(student)} />
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={tokens.text.muted} />
              </View>
            </AppPressable>

            {expanded ? (
              <View className="border-t px-4 py-4" style={{ borderTopColor: tokens.border.default, backgroundColor: tokens.background.secondary }}>
                <View className="flex-row flex-wrap items-center gap-3">
                  <DetailPill label="XP" value={student.globalPoints.toLocaleString()} />
                  <DetailPill label="Preguntas" value={String(student.challenges)} />
                  <DetailPill label="Nota" value={`${student.averageScore.toFixed(1)}/10`} />
                  <DetailPill label="Área prioritaria" value={student.weakAreas[0]?.title || 'Sin alertas'} />
                  <View className="ml-auto flex-row gap-2">
                    <AppButton label="Ver historial" icon="time-outline" size="sm" variant="secondary" onPress={() => onViewHistory(student)} />
                    <AppButton label="Asignar repaso" icon="locate-outline" size="sm" variant="secondary" onPress={() => onAssignActivity(student)} />
                    <AppButton accessibilityLabel={`Más acciones para ${student.alias}`} icon="ellipsis-horizontal" iconOnly size="sm" variant="ghost" onPress={() => onOpenActions(student)} />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
          )
        }}
        accessibilityLabel="Tabla de alumnos"
      />
    </View>
  )
}

function HeaderCell({ label, className }: { label: string; className: string }) {
  const { tokens } = useAppTheme()
  return <Text className={`${className} text-[10px] font-black uppercase tracking-[0.7px]`} style={{ color: tokens.text.muted }}>{label}</Text>
}

function ValueCell({ value, color }: { value: string; color: string }) {
  return <Text className="w-[112px] pr-3 text-right text-[13px] font-black" style={{ color }}>{value}</Text>
}

function DetailPill({ label, value }: { label: string; value: string }) {
  const { tokens } = useAppTheme()
  return (
    <View className="min-w-[120px] rounded-xl border px-3 py-2" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
      <Text className="text-[10px] font-black uppercase tracking-[0.5px]" style={{ color: tokens.text.muted }}>{label}</Text>
      <Text numberOfLines={1} className="mt-1 text-[12px] font-black" style={{ color: tokens.text.primary }}>{value}</Text>
    </View>
  )
}
