import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppTabs from '../../ui/AppTabs'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherProfileMetrics as Metrics, TeacherProfilePeriod } from '../../../hooks/teacher/useTeacherProfile'

type Props = {
  metrics: Metrics
  period: TeacherProfilePeriod
  periodLabel: string
  participationDescription: string
  participationNumerator: number
  participationDenominator: number
  onPeriodChange: (period: TeacherProfilePeriod) => void
}

const periods = [
  { key: 30 as const, label: '30 días' },
  { key: 90 as const, label: '90 días' },
  { key: 365 as const, label: '12 meses' },
]

export default function TeacherProfileMetrics(props: Props) {
  const { tokens } = useAppTheme()
  const cards = [
    { label: 'Cursos activos', value: props.metrics.activeCourses, icon: 'book-outline' as const, detail: 'Estado actual' },
    { label: 'Alumnos participantes', value: props.metrics.participatingStudents, icon: 'people-outline' as const, detail: props.periodLabel },
    { label: 'Participación', value: `${props.metrics.participationPercent}%`, icon: 'pulse-outline' as const, detail: `${props.participationNumerator} de ${props.participationDenominator}` },
    { label: 'Preguntas creadas', value: props.metrics.questionsCreated, icon: 'help-circle-outline' as const, detail: props.periodLabel },
    { label: 'Precisión media', value: `${props.metrics.accuracyPercent}%`, icon: 'analytics-outline' as const, detail: `${props.metrics.attempts} intentos` },
  ]

  return (
    <View style={{ marginTop: 18, borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.surface.default, borderRadius: 22, padding: 18 }}>
      <View style={{ gap: 12 }}>
        <View>
          <Text style={{ color: tokens.text.primary, fontSize: 18, fontWeight: '900' }}>Impacto docente</Text>
          <Text style={{ marginTop: 4, color: tokens.text.secondary, fontSize: 12, lineHeight: 18 }}>Periodo de las métricas: {props.periodLabel}.</Text>
        </View>
        <AppTabs items={periods} value={props.period} onChange={props.onPeriodChange} role="teacher" compact fill accessibilityLabel="Periodo de métricas docentes" />
      </View>

      <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cards.map((card) => (
          <View key={card.label} style={{ minWidth: 170, flexGrow: 1, flexBasis: 190, borderRadius: 16, padding: 15, backgroundColor: tokens.surface.raised, borderWidth: 1, borderColor: tokens.border.subtle }}>
            <Ionicons name={card.icon} size={21} color={tokens.brand.teacher} />
            <Text maxFontSizeMultiplier={2} style={{ marginTop: 10, color: tokens.text.primary, fontSize: 22, fontWeight: '900' }}>{card.value}</Text>
            <Text maxFontSizeMultiplier={2} style={{ marginTop: 3, color: tokens.text.secondary, fontSize: 12, fontWeight: '800' }}>{card.label}</Text>
            <Text maxFontSizeMultiplier={2} style={{ marginTop: 2, color: tokens.text.muted, fontSize: 11 }}>{card.detail}</Text>
          </View>
        ))}
      </View>

      <View accessibilityRole="summary" style={{ marginTop: 14, flexDirection: 'row', gap: 10, borderRadius: 14, padding: 13, backgroundColor: tokens.surface.interactive }}>
        <Ionicons name="information-circle-outline" size={20} color={tokens.semantic.info} />
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={{ color: tokens.text.primary, fontSize: 12, fontWeight: '900' }}>Cómo se calcula la participación</Text>
          <Text maxFontSizeMultiplier={2} style={{ marginTop: 3, color: tokens.text.secondary, fontSize: 12, lineHeight: 18 }}>{props.participationDescription}</Text>
        </View>
      </View>
    </View>
  )
}
