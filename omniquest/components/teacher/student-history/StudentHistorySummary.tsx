import React, { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherStudentHistorySummaryPayload } from '../../../lib/teacherServerData'

export default function StudentHistorySummary({
  data,
  savingNote,
  onRecommendation,
  onAddNote,
}: {
  data: TeacherStudentHistorySummaryPayload
  savingNote: boolean
  onRecommendation: () => void
  onAddNote: (body: string) => Promise<void>
}) {
  const { tokens } = useAppTheme()
  const [note, setNote] = useState('')
  const summary = data.summary
  const delta = data.comparison.delta

  const submitNote = async () => {
    const body = note.trim()
    if (!body) return
    await onAddNote(body)
    setNote('')
  }

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-3">
        <Metric label="Intentos" value={String(summary.attempts)} icon="flash-outline" />
        <Metric label="Precisión" value={summary.accuracyPercent === null ? 'Sin datos' : `${summary.accuracyPercent}%`} icon="analytics-outline" />
        <Metric label="XP del periodo" value={String(summary.earnedXp)} icon="star-outline" />
        <Metric label="Cobertura" value={summary.coveragePercent === null ? 'Sin datos' : `${summary.coveragePercent}%`} icon="layers-outline" />
      </View>

      <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.selected }}>
        <View className="flex-row flex-wrap items-start gap-4">
          <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: tokens.surface.raised }}>
            <Ionicons name="sparkles-outline" size={24} color={tokens.brand.teacher} />
          </View>
          <View className="min-w-[250px] flex-1">
            <Text className="text-[11px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.brand.teacher }}>Acción recomendada</Text>
            <Text className="mt-2 text-[19px] font-black" style={{ color: tokens.text.primary }}>{data.recommendation.title}</Text>
            <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>{data.recommendation.reason}</Text>
          </View>
          <AppButton label={data.recommendation.actionLabel} icon="arrow-forward" iconPosition="right" role="teacher" onPress={onRecommendation} />
        </View>
      </View>

      <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className="text-[17px] font-black" style={{ color: tokens.text.primary }}>Comparación con el periodo anterior</Text>
        <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>Se comparan dos ventanas consecutivas de {summary.periodDays} días.</Text>
        <View className="mt-4 flex-row flex-wrap gap-3">
          <DeltaMetric label="Intentos" value={delta.attempts} suffix="" />
          <DeltaMetric label="Precisión" value={delta.accuracyPoints} suffix=" pp" />
          <DeltaMetric label="XP" value={delta.earnedXp} suffix="" />
        </View>
      </View>

      <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className="text-[17px] font-black" style={{ color: tokens.text.primary }}>Comentarios docentes</Text>
        <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>Notas privadas visibles solo para el profesorado responsable y administradores.</Text>
        <TextInput
          accessibilityLabel="Nuevo comentario docente"
          accessibilityHint="Escribe una observación privada sobre el alumno"
          multiline
          textAlignVertical="top"
          className="mt-4 min-h-[90px] rounded-xl border px-4 py-3"
          style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }}
          placeholder="Ejemplo: revisar fracciones en la próxima tutoría"
          placeholderTextColor={tokens.text.muted}
          value={note}
          onChangeText={setNote}
          maxLength={2000}
        />
        <View className="mt-3 flex-row justify-end">
          <AppButton label="Guardar comentario" icon="save-outline" role="teacher" loading={savingNote} disabled={!note.trim()} onPress={() => { void submitNote() }} />
        </View>
        <View className="mt-4 gap-3">
          {data.notes.length ? data.notes.map((item) => (
            <View key={item.id} className="rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
              <Text className="text-[13px] leading-5" style={{ color: tokens.text.primary }}>{item.body}</Text>
              <Text className="mt-2 text-[11px]" style={{ color: tokens.text.muted }}>{formatDateTime(item.createdAt)}</Text>
            </View>
          )) : <Text className="text-[13px]" style={{ color: tokens.text.muted }}>Todavía no hay comentarios docentes.</Text>}
        </View>
      </View>
    </View>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { tokens } = useAppTheme()
  return (
    <View className="min-w-[170px] flex-1 rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <Ionicons name={icon} size={21} color={tokens.brand.teacher} />
      <Text className="mt-3 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>{label}</Text>
      <Text className="mt-1 text-[24px] font-black" style={{ color: tokens.text.primary }}>{value}</Text>
    </View>
  )
}

function DeltaMetric({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const { tokens } = useAppTheme()
  const color = value > 0 ? tokens.semantic.success : value < 0 ? tokens.semantic.danger : tokens.text.secondary
  return (
    <View className="min-w-[150px] flex-1 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
      <Text className="text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>{label}</Text>
      <Text className="mt-1 text-[20px] font-black" style={{ color }}>{value > 0 ? '+' : ''}{value}{suffix}</Text>
    </View>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}
