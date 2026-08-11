import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { useI18n } from '../../../lib/i18n'
import type { TeacherAuditExport } from '../../../lib/teacherAudit'

export default function TeacherAuditExports({ exports, busy, retentionDays, onRequest, onDownload }: { exports: TeacherAuditExport[]; busy: boolean; retentionDays: number; onRequest: () => void; onDownload: (path: string) => void }) {
  const { tokens } = useAppTheme()
  const { locale } = useI18n()
  const hasPending = exports.some((item) => item.status === 'queued' || item.status === 'processing')
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-[230px] flex-1">
          <Text className="text-[17px] font-black" style={{ color: tokens.text.primary }}>Exportar historial</Text>
          <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>Si hay muchos registros, prepararemos el archivo en segundo plano. El historial se conserva durante {retentionDays} días.</Text>
          {hasPending ? <Text className="mt-1 text-[10px] font-bold" style={{ color: tokens.semantic.info }}>El estado de la exportación se actualizará automáticamente.</Text> : null}
        </View>
        <AppButton label="Exportar CSV" icon="cloud-download-outline" role="teacher" loading={busy} disabled={hasPending} onPress={onRequest} />
      </View>
      {exports.length ? <View className="mt-4 gap-2">{exports.map((item) => (
        <View key={item.id} className="flex-row flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
          <Ionicons name={item.status === 'ready' ? 'checkmark-circle-outline' : item.status === 'failed' ? 'alert-circle-outline' : 'time-outline'} size={20} color={item.status === 'ready' ? tokens.semantic.success : item.status === 'failed' ? tokens.semantic.danger : tokens.semantic.info} />
          <View className="min-w-[180px] flex-1"><Text className="font-black" style={{ color: tokens.text.primary }}>{statusLabel(item.status)}</Text><Text className="mt-1 text-[10px]" style={{ color: tokens.text.muted }}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.requested_at))} {item.row_count != null ? `· ${item.row_count} filas` : ''}</Text></View>
          {item.status === 'ready' && item.object_path ? <AppButton label="Descargar" icon="download-outline" variant="secondary" size="sm" onPress={() => onDownload(item.object_path!)} /> : null}
        </View>
      ))}</View> : null}
    </View>
  )
}

function statusLabel(status: string) { if (status === 'ready') return 'Archivo preparado'; if (status === 'failed') return 'Exportación fallida'; if (status === 'processing') return 'Procesando'; if (status === 'expired') return 'Archivo caducado'; return 'En cola' }
