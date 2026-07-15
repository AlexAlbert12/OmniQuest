import React from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { withAlpha } from '../../lib/color'
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
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
      <View className="mb-4 flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#10233F]">
          <Ionicons name="key-outline" size={20} color="#9FD6FF" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-white">Cambiar contraseña</Text>
          <Text className="mt-1 text-[12px] leading-5 text-[#AFC2DB]">
            Verificaremos tu contraseña actual antes de guardar la nueva.
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <PasswordInput
          value={currentPassword}
          onChangeText={onCurrentPasswordChange}
          visible={showCurrentPassword}
          onToggleVisible={onToggleCurrentPassword}
          placeholder="Contraseña actual"
          autoComplete="current-password"
          textContentType="password"
        />
        <PasswordInput
          value={newPassword}
          onChangeText={onNewPasswordChange}
          visible={showNewPassword}
          onToggleVisible={onToggleNewPassword}
          placeholder="Nueva contraseña"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PasswordInput
          value={confirmPassword}
          onChangeText={onConfirmPasswordChange}
          visible={showConfirmPassword}
          onToggleVisible={onToggleConfirmPassword}
          placeholder="Confirmar nueva contraseña"
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </View>

      <View className="mt-4 rounded-xl border border-[#183052] bg-[#071A32] p-3">
        <Text className="mb-3 text-[12px] font-black uppercase tracking-[1px] text-[#8FA7C7]">
          Requisitos
        </Text>
        <PasswordRuleRow valid={checks.hasCurrentPassword} label="Contraseña actual indicada" />
        <PasswordRuleRow valid={checks.hasMinimumLength} label="Mínimo 6 caracteres" />
        <PasswordRuleRow valid={checks.passwordsMatch} label="Las contraseñas coinciden" />
        <PasswordRuleRow valid={checks.isDifferentFromCurrent} label="La nueva contraseña es diferente" />
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
            <Text className="text-[14px] font-black text-white">Actualizar contraseña</Text>
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
  return (
    <View className="flex-row items-center rounded-xl border border-[#183052] bg-[#071A32] px-4">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={textContentType}
        className="min-w-0 flex-1 py-3 text-[13px] text-white"
      />
      <Pressable onPress={onToggleVisible} className="ml-3 h-9 w-9 items-center justify-center rounded-full bg-[#10233F]">
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color="#AFC2DB" />
      </Pressable>
    </View>
  )
}

function PasswordRuleRow({ valid, label }: { valid: boolean; label: string }) {
  return (
    <View className="mb-2 flex-row items-center gap-2">
      <View
        className="h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: valid ? '#22C55E24' : '#20375E' }}
      >
        <Ionicons name={valid ? 'checkmark' : 'ellipse-outline'} size={13} color={valid ? '#22C55E' : '#8FA7C7'} />
      </View>
      <Text className={`text-[12px] font-semibold ${valid ? 'text-[#BBF7D0]' : 'text-[#8FA7C7]'}`}>
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

  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
      <View className="mb-4 flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#10233F]">
          <Ionicons name="shield-checkmark-outline" size={21} color={verified ? '#22C55E' : '#F6A64A'} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-white">Estado de la cuenta</Text>
          <Text className="mt-1 text-[12px] leading-5 text-[#AFC2DB]">
            Información útil para revisar el acceso y la verificación de tu cuenta.
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <SecurityStatusRow
          icon={verified ? 'checkmark-circle' : 'alert-circle'}
          title="Correo verificado"
          value={verified ? 'Verificado' : 'Pendiente de verificación'}
          description={email}
          color={verified ? '#22C55E' : '#F6A64A'}
        />
        <SecurityStatusRow
          icon="time-outline"
          title="Último inicio de sesión"
          value={formatSecurityDate(lastSignInAt)}
          description="Última sesión registrada por Supabase Auth."
          color="#9FD6FF"
        />
      </View>

      <Pressable
        onPress={onSignOut}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-[#334155] bg-[#071A32] px-5 py-4"
        style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
      >
        <Ionicons name="log-out-outline" size={18} color="#F87171" />
        <Text className="text-[13px] font-black text-[#F87171]">Cerrar sesión en este dispositivo</Text>
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
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-[#183052] bg-[#071A32] p-3">
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '22') }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[12px] font-bold text-[#8FA7C7]">{title}</Text>
        <Text className="mt-1 text-[13px] font-black text-white">{value}</Text>
        <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>{description}</Text>
      </View>
    </View>
  )
}

export { SecurityDangerCard }

function formatSecurityDate(value: string | null) {
  if (!value) return 'Sin registro disponible'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin registro disponible'

  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
