import { Ionicons } from '@expo/vector-icons'
import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Text, View } from 'react-native'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

type ExportRequest = {
  id: string
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired'
  object_path: string | null
  file_size_bytes: number | null
  requested_at: string
  completed_at: string | null
  expires_at: string | null
  error_message: string | null
}

type DeletionRequest = {
  id: string
  status: 'pending' | 'cancelled' | 'processing' | 'completed' | 'failed'
  requested_at: string
  scheduled_for: string
  cancelled_at: string | null
  error_message: string | null
}

export default function AccountDataRequestsCard({
  deletingAccount,
  onRequestDeletion,
}: {
  deletingAccount: boolean
  onRequestDeletion: () => void
}) {
  const { accentColor, colors } = useAppTheme()
  const { t, formatDate } = useI18n()
  const [loading, setLoading] = useState(true)
  const [requestingExport, setRequestingExport] = useState(false)
  const [cancellingDeletion, setCancellingDeletion] = useState(false)
  const [exports, setExports] = useState<ExportRequest[]>([])
  const [deletion, setDeletion] = useState<DeletionRequest | null>(null)

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${message}`)
    else Alert.alert(title, message)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [exportResult, deletionResult] = await Promise.all([
        supabase
          .from('data_export_requests')
          .select('id, status, object_path, file_size_bytes, requested_at, completed_at, expires_at, error_message')
          .order('requested_at', { ascending: false })
          .limit(5),
        supabase
          .from('account_deletion_requests')
          .select('id, status, requested_at, scheduled_for, cancelled_at, error_message')
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (exportResult.error) throw exportResult.error
      if (deletionResult.error) throw deletionResult.error
      setExports((exportResult.data || []) as ExportRequest[])
      setDeletion((deletionResult.data || null) as DeletionRequest | null)
    } catch (error) {
      showAlert(t('accountRequests.error.title'), getErrorMessage(error, t('accountRequests.error.load')))
    } finally {
      setLoading(false)
    }
  }, [showAlert, t])

  useEffect(() => {
    void load()
  }, [deletingAccount, load])

  const requestExport = async () => {
    setRequestingExport(true)
    try {
      const { error } = await supabase.rpc('request_account_data_export')
      if (error) throw error
      await load()
      showAlert(t('accountRequests.export.requested'), t('accountRequests.export.requestedDetail'))
    } catch (error) {
      showAlert(t('accountRequests.error.title'), getErrorMessage(error, t('accountRequests.error.export')))
    } finally {
      setRequestingExport(false)
    }
  }

  const downloadExport = async (request: ExportRequest) => {
    if (!request.object_path) return
    try {
      const { data, error } = await supabase.storage.from('account-exports').createSignedUrl(request.object_path, 5 * 60)
      if (error) throw error
      if (!data.signedUrl || !await Linking.canOpenURL(data.signedUrl)) throw new Error(t('accountRequests.export.openError'))
      await Linking.openURL(data.signedUrl)
    } catch (error) {
      showAlert(t('accountRequests.error.title'), getErrorMessage(error, t('accountRequests.export.openError')))
    }
  }

  const cancelDeletion = async () => {
    if (!deletion || deletion.status !== 'pending') return
    setCancellingDeletion(true)
    try {
      const { error } = await supabase.rpc('cancel_account_deletion', { p_request_id: deletion.id })
      if (error) throw error
      await load()
      showAlert(t('accountRequests.deletion.cancelled'), t('accountRequests.deletion.cancelledDetail'))
    } catch (error) {
      showAlert(t('accountRequests.error.title'), getErrorMessage(error, t('accountRequests.error.cancel')))
    } finally {
      setCancellingDeletion(false)
    }
  }

  if (loading) return <ActivityIndicator className="my-6" color={accentColor} />

  const activeExport = exports.find((request) => ['queued', 'processing', 'ready'].includes(request.status) && (!request.expires_at || new Date(request.expires_at) > new Date()))
  const activeDeletion = deletion && ['pending', 'processing'].includes(deletion.status) ? deletion : null

  return (
    <View className="gap-4">
      <View className="rounded-xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <View className="flex-row items-start gap-3">
          <Ionicons name="archive-outline" size={22} color={accentColor} />
          <View className="min-w-0 flex-1">
            <Text className="font-black" style={{ color: colors.text }}>{t('accountRequests.export.title')}</Text>
            <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{t('accountRequests.export.description')}</Text>
          </View>
        </View>

        {activeExport ? (
          <View className="mt-4 rounded-lg border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
            <RequestStatus status={activeExport.status} />
            <Text className="mt-2 text-[11px]" style={{ color: colors.textMuted }}>
              {t('accountRequests.requestedAt', { date: formatDate(activeExport.requested_at, { dateStyle: 'medium', timeStyle: 'short' }) })}
            </Text>
            {activeExport.status === 'ready' ? (
              <Pressable onPress={() => void downloadExport(activeExport)} className="mt-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-lg" style={{ backgroundColor: accentColor }}>
                <Ionicons name="download-outline" size={17} color="#FFFFFF" />
                <Text className="font-black text-white">{t('accountRequests.export.download')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Pressable disabled={requestingExport} onPress={() => void requestExport()} className="mt-4 min-h-[46px] flex-row items-center justify-center gap-2 rounded-lg" style={{ backgroundColor: accentColor, opacity: requestingExport ? 0.6 : 1 }}>
            {requestingExport ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />}
            <Text className="font-black text-white">{requestingExport ? t('accountRequests.export.requesting') : t('accountRequests.export.request')}</Text>
          </Pressable>
        )}
      </View>

      <View className="rounded-xl border p-4" style={{ borderColor: colors.danger, backgroundColor: withAlpha(colors.danger, '12') }}>
        <View className="flex-row items-start gap-3">
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
          <View className="min-w-0 flex-1">
            <Text className="font-black" style={{ color: colors.text }}>{t('accountRequests.deletion.title')}</Text>
            <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{t('accountRequests.deletion.description')}</Text>
          </View>
        </View>

        {activeDeletion ? (
          <View className="mt-4 rounded-lg border p-3" style={{ borderColor: colors.danger, backgroundColor: colors.surface }}>
            <RequestStatus status={activeDeletion.status} />
            <Text className="mt-2 text-[12px] font-bold" style={{ color: colors.danger }}>
              {t('accountRequests.deletion.scheduled', { date: formatDate(activeDeletion.scheduled_for, { dateStyle: 'medium', timeStyle: 'short' }) })}
            </Text>
            {activeDeletion.status === 'pending' ? (
              <Pressable disabled={cancellingDeletion} onPress={() => void cancelDeletion()} className="mt-3 min-h-[44px] items-center justify-center rounded-lg border" style={{ borderColor: colors.border }}>
                <Text className="font-black" style={{ color: colors.text }}>{cancellingDeletion ? t('accountRequests.deletion.cancelling') : t('accountRequests.deletion.cancel')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Pressable disabled={deletingAccount} onPress={onRequestDeletion} className="mt-4 min-h-[46px] flex-row items-center justify-center gap-2 rounded-lg border" style={{ borderColor: colors.danger, backgroundColor: withAlpha(colors.danger, '0F'), opacity: deletingAccount ? 0.6 : 1 }}>
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text className="font-black" style={{ color: colors.danger }}>{t('accountRequests.deletion.request')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function RequestStatus({ status }: { status: string }) {
  const { colors } = useAppTheme()
  const { t } = useI18n()
  const color = status === 'ready' || status === 'completed' ? '#34D399' : status === 'failed' ? colors.danger : '#F6A64A'
  return <View className="self-start rounded-full px-3 py-1" style={{ backgroundColor: `${color}22` }}><Text className="text-[11px] font-black" style={{ color }}>{t(`accountRequests.status.${status}`)}</Text></View>
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
