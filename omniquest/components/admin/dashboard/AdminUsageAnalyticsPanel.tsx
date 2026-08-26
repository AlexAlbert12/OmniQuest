import React, { useEffect, useMemo, useState } from 'react'
import AdminButton from '../shared/AdminButton'
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
  const [error, setError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('get_admin_usage_analytics', { p_days: 30 })
      if (!cancelled) {
        if (rpcError) {
          console.warn('[admin] No se pudo cargar la analítica de uso:', rpcError.message)
          setAnalytics(null)
          setError('No se pudo consultar la analítica de uso. Revisa la conexión o inténtalo de nuevo.')
        } else setAnalytics((data || null) as AdminUsageAnalytics | null)
        setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [refreshVersion, retryVersion])

  const hasEvents = useMemo(() => Boolean(analytics && [analytics.screen_views, analytics.form_abandoned, analytics.course_joins, analytics.game_started, analytics.game_finished, analytics.game_abandoned, analytics.game_errors, analytics.edge_function_errors, analytics.badges_unlocked].some((value) => Number(value || 0) > 0)), [analytics])

  return (
    <Panel title="Analítica de uso · 30 días" icon="analytics-outline">
      {loading ? <View className="items-center py-7"><ActivityIndicator color={tokens.brand.admin} /><Text className="mt-3 text-[13px] text-text-muted">Calculando eventos de producto...</Text></View> : error ? (
        <View className="rounded-xl border border-semantic-warning bg-semantic-surface-warning p-4"><Text className="text-[14px] font-black text-text-primary">No se pudo cargar la analítica</Text><Text className="mt-2 text-[12px] leading-5 text-text-secondary">{error}</Text><View className="mt-4 items-start"><AdminButton label="Reintentar" icon="refresh-outline" size="sm" variant="secondary" onPress={() => setRetryVersion((value) => value + 1)} /></View></View>
      ) : analytics && hasEvents ? (
        <>
          <View className="flex-row flex-wrap" style={{ gap: responsive.isMobile ? 8 : 12 }}>
            {[
              { color: tokens.brand.admin, icon: 'eye' as const, label: responsive.isMobile ? 'Visitas' : 'Visitas de pantalla', value: analytics.screen_views },
              { color: tokens.semantic.warning, icon: 'document-text' as const, label: responsive.isMobile ? 'Formularios' : 'Formularios abandonados', value: analytics.form_abandoned },
              { color: tokens.semantic.info, icon: 'enter' as const, label: responsive.isMobile ? 'Uniones' : 'Uniones a cursos', value: analytics.course_joins },
              { color: tokens.semantic.info, icon: 'play' as const, label: responsive.isMobile ? 'Iniciadas' : 'Partidas iniciadas', value: analytics.game_started },
              { color: tokens.semantic.success, icon: 'checkmark-circle' as const, label: 'Completadas', value: analytics.game_finished },
              { color: tokens.semantic.warning, icon: 'exit' as const, label: 'Abandonadas', value: analytics.game_abandoned },
              { color: tokens.semantic.danger, icon: 'warning' as const, label: 'Errores', value: analytics.game_errors },
              { color: tokens.semantic.danger, icon: 'cloud-offline' as const, label: 'Errores Edge', value: analytics.edge_function_errors },
            ].map((metric) => <View key={metric.label} style={responsive.isMobile ? { flexBasis: '22%', flexGrow: 1, minWidth: 0 } : { flexGrow: 1, minWidth: 160 }}><AdminMetric {...metric} value={String(metric.value || 0)} dense={responsive.isMobile} style={responsive.isMobile ? { width: '100%', aspectRatio: 1 } : undefined} /></View>)}
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
      ) : <EmptyState label="Aún no hay eventos de uso en los últimos 30 días." />}
    </Panel>
  )
}
