import React, { useMemo, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
import AppTabs from '../../ui/AppTabs'
import { useAppTheme } from '../../../lib/appTheme'
import type { ManualReviewConfiguration, ManualReviewStatus } from '../../../lib/teacherManualReview'

export default function ManualReviewBatchSheet({
  visible,
  selectedCount,
  configuration,
  busy,
  onClose,
  onSubmit,
}: {
  visible: boolean
  selectedCount: number
  configuration: ManualReviewConfiguration
  busy: boolean
  onClose: () => void
  onSubmit: (input: {
    status: ManualReviewStatus
    notes?: string
    audience?: 'student' | 'internal'
    rubricId?: string | null
    rubricResult?: Record<string, number> | null
  }) => Promise<void>
}) {
  const { tokens } = useAppTheme()
  const [status, setStatus] = useState<ManualReviewStatus>('approved')
  const [notes, setNotes] = useState('')
  const [audience, setAudience] = useState<'student' | 'internal'>('student')
  const [rubricId, setRubricId] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const rubric = useMemo(() => configuration.rubrics.find((item) => item.id === rubricId) || null, [configuration.rubrics, rubricId])

  const applyTemplate = (id: string) => {
    const template = configuration.templates.find((item) => item.id === id)
    if (!template) return
    setNotes(template.body)
    setAudience(template.audience)
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title={`Revisar ${selectedCount} respuestas`}
      description="La misma decisión se aplicará al lote. Cada cambio quedará en el historial inmutable."
      scrollable
      closeOnBackdropPress={!busy}
      footer={(
        <View className="flex-row justify-end gap-2">
          <AppButton label="Cancelar" variant="secondary" disabled={busy} onPress={onClose} />
          <AppButton
            label="Aplicar al lote"
            icon="checkmark-done-outline"
            role="teacher"
            loading={busy}
            onPress={() => void onSubmit({ status, notes, audience, rubricId, rubricResult: scores })}
          />
        </View>
      )}
    >
      <View className="gap-4">
        <View>
          <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Decisión</Text>
          <AppTabs<ManualReviewStatus>
            accessibilityLabel="Decisión para el lote"
            compact
            role="teacher"
            items={[
              { key: 'approved', label: 'Aprobar', icon: 'checkmark-circle-outline' },
              { key: 'needs_changes', label: 'Necesita cambios', icon: 'refresh-outline' },
              { key: 'rejected', label: 'Rechazar', icon: 'close-circle-outline' },
            ]}
            value={status}
            onChange={setStatus}
          />
        </View>

        {configuration.templates.length ? (
          <AppDropdown<string>
            label="Comentario predefinido"
            value={null}
            options={configuration.templates.map((item) => ({ value: item.id, label: item.title }))}
            onChange={applyTemplate}
            placeholder="Selecciona una plantilla"
          />
        ) : null}

        <View>
          <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Visibilidad</Text>
          <AppTabs<'student' | 'internal'>
            accessibilityLabel="Visibilidad del comentario del lote"
            compact
            role="teacher"
            items={[
              { key: 'student', label: 'Alumno', icon: 'eye-outline' },
              { key: 'internal', label: 'Interna', icon: 'lock-closed-outline' },
            ]}
            value={audience}
            onChange={setAudience}
          />
        </View>

        <TextInput
          accessibilityLabel="Comentario del lote"
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
          placeholder="Comentario común para las respuestas seleccionadas"
          placeholderTextColor={tokens.text.muted}
          className="min-h-[100px] rounded-xl border p-3"
          style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }}
        />

        {configuration.rubrics.length ? (
          <AppDropdown<string>
            label="Rúbrica"
            value={rubricId}
            options={configuration.rubrics.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => { setRubricId(value); setScores({}) }}
            placeholder="Sin rúbrica"
          />
        ) : null}

        {rubric ? rubric.criteria.map((criterion) => (
          <View key={criterion.id} className="rounded-xl border p-3" style={{ borderColor: tokens.border.default }}>
            <Text className="font-black" style={{ color: tokens.text.primary }}>{criterion.label} · máximo {criterion.maxScore}</Text>
            <TextInput
              accessibilityLabel={`Puntuación del lote para ${criterion.label}`}
              keyboardType="number-pad"
              value={String(scores[criterion.id] ?? '')}
              onChangeText={(value) => setScores((current) => ({ ...current, [criterion.id]: Math.max(0, Math.min(criterion.maxScore, Number(value) || 0)) }))}
              className="mt-2 min-h-11 rounded-xl border px-3"
              style={{ borderColor: tokens.border.default, color: tokens.text.primary, backgroundColor: tokens.background.primary }}
            />
          </View>
        )) : null}
      </View>
    </AppBottomSheet>
  )
}
