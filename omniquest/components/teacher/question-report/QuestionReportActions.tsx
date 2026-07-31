import React from 'react'
import { View } from 'react-native'
import AppButton from '../../ui/AppButton'

export default function QuestionReportActions({
  active,
  busy,
  onEdit,
  onCreatePractice,
  onManualReview,
  onExport,
  onArchive,
}: {
  active: boolean
  busy: boolean
  onEdit: () => void
  onCreatePractice: () => void
  onManualReview: () => void
  onExport: () => void
  onArchive: () => void
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      <AppButton label="Editar" icon="create-outline" role="teacher" onPress={onEdit} />
      <AppButton label="Crear variante" icon="add-circle-outline" variant="secondary" onPress={onCreatePractice} />
      <AppButton label="Revisión manual" icon="chatbox-ellipses-outline" variant="secondary" onPress={onManualReview} />
      <AppButton label="Exportar CSV" icon="download-outline" variant="secondary" onPress={onExport} />
      <AppButton label={active ? 'Archivar' : 'Archivada'} icon="archive-outline" variant="danger" loading={busy} disabled={!active} onPress={onArchive} />
    </View>
  )
}
