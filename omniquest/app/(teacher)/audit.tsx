import OmniLoadingScreen from '../../components/ui/OmniLoadingScreen'
import React from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import TeacherAuditFilters from '../../components/teacher/audit/TeacherAuditFilters'
import TeacherAuditAlerts from '../../components/teacher/audit/TeacherAuditAlerts'
import TeacherAuditTimeline from '../../components/teacher/audit/TeacherAuditTimeline'
import TeacherAuditExports from '../../components/teacher/audit/TeacherAuditExports'
import { useTeacherAudit } from '../../hooks/teacher/useTeacherAudit'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { useResponsiveLayout } from '../../lib/responsive'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

export default function TeacherAuditScreen() {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const isDesktop = responsive.isDesktop
  const pageSize = isDesktop ? 25 : 8
  const audit = useTeacherAudit(pageSize)

  const handleSignOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as any)
  }

  if (audit.loading) return <OmniLoadingScreen />

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
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
            title="Auditoría"
            mobileTitle="Auditoría"
            notificationOnPress={() => router.push('/(teacher)/notifications' as any)}
          />

          {audit.error ? <AppStatusBanner variant="danger" title="No se pudo completar la operación" message={audit.error} style={{ marginBottom: 16 }} /> : null}

          <View className="mb-5 flex-row flex-wrap gap-3">
            <MobileMetricCard semantic="audit" label="Registros" value={String(audit.pageData.total)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard icon="calendar-outline" label="Últimos 7 días" value={String(audit.pageData.stats.last7Days || 0)} color={tokens.semantic.info} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="attention" label="Advertencias" value={String(audit.pageData.stats.warning || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
            <MobileMetricCard semantic="critical" label="Críticas" value={String(audit.pageData.stats.critical || 0)} compact style={isDesktop ? { flex: 1 } : { width: '48%' }} />
          </View>

          <TeacherAuditAlerts alerts={audit.configuration.alerts} busy={audit.busy} onAcknowledge={(id) => void audit.acknowledgeAlert(id)} />

          <TeacherAuditFilters filters={audit.filters} actions={audit.pageData.actions} onChange={audit.updateFilters} />

          <View className="mt-5">
            <TeacherAuditTimeline items={audit.pageData.items} total={audit.pageData.total} page={audit.page} pageSize={pageSize} onPage={audit.setPage} />
          </View>

          <View className="mt-5">
            <TeacherAuditExports exports={audit.configuration.exports} busy={audit.busy} retentionDays={audit.configuration.retentionDays} onRequest={() => void audit.requestExport()} onDownload={(path) => void audit.downloadExport(path)} />
          </View>

          <AppStatusBanner
            variant="neutral"
            title="Protección de datos"
            message={`Los registros de auditoría se conservan durante ${audit.configuration.retentionDays} días. No se almacenan contraseñas, tokens ni respuestas del alumnado; descripciones, notas y comentarios se excluyen del historial.`}
            style={{ marginTop: 20 }}
          />
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="audit" /> : null}
    </SafeAreaView>
  )
}
