import React from 'react'
import { Text, View } from 'react-native'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'

export default function ManualReviewBatchBar({ selectedCount, busy, onReview, onClear }: { selectedCount: number; busy: boolean; onReview: () => void; onClear: () => void }) {
  const { tokens } = useAppTheme()
  if (!selectedCount) return null

  return (
    <View className="mb-4 flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.selected }}>
      <Text className="text-[15px] font-black" style={{ color: tokens.text.primary }}>{selectedCount} revisión{selectedCount === 1 ? '' : 'es'} seleccionada{selectedCount === 1 ? '' : 's'}</Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <AppButton label="Revisar lote" icon="checkmark-done-outline" role="teacher" disabled={busy} onPress={onReview} />
        <AppButton label="Limpiar selección" icon="close-outline" variant="ghost" disabled={busy} onPress={onClear} />
      </View>
    </View>
  )
}
