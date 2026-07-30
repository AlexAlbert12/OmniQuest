import { Ionicons } from '@expo/vector-icons'
import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import { getOrCreateDeviceId } from '../../lib/sessionSecurity'
import { supabase } from '../../lib/supabase'

type SessionRow = {
  id: string
  device_id: string
  device_name: string
  platform: string
  first_seen_at: string
  last_seen_at: string
  revoked_at: string | null
}

export default function ManagedSessionsCard() {
  const { accentColor, colors } = useAppTheme()
  const { t, formatDate } = useI18n()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [currentDevice, setCurrentDevice] = useState('')
  const [codesRemaining, setCodesRemaining] = useState(0)

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`)
    else Alert.alert(title, message)
  }, [])

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('manage-account-security', { body })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCurrentDevice(await getOrCreateDeviceId())
      const data = await invoke({ action: 'list_sessions' })
      setSessions(data.sessions || [])
      setCodesRemaining(data.backupCodesRemaining || 0)
    } catch (error) {
      showAlert(t('sessions.error.title'), getErrorMessage(error, t('sessions.error.load')))
    } finally {
      setLoading(false)
    }
  }, [invoke, showAlert, t])

  useEffect(() => {
    void load()
  }, [load])

  const revoke = async (session: SessionRow) => {
    setBusy(session.id)
    try {
      await invoke({ action: 'revoke_session', sessionId: session.id })
      await load()
    } catch (error) {
      showAlert(t('sessions.error.title'), getErrorMessage(error, t('sessions.error.revoke')))
    } finally {
      setBusy(null)
    }
  }

  const revokeOthers = async () => {
    setBusy('others')
    try {
      await invoke({ action: 'revoke_others', currentDeviceId: currentDevice })
      await load()
      showAlert(t('sessions.revoked.title'), t('sessions.revoked.detail'))
    } catch (error) {
      showAlert(t('sessions.error.title'), getErrorMessage(error, t('sessions.error.revokeOthers')))
    } finally {
      setBusy(null)
    }
  }

  const generateCodes = async () => {
    setBusy('codes')
    try {
      const data = await invoke({ action: 'generate_backup_codes' })
      showAlert(t('sessions.codes.title'), `${t('sessions.codes.detail')}\n\n${(data.codes || []).join('\n')}`)
      await load()
    } catch (error) {
      showAlert(t('sessions.error.title'), getErrorMessage(error, t('sessions.error.codes')))
    } finally {
      setBusy(null)
    }
  }

  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
      <View className="mb-4 flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: colors.surfaceRaised }}>
          <Ionicons name="desktop-outline" size={21} color={accentColor} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black" style={{ color: colors.text }}>{t('sessions.title')}</Text>
          <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{t('sessions.description')}</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={accentColor} /> : (
        <View className="gap-3">
          {sessions.map((session) => {
            const current = session.device_id === currentDevice
            const active = !session.revoked_at
            return (
              <View key={session.id} className="rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
                <View className="flex-row items-start gap-3">
                  <Ionicons name={session.platform === 'web' ? 'globe-outline' : 'phone-portrait-outline'} size={19} color={active ? '#22C55E' : colors.textMuted} />
                  <View className="min-w-0 flex-1">
                    <Text className="font-black" style={{ color: colors.text }}>{session.device_name}{current ? ` · ${t('sessions.current')}` : ''}</Text>
                    <Text className="mt-1 text-[12px]" style={{ color: colors.textMuted }}>
                      {t('sessions.lastActivity', { date: formatDate(session.last_seen_at, { dateStyle: 'medium', timeStyle: 'short' }) })}
                    </Text>
                    <Text className="mt-1 text-[12px] font-bold" style={{ color: active ? '#22C55E' : colors.danger }}>
                      {t(active ? 'sessions.active' : 'sessions.revoked')}
                    </Text>
                  </View>
                  {active && !current ? (
                    <Pressable disabled={busy === session.id} onPress={() => void revoke(session)} className="rounded-lg border px-3 py-2" style={{ borderColor: colors.danger }}>
                      {busy === session.id ? <ActivityIndicator size="small" color={colors.danger} /> : <Text className="text-[11px] font-black" style={{ color: colors.danger }}>{t('sessions.close')}</Text>}
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )
          })}
          {sessions.length === 0 ? <Text className="py-4 text-center" style={{ color: colors.textMuted }}>{t('sessions.empty')}</Text> : null}
        </View>
      )}

      <Pressable disabled={Boolean(busy)} onPress={() => void revokeOthers()} className="mt-4 min-h-[46px] flex-row items-center justify-center gap-2 rounded-xl border px-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised, opacity: busy ? 0.6 : 1 }}>
        <Ionicons name="log-out-outline" size={17} color={colors.danger} />
        <Text className="font-black" style={{ color: colors.danger }}>{t('sessions.closeOthers')}</Text>
      </Pressable>
      <Pressable disabled={Boolean(busy)} onPress={() => void generateCodes()} className="mt-3 min-h-[46px] flex-row items-center justify-center gap-2 rounded-xl border px-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised, opacity: busy ? 0.6 : 1 }}>
        <Ionicons name="key-outline" size={17} color={accentColor} />
        <Text className="font-black" style={{ color: accentColor }}>{t('sessions.codes.generate', { count: codesRemaining })}</Text>
      </Pressable>
    </View>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
