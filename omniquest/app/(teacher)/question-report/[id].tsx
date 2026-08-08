import React, { useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import TeacherSidebar from '../../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../../components/teacher/TeacherPageHeader'
import QuestionMedia from '../../../components/questions/QuestionMedia'
import AppDropdown from '../../../components/ui/AppDropdown'
import AppTabs from '../../../components/ui/AppTabs'
import AppStatusBanner from '../../../components/ui/AppStatusBanner'
import AppConfirmModal from '../../../components/AppConfirmModal'
import QuestionDiagnosisCard from '../../../components/teacher/question-report/QuestionDiagnosisCard'
import AnswerDistributionChart from '../../../components/teacher/question-report/AnswerDistributionChart'
import AffectedStudentsList from '../../../components/teacher/question-report/AffectedStudentsList'
import QuestionReportActions from '../../../components/teacher/question-report/QuestionReportActions'
import { useQuestionReport } from '../../../hooks/teacher/useQuestionReport'
import { useAppTheme } from '../../../lib/appTheme'
import { supabase } from '../../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout'
import { exportCsvFile, slugifyFilename } from '../../../lib/reportExports'
import type { ClassroomComparisonPoint, QuestionReportPeriod, TemporalTrendPoint } from '../../../lib/teacherQuestionReport'
import { signOutCurrentDeviceSession } from '../../../lib/pushNotifications'

const PERIODS: { key: QuestionReportPeriod; label: string; icon: any }[] = [
  { key: '7d', label: '7 días', icon: 'calendar-outline' },
  { key: '30d', label: '30 días', icon: 'calendar-number-outline' },
  { key: '90d', label: '90 días', icon: 'calendar-clear-outline' },
  { key: 'all', label: 'Todo', icon: 'infinite-outline' },
]

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Tipo test',
  true_false: 'Verdadero/Falso',
  fill_blank: 'Rellenar huecos',
  match_pairs: 'Emparejar',
  ordering: 'Ordenar',
  open_answer: 'Respuesta abierta',
  drag_drop: 'Arrastrar y soltar',
}

export default function TeacherQuestionReportScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const questionId = Number(Array.isArray(id) ? id[0] : id)
  const isDesktop = width >= 1080
  const isWide = width >= 900
  const affectedPageSize = isDesktop ? 12 : 6
  const report = useQuestionReport(questionId, affectedPageSize)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const handleSignOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as any)
  }

  const exportReport = async () => {
    if (!report.report) return
    const { question, summary, classComparison, temporalTrend, answerDistribution } = report.report
    const rows: (string | number | boolean | null | undefined)[][] = [
      ['RESUMEN', question.id, question.subjectName, question.text, summary.totalAttempts, summary.sampleSize, summary.failedAttempts, summary.abandonmentPercent, summary.averageTimeSeconds, summary.discrimination],
      ...answerDistribution.map((item) => ['RESPUESTA', item.label, item.count, item.percent, item.correct]),
      ...classComparison.map((item) => ['CLASE', item.classroom_name, item.attempts, item.failure_percent, item.average_time_seconds]),
      ...temporalTrend.map((item) => ['TENDENCIA', item.day, item.attempts, item.failure_percent, item.average_time_seconds]),
    ]
    await exportCsvFile(
      `omniquest_pregunta_${question.id}_${slugifyFilename(question.subjectName)}.csv`,
      ['Sección', 'Campo_1', 'Campo_2', 'Campo_3', 'Campo_4', 'Campo_5', 'Campo_6', 'Campo_7', 'Campo_8', 'Campo_9'],
      rows,
    )
  }

  if (report.loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: tokens.background.primary }}>
        <ActivityIndicator size="large" color={tokens.brand.teacher} />
        <Text className="mt-4" style={{ color: tokens.text.secondary }}>Preparando diagnóstico...</Text>
      </View>
    )
  }

  const question = report.report?.question

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <View className="flex-1 flex-row">
        {isDesktop ? <TeacherSidebar activeSection="classes" subjectsCount={report.subjectsCount} onSignOut={handleSignOut} /> : null}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: isDesktop ? 28 : 16, paddingTop: isDesktop ? 26 : 20, paddingBottom: isDesktop ? 48 : MOBILE_BOTTOM_NAV_SPACER + 20 }}
          refreshControl={<RefreshControl refreshing={report.refreshing} onRefresh={report.refresh} tintColor={tokens.brand.teacher} />}
        >
          <TeacherPageHeader
            backAction={{ label: 'Volver', onPress: () => router.back() }}
            icon="analytics"
            isDesktop={isDesktop}
            title="Informe de pregunta"
            subtitle="Diagnóstico agregado en servidor con muestra, tendencia, abandono, tiempo y discriminación."
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
          />

          {report.error ? <AppStatusBanner variant="danger" title="No se pudo cargar el informe" message={report.error} style={{ marginBottom: 16 }} /> : null}

          {question && report.report ? (
            <>
              <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
                <View className="flex-row flex-wrap items-start gap-4">
                  <View className="min-w-[260px] flex-1">
                    <View className="flex-row flex-wrap gap-2">
                      <Badge label={TYPE_LABELS[question.type] || question.type} color={tokens.brand.teacher} />
                      <Badge label={question.subjectName} color={tokens.semantic.info} />
                      {question.classroomName ? <Badge label={question.classroomName} color={tokens.semantic.success} /> : null}
                      {question.topicName ? <Badge label={question.topicName} color={tokens.semantic.warning} /> : null}
                      {question.active === false ? <Badge label="Archivada" color={tokens.semantic.danger} /> : null}
                    </View>
                    <Text className="mt-3 text-[25px] font-black leading-8" style={{ color: tokens.text.primary }}>{question.text}</Text>
                    {question.explanation ? <Text className="mt-3 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>{question.explanation}</Text> : null}
                    <QuestionMedia
                      questionId={question.id}
                      type={question.mediaType}
                      path={question.mediaPath}
                      altText={question.mediaAltText}
                      caption={question.mediaCaption}
                      compact={!isDesktop}
                    />
                  </View>
                  <View className="min-w-[280px] flex-1">
                    <QuestionReportActions
                      active={question.active !== false}
                      busy={report.busy}
                      onEdit={() => router.push(`/(teacher)/subject/edit-question?subjectId=${question.subjectId}&questionId=${question.id}` as any)}
                      onCreatePractice={() => router.push(`/(teacher)/subject/add-question?subjectId=${question.subjectId}&sourceQuestionId=${question.id}` as any)}
                      onManualReview={() => router.push('/(teacher)/reviews' as any)}
                      onExport={() => void exportReport()}
                      onArchive={() => setArchiveOpen(true)}
                    />
                  </View>
                </View>
              </View>

              <View className="mt-5 rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
                <View className="flex-row flex-wrap items-end gap-4">
                  <View className="min-w-[260px] flex-[2]">
                    <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Periodo</Text>
                    <AppTabs<QuestionReportPeriod>
                      accessibilityLabel="Periodo del informe"
                      compact
                      role="teacher"
                      items={PERIODS}
                      value={report.period}
                      onChange={report.setPeriod}
                    />
                  </View>
                  <AppDropdown<number>
                    label="Clase"
                    value={report.classroomId}
                    options={report.report.classOptions.map((item) => ({ value: item.id, label: item.name }))}
                    onChange={report.setClassroomId}
                    placeholder="Todas las clases"
                    style={{ minWidth: 220, flex: 1 }}
                  />
                </View>
              </View>

              <View className="mt-5"><QuestionDiagnosisCard summary={report.report.summary} /></View>

              <View className={isWide ? 'mt-5 flex-row items-start gap-5' : 'mt-5 gap-5'}>
                <View className="flex-1"><AnswerDistributionChart items={report.report.answerDistribution} /></View>
                <View className="flex-1"><ClassComparison items={report.report.classComparison} /></View>
              </View>

              <View className="mt-5"><TemporalTrend items={report.report.temporalTrend} /></View>

              <View className="mt-5">
                <AffectedStudentsList
                  items={report.affected.items}
                  total={report.affected.total}
                  page={report.affectedPage}
                  pageSize={affectedPageSize}
                  onPage={report.setAffectedPage}
                  onOpenStudent={(studentId) => router.push(`/(teacher)/student/${studentId}/history?subjectId=${question.subjectId}` as any)}
                />
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="classes" /> : null}

      <AppConfirmModal
        visible={archiveOpen}
        title="Archivar pregunta"
        message="La pregunta dejará de aparecer en nuevas partidas, pero conservará sus datos históricos."
        confirmLabel="Archivar"
        variant="danger"
        busy={report.busy}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => void report.archive().then(() => setArchiveOpen(false))}
      />
    </View>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return <View className="rounded-full border px-2.5 py-1" style={{ borderColor: color, backgroundColor: `${color}20` }}><Text className="text-[10px] font-black" style={{ color }}>{label}</Text></View>
}

function ClassComparison({ items }: { items: ClassroomComparisonPoint[] }) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>Comparación por clase</Text>
      <View className="mt-4 gap-3">
        {items.length ? items.map((item) => (
          <View key={item.classroom_id} className="rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
            <View className="flex-row items-center justify-between gap-3">
              <Text className="font-black" style={{ color: tokens.text.primary }}>{item.classroom_name}</Text>
              <Text className="font-black" style={{ color: item.failure_percent >= 50 ? tokens.semantic.danger : tokens.semantic.warning }}>{item.failure_percent}% fallos</Text>
            </View>
            <Text className="mt-1 text-[11px]" style={{ color: tokens.text.muted }}>{item.attempts} intentos · {item.average_time_seconds == null ? 'sin tiempo medio' : `${item.average_time_seconds}s de media`}</Text>
          </View>
        )) : <Text className="py-6 text-center" style={{ color: tokens.text.muted }}>No hay clases comparables.</Text>}
      </View>
    </View>
  )
}

function TemporalTrend({ items }: { items: TemporalTrendPoint[] }) {
  const { tokens } = useAppTheme()
  const max = Math.max(1, ...items.map((item) => Number(item.failure_percent || 0)))
  return (
    <View className="rounded-2xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="flex-row items-center gap-2"><Ionicons name="trending-up-outline" size={22} color={tokens.semantic.info} /><Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>Tendencia temporal</Text></View>
      <View className="mt-5 flex-row items-end gap-2" style={{ minHeight: 150 }}>
        {items.length ? items.map((item) => (
          <View key={item.day} className="min-w-0 flex-1 items-center justify-end">
            <Text className="mb-1 text-[9px] font-black" style={{ color: tokens.text.muted }}>{item.failure_percent}%</Text>
            <View style={{ width: '75%', minWidth: 5, height: Math.max(4, 105 * Number(item.failure_percent || 0) / max), borderRadius: 6, backgroundColor: tokens.brand.teacher }} />
            <Text className="mt-2 text-[9px]" style={{ color: tokens.text.muted }} numberOfLines={1}>{String(item.day).slice(5)}</Text>
          </View>
        )) : <Text className="w-full py-6 text-center" style={{ color: tokens.text.muted }}>No hay tendencia disponible.</Text>}
      </View>
    </View>
  )
}
