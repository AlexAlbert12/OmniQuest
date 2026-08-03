import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import AppPressable from '../../ui/AppPressable'
import PaginationControls from '../../ui/PaginationControls'
import VirtualizedStack from '../../ui/VirtualizedStack'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { ManualReviewQueueRow } from '../../../lib/teacherManualReview'

export default function ManualReviewQueue({
  rows,
  total,
  page,
  pageSize,
  selectedIds,
  onToggle,
  onTogglePage,
  onOpen,
  onPage,
}: {
  rows: ManualReviewQueueRow[]
  total: number
  page: number
  pageSize: number
  selectedIds: number[]
  onToggle: (id: number) => void
  onTogglePage: () => void
  onOpen: (row: ManualReviewQueueRow) => void
  onPage: (page: number) => void
}) {
  const { tokens } = useAppTheme()
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id))

  if (!rows.length) {
    return (
      <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Ionicons name="checkmark-done-circle-outline" size={44} color={tokens.semantic.success} />
        <Text className="mt-3 text-center text-[17px] font-black" style={{ color: tokens.text.primary }}>No hay revisiones con estos filtros</Text>
        <Text className="mt-2 text-center text-[13px] leading-5" style={{ color: tokens.text.secondary }}>Prueba otro estado, curso o búsqueda.</Text>
      </View>
    )
  }

  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-3">
        <View>
          <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>Cola de revisión</Text>
          <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>{total} respuestas · ordenadas por SLA</Text>
        </View>
        <AppButton
          label={allSelected ? 'Deseleccionar página' : 'Seleccionar página'}
          icon={allSelected ? 'square-outline' : 'checkbox-outline'}
          variant="secondary"
          size="sm"
          onPress={onTogglePage}
        />
      </View>

      <VirtualizedStack
        data={rows}
        keyExtractor={(row) => String(row.id)}
        renderItem={(row) => {
          const selected = selectedIds.includes(row.id)
          const status = getStatus(row.status, tokens)
          return (
            <View
              className="rounded-2xl border p-4"
              style={{
                borderColor: row.is_overdue ? tokens.semantic.danger : selected ? tokens.border.active : tokens.border.default,
                backgroundColor: selected ? tokens.surface.selected : tokens.surface.raised,
              }}
            >
              <View className="flex-row items-start gap-3">
                <AppPressable
                  accessibilityLabel={selected ? `Deseleccionar revisión de ${row.student_name}` : `Seleccionar revisión de ${row.student_name}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => onToggle(row.id)}
                  style={{ paddingTop: 2 }}
                >
                  <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={24} color={selected ? tokens.border.active : tokens.text.muted} />
                </AppPressable>

                <View className="min-w-0 flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-[15px] font-black" style={{ color: tokens.text.primary }}>{row.student_name}</Text>
                    <Pill label={status.label} color={status.color} />
                    {row.is_overdue ? <Pill label="SLA vencido" color={tokens.semantic.danger} /> : null}
                    {row.assigned_to_name ? <Pill label={`Asignada a ${row.assigned_to_name}`} color={tokens.semantic.info} /> : null}
                  </View>
                  <Text className="mt-2 text-[14px] font-bold leading-5" style={{ color: tokens.text.primary }}>{row.question_text}</Text>
                  <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }} numberOfLines={3}>{row.answer_text || 'Sin respuesta escrita'}</Text>
                  <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-2">
                    <Meta icon="book-outline" value={row.subject_name} />
                    <Meta icon="people-outline" value={row.classroom_name} />
                    <Meta icon="time-outline" value={formatPending(row.pending_seconds)} />
                    <Meta icon="alarm-outline" value={formatDue(row.due_at)} danger={row.is_overdue} />
                    <Meta icon="chatbubbles-outline" value={`${row.comments_count} comentarios`} />
                  </View>
                </View>

                <AppButton label="Abrir" icon="open-outline" size="sm" role="teacher" onPress={() => onOpen(row)} />
              </View>
            </View>
          )
        }}
        accessibilityLabel="Cola de revisión manual"
      />

      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        onPrevious={() => onPage(Math.max(0, page - 1))}
        onNext={() => onPage(page + 1)}
      />
    </View>
  )
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-full border px-2.5 py-1" style={{ borderColor: withAlpha(color, '88'), backgroundColor: withAlpha(color, '1F') }}>
      <Text className="text-[10px] font-black" style={{ color }}>{label}</Text>
    </View>
  )
}

function Meta({ icon, value, danger = false }: { icon: keyof typeof Ionicons.glyphMap; value: string; danger?: boolean }) {
  const { tokens } = useAppTheme()
  const color = danger ? tokens.semantic.danger : tokens.text.muted
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon} size={14} color={color} />
      <Text className="text-[11px] font-bold" style={{ color }}>{value}</Text>
    </View>
  )
}

function getStatus(status: string, tokens: ReturnType<typeof useAppTheme>['tokens']) {
  if (status === 'pending') return { label: 'Pendiente', color: tokens.semantic.warning }
  if (status === 'in_review') return { label: 'En revisión', color: tokens.semantic.info }
  if (status === 'needs_changes') return { label: 'Necesita cambios', color: tokens.gamification.badge }
  if (status === 'approved') return { label: 'Aprobada', color: tokens.semantic.success }
  return { label: 'Rechazada', color: tokens.semantic.danger }
}

function formatPending(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  if (hours < 24) return `${Math.max(1, hours)} h pendiente`
  return `${Math.floor(hours / 24)} d ${hours % 24} h pendiente`
}

function formatDue(value: string | null) {
  if (!value) return 'Sin SLA'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin SLA'
  return `SLA ${date.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
}
