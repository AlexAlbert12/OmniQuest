import React from 'react'
import { View } from 'react-native'
import AppButton from '../../ui/AppButton'

export default function QuestionReportActions({
  active,
  busy,
  exporting,
  onEdit,
  onCreatePractice,
  onManualReview,
  onExport,
  onArchive,
}: {
  active: boolean
  busy: boolean
  exporting: boolean
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
      <AppButton label="Exportar informe" icon="download-outline" variant="secondary" loading={exporting} disabled={exporting} onPress={onExport} />
      <AppButton label={active ? 'Archivar' : 'Archivada'} icon="archive-outline" variant="danger" loading={busy} disabled={!active} onPress={onArchive} />
    </View>
  )
}
