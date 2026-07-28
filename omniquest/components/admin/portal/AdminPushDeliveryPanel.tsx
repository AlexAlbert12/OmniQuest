import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, useWindowDimensions, View } from 'react-native'
import { supabase } from '../../../lib/supabase'
import { AdminMetric, EmptyState, Panel } from './AdminPortalCore'

type PushDeliveryMetrics = {
  days: number
  queued: number
  pending: number
  completed: number
  failed: number
  skipped: number
  tickets: number
  delivered: number
  device_failures: number
  retrying: number
  delivery_rate: number
}

const EMPTY_METRICS: PushDeliveryMetrics = {
  days: 30,
  queued: 0,
  pending: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  tickets: 0,
  delivered: 0,
  device_failures: 0,
  retrying: 0,
  delivery_rate: 0,
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeMetrics(value: unknown): PushDeliveryMetrics | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  return {
    days: Math.max(1, toNumber(row.days) || 30),
    queued: toNumber(row.queued),
    pending: toNumber(row.pending),
    completed: toNumber(row.completed),
    failed: toNumber(row.failed),
    skipped: toNumber(row.skipped),
    tickets: toNumber(row.tickets),
    delivered: toNumber(row.delivered),
    device_failures: toNumber(row.device_failures),
    retrying: toNumber(row.retrying),
    delivery_rate: toNumber(row.delivery_rate),
  }
}

export default function AdminPushDeliveryPanel({ refreshVersion }: { refreshVersion: number }) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1040
  const [metrics, setMetrics] = useState<PushDeliveryMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_admin_push_delivery_metrics', { p_days: 30 })
      if (cancelled) return

      if (error) {
        console.warn('[admin] No se pudieron cargar las métricas push:', error.message)
        setMetrics(null)
      } else {
        setMetrics(normalizeMetrics(data) || EMPTY_METRICS)
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [refreshVersion])

  return (
    <Panel title="Entrega de notificaciones push · 30 días" icon="paper-plane-outline">
      {loading ? (
        <View className="items-center py-7">
          <ActivityIndicator color="#8B5CF6" />
          <Text className="mt-3 text-[13px] text-text-muted">Revisando cola, reintentos y recibos...</Text>
        </View>
      ) : metrics ? (
        <>
          <View className="flex-row flex-wrap gap-3">
            <AdminMetric color="#38BDF8" icon="notifications" label="En cola" value={String(metrics.queued)} />
            <AdminMetric color="#FBBF24" icon="time" label="Pendientes" value={String(metrics.pending)} />
            <AdminMetric color="#34D399" icon="checkmark-circle" label="Entregadas" value={String(metrics.delivered)} />
            <AdminMetric color="#FB7185" icon="warning" label="Fallos de dispositivo" value={String(metrics.device_failures)} />
          </View>

          <View className={isDesktop ? 'mt-4 flex-row gap-4' : 'mt-4 gap-3'}>
            <MetricSummary label="Tasa de entrega" value={`${metrics.delivery_rate.toFixed(1)}%`} />
            <MetricSummary label="Reintentando" value={String(metrics.retrying)} />
            <MetricSummary label="Omitidas por preferencias/token" value={String(metrics.skipped)} />
          </View>

          <Text className="mt-4 text-[12px] leading-5 text-text-muted">
            Las notificaciones persistentes entran en una cola central. El sistema respeta las preferencias push,
            reintenta errores temporales y desactiva tokens que Expo marca como no registrados.
          </Text>
        </>
      ) : (
        <EmptyState label="Las métricas de entrega aparecerán después de aplicar la migración y desplegar el procesador push." />
      )}
    </Panel>
  )
}

function MetricSummary({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-xl border border-border-default bg-surface-default p-4">
      <Text className="text-[12px] font-bold text-text-muted">{label}</Text>
      <Text className="mt-1 text-[26px] font-black text-white">{value}</Text>
    </View>
  )
}
