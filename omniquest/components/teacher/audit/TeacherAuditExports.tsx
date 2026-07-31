import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import type { TeacherAuditExport } from '../../../lib/teacherAudit'

export default function TeacherAuditExports({ exports, busy, retentionDays, onRequest, onDownload }: { exports: TeacherAuditExport[]; busy: boolean; retentionDays: number; onRequest: () => void; onDownload: (path: string) => void }) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-[230px] flex-1">
          <Text className="text-[17px] font-black" style={{ color: tokens.text.primary }}>Exportación asíncrona</Text>
          <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>Los volúmenes grandes se procesan en segundo plano. La política conserva eventos durante {retentionDays} días.</Text>
        </View>
        <AppButton label="Solicitar CSV" icon="cloud-download-outline" role="teacher" loading={busy} onPress={onRequest} />
      </View>
      {exports.length ? <View className="mt-4 gap-2">{exports.map((item) => (
        <View key={item.id} className="flex-row flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
          <Ionicons name={item.status === 'ready' ? 'checkmark-circle-outline' : item.status === 'failed' ? 'alert-circle-outline' : 'time-outline'} size={20} color={item.status === 'ready' ? tokens.semantic.success : item.status === 'failed' ? tokens.semantic.danger : tokens.semantic.info} />
          <View className="min-w-[180px] flex-1"><Text className="font-black" style={{ color: tokens.text.primary }}>{statusLabel(item.status)}</Text><Text className="mt-1 text-[10px]" style={{ color: tokens.text.muted }}>{new Date(item.requested_at).toLocaleString('es-ES')} {item.row_count != null ? `· ${item.row_count} filas` : ''}</Text></View>
          {item.status === 'ready' && item.object_path ? <AppButton label="Descargar" icon="download-outline" variant="secondary" size="sm" onPress={() => onDownload(item.object_path!)} /> : null}
        </View>
      ))}</View> : null}
    </View>
  )
}
function statusLabel(status: string) { if (status === 'ready') return 'Archivo preparado'; if (status === 'failed') return 'Exportación fallida'; if (status === 'processing') return 'Procesando'; if (status === 'expired') return 'Archivo caducado'; return 'En cola' }
