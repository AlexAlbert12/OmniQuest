import React, { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { formatCount } from '../../../lib/formatCount'
import { useResponsiveLayout } from '../../../lib/responsive'
import type { TeacherStudentHistorySummaryPayload } from '../../../lib/teacherServerData'

export default function StudentHistorySummary({ data, savingNote, onRecommendation, onAddNote }: { data: TeacherStudentHistorySummaryPayload; savingNote: boolean; onRecommendation: () => void; onAddNote: (body: string) => Promise<void> }) {
  const { tokens } = useAppTheme()
  const { isDesktop } = useResponsiveLayout()
  const [note, setNote] = useState('')
  const summary = data.summary
  const delta = data.comparison.delta
  const accuracyDetail = `${formatCount(summary.evaluatedAttempts, 'respuesta evaluada', 'respuestas evaluadas')}${summary.pendingEvaluation > 0 ? ` · ${formatCount(summary.pendingEvaluation, 'pendiente', 'pendientes')}` : ''}`
  const coverageDetail = summary.availableQuestions > 0 ? `${summary.answeredQuestions} de ${summary.availableQuestions} preguntas trabajadas` : 'Sin preguntas disponibles'

  const submitNote = async () => {
    const body = note.trim()
    if (!body) return
    try {
      await onAddNote(body)
      setNote('')
    } catch {

    }
  }

  return (
    <View className="gap-4">
      <View className={isDesktop ? 'flex-row flex-wrap gap-3' : 'flex-row gap-2'}>
        <Metric isDesktop={isDesktop} mobileLabel="Intentos" label={`Intentos · últimos ${summary.periodDays} días`} value={String(summary.attempts)} detail="Actividad registrada en el periodo" icon="flash-outline" />
        <Metric isDesktop={isDesktop} label="Precisión" value={summary.accuracyPercent === null ? 'Sin datos' : `${summary.accuracyPercent}%`} detail={accuracyDetail} icon="analytics-outline" />
        <Metric isDesktop={isDesktop} label="XP del periodo" value={String(summary.earnedXp)} detail={`Últimos ${summary.periodDays} días`} icon="star-outline" />
        <Metric isDesktop={isDesktop} label="Cobertura" value={summary.coveragePercent === null ? 'Sin datos' : `${summary.coveragePercent}%`} detail={coverageDetail} icon="layers-outline" />
      </View>

      <View className={`rounded-2xl border ${isDesktop ? 'p-5' : 'p-3'}`} style={{ borderColor: tokens.border.active, backgroundColor: tokens.surface.selected }}>
        {isDesktop ? (
          <View className="flex-row flex-wrap items-start gap-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: tokens.surface.raised }}><Ionicons name="sparkles-outline" size={24} color={tokens.brand.teacher} /></View>
            <View className="min-w-[250px] flex-1">
              <Text className="text-[11px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.brand.teacher }}>Acción recomendada</Text>
              <Text className="mt-2 text-[19px] font-black" style={{ color: tokens.text.primary }}>{data.recommendation.title}</Text>
              <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>{data.recommendation.reason}</Text>
            </View>
            <AppButton label={data.recommendation.actionLabel} icon="arrow-forward" iconPosition="right" role="teacher" onPress={onRecommendation} />
          </View>
        ) : (
          <>
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tokens.surface.raised }}><Ionicons name="sparkles-outline" size={20} color={tokens.brand.teacher} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[10px] font-black uppercase tracking-[0.7px]" style={{ color: tokens.brand.teacher }}>Acción recomendada</Text>
                <Text className="mt-1 text-[16px] font-black" style={{ color: tokens.text.primary }} numberOfLines={2}>{data.recommendation.title}</Text>
                <Text className="mt-1 text-[11px] leading-4" style={{ color: tokens.text.secondary }} numberOfLines={2}>{data.recommendation.reason}</Text>
              </View>
            </View>
            <AppButton label={data.recommendation.actionLabel} icon="arrow-forward" iconPosition="right" role="teacher" size="sm" onPress={onRecommendation} style={{ marginTop: 10 }} />
          </>
        )}
      </View>

      <View className={`rounded-2xl border ${isDesktop ? 'p-5' : 'p-3'}`} style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className={`${isDesktop ? 'text-[17px]' : 'text-[15px]'} font-black`} style={{ color: tokens.text.primary }}>Comparación con el periodo anterior</Text>
        <Text className={`mt-1 ${isDesktop ? 'text-[12px]' : 'text-[11px] leading-4'}`} style={{ color: tokens.text.muted }}>Se comparan dos ventanas consecutivas de {summary.periodDays} días. La precisión excluye respuestas pendientes de evaluación.</Text>
        <View className={isDesktop ? 'mt-4 flex-row flex-wrap gap-3' : 'mt-3 flex-row gap-2'}>
          <DeltaMetric isDesktop={isDesktop} label="Intentos" value={delta.attempts} suffix="" />
          <DeltaMetric isDesktop={isDesktop} label="Precisión" value={delta.accuracyPoints} suffix=" pp" />
          <DeltaMetric isDesktop={isDesktop} label="XP" value={delta.earnedXp} suffix="" />
        </View>
      </View>

      <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className="text-[17px] font-black" style={{ color: tokens.text.primary }}>Comentarios docentes recientes</Text>
        <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>Notas privadas visibles solo para el profesorado responsable y administradores.</Text>
        <TextInput accessibilityLabel="Nuevo comentario docente" accessibilityHint="Escribe una observación privada sobre el alumno" multiline textAlignVertical="top" className="mt-4 min-h-[90px] rounded-xl border px-4 py-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, color: tokens.text.primary }} placeholder="Ejemplo: revisar fracciones en la próxima tutoría" placeholderTextColor={tokens.text.muted} value={note} onChangeText={setNote} maxLength={2000} />
        <View className="mt-3 flex-row justify-end"><AppButton label="Guardar comentario" icon="save-outline" role="teacher" loading={savingNote} disabled={!note.trim()} onPress={() => { void submitNote() }} /></View>
        <View className="mt-4 gap-3">
          {data.notes.length ? data.notes.map((item) => (
            <View key={item.id} className="rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
              <Text className="text-[13px] leading-5" style={{ color: tokens.text.primary }}>{item.body}</Text>
              <Text className="mt-2 text-[11px]" style={{ color: tokens.text.muted }}>{formatDateTime(item.createdAt)}</Text>
            </View>
          )) : <Text className="text-[13px]" style={{ color: tokens.text.muted }}>Todavía no hay comentarios docentes.</Text>}
          {data.notesTotal > data.notes.length ? <Text className="text-[11px]" style={{ color: tokens.text.muted }}>Mostrando {data.notes.length} de {data.notesTotal} comentarios recientes.</Text> : null}
        </View>
      </View>
    </View>
  )
}

function Metric({ label, mobileLabel, value, detail, icon, isDesktop }: { label: string; mobileLabel?: string; value: string; detail?: string; icon: keyof typeof Ionicons.glyphMap; isDesktop: boolean }) {
  const { tokens } = useAppTheme()

  if (!isDesktop) {
    return (
      <View
        accessible
        accessibilityLabel={`${label}: ${value}${detail ? `. ${detail}` : ''}`}
        className="min-w-0 flex-1 items-center justify-center rounded-xl border p-1.5"
        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}
      >
        <View className="w-full flex-row items-center justify-center gap-2">
          <Ionicons name={icon} size={18} color={tokens.brand.teacher} />
          <Text className="min-w-0 flex-1 text-center text-[16px] font-black" style={{ color: tokens.text.primary }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        </View>
        <Text className="mt-0.5 text-center text-[9px] font-black leading-3" style={{ color: tokens.text.muted }} numberOfLines={2}>{mobileLabel || label}</Text>
      </View>
    )
  }

  return (
    <View className="min-w-[170px] flex-1 rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="flex-row items-center justify-center gap-3">
        <Ionicons name={icon} size={21} color={tokens.brand.teacher} />
        <Text className="min-w-0 text-[11px] font-black uppercase" style={{ color: tokens.text.muted, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
        <Text className="min-w-0 text-[24px] font-black" style={{ color: tokens.text.primary, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
      {detail ? <Text className="mt-1 text-center text-[11px] leading-4" style={{ color: tokens.text.muted }}>{detail}</Text> : null}
    </View>
  )
}

function DeltaMetric({ label, value, suffix, isDesktop }: { label: string; value: number; suffix: string; isDesktop: boolean }) {
  const { tokens } = useAppTheme()
  const color = value > 0 ? tokens.semantic.success : value < 0 ? tokens.semantic.danger : tokens.text.secondary
  return <View className={`${isDesktop ? 'min-w-[150px] p-3' : 'min-w-0 p-2.5'} flex-1 rounded-xl border`} style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}><Text className={`${isDesktop ? 'text-[11px]' : 'text-[9px]'} font-black uppercase`} style={{ color: tokens.text.muted }}>{label}</Text><Text className={`mt-1 ${isDesktop ? 'text-[20px]' : 'text-[17px]'} font-black`} style={{ color }} numberOfLines={1}>{value > 0 ? '+' : ''}{value}{suffix}</Text></View>
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}
