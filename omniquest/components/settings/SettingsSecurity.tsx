import React from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { withAlpha } from '../../lib/color'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import { SecurityDangerCard } from './SettingsDangerZone'
import type { IconName } from './SettingsTypes'

export type PasswordChecks = {
  hasCurrentPassword: boolean
  hasMinimumLength: boolean
  hasConfirmation: boolean
  passwordsMatch: boolean
  isDifferentFromCurrent: boolean
  canSubmit: boolean
}

export function SecurityPasswordCard({
  accentColor,
  currentPassword,
  newPassword,
  confirmPassword,
  showCurrentPassword,
  showNewPassword,
  showConfirmPassword,
  changingPassword,
  checks,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onToggleCurrentPassword,
  onToggleNewPassword,
  onToggleConfirmPassword,
  onSubmit,
}: {
  accentColor: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
  showCurrentPassword: boolean
  showNewPassword: boolean
  showConfirmPassword: boolean
  changingPassword: boolean
  checks: PasswordChecks
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onToggleCurrentPassword: () => void
  onToggleNewPassword: () => void
  onToggleConfirmPassword: () => void
  onSubmit: () => void
}) {
  const { colors, tokens } = useAppTheme()
  const { t } = useI18n()
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
      <View className="mb-4 flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: colors.surfaceRaised }}>
          <Ionicons name="key-outline" size={20} color={tokens.semantic.info} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black" style={{ color: colors.text }}>{t('security.password.title')}</Text>
          <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{t('security.password.description')}</Text>
        </View>
      </View>

      <View className="gap-3">
        <PasswordInput
          value={currentPassword}
          onChangeText={onCurrentPasswordChange}
          visible={showCurrentPassword}
          onToggleVisible={onToggleCurrentPassword}
          placeholder={t('security.password.current')}
          autoComplete="current-password"
          textContentType="password"
        />
        <PasswordInput
          value={newPassword}
          onChangeText={onNewPasswordChange}
          visible={showNewPassword}
          onToggleVisible={onToggleNewPassword}
          placeholder={t('security.password.new')}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PasswordInput
          value={confirmPassword}
          onChangeText={onConfirmPasswordChange}
          visible={showConfirmPassword}
          onToggleVisible={onToggleConfirmPassword}
          placeholder={t('security.password.confirm')}
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </View>

      <View className="mt-4 rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <Text className="mb-3 text-[12px] font-black uppercase tracking-[1px]" style={{ color: colors.textMuted }}>{t('security.password.requirements')}</Text>
        <PasswordRuleRow valid={checks.hasCurrentPassword} label={t('security.password.rule.current')} />
        <PasswordRuleRow valid={checks.hasMinimumLength} label={t('security.password.rule.length')} />
        <PasswordRuleRow valid={checks.passwordsMatch} label={t('security.password.rule.match')} />
        <PasswordRuleRow valid={checks.isDifferentFromCurrent} label={t('security.password.rule.different')} />
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={!checks.canSubmit}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-xl px-5 py-4"
        style={({ pressed }) => ({
          backgroundColor: accentColor,
          opacity: !checks.canSubmit ? 0.5 : pressed ? 0.86 : 1,
        })}
      >
        {changingPassword ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
            <Text className="text-[14px] font-black text-white">{t('security.password.update')}</Text>
          </>
        )}
      </Pressable>
    </View>
  )
}

function PasswordInput({
  value,
  onChangeText,
  visible,
  onToggleVisible,
  placeholder,
  autoComplete,
  textContentType,
}: {
  value: string
  onChangeText: (value: string) => void
  visible: boolean
  onToggleVisible: () => void
  placeholder: string
  autoComplete?: any
  textContentType?: any
}) {
  const { colors } = useAppTheme()
  return (
    <View className="flex-row items-center rounded-xl border px-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={textContentType}
        className="min-w-0 flex-1 py-3 text-[13px]"
        style={{ color: colors.text }}
      />
      <Pressable onPress={onToggleVisible} className="ml-3 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.surfaceMuted }}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  )
}

function PasswordRuleRow({ valid, label }: { valid: boolean; label: string }) {
  const { colors } = useAppTheme()
  return (
    <View className="mb-2 flex-row items-center gap-2">
      <View
        className="h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: valid ? withAlpha(colors.success, '24') : colors.surfaceMuted }}
      >
        <Ionicons name={valid ? 'checkmark' : 'ellipse-outline'} size={13} color={valid ? colors.success : colors.textMuted} />
      </View>
      <Text className="text-[12px] font-semibold" style={{ color: valid ? colors.textSecondary : colors.textMuted }}>
        {label}
      </Text>
    </View>
  )
}

export function SecurityAccountStatusCard({
  email,
  emailConfirmedAt,
  lastSignInAt,
  onSignOut,
}: {
  email: string
  emailConfirmedAt: string | null
  lastSignInAt: string | null
  onSignOut: () => void
}) {
  const verified = Boolean(emailConfirmedAt)
  const { colors, tokens } = useAppTheme()
  const { t, formatDate } = useI18n()
  const lastSignIn = lastSignInAt
    ? formatDate(lastSignInAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : t('security.account.noDate')

  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
      <View className="mb-4 flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: colors.surfaceRaised }}>
          <Ionicons name="shield-checkmark-outline" size={21} color={verified ? colors.success : colors.warning} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black" style={{ color: colors.text }}>{t('security.account.title')}</Text>
          <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{t('security.account.description')}</Text>
        </View>
      </View>

      <View className="gap-3">
        <SecurityStatusRow
          icon={verified ? 'checkmark-circle' : 'alert-circle'}
          title={t('security.account.email')}
          value={verified ? t('security.account.verified') : t('security.account.pending')}
          description={email}
          color={verified ? colors.success : colors.warning}
        />
        <SecurityStatusRow
          icon="time-outline"
          title={t('security.account.lastSignIn')}
          value={lastSignIn}
          description={t('security.account.sessionSource')}
          color={tokens.semantic.info}
        />
      </View>

      <Pressable
        onPress={onSignOut}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border px-5 py-4"
        style={({ pressed }) => ({ borderColor: colors.border, backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.82 : 1 })}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text className="text-[13px] font-black" style={{ color: colors.danger }}>{t('security.account.signOut')}</Text>
      </Pressable>
    </View>
  )
}

function SecurityStatusRow({
  icon,
  title,
  value,
  description,
  color,
}: {
  icon: IconName
  title: string
  value: string
  description: string
  color: string
}) {
  const { colors } = useAppTheme()
  return (
    <View className="flex-row items-center gap-3 rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '22') }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[12px] font-bold" style={{ color: colors.textMuted }}>{title}</Text>
        <Text className="mt-1 text-[13px] font-black" style={{ color: colors.text }}>{value}</Text>
        <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }} numberOfLines={1}>{description}</Text>
      </View>
    </View>
  )
}

export { SecurityDangerCard }
