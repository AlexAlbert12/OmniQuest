import React, { useMemo, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
import AppPressable from '../../ui/AppPressable'
import AppTabs from '../../ui/AppTabs'
import DateCalendar from '../../ui/DateCalendar'
import { useAppTheme } from '../../../lib/appTheme'
import { useI18n } from '../../../lib/i18n'
import { getTeacherAuditActionLabel } from '../../../lib/teacherAuditPresentation'
import type { TeacherAuditCategory, TeacherAuditFilters as TeacherAuditFilterState, TeacherAuditSeverity } from '../../../lib/teacherAudit'

const ALL_ACTIONS = '__all_actions__'
const CATEGORIES: { key: TeacherAuditCategory; label: string; icon: any }[] = [
  { key: 'all', label: 'Todas', icon: 'list-outline' },
  { key: 'student', label: 'Alumnos', icon: 'people-outline' },
  { key: 'question', label: 'Preguntas', icon: 'help-circle-outline' },
  { key: 'subject', label: 'Cursos', icon: 'book-outline' },
  { key: 'code', label: 'Códigos', icon: 'key-outline' },
  { key: 'profile', label: 'Perfil', icon: 'person-circle-outline' },
]

export default function TeacherAuditFilters({ filters, actions, onChange }: { filters: TeacherAuditFilterState; actions: string[]; onChange: (patch: Partial<TeacherAuditFilterState>) => void }) {
  const { tokens } = useAppTheme()
  const { locale } = useI18n()
  const actionOptions = useMemo(() => [
    { value: ALL_ACTIONS, label: 'Todas las acciones' },
    ...actions.map((value) => ({ value, label: getTeacherAuditActionLabel(value, locale) })).sort((left, right) => left.label.localeCompare(right.label, locale)),
  ], [actions, locale])

  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <AppTabs<TeacherAuditCategory> accessibilityLabel="Categoría de auditoría" compact role="teacher" items={CATEGORIES} value={filters.category} onChange={(category) => onChange({ category })} />
      <View className="mt-4 flex-row flex-wrap gap-3">
        <View className="min-w-[250px] flex-[2]">
          <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Buscar</Text>
          <TextInput accessibilityLabel="Buscar en el historial" value={filters.search} onChangeText={(search) => onChange({ search })} placeholder="Buscar en el historial..." placeholderTextColor={tokens.text.muted} className="min-h-12 rounded-xl border px-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }} />
        </View>
        <AppDropdown<string> label="Acción" value={filters.action || ALL_ACTIONS} options={actionOptions} onChange={(action) => onChange({ action: action === ALL_ACTIONS ? null : action })} style={{ minWidth: 220, flex: 1 }} />
        <AuditDateField label="Desde" value={filters.from} boundary="start" onChange={(from) => onChange({ from })} />
        <AuditDateField label="Hasta" value={filters.to} boundary="end" onChange={(to) => onChange({ to })} />
        <AppDropdown<TeacherAuditSeverity>
          label="Severidad"
          value={filters.severity}
          options={[{ value: 'all', label: 'Todas' }, { value: 'info', label: 'Informativa' }, { value: 'warning', label: 'Advertencia' }, { value: 'critical', label: 'Crítica' }]}
          onChange={(severity) => onChange({ severity })}
          style={{ minWidth: 180, flex: 1 }}
        />
      </View>
    </View>
  )
}

function AuditDateField({ label, value, boundary, onChange }: { label: string; value: string | null; boundary: 'start' | 'end'; onChange: (value: string | null) => void }) {
  const { tokens } = useAppTheme()
  const { locale } = useI18n()
  const selectedDate = useMemo(() => filterIsoToLocalDate(value, boundary), [boundary, value])
  const [visible, setVisible] = useState(false)
  const [month, setMonth] = useState(selectedDate || new Date())
  const formatted = selectedDate ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(selectedDate) : 'Sin límite'

  const open = () => {
    setMonth(selectedDate || new Date())
    setVisible(true)
  }

  const selectDate = (date: Date) => {
    onChange(boundary === 'start' ? startOfLocalDay(date).toISOString() : startOfNextLocalDay(date).toISOString())
    setVisible(false)
  }

  return (
    <View style={{ minWidth: 175, flex: 1 }}>
      <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>{label}</Text>
      <AppPressable accessibilityLabel={`Fecha ${label.toLowerCase()}`} accessibilityHint="Abre el calendario" onPress={open} style={({ pressed }) => ({ minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, opacity: pressed ? 0.82 : 1 })}>
        <Ionicons name="calendar-outline" size={18} color={tokens.text.secondary} />
        <Text className="min-w-0 flex-1 text-[13px] font-extrabold" style={{ color: selectedDate ? tokens.text.primary : tokens.text.muted }}>{formatted}</Text>
        <Ionicons name="chevron-down" size={17} color={tokens.text.muted} />
      </AppPressable>
      <AppBottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title={`Fecha ${label.toLowerCase()}`}
        description={boundary === 'start' ? 'Incluye los registros a partir del inicio de ese día.' : 'Incluye todos los registros hasta el final de ese día.'}
        footer={<View className="flex-row justify-end gap-2"><AppButton label="Sin límite" variant="ghost" icon="close-circle-outline" onPress={() => { onChange(null); setVisible(false) }} /><AppButton label="Cancelar" variant="secondary" onPress={() => setVisible(false)} /></View>}
      >
        <DateCalendar month={month} selectedDate={selectedDate} onMonthChange={setMonth} onSelectDate={selectDate} subtitle="Selecciona un día" locale={locale} minimumDate={null} />
      </AppBottomSheet>
    </View>
  )
}

function filterIsoToLocalDate(value: string | null, boundary: 'start' | 'end') {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return boundary === 'end' ? new Date(date.getTime() - 1) : date
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0)
}

function startOfNextLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1, 0, 0, 0, 0)
}
