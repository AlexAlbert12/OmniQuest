import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppButton from '../../ui/AppButton'
import AppDropdown from '../../ui/AppDropdown'
import AppTabs from '../../ui/AppTabs'
import AppStatusBanner from '../../ui/AppStatusBanner'
import { useAppTheme } from '../../../lib/appTheme'
import type {
  ManualReviewComment,
  ManualReviewConfiguration,
  ManualReviewHistoryItem,
  ManualReviewQueueRow,
  ManualReviewStatus,
} from '../../../lib/teacherManualReview'

export default function ManualReviewDetailSheet({
  row,
  configuration,
  visible,
  busy,
  onClose,
  onLoadDetail,
  onReview,
}: {
  row: ManualReviewQueueRow | null
  configuration: ManualReviewConfiguration
  visible: boolean
  busy: boolean
  onClose: () => void
  onLoadDetail: (row: ManualReviewQueueRow) => Promise<{ comments: ManualReviewComment[]; history: ManualReviewHistoryItem[] }>
  onReview: (input: {
    id: number
    status: ManualReviewStatus
    notes?: string
    audience?: 'student' | 'internal'
    rubricId?: string | null
    rubricResult?: Record<string, number> | null
  }) => Promise<void>
}) {
  const { tokens } = useAppTheme()
  const [comments, setComments] = useState<ManualReviewComment[]>([])
  const [history, setHistory] = useState<ManualReviewHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [audience, setAudience] = useState<'student' | 'internal'>('student')
  const [rubricId, setRubricId] = useState<string | null>(null)
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<'review' | 'history'>('review')
  const selectedRubric = useMemo(() => configuration.rubrics.find((item) => item.id === rubricId) || null, [configuration.rubrics, rubricId])

  useEffect(() => {
    if (!visible || !row) return
    setLoading(true)
    setNotes('')
    setAudience('student')
    setRubricId(row.rubric_id)
    setRubricScores(row.rubric_result || {})
    setTab('review')
    void onLoadDetail(row)
      .then((result) => {
        setComments(result.comments)
        setHistory(result.history)
      })
      .finally(() => setLoading(false))
  }, [onLoadDetail, row, visible])

  const applyTemplate = (templateId: string) => {
    const template = configuration.templates.find((item) => item.id === templateId)
    if (!template) return
    setNotes(template.body)
    setAudience(template.audience)
  }

  const submit = async (status: ManualReviewStatus) => {
    if (!row) return
    await onReview({ id: row.id, status, notes, audience, rubricId, rubricResult: rubricScores })
    onClose()
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
          {row.is_overdue ? <AppStatusBanner variant="danger" title="SLA vencido" message={`La respuesta lleva ${formatPending(row.pending_seconds)} pendiente.`} style={{ marginBottom: 14 }} /> : null}

          <AppTabs<'review' | 'history'>
            accessibilityLabel="Secciones de la revisión"
            compact
            role="teacher"
            items={[
              { key: 'review', label: 'Revisión', icon: 'create-outline', badge: comments.length },
              { key: 'history', label: 'Historial inmutable', icon: 'time-outline', badge: history.length },
            ]}
            value={tab}
            onChange={setTab}
          />

          {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={tokens.brand.teacher} /> : tab === 'history' ? (
            <View className="mt-4 gap-3">
              {history.length ? history.map((item) => (
                <View key={item.id} className="rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
                  <Text className="font-black" style={{ color: tokens.text.primary }}>{historyLabel(item.eventType)}</Text>
                  <Text className="mt-1 text-[12px]" style={{ color: tokens.text.secondary }}>{item.actorName} · {formatDate(item.createdAt)}</Text>
                  {item.fromStatus !== item.toStatus ? <Text className="mt-2 text-[12px]" style={{ color: tokens.text.muted }}>{item.fromStatus || '—'} → {item.toStatus || '—'}</Text> : null}
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

              {configuration.rubrics.length ? (
                <Section title="Rúbrica">
                  <AppDropdown<string>
                    value={rubricId}
                    options={configuration.rubrics
                      .filter((item) => item.subject_id == null || item.subject_id === row.subject_id)
                      .map((item) => ({ value: item.id, label: item.name, description: `${item.criteria.length} criterios` }))}
                    onChange={setRubricId}
                    placeholder="Sin rúbrica"
                  />
                  {selectedRubric ? (
                    <View className="mt-3 gap-3">
                      {selectedRubric.criteria.map((criterion) => (
                        <View key={criterion.id} className="rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
                          <View className="flex-row items-center justify-between gap-3">
                            <Text className="min-w-0 flex-1 font-black" style={{ color: tokens.text.primary }}>{criterion.label}</Text>
                            <Text style={{ color: tokens.text.muted }}>/{criterion.maxScore}</Text>
                          </View>
                          <TextInput
                            accessibilityLabel={`Puntuación para ${criterion.label}`}
                            keyboardType="number-pad"
                            value={String(rubricScores[criterion.id] ?? '')}
                            onChangeText={(value) => {
                              const numeric = Math.max(0, Math.min(criterion.maxScore, Number(value) || 0))
                              setRubricScores((current) => ({ ...current, [criterion.id]: numeric }))
                            }}
                            className="mt-2 min-h-11 rounded-xl border px-3"
                            style={{ borderColor: tokens.border.default, color: tokens.text.primary, backgroundColor: tokens.background.primary }}
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Section>
              ) : null}

              {configuration.templates.length ? (
                <Section title="Comentario predefinido">
                  <AppDropdown<string>
                    value={null}
                    options={configuration.templates.map((item) => ({ value: item.id, label: item.title, description: item.audience === 'internal' ? 'Nota interna' : 'Visible para alumno' }))}
                    onChange={applyTemplate}
                    placeholder="Insertar comentario"
                  />
                </Section>
              ) : null}

              <Section title="Comentario">
                <AppTabs<'student' | 'internal'>
                  accessibilityLabel="Visibilidad del comentario"
                  compact
                  role="teacher"
                  items={[
                    { key: 'student', label: 'Visible para alumno', icon: 'eye-outline' },
                    { key: 'internal', label: 'Nota interna', icon: 'lock-closed-outline' },
                  ]}
                  value={audience}
                  onChange={setAudience}
                />
                <TextInput
                  accessibilityLabel="Comentario de revisión"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  textAlignVertical="top"
                  placeholder="Explica la decisión o deja una indicación..."
                  placeholderTextColor={tokens.text.muted}
                  className="mt-3 min-h-[110px] rounded-xl border p-3"
                  style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }}
                />
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { tokens } = useAppTheme()
  return <View><Text className="mb-2 text-[11px] font-black uppercase tracking-wide" style={{ color: tokens.text.muted }}>{title}</Text>{children}</View>
}

function formatPending(seconds: number) {
  const hours = Math.max(1, Math.floor(seconds / 3600))
  return hours < 24 ? `${hours} horas` : `${Math.floor(hours / 24)} días y ${hours % 24} horas`
}
function formatDate(value: string) { return new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) }
function historyLabel(event: string) {
  if (event === 'status_changed') return 'Estado actualizado'
  if (event === 'assigned') return 'Revisión reasignada'
  if (event === 'rubric_scored') return 'Rúbrica evaluada'
  return 'Revisión actualizada'
}
