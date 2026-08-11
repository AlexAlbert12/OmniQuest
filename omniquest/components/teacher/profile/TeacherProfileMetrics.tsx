import React, { useCallback } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppModal } from '../../AppModalProvider'
import AppPressable from '../../ui/AppPressable'
import AppTabs from '../../ui/AppTabs'
import { useAppTheme } from '../../../lib/appTheme'
import { translateUiText, useI18n } from '../../../lib/i18n'
import { useResponsiveLayout } from '../../../lib/responsive'
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
  const { showModal } = useAppModal()
  const { locale, t, formatNumber } = useI18n()
  const responsive = useResponsiveLayout()
  const showParticipationInfo = useCallback(() => {
    const description = translateUiText(locale, props.participationDescription)
    const periodLabel = translateUiText(locale, props.periodLabel)
    showModal({ title: t('teacher.profile.participation.title'), message: `${description}\n\n${t('teacher.profile.participation.period', { period: periodLabel })}\n${t('teacher.profile.participation.participants', { numerator: props.participationNumerator, denominator: props.participationDenominator })}\n${t('teacher.profile.participation.result', { percent: formatNumber(props.metrics.participationPercent, { maximumFractionDigits: 1 }) })}`, variant: 'info' })
  }, [formatNumber, locale, props.metrics.participationPercent, props.participationDenominator, props.participationDescription, props.participationNumerator, props.periodLabel, showModal, t])

  const cards = [
    { label: 'Cursos activos', value: props.metrics.activeCourses, icon: 'book-outline' as const, detail: 'Estado actual' },
    { label: 'Alumnos participantes', value: props.metrics.participatingStudents, icon: 'people-outline' as const, detail: props.periodLabel },
    { label: 'Participación', value: `${props.metrics.participationPercent}%`, icon: 'pulse-outline' as const, detail: `${props.participationNumerator} de ${props.participationDenominator}`, info: true },
    { label: 'Preguntas creadas', value: props.metrics.questionsCreated, icon: 'help-circle-outline' as const, detail: props.periodLabel },
    { label: 'Precisión global', value: `${props.metrics.accuracyPercent}%`, icon: 'analytics-outline' as const, detail: `${props.metrics.attempts} intentos` },
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

      <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: responsive.isMobile ? 10 : 12 }}>
        {cards.map((card, index) => {
          const fullWidthMobile = responsive.isMobile && index === cards.length - 1
          return (
            <View key={card.label} style={{ minWidth: responsive.isMobile ? 0 : 170, flexGrow: 1, flexBasis: responsive.isMobile ? (fullWidthMobile ? '100%' : '45%') : 190, borderRadius: 16, padding: responsive.isMobile ? 14 : 15, backgroundColor: tokens.surface.raised, borderWidth: 1, borderColor: tokens.border.subtle }}>
              <Ionicons name={card.icon} size={21} color={tokens.brand.teacher} />
              {card.info ? (
                <AppPressable accessibilityLabel={t('teacher.profile.participation.title')} accessibilityHint={t('teacher.profile.participation.hint')} onPress={showParticipationInfo} style={({ pressed }) => ({ position: 'absolute', top: 11, right: 11, width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, opacity: pressed ? 0.72 : 1 })}>
                  <Ionicons name="information-circle-outline" size={18} color={tokens.semantic.info} />
                </AppPressable>
              ) : null}
              <Text maxFontSizeMultiplier={2} style={{ marginTop: 10, color: tokens.text.primary, fontSize: 22, fontWeight: '900' }}>{card.value}</Text>
              <Text maxFontSizeMultiplier={2} style={{ marginTop: 3, color: tokens.text.secondary, fontSize: 12, fontWeight: '800' }}>{card.label}</Text>
              <Text maxFontSizeMultiplier={2} style={{ marginTop: 2, color: tokens.text.muted, fontSize: 11 }}>{card.detail}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
