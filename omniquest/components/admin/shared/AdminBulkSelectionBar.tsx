import React from 'react'
import { Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import AdminButton from './AdminButton'

type BulkBarAction = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
}

export default function AdminBulkSelectionBar({ actions = [], count, onClear, onSelectPage, primaryLabel, onPrimary, secondaryLabel, onSecondary }: {
  actions?: BulkBarAction[]
  count: number
  onClear: () => void
  onSelectPage: () => void
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}) {
  const { tokens } = useAppTheme()
  if (count === 0) return <View className="mt-3 items-start"><AdminButton label="Seleccionar página" icon="checkbox-outline" size="sm" variant="ghost" onPress={onSelectPage} /></View>
  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-3 rounded-2xl border p-3" style={{ borderColor: withAlpha(tokens.brand.admin, 'A0'), backgroundColor: withAlpha(tokens.brand.admin, '18') }}>
      <Text className="min-w-[130px] flex-1 text-[13px] font-black text-text-primary">{count === 1 ? '1 seleccionado' : `${count} seleccionados`}</Text>
      <AdminButton label="Seleccionar página" icon="checkbox-outline" size="sm" variant="ghost" onPress={onSelectPage} />
      <AdminButton label="Limpiar" icon="close-outline" size="sm" variant="ghost" onPress={onClear} />
      {actions.map((action) => <AdminButton key={action.label} label={action.label} size="sm" variant={action.variant || 'secondary'} disabled={action.disabled} onPress={action.onPress} />)}
      {secondaryLabel && onSecondary ? <AdminButton label={secondaryLabel} size="sm" variant="secondary" onPress={onSecondary} /> : null}
      <AdminButton label={primaryLabel} size="sm" variant="danger" onPress={onPrimary} />
    </View>
  )
}
