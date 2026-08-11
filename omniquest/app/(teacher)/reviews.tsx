import OmniLoadingScreen from '../../components/ui/OmniLoadingScreen'
import React, { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import AppButton from '../../components/ui/AppButton'
import AppDropdown from '../../components/ui/AppDropdown'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import AppTabs from '../../components/ui/AppTabs'
import ManualReviewQueue from '../../components/teacher/reviews/ManualReviewQueue'
import ManualReviewBatchBar from '../../components/teacher/reviews/ManualReviewBatchBar'
import ManualReviewDetailSheet from '../../components/teacher/reviews/ManualReviewDetailSheet'
import ManualReviewBatchSheet from '../../components/teacher/reviews/ManualReviewBatchSheet'
import ManualReviewConfigurationSheet from '../../components/teacher/reviews/ManualReviewConfigurationSheet'
import { useManualReview } from '../../hooks/teacher/useManualReview'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import type { ManualReviewQueueRow, ManualReviewStatus } from '../../lib/teacherManualReview'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

const STATUS_OPTIONS: { key: 'all' | ManualReviewStatus; label: string; icon: any }[] = [
  { key: 'all', label: 'Todas', icon: 'list-outline' },
  { key: 'pending', label: 'Pendientes', icon: 'time-outline' },
  { key: 'needs_changes', label: 'Necesita cambios', icon: 'refresh-outline' },
  { key: 'approved', label: 'Aprobadas', icon: 'checkmark-circle-outline' },
  { key: 'rejected', label: 'Rechazadas', icon: 'close-circle-outline' },
]

export default function TeacherReviewsScreen() {
  const params = useLocalSearchParams<{ studentId?: string; attemptId?: string; subjectId?: string; classroomId?: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isDesktop = width >= 1080
  const pageSize = isDesktop ? 15 : 6
  const studentId = normalizeStringParam(params.studentId)
  const attemptId = parseNumberParam(params.attemptId)
  const subjectId = parseNumberParam(params.subjectId)
  const classroomId = parseNumberParam(params.classroomId)
  const [requestedAttemptId, setRequestedAttemptId] = useState<number | null>(attemptId)
  const review = useManualReview(pageSize, { studentId, attemptId: requestedAttemptId, subjectId, classroomId })
  const [selectedRow, setSelectedRow] = useState<ManualReviewQueueRow | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const selectedQuestionCount = new Set(review.selectedRows.map((row) => row.question_id)).size

  useEffect(() => { setRequestedAttemptId(attemptId) }, [attemptId])

  useEffect(() => {
    if (!requestedAttemptId) return
    const row = review.queue.items.find((item) => item.id === requestedAttemptId)
    if (!row) return
    setSelectedRow(row)
    setRequestedAttemptId(null)
  }, [requestedAttemptId, review.queue.items])

  const handleSignOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as any)
  }

  if (review.loading) return <OmniLoadingScreen />

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <View className="flex-1 flex-row">
        {isDesktop ? <TeacherSidebar activeSection="reviews" subjectsCount={review.configuration.subjects.length} onSignOut={handleSignOut} /> : null}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: isDesktop ? 32 : 16, paddingTop: isDesktop ? 30 : 22, paddingBottom: isDesktop ? 48 : MOBILE_BOTTOM_NAV_SPACER + 24 }}
          refreshControl={<RefreshControl refreshing={review.refreshing} onRefresh={review.refresh} tintColor={tokens.brand.teacher} />}
        >
          <TeacherPageHeader
            icon="create"
            isDesktop={isDesktop}
            title="Revisión manual"
            subtitle="Revisa respuestas abiertas, prioriza las pendientes y deja feedback al alumnado."
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
            actions={<AppButton label="Configurar" icon="settings-outline" role="teacher" onPress={() => setSettingsOpen(true)} />}
          />

          {review.error ? <AppStatusBanner variant="danger" title="No se pudo completar la operación" message={review.error} style={{ marginBottom: 16 }} /> : null}
          {studentId ? <AppStatusBanner variant="info" title="Revisiones del alumno" message={attemptId ? 'Se ha abierto la revisión seleccionada desde su historial.' : 'La cola está filtrada por el alumno seleccionado desde su historial.'} style={{ marginBottom: 16 }} /> : null}

          <View className="mb-5 flex-row flex-wrap gap-3">
            <MobileMetricCard semantic="attention" label="Pendientes" value={String(review.queue.summary.pending || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="audit" label="Necesita cambios" value={String(review.queue.summary.needs_changes || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard icon="alarm-outline" label="Vencen pronto" value={String(review.queue.summary.due_soon || 0)} color={tokens.semantic.info} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="critical" label="Plazo vencido" value={String(review.queue.summary.overdue || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
          </View>

          <View className="mb-4 rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[240px] flex-[2]">
                <Text className="mb-2 text-[11px] font-black uppercase" style={{ color: tokens.text.muted }}>Buscar</Text>
                <TextInput
                  accessibilityLabel="Buscar revisiones"
                  value={review.filters.search}
                  onChangeText={(search) => review.updateFilters({ search })}
                  placeholder="Alumno, pregunta, respuesta o curso"
                  placeholderTextColor={tokens.text.muted}
                  className="min-h-12 rounded-xl border px-4"
                  style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }}
                />
              </View>
              <AppDropdown<number>
                label="Curso"
                value={review.filters.subjectId}
                options={review.configuration.subjects.map((item) => ({ value: item.id, label: item.name }))}
                onChange={(nextSubjectId) => review.updateFilters({ subjectId: nextSubjectId, classroomId: null })}
                placeholder="Todos los cursos"
                style={{ minWidth: 210, flex: 1 }}
              />
              <AppDropdown<number>
                label="Clase"
                value={review.filters.classroomId}
                options={review.visibleClassrooms.map((item) => ({ value: item.id, label: item.name }))}
                onChange={(nextClassroomId) => review.updateFilters({ classroomId: nextClassroomId })}
                placeholder="Todas las clases"
                style={{ minWidth: 210, flex: 1 }}
              />
            </View>
            <View className="mt-4">
              <AppTabs<'all' | ManualReviewStatus> accessibilityLabel="Estado de la revisión" compact role="teacher" items={STATUS_OPTIONS} value={review.filters.status} onChange={(status) => review.updateFilters({ status })} />
            </View>
          </View>

          <ManualReviewBatchBar selectedCount={review.selectedIds.length} busy={review.busy} onReview={() => setBatchOpen(true)} onClear={review.clearSelection} />

          <ManualReviewQueue rows={review.queue.items} total={review.queue.total} page={review.page} pageSize={pageSize} selectedIds={review.selectedIds} onToggle={review.toggleSelected} onTogglePage={review.selectPage} onOpen={setSelectedRow} onPage={review.setPage} />
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="reviews" /> : null}

      <ManualReviewDetailSheet row={selectedRow} configuration={review.configuration} visible={Boolean(selectedRow)} busy={review.busy} onClose={() => setSelectedRow(null)} onLoadDetail={review.loadDetail} onReview={review.reviewOne} />

      <ManualReviewBatchSheet
        visible={batchOpen}
        selectedCount={review.selectedIds.length}
        questionCount={selectedQuestionCount}
        configuration={review.configuration}
        busy={review.busy}
        onClose={() => setBatchOpen(false)}
        onSubmit={async (input) => { await review.reviewBatch({ ids: review.selectedIds, ...input }); setBatchOpen(false) }}
      />

      <ManualReviewConfigurationSheet visible={settingsOpen} configuration={review.configuration} busy={review.busy} onClose={() => setSettingsOpen(false)} onSaveSla={review.saveSla} onSaveTemplate={review.saveTemplate} />
    </View>
  )
}

function normalizeStringParam(value?: string | string[]) { return Array.isArray(value) ? value[0] || null : value || null }
function parseNumberParam(value?: string | string[]) { const raw = Array.isArray(value) ? value[0] : value; const parsed = Number(raw); return Number.isFinite(parsed) && parsed > 0 ? parsed : null }
