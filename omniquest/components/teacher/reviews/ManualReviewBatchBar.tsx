import React from 'react'
import { Text, View } from 'react-native'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
import { useAppTheme } from '../../../lib/appTheme'
import type { ManualReviewAssignee } from '../../../lib/teacherManualReview'

export default function ManualReviewBatchBar({
  selectedCount,
  assignees,
  assigneeId,
  busy,
  onAssignee,
  onAssign,
  onReview,
  onClear,
}: {
  selectedCount: number
  assignees: ManualReviewAssignee[]
  assigneeId: string | null
  busy: boolean
  onAssignee: (id: string | null) => void
  onAssign: () => void
  onReview: () => void
  onClear: () => void
}) {
  const { tokens } = useAppTheme()
  if (!selectedCount) return null

  return (
    <View className="mb-4 rounded-2xl border p-4" style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.selected }}>
      <Text className="text-[15px] font-black" style={{ color: tokens.text.primary }}>{selectedCount} revisión{selectedCount === 1 ? '' : 'es'} seleccionada{selectedCount === 1 ? '' : 's'}</Text>
      <View className="mt-3 flex-row flex-wrap items-end gap-3">
        <AppDropdown<string>
          label="Asignar a"
          value={assigneeId}
          options={assignees.map((item) => ({ value: item.id, label: item.name, icon: 'person-outline' }))}
          onChange={(value) => onAssignee(value)}
          placeholder="Selecciona profesor"
          style={{ minWidth: 220, flex: 1 }}
        />
        <AppButton label="Asignar" icon="person-add-outline" variant="secondary" disabled={!assigneeId || busy} onPress={onAssign} />
        <AppButton label="Revisar lote" icon="checkmark-done-outline" role="teacher" disabled={busy} onPress={onReview} />
        <AppButton label="Limpiar" icon="close-outline" variant="ghost" disabled={busy} onPress={onClear} />
      </View>
    </View>
  )
}
