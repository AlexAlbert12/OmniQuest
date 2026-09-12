import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppStatusBanner from '../../ui/AppStatusBanner'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherQuestionReportSummary } from '../../../lib/teacherQuestionReport'
import { getDiscriminationLabel, getFailureTrendLabel, getQuestionFailureRate } from '../../../lib/teacherQuestionReportPresentation'

export default function QuestionDiagnosisCard({ summary }: { summary: TeacherQuestionReportSummary }) {
  const { tokens } = useAppTheme()
  const rawFailureRate = getQuestionFailureRate(summary)
  const failureRate = rawFailureRate == null ? null : Math.round(rawFailureRate * 100)
  const discriminationLabel = getDiscriminationLabel(summary.discrimination)
  const trend = summary.failureTrendPoints

  return (
    <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: tokens.semanticSurface.info }}>
          <Ionicons name="analytics-outline" size={25} color={tokens.semantic.info} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[19px] font-black" style={{ color: tokens.text.primary }}>Diagnóstico de la pregunta</Text>
          <Text className="mt-1 text-[12px]" style={{ color: tokens.text.secondary }}>Muestra, dificultad, abandono, tiempo y poder de discriminación.</Text>
        </View>
      </View>

      {summary.lowSample ? (
        <AppStatusBanner
          variant="warning"
          title="Muestra todavía pequeña"
          message={`Solo hay ${summary.sampleSize} alumno${summary.sampleSize === 1 ? '' : 's'} en la muestra. Interpreta porcentajes y tendencias con cautela.`}
          style={{ marginTop: 16 }}
        />
      ) : null}

      <View className="mt-4 flex-row flex-wrap gap-3">
        <Metric label="Tamaño de muestra" value={String(summary.sampleSize)} detail={`${summary.totalAttempts} intentos`} color={tokens.brand.teacher} />
        <Metric label="Tasa de fallo" value={failureRate == null ? '—' : `${failureRate}%`} detail={`${summary.failedAttempts} fallos · ${summary.evaluatedAttempts} evaluados`} color={failureRate != null && failureRate >= 50 ? tokens.semantic.danger : tokens.semantic.warning} />
        {summary.pendingAttempts > 0 ? <Metric label="Pendientes" value={String(summary.pendingAttempts)} detail="Revisión manual pendiente" color={tokens.semantic.warning} /> : null}
        <Metric label="Abandono" value={`${Number(summary.abandonmentPercent || 0).toFixed(1)}%`} detail="Respuestas omitidas" color={tokens.semantic.warning} />
        <Metric label="Tiempo medio" value={summary.averageTimeSeconds == null ? '—' : `${summary.averageTimeSeconds}s`} detail="Por intento" color={tokens.semantic.info} />
        <Metric label="Discriminación" value={summary.discrimination == null ? '—' : summary.discrimination.toFixed(2)} detail={discriminationLabel} color={summary.discrimination != null && summary.discrimination >= 0.3 ? tokens.semantic.success : tokens.semantic.warning} />
        <Metric label="Tendencia 7 días" value={`${trend > 0 ? '+' : ''}${Number(trend || 0).toFixed(1)} p.p.`} detail={getFailureTrendLabel(trend)} color={trend > 0 ? tokens.semantic.danger : trend < 0 ? tokens.semantic.success : tokens.text.muted} />
      </View>
    </View>
  )
}

function Metric({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  const { tokens } = useAppTheme()
  return (
    <View className="min-w-[145px] flex-1 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
      <Text className="text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>{label}</Text>
      <Text className="mt-2 text-[23px] font-black" style={{ color }}>{value}</Text>
      <Text className="mt-1 text-[11px]" style={{ color: tokens.text.secondary }}>{detail}</Text>
    </View>
  )
}
