import React from 'react'
import { Text, View } from 'react-native'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherStudentHistoryReview } from '../../../lib/teacherServerData'

export default function StudentHistoryReviews({ items, total }: { items: TeacherStudentHistoryReview[]; total: number }) {
  const { tokens } = useAppTheme()
  if (!items.length) return <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}><Text style={{ color: tokens.text.muted }}>No hay respuestas de revisión manual.</Text></View>
  return (
    <View className="gap-3">
      <Text className="text-[12px] font-black" style={{ color: tokens.brand.teacher }}>{total} revisión(es)</Text>
      {items.map((item) => (
        <View key={item.id} className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="min-w-[230px] flex-1 font-black" style={{ color: tokens.text.primary }}>{item.question_text}</Text>
            <Text className="text-[11px] font-black uppercase" style={{ color: getStatusColor(item.status, tokens) }}>{formatStatus(item.status)}</Text>
          </View>
          <Text className="mt-2 text-[12px]" style={{ color: tokens.text.muted }}>{item.subject_name} · {item.topic_title}</Text>
          <Text className="mt-3 text-[13px]" style={{ color: tokens.text.secondary }}>Respuesta: {item.answer_text || 'Sin respuesta conservada'}</Text>
          {item.review_notes ? <Text className="mt-2 text-[13px]" style={{ color: tokens.semantic.info }}>Comentario: {item.review_notes}</Text> : null}
          {item.comments_count > 0 ? <Text className="mt-2 text-[11px]" style={{ color: tokens.text.muted }}>{item.comments_count} comentario(s) en el hilo</Text> : null}
        </View>
      ))}
    </View>
  )
}

function formatStatus(value: string) {
  if (value === 'pending') return 'Pendiente'
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
