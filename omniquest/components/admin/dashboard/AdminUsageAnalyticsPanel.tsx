import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { supabase } from '../../../lib/supabase'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import type { AdminUsageAnalytics } from '../types/admin'
import { AdminMetric, EmptyState, Panel } from '../shared/AdminPrimitives'

export default function AdminUsageAnalyticsPanel({ refreshVersion }: { refreshVersion: number }) {
  const { tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  const [analytics, setAnalytics] = useState<AdminUsageAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_admin_usage_analytics', { p_days: 30 })
      if (!cancelled) {
        if (error) {
          console.warn('[admin] No se pudo cargar la analítica de uso:', error.message)
          setAnalytics(null)
        } else setAnalytics((data || null) as AdminUsageAnalytics | null)
        setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [refreshVersion])

  return (
    <Panel title="Analítica de uso · 30 días" icon="analytics-outline">
      {loading ? <View className="items-center py-7"><ActivityIndicator color={tokens.brand.admin} /><Text className="mt-3 text-[13px] text-text-muted">Calculando eventos de producto...</Text></View> : analytics ? (
        <>
          <View className="flex-row flex-wrap gap-3">
            <AdminMetric color={tokens.brand.admin} icon="eye" label="Visitas de pantalla" value={String(analytics.screen_views || 0)} />
            <AdminMetric color={tokens.semantic.warning} icon="document-text" label="Formularios abandonados" value={String(analytics.form_abandoned || 0)} />
            <AdminMetric color={tokens.semantic.info} icon="enter" label="Uniones a cursos" value={String(analytics.course_joins || 0)} />
            <AdminMetric color={tokens.semantic.info} icon="play" label="Partidas iniciadas" value={String(analytics.game_started || 0)} />
            <AdminMetric color={tokens.semantic.success} icon="checkmark-circle" label="Completadas" value={String(analytics.game_finished || 0)} />
            <AdminMetric color={tokens.semantic.warning} icon="exit" label="Abandonadas" value={String(analytics.game_abandoned || 0)} />
            <AdminMetric color={tokens.semantic.danger} icon="warning" label="Errores" value={String(analytics.game_errors || 0)} />
            <AdminMetric color={tokens.semantic.danger} icon="cloud-offline" label="Errores Edge" value={String(analytics.edge_function_errors || 0)} />
          </View>
          <View className={responsive.isDesktop ? 'mt-4 flex-row gap-4' : 'mt-4 gap-3'}>
            <View className="flex-1 rounded-xl border border-border-default bg-surface-default p-4"><Text className="text-[12px] font-bold text-text-muted">Retención</Text><Text className="mt-2 text-[13px] font-black text-text-primary">D1 {Number(analytics.retention?.d1 || 0).toFixed(1)}% · D7 {Number(analytics.retention?.d7 || 0).toFixed(1)}% · D30 {Number(analytics.retention?.d30 || 0).toFixed(1)}%</Text></View>
            <View className="flex-1 rounded-xl border border-border-default bg-surface-default p-4"><Text className="text-[12px] font-bold text-text-muted">Latencia RPC</Text><Text className="mt-2 text-[13px] font-black text-text-primary">p50 {Number(analytics.rpc_latency_ms?.p50 || 0).toFixed(0)} ms · p95 {Number(analytics.rpc_latency_ms?.p95 || 0).toFixed(0)} ms</Text></View>
          </View>
          <View className="mt-4 rounded-xl border border-border-default bg-surface-default p-4"><Text className="text-[12px] font-bold text-text-muted">Embudo de aprendizaje</Text><Text className="mt-2 text-[13px] font-black text-text-primary">Pantalla {analytics.funnel?.screen_view || 0} → Curso {analytics.funnel?.course_joined || 0} → Partida {analytics.funnel?.game_started || 0} → Final {analytics.funnel?.game_finished || 0}</Text>{Object.keys(analytics.question_types || {}).length > 0 ? <Text className="mt-2 text-[12px] text-text-secondary">Tipos de pregunta: {Object.entries(analytics.question_types || {}).map(([type, total]) => `${type} ${total}`).join(' · ')}</Text> : null}</View>
          <View className={responsive.isDesktop ? 'mt-4 flex-row gap-4' : 'mt-4 gap-3'}>
            <View className="flex-1 rounded-xl border border-border-default bg-surface-default p-4"><Text className="text-[12px] font-bold text-text-muted">Tasa de finalización</Text><Text className="mt-1 text-[26px] font-black text-text-primary">{Number(analytics.completion_rate || 0).toFixed(1)}%</Text></View>
            <View className="flex-1 rounded-xl border border-border-default bg-surface-default p-4"><Text className="text-[12px] font-bold text-text-muted">Usuarios activos</Text><Text className="mt-1 text-[26px] font-black text-text-primary">{analytics.active_users || 0}</Text></View>
            <View className="flex-1 rounded-xl border border-border-default bg-surface-default p-4"><Text className="text-[12px] font-bold text-text-muted">Logros desbloqueados</Text><Text className="mt-1 text-[26px] font-black text-text-primary">{analytics.badges_unlocked || 0}</Text></View>
          </View>
        </>
      ) : <EmptyState label="La analítica aparecerá cuando se registren eventos de uso." />}
    </Panel>
  )
}
