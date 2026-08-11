import React, { useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
import AppTabs from '../../ui/AppTabs'
import AppStatusBanner from '../../ui/AppStatusBanner'
import { useAppTheme } from '../../../lib/appTheme'
import type { ManualReviewConfiguration, ManualReviewDecision } from '../../../lib/teacherManualReview'

export default function ManualReviewBatchSheet({ visible, selectedCount, questionCount, configuration, busy, onClose, onSubmit }: { visible: boolean; selectedCount: number; questionCount: number; configuration: ManualReviewConfiguration; busy: boolean; onClose: () => void; onSubmit: (input: { status: ManualReviewDecision; notes?: string; audience?: 'student' | 'internal' }) => Promise<void> }) {
  const { tokens } = useAppTheme()
  const [status, setStatus] = useState<ManualReviewDecision>('approved')
  const [notes, setNotes] = useState('')
  const [audience, setAudience] = useState<'student' | 'internal'>('student')
  const [confirmMixedQuestions, setConfirmMixedQuestions] = useState(false)
  const requiresComment = status === 'needs_changes' || status === 'rejected'
  const commentMissing = requiresComment && !notes.trim()
  const audienceInvalid = requiresComment && audience !== 'student'
  const decisionInvalid = commentMissing || audienceInvalid

  useEffect(() => { if (visible) setConfirmMixedQuestions(false) }, [visible])
  useEffect(() => { setConfirmMixedQuestions(false) }, [status, notes, audience])

  const applyTemplate = (id: string) => {
    const template = configuration.templates.find((item) => item.id === id)
    if (!template) return
    setNotes(template.body)
    setAudience(template.audience)
  }

  const submit = async () => {
    if (decisionInvalid) return
    if (questionCount > 1 && !confirmMixedQuestions) { setConfirmMixedQuestions(true); return }
    await onSubmit({ status, notes, audience })
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
          <AppButton label={confirmMixedQuestions ? `Confirmar y aplicar a ${selectedCount} respuestas` : `Aplicar a ${selectedCount} respuestas`} icon="checkmark-done-outline" role="teacher" loading={busy} disabled={decisionInvalid || selectedCount === 0} onPress={() => void submit()} />
        </View>
      )}
    >
      <View className="gap-4">
        {questionCount > 1 ? <AppStatusBanner variant={confirmMixedQuestions ? 'warning' : 'info'} title={confirmMixedQuestions ? 'Confirma el lote' : 'Varias preguntas seleccionadas'} message={confirmMixedQuestions ? `Vas a aplicar la misma decisión a ${selectedCount} respuestas de ${questionCount} preguntas diferentes. Pulsa de nuevo para confirmar.` : `Las respuestas seleccionadas pertenecen a ${questionCount} preguntas diferentes.`} /> : null}

        {audienceInvalid ? <AppStatusBanner variant="warning" title="Comentario visible obligatorio" message="Necesita cambios y Rechazar requieren un comentario visible para el alumno." /> : null}

        <View>
          <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Decisión</Text>
          <AppTabs<ManualReviewDecision> accessibilityLabel="Decisión para el lote" compact role="teacher" items={[{ key: 'approved', label: 'Aprobar', icon: 'checkmark-circle-outline' }, { key: 'needs_changes', label: 'Necesita cambios', icon: 'refresh-outline' }, { key: 'rejected', label: 'Rechazar', icon: 'close-circle-outline' }]} value={status} onChange={setStatus} />
        </View>

        {configuration.templates.length ? <AppDropdown<string> label="Comentario predefinido" value={null} options={configuration.templates.map((item) => ({ value: item.id, label: item.title, description: item.audience === 'internal' ? 'Nota interna' : 'Visible para alumno' }))} onChange={applyTemplate} placeholder="Selecciona una plantilla" /> : null}

        <View>
          <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Visibilidad</Text>
          <AppTabs<'student' | 'internal'> accessibilityLabel="Visibilidad del comentario del lote" compact role="teacher" items={[{ key: 'student', label: 'Visible para alumno', icon: 'eye-outline' }, { key: 'internal', label: 'Nota interna', icon: 'lock-closed-outline' }]} value={audience} onChange={setAudience} />
        </View>

        <View>
          <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: commentMissing ? tokens.semantic.warning : tokens.text.muted }}>{requiresComment ? 'Comentario obligatorio' : 'Comentario opcional'}</Text>
          <TextInput accessibilityLabel="Comentario del lote" value={notes} onChangeText={setNotes} multiline textAlignVertical="top" placeholder={requiresComment ? 'Explica la decisión para las respuestas seleccionadas' : 'Comentario común opcional'} placeholderTextColor={tokens.text.muted} className="min-h-[100px] rounded-xl border p-3" style={{ borderColor: commentMissing ? tokens.semantic.warning : tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }} />
        </View>
      </View>
    </AppBottomSheet>
  )
}
