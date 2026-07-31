import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherAuditAlert } from '../../../lib/teacherAudit'

export default function TeacherAuditAlerts({ alerts, busy, onAcknowledge }: { alerts: TeacherAuditAlert[]; busy: boolean; onAcknowledge: (id: number) => void }) {
  const { tokens } = useAppTheme()
  if (!alerts.length) return null
  return (
    <View className="mb-5 rounded-2xl border p-4" style={{ borderColor: tokens.semantic.warning, backgroundColor: tokens.semanticSurface.warning }}>
      <View className="mb-3 flex-row items-center gap-2">
        <Ionicons name="warning-outline" size={22} color={tokens.semantic.warning} />
        <Text className="text-[17px] font-black" style={{ color: tokens.text.primary }}>Patrones anómalos detectados</Text>
      </View>
      <View className="gap-3">
        {alerts.map((alert) => (
          <View key={alert.id} className="flex-row flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
            <View className="min-w-[220px] flex-1">
              <Text className="font-black" style={{ color: alert.severity === 'critical' ? tokens.semantic.danger : tokens.semantic.warning }}>{alert.title}</Text>
              <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>{alert.description}</Text>
              <Text className="mt-1 text-[10px]" style={{ color: tokens.text.muted }}>{alert.event_count} eventos · {new Date(alert.created_at).toLocaleString('es-ES')}</Text>
            </View>
            <AppButton label="Revisado" icon="checkmark-outline" variant="secondary" size="sm" disabled={busy} onPress={() => onAcknowledge(alert.id)} />
          </View>
        ))}
      </View>
    </View>
  )
}
