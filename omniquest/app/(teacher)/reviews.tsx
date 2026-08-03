import React, { useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { useRouter } from 'expo-router'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import AppButton from '../../components/ui/AppButton'
import AppDropdown from '../../components/ui/AppDropdown'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import AppBottomSheet from '../../components/ui/AppBottomSheet'
import AppTabs from '../../components/ui/AppTabs'
import ManualReviewQueue from '../../components/teacher/reviews/ManualReviewQueue'
import ManualReviewBatchBar from '../../components/teacher/reviews/ManualReviewBatchBar'
import ManualReviewDetailSheet from '../../components/teacher/reviews/ManualReviewDetailSheet'
import ManualReviewBatchSheet from '../../components/teacher/reviews/ManualReviewBatchSheet'
import ManualReviewConfigurationSheet from '../../components/teacher/reviews/ManualReviewConfigurationSheet'
import { useManualReview } from '../../hooks/teacher/useManualReview'
import { useAppTheme } from '../../lib/appTheme'
import { supabase } from '../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import type { ManualReviewFilters, ManualReviewQueueRow, ManualReviewStatus } from '../../lib/teacherManualReview'

const STATUS_OPTIONS: { key: 'all' | ManualReviewStatus; label: string; icon: any }[] = [
  { key: 'all', label: 'Todas', icon: 'list-outline' },
  { key: 'pending', label: 'Pendientes', icon: 'time-outline' },
  { key: 'in_review', label: 'En revisión', icon: 'eye-outline' },
  { key: 'needs_changes', label: 'Necesita cambios', icon: 'refresh-outline' },
  { key: 'approved', label: 'Aprobadas', icon: 'checkmark-circle-outline' },
  { key: 'rejected', label: 'Rechazadas', icon: 'close-circle-outline' },
]

export default function TeacherReviewsScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isDesktop = width >= 1080
  const pageSize = isDesktop ? 15 : 6
  const review = useManualReview(pageSize)
  const [selectedRow, setSelectedRow] = useState<ManualReviewQueueRow | null>(null)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saveFilterOpen, setSaveFilterOpen] = useState(false)
  const [filterName, setFilterName] = useState('Mi filtro')

  const savedFilterOptions = useMemo(() => review.configuration.savedFilters.map((item) => ({
    value: item.id,
    label: item.name,
    description: summarizeFilter(item.filters),
  })), [review.configuration.savedFilters])

  const applySavedFilter = (id: string) => {
    const saved = review.configuration.savedFilters.find((item) => item.id === id)
    if (!saved) return
    review.updateFilters(saved.filters)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  if (review.loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: tokens.background.primary }}>
        <ActivityIndicator size="large" color={tokens.brand.teacher} />
        <Text className="mt-4" style={{ color: tokens.text.secondary }}>Cargando cola de revisión...</Text>
      </View>
    )
  }

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
            subtitle="Gestiona SLA, rúbricas, asignaciones y decisiones por lotes con historial inmutable."
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
            actions={(
              <View className="flex-row flex-wrap gap-2">
                <AppButton label="Guardar filtro" icon="bookmark-outline" variant="secondary" onPress={() => setSaveFilterOpen(true)} />
                <AppButton label="Configurar" icon="settings-outline" role="teacher" onPress={() => setSettingsOpen(true)} />
              </View>
            )}
          />

          {review.error ? <AppStatusBanner variant="danger" title="No se pudo completar la operación" message={review.error} style={{ marginBottom: 16 }} /> : null}

          <View className="mb-5 flex-row flex-wrap gap-3">
            <MobileMetricCard semantic="attention" label="Pendientes" value={String(review.queue.summary.pending || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard icon="eye-outline" label="En revisión" value={String(review.queue.summary.in_review || 0)} color={tokens.semantic.info} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="audit" label="Necesita cambios" value={String(review.queue.summary.needs_changes || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="critical" label="SLA vencido" value={String(review.queue.summary.overdue || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
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
                onChange={(subjectId) => review.updateFilters({ subjectId, classroomId: null })}
                placeholder="Todos los cursos"
                style={{ minWidth: 210, flex: 1 }}
              />
              <AppDropdown<number>
                label="Clase"
                value={review.filters.classroomId}
                options={review.visibleClassrooms.map((item) => ({ value: item.id, label: item.name }))}
                onChange={(classroomId) => review.updateFilters({ classroomId })}
                placeholder="Todas las clases"
                style={{ minWidth: 210, flex: 1 }}
              />
              {savedFilterOptions.length ? (
                <AppDropdown<string>
                  label="Filtros guardados"
                  value={null}
                  options={savedFilterOptions}
                  onChange={applySavedFilter}
                  placeholder="Aplicar filtro"
                  style={{ minWidth: 210, flex: 1 }}
                />
              ) : null}
            </View>
            <View className="mt-4">
              <AppTabs<'all' | ManualReviewStatus>
                accessibilityLabel="Estado de la revisión"
                compact
                role="teacher"
                items={STATUS_OPTIONS}
                value={review.filters.status}
                onChange={(status) => review.updateFilters({ status })}
              />
            </View>
          </View>

          <ManualReviewBatchBar
            selectedCount={review.selectedIds.length}
            assignees={review.configuration.assignees}
            assigneeId={assigneeId}
            busy={review.busy}
            onAssignee={setAssigneeId}
            onAssign={() => void review.assign(review.selectedIds, assigneeId)}
            onReview={() => setBatchOpen(true)}
            onClear={review.clearSelection}
          />

          <ManualReviewQueue
            rows={review.queue.items}
            total={review.queue.total}
            page={review.page}
            pageSize={pageSize}
            selectedIds={review.selectedIds}
            onToggle={review.toggleSelected}
            onTogglePage={review.selectPage}
            onOpen={setSelectedRow}
            onPage={review.setPage}
          />
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="reviews" /> : null}

      <ManualReviewDetailSheet
        row={selectedRow}
        configuration={review.configuration}
        visible={Boolean(selectedRow)}
        busy={review.busy}
        onClose={() => setSelectedRow(null)}
        onLoadDetail={review.loadDetail}
        onReview={review.reviewOne}
      />

      <ManualReviewBatchSheet
        visible={batchOpen}
        selectedCount={review.selectedIds.length}
        configuration={review.configuration}
        busy={review.busy}
        onClose={() => setBatchOpen(false)}
        onSubmit={async (input) => {
          await review.reviewBatch({ ids: review.selectedIds, ...input })
          setBatchOpen(false)
        }}
      />

      <ManualReviewConfigurationSheet
        visible={settingsOpen}
        configuration={review.configuration}
        busy={review.busy}
        onClose={() => setSettingsOpen(false)}
        onSaveSla={review.saveSla}
        onSaveRubric={review.saveRubric}
        onSaveTemplate={review.saveTemplate}
      />

      <AppBottomSheet
        visible={saveFilterOpen}
        onClose={() => setSaveFilterOpen(false)}
        title="Guardar filtros"
        description="Guarda la combinación actual para reutilizarla."
        footer={(
          <View className="flex-row justify-end gap-2">
            <AppButton label="Cancelar" variant="secondary" onPress={() => setSaveFilterOpen(false)} />
            <AppButton label="Guardar" icon="bookmark-outline" role="teacher" loading={review.busy} onPress={() => void review.saveFilter(filterName).then(() => setSaveFilterOpen(false))} />
          </View>
        )}
      >
        <TextInput
          accessibilityLabel="Nombre del filtro"
          value={filterName}
          onChangeText={setFilterName}
          className="min-h-12 rounded-xl border px-4"
          style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }}
        />
      </AppBottomSheet>
    </View>
  )
}

function summarizeFilter(filters: ManualReviewFilters) {
  const parts = [filters.status === 'all' ? 'todos los estados' : filters.status]
  if (filters.subjectId) parts.push(`curso ${filters.subjectId}`)
  if (filters.classroomId) parts.push(`clase ${filters.classroomId}`)
  if (filters.search) parts.push(`“${filters.search}”`)
  return parts.join(' · ')
}
