import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import PaginationControls from '../../ui/PaginationControls'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherStudentHistoryTimelineItem } from '../../../lib/teacherServerData'

export default function StudentHistoryTimeline({
  items,
  total,
  page,
  pageSize,
  onPage,
}: {
  items: TeacherStudentHistoryTimelineItem[]
  total: number
  page: number
  pageSize: number
  onPage: (page: number) => void
}) {
  const { tokens } = useAppTheme()
  if (!items.length) return <Empty icon="time-outline" message="No hay actividad con los filtros seleccionados." />

  return (
    <View>
      <View accessibilityRole="list" className="gap-3">
        {items.map((item) => (
          <View key={item.id} accessible accessibilityLabel={`${item.question_text}. ${item.is_correct ? 'Correcta' : 'Incorrecta'}. ${item.earned_points} XP.`} className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
            <View className="flex-row flex-wrap items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: item.is_correct ? tokens.semanticSurface.success : tokens.semanticSurface.danger }}>
                <Ionicons name={item.is_correct ? 'checkmark' : 'close'} size={20} color={item.is_correct ? tokens.semantic.success : tokens.semantic.danger} />
              </View>
              <View className="min-w-[230px] flex-1">
                <Text className="font-black" style={{ color: tokens.text.primary }}>{item.question_text}</Text>
                <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>{item.subject_name} · {item.topic_title} · {formatDateTime(item.attempted_at)}</Text>
                <Text className="mt-3 text-[13px]" style={{ color: tokens.text.secondary }}>Respuesta: {item.answer_text}</Text>
                {item.review_notes ? <Text className="mt-2 text-[12px]" style={{ color: tokens.semantic.info }}>Feedback: {item.review_notes}</Text> : null}
              </View>
              <View className="items-end">
                <Text className="font-black" style={{ color: tokens.gamification.xp }}>+{item.earned_points} XP</Text>
                {item.comments_count > 0 ? <Text className="mt-2 text-[11px]" style={{ color: tokens.text.muted }}>{item.comments_count} comentario(s)</Text> : null}
              </View>
            </View>
          </View>
        ))}
      </View>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        onPrevious={() => onPage(Math.max(0, page - 1))}
        onNext={() => onPage(Math.min(Math.max(0, Math.ceil(total / pageSize) - 1), page + 1))}
      />
    </View>
  )
}

function Empty({ icon, message }: { icon: keyof typeof Ionicons.glyphMap; message: string }) {
  const { tokens } = useAppTheme()
  return (
    <View className="items-center rounded-2xl border p-8" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <Ionicons name={icon} size={42} color={tokens.text.muted} />
      <Text className="mt-3 text-center" style={{ color: tokens.text.muted }}>{message}</Text>
    </View>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}
