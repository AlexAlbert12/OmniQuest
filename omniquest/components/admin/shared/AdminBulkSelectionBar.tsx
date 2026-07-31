import React from 'react'
import { Text, View } from 'react-native'
import { AppButton } from '../../ui'

type BulkBarAction = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
}

export default function AdminBulkSelectionBar({
  actions = [],
  count,
  onClear,
  onSelectPage,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  actions?: BulkBarAction[]
  count: number
  onClear: () => void
  onSelectPage: () => void
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}) {
  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-3 rounded-2xl border border-border-active bg-surface-selected p-3">
      <Text className="min-w-[130px] flex-1 text-[13px] font-black text-text-primary">{count} seleccionado(s)</Text>
      <AppButton label="Seleccionar página" icon="checkbox-outline" size="sm" variant="ghost" onPress={onSelectPage} />
      <AppButton label="Limpiar" icon="close-outline" size="sm" variant="ghost" onPress={onClear} />
      {actions.map((action) => <AppButton key={action.label} label={action.label} size="sm" variant={action.variant || 'secondary'} disabled={count === 0 || action.disabled} onPress={action.onPress} />)}
      {secondaryLabel && onSecondary ? <AppButton label={secondaryLabel} size="sm" variant="secondary" disabled={count === 0} onPress={onSecondary} /> : null}
      <AppButton label={primaryLabel} size="sm" variant="danger" disabled={count === 0} onPress={onPrimary} />
    </View>
  )
}
