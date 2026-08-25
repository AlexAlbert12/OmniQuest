import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { type Href, useRouter } from 'expo-router'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import { formatAdminPushRelative } from '../../../lib/adminPushPresentation'
import { fetchAdminPushDeliveryMetrics } from '../api/adminApi'
import type { AdminPushDeliveryMetrics } from '../types/admin'
import { AdminMetric, EmptyState, Panel } from '../shared/AdminPrimitives'
import { AppPressable } from '../../ui'

export default function AdminPushDeliveryPanel({ refreshVersion }: { refreshVersion: number }) {
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const router = useRouter()
  const isDesktop = responsive.isDesktop
  const [metrics, setMetrics] = useState<AdminPushDeliveryMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const next = await fetchAdminPushDeliveryMetrics(30)
        if (!cancelled) setMetrics(next)
      } catch (error: unknown) {
        if (!cancelled) { console.warn('[admin] No se pudieron cargar las métricas push:', error instanceof Error ? error.message : String(error)); setMetrics(null) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [refreshVersion])

  const attention = metrics?.service_health === 'attention'
  const oldestPending = metrics?.oldest_pending_at ? formatAdminPushRelative(metrics.oldest_pending_at).toLowerCase() : null

  return (
    <Panel title="Entrega de notificaciones push · 30 días" icon="paper-plane-outline">
      {loading ? <View className="items-center py-7"><ActivityIndicator /><Text className="mt-3 text-[13px] text-text-muted">Revisando cola, reintentos y confirmaciones...</Text></View> : metrics ? (
        <>
          <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-border-default bg-surface-default px-4 py-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: attention ? tokens.semanticSurface.warning : tokens.semanticSurface.success }}><Ionicons name={attention ? 'warning-outline' : 'checkmark-circle-outline'} size={19} color={attention ? tokens.semantic.warning : tokens.semantic.success} /></View>
            <View className="min-w-0 flex-1"><Text className="text-[12px] font-bold text-text-muted">Servicio push</Text><Text className="mt-0.5 text-[14px] font-black text-text-primary">{attention ? 'Requiere atención' : 'Operativo'}</Text><Text className="mt-0.5 text-[11px] text-text-muted">{metrics.queued > 0 ? `${metrics.queued} pendientes${oldestPending ? ` · el más antiguo: ${oldestPending}` : ''}` : 'No hay envíos pendientes.'}</Text></View>
          </View>
          <View className="flex-row flex-wrap gap-3">
            {[
              { color: tokens.semantic.info, icon: 'time-outline' as const, label: 'Pendientes', value: metrics.queued },
              { color: tokens.semantic.warning, icon: 'sync-outline' as const, label: 'Procesando', value: metrics.processing },
              { color: tokens.semantic.success, icon: 'checkmark-circle' as const, label: 'Entregadas', value: metrics.delivered },
              { color: tokens.semantic.danger, icon: 'alert-circle' as const, label: 'Fallidas', value: metrics.failed },
            ].map((metric) => <View key={metric.label} style={isDesktop ? { flexGrow: 1, minWidth: 160 } : { flexBasis: '47%', flexGrow: 1, minWidth: 0 }}><AdminMetric compact={!isDesktop} color={metric.color} icon={metric.icon} label={metric.label} value={String(metric.value)} /></View>)}
          </View>
          <View className="mt-4 flex-row flex-wrap gap-3">
            <MetricSummary label="Tasa de entrega" value={metrics.delivery_rate === null ? '—' : `${metrics.delivery_rate.toFixed(1)}%`} detail={metrics.delivery_rate === null ? 'Sin entregas resueltas todavía.' : undefined} />
            <MetricSummary label="Reintentando" value={String(metrics.retrying)} />
            <MetricSummary label="Omitidas" value={String(metrics.skipped)} detail="Respeta preferencias y dispositivos disponibles." />
          </View>
          <AppPressable accessibilityRole="button" accessibilityLabel="Abrir centro de notificaciones push" onPress={() => router.push('/(admin)/push' as Href)} className={isDesktop ? 'mt-4 self-start rounded-xl border border-border-default bg-surface-interactive px-4 py-3' : 'mt-4 items-center rounded-xl border border-border-default bg-surface-interactive px-4 py-3'}><View className="flex-row items-center gap-2"><Text className="text-[13px] font-black text-brand-admin">Ver centro push</Text><Ionicons name="arrow-forward" size={16} color={tokens.brand.admin} /></View></AppPressable>
        </>
      ) : <EmptyState label="No se pudieron consultar las métricas de entrega push." />}
    </Panel>
  )
}

function MetricSummary({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return <View className="rounded-xl border border-border-default bg-surface-default p-4" style={{ flexBasis: '30%', flexGrow: 1, minWidth: 92 }}><Text className="text-[12px] font-bold text-text-muted">{label}</Text><Text className="mt-1 text-[26px] font-black text-white">{value}</Text>{detail ? <Text className="mt-1 text-[11px] leading-4 text-text-muted">{detail}</Text> : null}</View>
}
