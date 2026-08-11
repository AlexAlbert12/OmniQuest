import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import PaginationControls from '../../ui/PaginationControls'
import { useAppTheme } from '../../../lib/appTheme'
import { formatCount } from '../../../lib/formatCount'
import type { TeacherStudentHistoryReview } from '../../../lib/teacherServerData'

export default function StudentHistoryReviews({ items, total, page, pageSize, onPage, onOpenReview }: { items: TeacherStudentHistoryReview[]; total: number; page: number; pageSize: number; onPage: (page: number) => void; onOpenReview?: (item: TeacherStudentHistoryReview) => void }) {
  const { tokens } = useAppTheme()
  if (!items.length) return <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}><Text style={{ color: tokens.text.muted }}>No hay respuestas de revisión manual.</Text></View>
  return (
    <View>
      <View className="mb-3">
        <Text className="text-[14px] font-black" style={{ color: tokens.text.primary }}>{formatCount(total, 'revisión', 'revisiones')}</Text>
        <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>Se muestran todas las revisiones del historial, independientemente del periodo de análisis.</Text>
      </View>
      <View className="gap-3">
        {items.map((item) => {
          const actionable = Boolean(onOpenReview)
          const actionLabel = item.status === 'pending' || item.status === 'in_review' || item.status === 'needs_changes' ? 'Revisar' : 'Ver revisión'
          return (
            <Pressable key={item.id} accessibilityRole={actionable ? 'button' : undefined} accessibilityLabel={actionable ? `${actionLabel}: ${item.question_text}` : undefined} disabled={!actionable} onPress={() => onOpenReview?.(item)} className="rounded-2xl border p-4" style={({ pressed }) => ({ borderColor: tokens.border.default, backgroundColor: pressed && actionable ? tokens.surface.interactive : tokens.surface.default, opacity: pressed && actionable ? 0.86 : 1 })}>
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Text className="min-w-[230px] flex-1 font-black" style={{ color: tokens.text.primary }}>{item.question_text}</Text>
                <Text className="text-[11px] font-black uppercase" style={{ color: getStatusColor(item.status, tokens) }}>{formatStatus(item.status)}</Text>
              </View>
              <Text className="mt-2 text-[12px]" style={{ color: tokens.text.muted }}>{item.subject_name} · {item.topic_title}</Text>
              <Text className="mt-3 text-[13px]" style={{ color: tokens.text.secondary }}>Respuesta: {item.answer_text || 'Sin respuesta conservada'}</Text>
              {item.review_notes ? <Text className="mt-2 text-[13px]" style={{ color: tokens.semantic.info }}>Comentario: {item.review_notes}</Text> : null}
              {item.comments_count > 0 ? <Text className="mt-2 text-[11px]" style={{ color: tokens.text.muted }}>{formatCount(item.comments_count, 'comentario en el hilo', 'comentarios en el hilo')}</Text> : null}
              {actionable ? <View className="mt-3 flex-row items-center justify-end gap-1"><Text className="text-[12px] font-black" style={{ color: tokens.brand.teacher }}>{actionLabel}</Text><Ionicons name="arrow-forward" size={15} color={tokens.brand.teacher} /></View> : null}
            </Pressable>
          )
        })}
      </View>
      <PaginationControls page={page} pageSize={pageSize} total={total} onPrevious={() => onPage(Math.max(0, page - 1))} onNext={() => onPage(Math.min(Math.max(0, Math.ceil(total / pageSize) - 1), page + 1))} />
    </View>
  )
}

function formatStatus(value: string) {
  if (value === 'pending') return 'Pendiente'
  if (value === 'in_review') return 'En revisión'
  if (value === 'approved') return 'Aprobada'
  if (value === 'rejected') return 'Rechazada'
  if (value === 'needs_changes') return 'Necesita cambios'
  return value.replace(/_/g, ' ')
}

function getStatusColor(value: string, tokens: ReturnType<typeof useAppTheme>['tokens']) {
  if (value === 'approved') return tokens.semantic.success
  if (value === 'rejected') return tokens.semantic.danger
  return tokens.semantic.warning
}
