import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MobileMetricCard from '../../ui/mobile/MobileMetricCard'
import type { IconName, StudentRow } from './types';
import { formatRelativeDate, getInitials, getStatusMeta } from './studentUtils';

export function MetricCard({ icon, title, value, detail, color }: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
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
      label={title}
      value={value}
    />
  )
}

export function PendingFirstAccessCard({
  count,
  sendingReminder,
  onSendReminder,
  onExport,
}: {
  count: number
  sendingReminder?: boolean
  onSendReminder: () => void
  onExport: () => void
}) {
  return (
    <View className="mt-5 rounded-2xl border border-[#263E61] bg-[#0B1930] p-5">
      <View className="flex-row flex-wrap items-center justify-between gap-4">
        <View className="min-w-[250px] flex-1 flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#13284A]">
            <Ionicons name="mail-unread-outline" size={25} color="#9FD6FF" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[18px] font-black text-white">Pendientes de primer acceso</Text>
            <Text className="mt-1 text-[13px] leading-5 text-[#B7C4D7]">
              {count} alumno{count === 1 ? '' : 's'} importado{count === 1 ? '' : 's'} todavía no han iniciado actividad.
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            onPress={onSendReminder}
            disabled={sendingReminder}
            className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-4 py-3"
            style={({ pressed }) => ({ opacity: sendingReminder ? 0.65 : pressed ? 0.82 : 1 })}
          >
            {sendingReminder ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send-outline" size={16} color="#FFFFFF" />}
            <Text className="text-[12px] font-black text-white">{sendingReminder ? 'Enviando...' : 'Enviar recordatorio'}</Text>
          </Pressable>
          <Pressable onPress={onExport} className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#07162E] px-4 py-3">
            <Ionicons name="download-outline" size={16} color="#DDE7F4" />
            <Text className="text-[12px] font-black text-[#DDE7F4]">Exportar pendientes</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function CycleSelectButton({
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
      onPress={() => onChange(nextValue)}
      className="h-12 min-w-[165px] flex-row items-center justify-between gap-3 rounded-xl border border-[#20375E] bg-[#07162E] px-4"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-[10px] font-black uppercase tracking-[0.8px] text-[#8FA7C7]">{label}</Text>
        <Text className="text-[12px] font-bold text-[#DDE7F4]" numberOfLines={1}>{selectedLabel}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color="#AFC2DB" />
    </Pressable>
  );
}

export function CycleStringSelectButton<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  const nextOption = options[selectedIndex >= options.length - 1 ? 0 : selectedIndex + 1] || options[0];
  const selectedLabel = options.find((option) => option.value === value)?.label || options[0]?.label || '';

  return (
    <Pressable
      onPress={() => onChange(nextOption.value)}
      className="h-12 min-w-[165px] flex-row items-center justify-between gap-3 rounded-xl border border-[#20375E] bg-[#07162E] px-4"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-[10px] font-black uppercase tracking-[0.8px] text-[#8FA7C7]">{label}</Text>
        <Text className="text-[12px] font-bold text-[#DDE7F4]" numberOfLines={1}>{selectedLabel}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color="#AFC2DB" />
    </Pressable>
  );
}

export function StudentCard({
  student,
  isWide,
  temporaryPassword,
  reminderBusy,
  onViewDetails,
  onAssignActivity,
  onOpenActions,
  onSendReminder,
  onResendCredentials,
  onCopyTemporaryPassword,
}: {
  student: StudentRow
  isWide: boolean
  temporaryPassword: string | null
  reminderBusy: boolean
  onViewDetails: (student: StudentRow) => void
  onAssignActivity: (student: StudentRow) => void
  onOpenActions: (student: StudentRow) => void
  onSendReminder: (student: StudentRow) => void
  onResendCredentials: (student: StudentRow) => void
  onCopyTemporaryPassword: (student: StudentRow) => void
}) {
  const status = getStatusMeta(student.status);
  const mainContext = student.courseContexts[0];

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5" style={{ width: isWide ? '48.5%' : '100%' }}>
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-[#17315E]">
          <Text className="text-[15px] font-black text-white">{getInitials(student.alias)}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="min-w-0 flex-1 text-[17px] font-black text-white" numberOfLines={1}>{student.alias}</Text>
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${status.color}24` }}>
              <Text className="text-[11px] font-black" style={{ color: status.color }}>{status.label}</Text>
            </View>
          </View>
          <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>{student.handle}</Text>
          <Text className="mt-2 text-[12px] text-[#AFC2DB]" numberOfLines={2}>
            {mainContext ? `${mainContext.subjectName} · ${mainContext.classroomName}` : 'Sin curso asignado'}
          </Text>
          {!student.hasActivity ? (
            <Text className="mt-1 text-[11px] font-semibold text-[#9FD6FF]">Importado recientemente · pendiente de empezar</Text>
          ) : null}
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-3">
        <StudentMiniStat label="Precisión" value={student.hasActivity ? `${student.accuracyPercent}%` : '—'} color="#38BDF8" />
        <StudentMiniStat label="Preguntas" value={student.challenges.toLocaleString()} color="#8B5CF6" />
        <StudentMiniStat label="Nota" value={student.hasActivity ? student.averageScore.toFixed(1) : '—'} color="#F6A64A" />
        <StudentMiniStat label="XP" value={student.subjectScore.toLocaleString()} color="#FBBF24" />
      </View>

      {student.status === 'no_activity' ? (
        <NoActivityQuickActions
          student={student}
          temporaryPassword={temporaryPassword}
          reminderBusy={reminderBusy}
          onSendReminder={onSendReminder}
          onResendCredentials={onResendCredentials}
          onCopyTemporaryPassword={onCopyTemporaryPassword}
        />
      ) : null}

      <View className="mt-4 rounded-xl border border-[#20375E] bg-[#07162E] p-3">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-[12px] font-bold text-white">Participación</Text>
          <Text className="text-[12px] font-black text-[#DDE7F4]">{student.progress}%</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full" style={{ width: `${student.progress}%`, backgroundColor: status.color }} />
        </View>
        <Text className="mt-2 text-[11px] text-[#8FA7C7]">Última actividad: {formatRelativeDate(student.lastActivityAt)}</Text>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Pressable onPress={() => onViewDetails(student)} className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-4 py-3">
          <Ionicons name="document-text-outline" size={15} color="#FFFFFF" />
          <Text className="text-[12px] font-black text-white">Ver detalle</Text>
        </Pressable>
        <Pressable onPress={() => onAssignActivity(student)} className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#07162E] px-4 py-3">
          <Ionicons name="add-circle-outline" size={15} color="#DDE7F4" />
          <Text className="text-[12px] font-black text-[#DDE7F4]">Asignar repaso</Text>
        </Pressable>
        <Pressable onPress={() => onOpenActions(student)} className="h-11 w-11 items-center justify-center rounded-xl border border-[#20375E] bg-[#07162E]">
          <Ionicons name="ellipsis-horizontal" size={17} color="#AFC2DB" />
        </Pressable>
      </View>
    </View>
  );
}


export function NoActivityQuickActions({
  student,
  temporaryPassword,
  reminderBusy,
  onSendReminder,
  onResendCredentials,
  onCopyTemporaryPassword,
}: {
  student: StudentRow
  temporaryPassword: string | null
  reminderBusy: boolean
  onSendReminder: (student: StudentRow) => void
  onResendCredentials: (student: StudentRow) => void
  onCopyTemporaryPassword: (student: StudentRow) => void
}) {
  return (
    <View className="mt-4 rounded-xl border border-[#2B3F70] bg-[#101B3A] p-3">
      <View className="mb-3 flex-row items-center gap-2">
        <Ionicons name="mail-unread-outline" size={16} color="#C4B5FD" />
        <Text className="text-[12px] font-black text-white">Acciones de primer acceso</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <QuickStudentAction
          icon="send-outline"
          label={reminderBusy ? 'Enviando...' : 'Recordatorio'}
          disabled={reminderBusy}
          onPress={() => onSendReminder(student)}
        />
        <QuickStudentAction
          icon="key-outline"
          label={reminderBusy ? 'Reenviando...' : 'Credenciales'}
          disabled={reminderBusy}
          onPress={() => onResendCredentials(student)}
        />
        {temporaryPassword ? (
          <QuickStudentAction
            icon="copy-outline"
            label="Copiar clave"
            onPress={() => onCopyTemporaryPassword(student)}
          />
        ) : null}
      </View>
    </View>
  );
}

export function QuickStudentAction({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean
  icon: IconName
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center gap-2 rounded-lg border border-[#4B3FA8] bg-[#191C4C] px-3 py-2"
      style={({ pressed }) => ({ opacity: disabled ? 0.55 : pressed ? 0.82 : 1 })}
    >
      {disabled ? <ActivityIndicator size="small" color="#C4B5FD" /> : <Ionicons name={icon} size={14} color="#C4B5FD" />}
      <Text className="text-[11px] font-black text-[#C4B5FD]">{label}</Text>
    </Pressable>
  );
}

export function StudentMiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="min-w-[86px] flex-1 rounded-xl border border-[#20375E] bg-[#07162E] p-3">
      <Text className="text-[11px] text-[#8FA7C7]">{label}</Text>
      <Text className="mt-1 text-[15px] font-black" style={{ color }}>{value}</Text>
    </View>
  );
}

export function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-black text-white">{title}</Text>
        {action ? <Text className="text-[12px] font-semibold text-[#B9A7FF]">{action}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function LegendRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <View className="flex-row items-center gap-2">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="min-w-0 flex-1 text-[12px] text-[#DDE7F4]">{label}</Text>
      <Text className="text-[12px] text-white">{value} ({percent}%)</Text>
    </View>
  );
}

export function ProgressStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = Math.min(100, Math.round((value / total) * 100));

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[12px] font-semibold text-white">{label}</Text>
        <Text className="text-[12px] text-[#DDE7F4]">{value.toLocaleString()}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-[#13294C]">
        <View className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function AttentionRow({ student, onPress }: { student: StudentRow; onPress: (student: StudentRow) => void }) {
  const status = getStatusMeta(student.status);
  const reason = student.status === 'needs_help'
    ? 'Baja precisión o nota media'
    : student.status === 'inactive'
      ? 'Baja participación'
      : 'Revisar evolución';

  return (
    <Pressable onPress={() => onPress(student)} className="flex-row items-center gap-3" style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#17315E]">
        <Text className="text-[12px] font-black text-white">{getInitials(student.alias)}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-bold text-white" numberOfLines={1}>{student.alias}</Text>
        <Text className="text-[11px] text-[#B7C4D7]">{reason}</Text>
      </View>
      <View className="rounded-md border px-2 py-1" style={{ borderColor: status.color }}>
        <Text className="text-[11px] font-black" style={{ color: status.color }}>{student.hasActivity ? `${student.accuracyPercent}%` : '—'}</Text>
      </View>
    </Pressable>
  );
}

