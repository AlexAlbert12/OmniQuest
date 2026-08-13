import { Ionicons } from '@expo/vector-icons'
import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native'
import { useAppModal } from '../AppModalProvider'
import AppButton from '../ui/AppButton'
import { useAppTheme } from '../../lib/appTheme'
import type { AppRole } from '../../lib/designTokens'
import { useI18n } from '../../lib/i18n'
import { useResponsiveLayout } from '../../lib/responsive'
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

type ManagedSessionsCardProps = {
  role?: AppRole
  splitSections?: boolean
}

export default function ManagedSessionsCard({ role, splitSections = false }: ManagedSessionsCardProps) {
  const { accentColor, colors, tokens } = useAppTheme()
  const { t, formatDate } = useI18n()
  const responsive = useResponsiveLayout()
  const { showModal } = useAppModal()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [currentDevice, setCurrentDevice] = useState('')
  const [codesRemaining, setCodesRemaining] = useState(0)
  const identityColor = role === 'admin' ? tokens.brand.admin : role ? tokens.brand[role] : accentColor

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`)
    else Alert.alert(title, message)
  }, [])

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('manage-account-security', { body })
    if (error) {
      const response = (error as { context?: { clone?: () => { json: () => Promise<unknown> } } }).context
      let publicMessage = ''
      if (response?.clone) {
        try {
          const payload = await response.clone().json() as { error?: string; message?: string }
          publicMessage = payload?.error || payload?.message || ''
        } catch {

        }
      }
      if (publicMessage) throw new Error(publicMessage)
      throw error
    }
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

  const activeOtherSessions = sessions.filter((session) => !session.revoked_at && session.device_id !== currentDevice)

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

  const requestGenerateCodes = () => {
    if (codesRemaining <= 0) {
      void generateCodes()
      return
    }
    showModal({ title: t('sessions.codes.regenerateConfirmTitle'), message: t('sessions.codes.regenerateConfirmDetail'), variant: 'warning', buttons: [{ label: t('common.cancel'), role: 'cancel' }, { label: t('sessions.codes.regenerateConfirmAction'), role: 'danger', onPress: generateCodes }] })
  }

  const sessionsList = loading ? <ActivityIndicator color={identityColor} /> : (
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
                <Text className="mt-1 text-[12px]" style={{ color: colors.textMuted }}>{t('sessions.lastActivity', { date: formatDate(session.last_seen_at, { dateStyle: 'medium', timeStyle: 'short' }) })}</Text>
                <Text className="mt-1 text-[12px] font-bold" style={{ color: active ? '#22C55E' : colors.danger }}>{t(active ? 'sessions.active' : 'sessions.revoked')}</Text>
              </View>
              {active && !current ? <Pressable disabled={busy === session.id} onPress={() => void revoke(session)} className="rounded-lg border px-3 py-2" style={{ borderColor: colors.danger }}>{busy === session.id ? <ActivityIndicator size="small" color={colors.danger} /> : <Text className="text-[11px] font-black" style={{ color: colors.danger }}>{t('sessions.close')}</Text>}</Pressable> : null}
            </View>
          </View>
        )
      })}
      {sessions.length === 0 ? <Text className="py-4 text-center" style={{ color: colors.textMuted }}>{t('sessions.empty')}</Text> : null}
    </View>
  )

  const closeOthersButton = activeOtherSessions.length > 0 ? <AppButton label={t('sessions.closeOthers')} icon="log-out-outline" variant="danger" fullWidth disabled={Boolean(busy)} loading={busy === 'others'} onPress={() => void revokeOthers()} /> : null
  const recoveryButtonLabel = splitSections ? t(codesRemaining > 0 ? 'sessions.codes.regenerateAction' : 'sessions.codes.generateAction') : t('sessions.codes.generate', { count: codesRemaining })
  const recoveryButton = <AppButton label={recoveryButtonLabel} icon="key-outline" role={role} fullWidth disabled={Boolean(busy) || loading} loading={busy === 'codes'} onPress={requestGenerateCodes} />

  if (splitSections) {
    return (
      <View style={{ flexDirection: responsive.isDesktop ? 'row' : 'column', gap: 16 }}>
        <View className="min-w-0 flex-1 rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
          <SectionHeader icon="desktop-outline" title={t('sessions.activeTitle')} description={t('sessions.activeDescription')} color={identityColor} />
          {sessionsList}
          {closeOthersButton ? <View className="mt-4">{closeOthersButton}</View> : null}
        </View>
        <View className="min-w-0 flex-1 rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
          <SectionHeader icon="key-outline" title={t('sessions.codes.title')} description={t('sessions.codes.adminDescription')} color={identityColor} />
          {loading ? <ActivityIndicator color={identityColor} /> : <View className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}><Text className="text-[11px] font-black uppercase tracking-[0.7px]" style={{ color: colors.textMuted }}>{t('sessions.codes.available')}</Text><Text className="mt-2 text-[30px] font-black" style={{ color: colors.text }}>{codesRemaining}</Text><Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{codesRemaining > 0 ? t('sessions.codes.regenerateHint') : t('sessions.codes.generateHint')}</Text></View>}
          <View className="mt-4">{recoveryButton}</View>
        </View>
      </View>
    )
  }

  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
      <SectionHeader icon="desktop-outline" title={t('sessions.title')} description={t('sessions.description')} color={identityColor} />
      {sessionsList}
      {closeOthersButton ? <View className="mt-4">{closeOthersButton}</View> : null}
      <View className="mt-3">{recoveryButton}</View>
    </View>
  )
}

function SectionHeader({ color, description, icon, title }: { color: string; description: string; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const { colors } = useAppTheme()
  return <View className="mb-4 flex-row items-start gap-3"><View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: colors.surfaceRaised }}><Ionicons name={icon} size={21} color={color} /></View><View className="min-w-0 flex-1"><Text className="text-[16px] font-black" style={{ color: colors.text }}>{title}</Text><Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{description}</Text></View></View>
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
