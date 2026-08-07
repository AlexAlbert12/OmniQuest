import React from 'react'
import { Link } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../ui/mobile/MobileMetricCard'
import { GradeDistributionBars, SubjectPanel } from './SubjectShared'
import type { ActivityItem, Subject } from '../../../hooks/teacher/useTeacherSubjectDetail'
import type { TeacherSubjectOverview } from '../../../lib/teacherServerData'

export default function SubjectSummaryTab({
  activity,
  addQuestionHref,
  gradeDistribution,
  isDesktop,
  onOpenAnalytics,
  onShowCode,
  overview,
  subject,
}: {
  activity: ActivityItem[]
  addQuestionHref: string
  gradeDistribution: { label: string; color: string; count: number }[]
  isDesktop: boolean
  onOpenAnalytics: () => void
  onShowCode: () => void
  overview: TeacherSubjectOverview
  subject: Subject
}) {
  const summary = overview.summary

  return (
    <View className="gap-5">
      <View className={isDesktop ? 'flex-row gap-4' : 'flex-row flex-wrap gap-3'}>
        <SummaryMetric icon="people-outline" label="Participación" value={`${summary.participation}%`} detail={`${summary.activeStudents}/${summary.enrolledCount} alumnos activos`} />
        <SummaryMetric icon="shield-checkmark-outline" label="Precisión" value={`${summary.averageAccuracy}%`} detail={`${summary.correctAnswers}/${summary.totalAnswers} respuestas correctas`} />
        <SummaryMetric icon="star-outline" label="XP media" value={`${summary.averageXp}`} detail="Puntos medios de la clase" />
        <SummaryMetric icon="analytics-outline" label="Progreso" value={`${summary.progress}%`} detail={`${summary.answeredClassQuestions}/${summary.possibleClassQuestions} combinaciones respondidas`} />
      </View>

      <View className={isDesktop ? 'flex-row gap-6' : 'gap-5'}>
        <View className={isDesktop ? 'min-w-0 flex-[1.45] gap-5' : 'gap-5'}>
          <SubjectPanel title="Siguiente acción">
            <View className="flex-row flex-wrap items-center gap-4">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface-selected">
                <Ionicons name="help-circle-outline" size={24} color="#A78BFA" />
              </View>
              <View className="min-w-[220px] flex-1">
                <Text className="text-[12px] font-semibold text-text-secondary">Última pregunta</Text>
                <Text className="mt-1 text-[18px] font-black text-text-primary" numberOfLines={3}>
                  {overview.latestQuestion?.text || 'Todavía no hay preguntas en esta clase'}
                </Text>
              </View>
              <Link href={addQuestionHref as never} asChild>
                <Pressable accessibilityRole="link" className="min-h-11 rounded-xl bg-brand-teacher px-4 py-3">
                  <Text className="font-black text-white">Crear pregunta</Text>
                </Pressable>
              </Link>
            </View>
          </SubjectPanel>

          <SubjectPanel title="Actividad reciente" actionLabel="Abrir analítica" onAction={onOpenAnalytics}>
            {activity.length > 0 ? (
              <View className="gap-3">
                {activity.map((item, index) => (
                  <View key={`${item.title}-${index}`} className="flex-row items-center gap-3 border-b border-border-subtle pb-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-raised">
                      <Ionicons name={item.icon} size={18} color={item.color} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-bold text-text-primary" numberOfLines={2}>{item.title}</Text>
                      <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={2}>{item.detail}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[11px] font-bold text-brand-teacher">{item.meta}</Text>
                      <Text className="mt-1 text-[10px] text-text-muted">{item.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-[12px] text-text-muted">La actividad aparecerá cuando el alumnado empiece a responder.</Text>
            )}
          </SubjectPanel>
        </View>

        <View className={isDesktop ? 'w-[360px] gap-5' : 'gap-5'}>
          <SubjectPanel title="Distribución de notas">
            <GradeDistributionBars distribution={gradeDistribution} total={Math.max(overview.summary.enrolledCount, 1)} />
          </SubjectPanel>

          <View className="rounded-xl border border-border-active bg-surface-selected p-5">
            <View className="flex-row items-center gap-3">
              <Ionicons name="qr-code-outline" size={24} color="#A78BFA" />
              <Text className="font-black text-text-primary">Código del curso</Text>
            </View>
            <Text className="mt-3 text-[12px] leading-5 text-text-secondary">Comparte este código para que el alumnado se una.</Text>
            <Pressable accessibilityRole="button" onPress={onShowCode} className="mt-4 min-h-11 flex-row items-center justify-between rounded-xl bg-surface-default px-4 py-3">
              <Text className="font-mono text-[16px] font-black text-brand-teacher">{subject.code}</Text>
              <Ionicons name="copy-outline" size={18} color="#A78BFA" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}

function SummaryMetric({ icon, label, value, detail }: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  detail: string
}) {
  return (
    <MobileMetricCard
      className="min-w-[190px] flex-1"
      color="#8B5CF6"
      detail={detail}
      icon={icon}
      label={label}
      value={value}
    />
  )
}
