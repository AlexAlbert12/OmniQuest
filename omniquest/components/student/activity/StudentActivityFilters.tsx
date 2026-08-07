import React, { useMemo } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import type { ActivityFilter, ActivityFilterOption, ActivityStatusCounts } from './types'

export type StudentActivityFiltersProps = {
  searchQuery: string
  onSearchChange: (value: string) => void
  statusFilter: ActivityFilter
  onStatusFilterChange: (value: ActivityFilter) => void
  statusCounts: ActivityStatusCounts
  subjectOptions: ActivityFilterOption[]
  selectedSubjectId: string
  onSubjectChange: (value: string) => void
  topicOptions: ActivityFilterOption[]
  selectedTopicId: string
  onTopicChange: (value: string) => void
  visibleCount: number
  totalCount: number
}

export default React.memo(function StudentActivityFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  subjectOptions,
  selectedSubjectId,
  onSubjectChange,
  topicOptions,
  selectedTopicId,
  onTopicChange,
  visibleCount,
  totalCount,
}: StudentActivityFiltersProps) {
  const { tokens } = useAppTheme()
  const statusFilters = useMemo(() => [
    { id: 'all' as const, label: 'Todas', count: statusCounts.all, icon: 'list' as const },
    { id: 'correct' as const, label: 'Correctas', count: statusCounts.correct, icon: 'checkmark-circle' as const },
    { id: 'incorrect' as const, label: 'Incorrectas', count: statusCounts.incorrect, icon: 'close-circle' as const },
  ], [statusCounts])

  return (
    <View
      className="mb-5 rounded-2xl border p-4"
      style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}
      accessibilityLabel="Filtros del historial de actividad"
    >
      <Text maxFontSizeMultiplier={2} className="text-[16px] font-black" style={{ color: tokens.text.primary }}>
        Filtra tu actividad
      </Text>
      <Text maxFontSizeMultiplier={2} className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>
        Mostrando {visibleCount} de {totalCount} intentos. La búsqueda y los filtros se aplican en el servidor.
      </Text>

      <View className="mt-4 flex-row items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
        <Ionicons name="search" size={18} color={tokens.text.muted} />
        <TextInput
          accessibilityLabel="Buscar en el historial"
          accessibilityHint="Busca por texto de pregunta, curso o tema"
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Buscar pregunta, curso o tema..."
          placeholderTextColor={tokens.text.disabled}
          className="min-w-0 flex-1 text-[14px] outline-none"
          style={{ color: tokens.text.primary }}
          autoCorrect={false}
          autoCapitalize="none"
          maxFontSizeMultiplier={2}
        />
        {searchQuery.trim() ? (
          <AppPressable
            accessibilityLabel="Limpiar búsqueda"
            accessibilityHint="Elimina el texto y vuelve a mostrar todos los resultados"
            onPress={() => onSearchChange('')}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: tokens.surface.interactive }}
          >
            <Ionicons name="close" size={18} color={tokens.text.secondary} />
          </AppPressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingTop: 14 }}
        accessibilityLabel="Filtros por resultado"
      >
        {statusFilters.map((filter) => (
          <FilterChip
            key={filter.id}
            label={filter.label}
            count={filter.count}
            icon={filter.icon}
            active={statusFilter === filter.id}
            onPress={() => onStatusFilterChange(filter.id)}
          />
        ))}
      </ScrollView>

      <View className="mt-4 gap-3">
        <FilterGroup
          label="Por curso"
          options={[{ id: 'all', label: 'Todos los cursos', count: totalCount }, ...subjectOptions]}
          selectedId={selectedSubjectId}
          icon="book"
          onChange={onSubjectChange}
        />
        <FilterGroup
          label="Por tema"
          options={[{ id: 'all', label: 'Todos los temas', count: totalCount }, ...topicOptions]}
          selectedId={selectedTopicId}
          icon="pricetag"
          onChange={onTopicChange}
        />
      </View>
    </View>
  )
})

function FilterGroup({
  label,
  options,
  selectedId,
  icon,
  onChange,
}: {
  label: string
  options: ActivityFilterOption[]
  selectedId: string
  icon: keyof typeof Ionicons.glyphMap
  onChange: (value: string) => void
}) {
  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>()
    return options.filter((option) => {
      if (seen.has(option.id)) return false
      seen.add(option.id)
      return true
    })
  }, [options])

  return (
    <View>
      <Text maxFontSizeMultiplier={2} className="mb-2 text-[12px] font-black uppercase tracking-wide text-text-muted">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} accessibilityLabel={label}>
        {uniqueOptions.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            count={option.count}
            icon={icon}
            active={selectedId === option.id}
            onPress={() => onChange(option.id)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

function FilterChip({
  label,
  count,
  icon,
  active,
  onPress,
}: {
  label: string
  count: number
  icon: keyof typeof Ionicons.glyphMap
  active: boolean
  onPress: () => void
}) {
  const { tokens } = useAppTheme()
  const foreground = active ? '#FFFFFF' : tokens.text.secondary
  return (
    <AppPressable
      accessibilityLabel={`${label}, ${count} resultados`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-2 rounded-xl border px-4 py-2"
      style={{
        borderColor: active ? tokens.brand.student : tokens.border.default,
        backgroundColor: active ? tokens.brand.student : tokens.surface.raised,
      }}
    >
      <Ionicons name={icon} size={15} color={foreground} />
      <Text maxFontSizeMultiplier={2} className="text-[13px] font-black" style={{ color: foreground }}>{label}</Text>
      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: active ? 'rgba(255,255,255,0.18)' : tokens.surface.interactive }}>
        <Text maxFontSizeMultiplier={2} className="text-[11px] font-black" style={{ color: foreground }}>{count}</Text>
      </View>
    </AppPressable>
  )
}
