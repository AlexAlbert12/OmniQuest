import React from 'react'
import { Text, View } from 'react-native'
import { GradeDistributionBars, SubjectKpiCard, SubjectPanel } from './SubjectShared'
import type { TeacherSubjectAnalyticsPayload } from '../../../lib/teacherServerData'
import { formatCount } from '../../../lib/formatCount'

export default function SubjectAnalyticsTab({ analytics, isDesktop }: {
  analytics: TeacherSubjectAnalyticsPayload
  isDesktop: boolean
}) {
  const summary = analytics.summary
  const distribution = addColors(analytics.gradeDistribution)
  const maxActivityCount = Math.max(1, ...analytics.temporalEvolution.map((item) => item.activityCount))

  return (
    <View className="gap-5">
      <View className={isDesktop ? 'flex-row gap-4' : 'flex-row gap-2'}>
        <SubjectKpiCard isDesktop={isDesktop} label="Alumnos evaluados" value={`${summary.answered}/${summary.enrolled}`} detail={`${summary.participation}% participación`} icon="people-outline" />
        <SubjectKpiCard isDesktop={isDesktop} label="Nota media" value={`${Number(summary.averageGrade).toFixed(1)}/10`} detail={`${summary.averageAccuracy}% precisión global`} icon="shield-checkmark-outline" />
        <SubjectKpiCard isDesktop={isDesktop} label="Fallos" value={String(summary.failedAnswers)} detail={`${summary.correctAnswers} respuestas correctas`} icon="close-circle-outline" />
        <SubjectKpiCard isDesktop={isDesktop} label="XP media" value={`${summary.averageXp} XP`} detail="Media del alumnado matriculado" icon="star-outline" />
      </View>

      <View className={isDesktop ? 'flex-row gap-6' : 'gap-5'}>
        <View className={isDesktop ? 'min-w-0 flex-[1.45] gap-5' : 'gap-5'}>
          <SubjectPanel title="Métricas por alumno">
            {analytics.items.length > 0 ? (
              <View className="gap-3">
                {analytics.items.slice(0, 20).map((student, index) => (
                  <View key={student.id} className="flex-row items-center gap-3 rounded-xl border border-border-default bg-surface-raised p-3">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-selected">
                      <Text className="font-black text-brand-teacher">{index + 1}</Text>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-black text-text-primary" numberOfLines={2}>{student.name}</Text>
                      <Text className="mt-1 text-[11px] text-text-muted">{student.hasActivity ? `${student.accuracyPercent}% precisión · ${student.participation}% progreso` : 'Sin actividad · Sin evaluar'}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-black text-text-primary">{student.score} XP</Text>
                      <Text className="mt-0.5 text-[10px] font-bold text-text-muted">{student.hasActivity ? `${student.grade.toFixed(1)}/10` : 'Sin evaluar'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : <Text className="text-[12px] text-text-muted">No hay datos suficientes para generar la analítica.</Text>}
          </SubjectPanel>

          <SubjectPanel title="Evolución de seis semanas">
            <View className="gap-3">
              {analytics.temporalEvolution.map((item) => (
                <View key={item.label} className="flex-row items-center gap-3">
                  <Text className="w-20 text-[11px] text-text-muted">{item.label}</Text>
                  <View className="h-2 flex-1 overflow-hidden rounded-full bg-surface-interactive">
                    <View className="h-full rounded-full bg-brand-teacher" style={{ width: `${Math.round((item.activityCount / maxActivityCount) * 100)}%` }} />
                  </View>
                  <Text className="w-20 text-right text-[11px] font-bold text-text-secondary">{formatCount(item.activityCount, 'respuesta', 'respuestas')}</Text>
                </View>
              ))}
            </View>
          </SubjectPanel>
        </View>

        <View className={isDesktop ? 'w-[380px] gap-5' : 'gap-5'}>
          <SubjectPanel title="Preguntas más falladas">
            {analytics.failedQuestions.length > 0 ? (
              <View className="gap-3">
                {analytics.failedQuestions.map((question) => (
                  <View key={question.id} className="rounded-xl border border-border-default bg-surface-raised p-3">
                    <Text className="font-bold text-text-primary" numberOfLines={3}>{question.text}</Text>
                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className="mt-1 text-[11px] text-semantic-danger">{question.failureRate}% fallo</Text>
                      <Text className="mt-1 text-[10px] text-text-muted">{question.topic}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : <Text className="text-[12px] text-text-muted">No hay preguntas con fallos registrados.</Text>}
          </SubjectPanel>

          <SubjectPanel title="Distribución de notas">
            <GradeDistributionBars distribution={distribution} total={summary.answered} unassessed={summary.unassessed} />
          </SubjectPanel>
        </View>
      </View>
    </View>
  )
}

function addColors(rows: { label: string; count: number }[]) {
  const colors = ['#34D399', '#3B82F6', '#F59E0B', '#F43F5E']
  return rows.map((row, index) => ({ ...row, color: colors[index] || '#8FA7C7' }))
}
