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
  onRestore,
  onDelete,
}: {
  active: boolean
  busy: boolean
  exporting: boolean
  onEdit: () => void
  onCreatePractice: () => void
  onManualReview: () => void
  onExport: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {active ? <AppButton label="Editar" icon="create-outline" role="teacher" onPress={onEdit} /> : null}
      {active ? <AppButton label="Crear variante" icon="add-circle-outline" variant="secondary" onPress={onCreatePractice} /> : null}
      <AppButton label="Revisión manual" icon="chatbox-ellipses-outline" variant="secondary" onPress={onManualReview} />
      <AppButton label="Exportar informe" icon="download-outline" variant="secondary" loading={exporting} disabled={exporting} onPress={onExport} />
      {active ? (
        <AppButton label="Archivar" accessibilityLabel="Archivar pregunta" accessibilityHint="Conserva el histórico y permite restaurar la pregunta más adelante" icon="archive-outline" variant="danger" loading={busy} disabled={busy} onPress={onArchive} />
      ) : (
        <>
          <AppButton label="Restaurar" accessibilityLabel="Restaurar pregunta" icon="refresh-outline" variant="secondary" loading={busy} disabled={busy} onPress={onRestore} />
          <AppButton label="Eliminar definitivamente" accessibilityLabel="Eliminar pregunta definitivamente" accessibilityHint="Solo se eliminará si no forma parte del histórico de ningún alumno" icon="trash-outline" variant="danger" disabled={busy} onPress={onDelete} />
        </>
      )}
    </View>
  )
}
