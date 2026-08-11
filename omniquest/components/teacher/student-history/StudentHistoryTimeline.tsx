import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import PaginationControls from '../../ui/PaginationControls'
import { useAppTheme } from '../../../lib/appTheme'
import { formatCount } from '../../../lib/formatCount'
import type { TeacherStudentHistoryTimelineItem } from '../../../lib/teacherServerData'

export default function StudentHistoryTimeline({ items, total, page, pageSize, onPage }: { items: TeacherStudentHistoryTimelineItem[]; total: number; page: number; pageSize: number; onPage: (page: number) => void }) {
  const { tokens } = useAppTheme()
  if (!items.length) return <Empty icon="time-outline" message="No hay actividad registrada en el historial." />

  return (
    <View>
      <View className="mb-3">
        <Text className="text-[14px] font-black" style={{ color: tokens.text.primary }}>Actividad histórica · {formatCount(total, 'intento', 'intentos')}</Text>
        <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>Se muestra el historial completo; el periodo de análisis no limita esta pestaña.</Text>
      </View>
      <View accessibilityRole="list" className="gap-3">
        {items.map((item) => {
          const state = getAttemptState(item, tokens)
          const answerText = item.was_skipped || item.answer_text === 'Sin respuesta registrada' ? 'Sin responder' : item.answer_text
          return (
            <View key={item.id} accessible accessibilityLabel={`${item.question_text}. ${state.label}. ${item.earned_points} XP.`} className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
              <View className="flex-row flex-wrap items-start gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: state.background }}><Ionicons name={state.icon} size={20} color={state.color} /></View>
                <View className="min-w-[230px] flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="flex-1 font-black" style={{ color: tokens.text.primary }}>{item.question_text}</Text>
                    <Text className="text-[10px] font-black uppercase" style={{ color: state.color }}>{state.label}</Text>
                  </View>
                  <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>{item.subject_name} · {item.topic_title} · {formatDateTime(item.attempted_at)}</Text>
                  <Text className="mt-3 text-[13px]" style={{ color: item.was_skipped ? tokens.text.muted : tokens.text.secondary }}>Respuesta: {answerText}</Text>
                  {item.review_notes ? <Text className="mt-2 text-[12px]" style={{ color: tokens.semantic.info }}>Feedback: {item.review_notes}</Text> : null}
                </View>
                <View className="items-end">
                  <Text className="font-black" style={{ color: tokens.gamification.xp }}>+{item.earned_points} XP</Text>
                  {item.comments_count > 0 ? <Text className="mt-2 text-[11px]" style={{ color: tokens.text.muted }}>{formatCount(item.comments_count, 'comentario', 'comentarios')}</Text> : null}
                </View>
              </View>
            </View>
          )
        })}
      </View>
      <PaginationControls page={page} pageSize={pageSize} total={total} onPrevious={() => onPage(Math.max(0, page - 1))} onNext={() => onPage(Math.min(Math.max(0, Math.ceil(total / pageSize) - 1), page + 1))} />
    </View>
  )
}

function getAttemptState(item: TeacherStudentHistoryTimelineItem, tokens: ReturnType<typeof useAppTheme>['tokens']) {
  const status = (item.manual_review_status || 'not_required').toLowerCase()
  if (item.was_skipped) return { label: 'Sin responder', icon: 'remove-circle-outline' as const, color: tokens.text.muted, background: tokens.surface.raised }
  if (status === 'pending' || status === 'in_review') return { label: status === 'in_review' ? 'En revisión' : 'Pendiente de revisión', icon: 'time-outline' as const, color: tokens.semantic.warning, background: tokens.semanticSurface.warning }
  if (status === 'needs_changes') return { label: 'Necesita cambios', icon: 'refresh-outline' as const, color: tokens.semantic.warning, background: tokens.semanticSurface.warning }
  if (item.is_correct) return { label: 'Correcta', icon: 'checkmark' as const, color: tokens.semantic.success, background: tokens.semanticSurface.success }
  return { label: 'Incorrecta', icon: 'close' as const, color: tokens.semantic.danger, background: tokens.semanticSurface.danger }
}

function Empty({ icon, message }: { icon: keyof typeof Ionicons.glyphMap; message: string }) {
  const { tokens } = useAppTheme()
  return <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}><Ionicons name={icon} size={42} color={tokens.text.muted} /><Text className="mt-3 text-center" style={{ color: tokens.text.muted }}>{message}</Text></View>
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}
