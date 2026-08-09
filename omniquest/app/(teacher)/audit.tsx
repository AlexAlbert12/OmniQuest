import OmniLoadingScreen from '../../components/ui/OmniLoadingScreen'
import React, { useMemo, useState } from 'react'
import { RefreshControl, ScrollView, TextInput, useWindowDimensions, View } from 'react-native'
import { useRouter } from 'expo-router'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import AppButton from '../../components/ui/AppButton'
import AppDropdown from '../../components/ui/AppDropdown'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import AppBottomSheet from '../../components/ui/AppBottomSheet'
import TeacherAuditFilters from '../../components/teacher/audit/TeacherAuditFilters'
import TeacherAuditAlerts from '../../components/teacher/audit/TeacherAuditAlerts'
import TeacherAuditTimeline from '../../components/teacher/audit/TeacherAuditTimeline'
import TeacherAuditExports from '../../components/teacher/audit/TeacherAuditExports'
import { useTeacherAudit } from '../../hooks/teacher/useTeacherAudit'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

export default function TeacherAuditScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isDesktop = width >= 1080
  const pageSize = isDesktop ? 25 : 8
  const audit = useTeacherAudit(pageSize)
  const [saveOpen, setSaveOpen] = useState(false)
  const [filterName, setFilterName] = useState('Filtro de auditoría')

  const savedOptions = useMemo(() => audit.configuration.savedFilters.map((item) => ({
    value: item.id,
    label: item.name,
    description: `${item.filters.category} · ${item.filters.severity}`,
  })), [audit.configuration.savedFilters])

  const applySavedFilter = (id: string) => {
    const saved = audit.configuration.savedFilters.find((item) => item.id === id)
    if (saved) audit.updateFilters(saved.filters)
  }

  const handleSignOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as any)
  }

  if (audit.loading) return <OmniLoadingScreen />

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <View className="flex-1 flex-row">
        {isDesktop ? <TeacherSidebar activeSection="audit" subjectsCount={audit.subjectsCount} onSignOut={handleSignOut} /> : null}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: isDesktop ? 28 : 16, paddingTop: isDesktop ? 28 : 20, paddingBottom: isDesktop ? 48 : MOBILE_BOTTOM_NAV_SPACER + 20 }}
          refreshControl={<RefreshControl refreshing={audit.refreshing} onRefresh={audit.refresh} tintColor={tokens.brand.teacher} />}
        >
          <TeacherPageHeader
            icon="shield-checkmark"
            isDesktop={isDesktop}
            title="Centro de auditoría"
            mobileTitle="Auditoría"
            subtitle="Registro inmutable, cambios antes/después, alertas anómalas y exportaciones asíncronas."
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
            actions={(
              <View className="flex-row flex-wrap gap-2">
                <AppButton label="Guardar filtro" icon="bookmark-outline" variant="secondary" onPress={() => setSaveOpen(true)} />
                <AppButton label="Actualizar" icon="refresh-outline" role="teacher" loading={audit.refreshing} onPress={audit.refresh} />
              </View>
            )}
          />

          {audit.error ? <AppStatusBanner variant="danger" title="No se pudo completar la operación" message={audit.error} style={{ marginBottom: 16 }} /> : null}

          <TeacherAuditAlerts alerts={audit.configuration.alerts} busy={audit.busy} onAcknowledge={(id) => void audit.acknowledgeAlert(id)} />

          <View className="mb-5 flex-row flex-wrap gap-3">
            <MobileMetricCard semantic="audit" label="Registros filtrados" value={String(audit.pageData.total)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard icon="calendar-outline" label="Últimos 7 días" value={String(audit.pageData.stats.last7Days || 0)} color={tokens.semantic.info} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="attention" label="Advertencias" value={String(audit.pageData.stats.warning || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="critical" label="Críticas" value={String(audit.pageData.stats.critical || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
          </View>

          {savedOptions.length ? (
            <View className="mb-4 max-w-[360px]">
              <AppDropdown<string>
                label="Filtros guardados"
                value={null}
                options={savedOptions}
                onChange={applySavedFilter}
                placeholder="Aplicar configuración"
              />
            </View>
          ) : null}

          <TeacherAuditFilters
            filters={audit.filters}
            actions={audit.pageData.actions}
            targetTables={audit.pageData.targetTables}
            onChange={audit.updateFilters}
          />

          <View className="mt-5">
            <TeacherAuditTimeline
              items={audit.pageData.items}
              total={audit.pageData.total}
              page={audit.page}
              pageSize={pageSize}
              onPage={audit.setPage}
            />
          </View>

          <View className="mt-5">
            <TeacherAuditExports
              exports={audit.configuration.exports}
              busy={audit.busy}
              retentionDays={audit.configuration.retentionDays}
              onRequest={() => void audit.requestExport()}
              onDownload={(path) => void audit.downloadExport(path)}
            />
          </View>

          <AppStatusBanner
            variant="neutral"
            title="Política de minimización"
            message="Los eventos no pueden editarse ni eliminarse fuera de la retención programada. Contraseñas, tokens, correos, respuestas y contenido libre se eliminan del payload antes de persistir."
            style={{ marginTop: 20 }}
          />
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="audit" /> : null}

      <AppBottomSheet
        visible={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Guardar filtro de auditoría"
        description="Guarda categoría, búsqueda, fechas, severidad, acción y entidad."
        footer={(
          <View className="flex-row justify-end gap-2">
            <AppButton label="Cancelar" variant="secondary" onPress={() => setSaveOpen(false)} />
            <AppButton label="Guardar" icon="bookmark-outline" role="teacher" loading={audit.busy} onPress={() => void audit.saveFilter(filterName).then(() => setSaveOpen(false))} />
          </View>
        )}
      >
        <TextInput
          accessibilityLabel="Nombre del filtro de auditoría"
          value={filterName}
          onChangeText={setFilterName}
          className="min-h-12 rounded-xl border px-4"
          style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, color: tokens.text.primary }}
        />
      </AppBottomSheet>
    </View>
  )
}
