import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
import AppTabs from '../../ui/AppTabs'
import AppStatusBanner from '../../ui/AppStatusBanner'
import { useAppTheme } from '../../../lib/appTheme'
import type { ManualReviewComment, ManualReviewConfiguration, ManualReviewDecision, ManualReviewHistoryItem, ManualReviewQueueRow } from '../../../lib/teacherManualReview'

export default function ManualReviewDetailSheet({ row, configuration, visible, busy, onClose, onLoadDetail, onReview }: { row: ManualReviewQueueRow | null; configuration: ManualReviewConfiguration; visible: boolean; busy: boolean; onClose: () => void; onLoadDetail: (row: ManualReviewQueueRow) => Promise<{ comments: ManualReviewComment[]; history: ManualReviewHistoryItem[] }>; onReview: (input: { id: number; status: ManualReviewDecision; notes?: string; audience?: 'student' | 'internal' }) => Promise<void> }) {
  const { tokens } = useAppTheme()
  const [comments, setComments] = useState<ManualReviewComment[]>([])
  const [history, setHistory] = useState<ManualReviewHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [audience, setAudience] = useState<'student' | 'internal'>('student')
  const [tab, setTab] = useState<'review' | 'history'>('review')
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !row) return
    setLoading(true)
    setNotes('')
    setAudience('student')
    setTab('review')
    setValidationMessage(null)
    void onLoadDetail(row).then((result) => { setComments(result.comments); setHistory(result.history) }).finally(() => setLoading(false))
  }, [onLoadDetail, row, visible])

  const applyTemplate = (templateId: string) => {
    const template = configuration.templates.find((item) => item.id === templateId)
    if (!template) return
    setNotes(template.body)
    setAudience(template.audience)
    setValidationMessage(null)
  }

  const submit = async (status: ManualReviewDecision) => {
    if (!row) return
    if ((status === 'needs_changes' || status === 'rejected') && !notes.trim()) {
      setValidationMessage(status === 'needs_changes' ? 'Indica al alumno qué debe cambiar antes de marcar esta decisión.' : 'Añade un comentario antes de rechazar la respuesta.')
      return
    }
    if ((status === 'needs_changes' || status === 'rejected') && audience !== 'student') {
      setValidationMessage('Para esta decisión, el comentario debe ser visible para el alumno.')
      return
    }
    setValidationMessage(null)
    try {
      await onReview({ id: row.id, status, notes, audience })
      onClose()
    } catch {
    }
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title={row ? `Revisión de ${row.student_name}` : 'Revisión manual'}
      description={row?.question_text}
      scrollable
      closeOnBackdropPress={!busy}
      footer={row ? (
        <View className="flex-row flex-wrap justify-end gap-2">
          <AppButton label="Necesita cambios" icon="refresh-outline" variant="secondary" loading={busy} onPress={() => void submit('needs_changes')} />
          <AppButton label="Rechazar" icon="close-circle-outline" variant="danger" disabled={busy} onPress={() => void submit('rejected')} />
          <AppButton label="Aprobar" icon="checkmark-circle-outline" variant="success" disabled={busy} onPress={() => void submit('approved')} />
        </View>
      ) : undefined}
    >
      {!row ? null : (
        <View>
          {row.is_overdue && row.due_at ? <AppStatusBanner variant="danger" title="Plazo vencido" message={`Venció el ${formatDate(row.due_at)}.`} style={{ marginBottom: 14 }} /> : null}
          {validationMessage ? <AppStatusBanner variant="warning" title="Comentario obligatorio" message={validationMessage} style={{ marginBottom: 14 }} /> : null}

          <AppTabs<'review' | 'history'>
            accessibilityLabel="Secciones de la revisión"
            compact
            role="teacher"
            items={[{ key: 'review', label: 'Revisión', icon: 'create-outline' }, { key: 'history', label: 'Historial inmutable', icon: 'time-outline', badge: history.length || undefined }]}
            value={tab}
            onChange={setTab}
          />

          {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={tokens.brand.teacher} /> : tab === 'history' ? (
            <View className="mt-4 gap-3">
              {history.length ? history.map((item) => (
                <View key={item.id} className="rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
                  <Text className="font-black" style={{ color: tokens.text.primary }}>{historyLabel(item.eventType)}</Text>
                  <Text className="mt-1 text-[12px]" style={{ color: tokens.text.secondary }}>{item.actorName} · {formatDate(item.createdAt)}</Text>
                  {item.fromStatus !== item.toStatus ? <Text className="mt-2 text-[12px]" style={{ color: tokens.text.muted }}>{statusLabel(item.fromStatus)} → {statusLabel(item.toStatus)}</Text> : null}
                </View>
              )) : <Text className="mt-6 text-center" style={{ color: tokens.text.muted }}>Todavía no hay cambios registrados.</Text>}
            </View>
          ) : (
            <View className="mt-4 gap-4">
              <Section title="Respuesta del alumno">
                <View className="rounded-xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
                  <Text className="text-[14px] leading-6" style={{ color: tokens.text.primary }}>{row.answer_text || 'Sin respuesta escrita'}</Text>
                </View>
              </Section>

              {configuration.templates.length ? (
                <Section title="Comentario predefinido">
                  <AppDropdown<string> value={null} options={configuration.templates.map((item) => ({ value: item.id, label: item.title, description: item.audience === 'internal' ? 'Nota interna' : 'Visible para alumno' }))} onChange={applyTemplate} placeholder="Insertar comentario" />
                </Section>
              ) : null}

              <Section title="Comentario">
                <AppTabs<'student' | 'internal'> accessibilityLabel="Visibilidad del comentario" compact role="teacher" items={[{ key: 'student', label: 'Visible para alumno', icon: 'eye-outline' }, { key: 'internal', label: 'Nota interna', icon: 'lock-closed-outline' }]} value={audience} onChange={(value) => { setAudience(value); setValidationMessage(null) }} />
                <TextInput accessibilityLabel="Comentario de revisión" value={notes} onChangeText={(value) => { setNotes(value); setValidationMessage(null) }} multiline textAlignVertical="top" placeholder="Explica la decisión o deja una indicación..." placeholderTextColor={tokens.text.muted} className="mt-3 min-h-[110px] rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }} />
              </Section>

              <Section title="Comentarios anteriores">
                {comments.length ? comments.map((comment) => (
                  <View key={comment.id} className="mb-2 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name={comment.audience === 'internal' ? 'lock-closed-outline' : 'eye-outline'} size={15} color={comment.audience === 'internal' ? tokens.semantic.warning : tokens.semantic.info} />
                      <Text className="font-black" style={{ color: tokens.text.primary }}>{comment.author_name}</Text>
                    </View>
                    <Text className="mt-2 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>{comment.body}</Text>
                  </View>
                )) : <Text style={{ color: tokens.text.muted }}>Sin comentarios previos.</Text>}
              </Section>
            </View>
          )}
        </View>
      )}
    </AppBottomSheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { const { tokens } = useAppTheme(); return <View><Text className="mb-2 text-[11px] font-black uppercase tracking-wide" style={{ color: tokens.text.muted }}>{title}</Text>{children}</View> }
function formatDate(value: string) { return new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) }
function historyLabel(event: string) { return event === 'status_changed' ? 'Estado actualizado' : 'Revisión actualizada' }
function statusLabel(status: string | null) { if (!status) return '—'; if (status === 'pending') return 'Pendiente'; if (status === 'needs_changes') return 'Necesita cambios'; if (status === 'approved') return 'Aprobada'; if (status === 'rejected') return 'Rechazada'; return status }
