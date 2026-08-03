import React from 'react'
import { Text, TextInput, View } from 'react-native'
import AppDropdown from '../../ui/AppDropdown'
import AppTabs from '../../ui/AppTabs'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherAuditCategory, TeacherAuditFilters as TeacherAuditFilterState, TeacherAuditSeverity } from '../../../lib/teacherAudit'

const CATEGORIES: { key: TeacherAuditCategory; label: string; icon: any }[] = [
  { key: 'all', label: 'Todas', icon: 'list-outline' },
  { key: 'student', label: 'Alumnos', icon: 'people-outline' },
  { key: 'question', label: 'Preguntas', icon: 'help-circle-outline' },
  { key: 'subject', label: 'Cursos', icon: 'book-outline' },
  { key: 'code', label: 'Códigos', icon: 'key-outline' },
  { key: 'profile', label: 'Perfil', icon: 'person-circle-outline' },
]

export default function TeacherAuditFilters({
  filters,
  actions,
  targetTables,
  onChange,
}: {
  filters: TeacherAuditFilterState
  actions: string[]
  targetTables: string[]
  onChange: (patch: Partial<TeacherAuditFilterState>) => void
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <AppTabs<TeacherAuditCategory>
        accessibilityLabel="Categoría de auditoría"
        compact
        role="teacher"
        items={CATEGORIES}
        value={filters.category}
        onChange={(category) => onChange({ category })}
      />
      <View className="mt-4 flex-row flex-wrap gap-3">
        <View className="min-w-[250px] flex-[2]">
          <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Buscar</Text>
          <TextInput
            accessibilityLabel="Buscar eventos de auditoría"
            value={filters.search}
            onChangeText={(search) => onChange({ search })}
            placeholder="Acción, entidad o identificador"
            placeholderTextColor={tokens.text.muted}
            className="min-h-12 rounded-xl border px-4"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }}
          />
        </View>
        <AppDropdown<string>
          label="Acción"
          value={filters.action}
          options={actions.map((value) => ({ value, label: value }))}
          onChange={(action) => onChange({ action })}
          placeholder="Todas las acciones"
          style={{ minWidth: 220, flex: 1 }}
        />
        <AppDropdown<string>
          label="Entidad"
          value={filters.targetTable}
          options={targetTables.map((value) => ({ value, label: value }))}
          onChange={(targetTable) => onChange({ targetTable })}
          placeholder="Todas las entidades"
          style={{ minWidth: 190, flex: 1 }}
        />
        <View className="min-w-[175px] flex-1">
          <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Desde</Text>
          <TextInput
            accessibilityLabel="Fecha inicial de auditoría"
            value={filters.from ? filters.from.slice(0, 10) : ''}
            onChangeText={(value) => onChange({ from: /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : null })}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={tokens.text.muted}
            className="min-h-12 rounded-xl border px-3"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }}
          />
        </View>
        <View className="min-w-[175px] flex-1">
          <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Hasta</Text>
          <TextInput
            accessibilityLabel="Fecha final de auditoría"
            value={filters.to ? filters.to.slice(0, 10) : ''}
            onChangeText={(value) => onChange({ to: /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : null })}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={tokens.text.muted}
            className="min-h-12 rounded-xl border px-3"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }}
          />
        </View>
        <AppDropdown<TeacherAuditSeverity>
          label="Severidad"
          value={filters.severity}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'info', label: 'Informativa' },
            { value: 'warning', label: 'Advertencia' },
            { value: 'critical', label: 'Crítica' },
          ]}
          onChange={(severity) => onChange({ severity })}
          style={{ minWidth: 180, flex: 1 }}
        />
      </View>
    </View>
  )
}
