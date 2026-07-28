import React from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import type {
  IconName,
  SettingsAnchorKey,
  SettingsMenuSectionKey,
  SettingsMenuVariant,
} from './SettingsTypes'

export type SettingsMenuItem = {
  key: SettingsMenuSectionKey
  label: string
  icon: IconName
  anchor: SettingsAnchorKey
}

type DestructiveActionType = 'scores' | 'enrollments' | 'all' | 'account'
const REQUIRED_DESTRUCTIVE_CONFIRMATION = 'ELIMINAR'

export function DestructiveConfirmModal({
  visible,
  action,
  isTeacher,
  value,
  busy,
  onChangeText,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  action: DestructiveActionType | null
  isTeacher: boolean
  value: string
  busy: boolean
  onChangeText: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const details = getDestructiveActionDetails(action, isTeacher)
  const { colors } = useAppTheme()
  const canConfirm = value.trim() === REQUIRED_DESTRUCTIVE_CONFIRMATION && !busy

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/70 px-5">
        <View className="w-full max-w-[430px] rounded-2xl border p-5" style={{ borderColor: colors.danger, backgroundColor: colors.surface }}>
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-semantic-surface-danger">
              <Ionicons name="warning-outline" size={20} color="#FB7185" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-black" style={{ color: colors.text }}>{details.title}</Text>
              <Text className="mt-1 text-[12px] leading-5 text-semantic-danger">{details.description}</Text>
            </View>
          </View>

          <Text className="mt-5 text-[12px] font-semibold" style={{ color: colors.textSecondary }}>
            Escribe {REQUIRED_DESTRUCTIVE_CONFIRMATION} para continuar.
          </Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="characters"
            placeholder={REQUIRED_DESTRUCTIVE_CONFIRMATION}
            placeholderTextColor="#64748B"
            className="mt-2 rounded-lg border px-4 py-3 text-[13px] font-bold"
            style={{ borderColor: colors.danger, backgroundColor: colors.surfaceRaised, color: colors.text }}
          />

          <View className="mt-5 flex-row justify-end gap-3">
            <Pressable
              accessibilityLabel="Cancelar acción destructiva"
              accessibilityRole="button"
              hitSlop={6}
              onPress={onCancel}
              disabled={busy}
              className="rounded-lg border px-4 py-3"
              style={({ pressed }) => ({ borderColor: colors.border, backgroundColor: colors.surfaceRaised, opacity: busy ? 0.55 : pressed ? 0.8 : 1 })}
            >
              <Text className="text-[12px] font-bold" style={{ color: colors.textSecondary }}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={details.confirmLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canConfirm, busy }}
              hitSlop={6}
              onPress={onConfirm}
              disabled={!canConfirm}
              className="rounded-lg bg-semantic-surface-danger px-4 py-3"
              style={({ pressed }) => ({ opacity: !canConfirm ? 0.45 : pressed ? 0.82 : 1 })}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-[12px] font-bold text-white">{details.confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function getDestructiveActionDetails(action: DestructiveActionType | null, isTeacher: boolean) {
  switch (action) {
    case 'scores':
      return isTeacher
        ? {
            title: 'Eliminar progreso de alumnos',
            description: 'Se borrarán puntuaciones por clase, puntuaciones por tema e intentos de alumnos en tus clases. No se borran clases, preguntas ni perfiles.',
            confirmLabel: 'Eliminar progreso',
          }
        : {
            title: 'Eliminar puntuaciones',
            description: 'Se borrarán subject_scores, topic_scores, intentos e insignias; tu XP global se recalculará a 0.',
            confirmLabel: 'Eliminar puntuaciones',
          }
    case 'enrollments':
      return {
        title: 'Salir de todas las clases',
        description: 'Se eliminarán tus inscripciones actuales. Tu cuenta seguirá activa.',
        confirmLabel: 'Salir de clases',
      }
    case 'all':
      return isTeacher
        ? {
            title: 'Eliminar todos mis datos docentes',
            description: 'Se borrarán tus clases, temas, preguntas, respuestas, inscripciones, puntuaciones de alumnos, intentos, preferencias, notificaciones y avatar. Tu cuenta seguirá activa.',
            confirmLabel: 'Eliminar todo',
          }
        : {
            title: 'Eliminar datos de uso',
            description: 'Se borrarán progreso, intentos, estado de notificaciones, preferencias y avatar. Tu cuenta seguirá activa.',
            confirmLabel: 'Eliminar datos',
          }
    case 'account':
      return isTeacher
        ? {
            title: 'Borrar mi cuenta',
            description: 'Se eliminarán tu usuario, perfil docente y datos asociados. Revisa antes tus clases y contenido creado. No se puede deshacer.',
            confirmLabel: 'Borrar cuenta',
          }
        : {
            title: 'Borrar mi cuenta',
            description: 'Se eliminarán tu usuario, perfil, progreso académico y datos asociados. No se puede deshacer.',
            confirmLabel: 'Borrar cuenta',
          }
    default:
      return {
        title: 'Confirmar acción',
        description: 'Esta acción no se puede deshacer.',
        confirmLabel: 'Continuar',
      }
  }
}

export function SettingsMenu({
  variant,
  onSignOut,
  activeSection,
  onSectionPress,
  sections,
}: {
  variant: SettingsMenuVariant
  onSignOut: () => void
  activeSection: SettingsMenuSectionKey
  onSectionPress: (section: SettingsMenuItem) => void
  sections: SettingsMenuItem[]
}) {
  const { accentColor, colors } = useAppTheme()

  const renderMenuItem = (section: SettingsMenuItem) => {
    const active = section.key === activeSection
    const isChip = variant === 'chips'

    return (
      <Pressable
        key={section.key}
        accessibilityRole="tab"
        accessibilityLabel={section.label}
        accessibilityState={{ selected: active }}
        hitSlop={6}
        onPress={() => onSectionPress(section)}
        className={`flex-row items-center gap-2 ${isChip ? 'min-h-[44px] rounded-full px-4 py-3' : 'rounded-xl px-4 py-3'}`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.82 : 1,
          borderWidth: 1,
          borderColor: active ? accentColor : colors.border,
          backgroundColor: active ? withAlpha(accentColor, '24') : colors.surfaceRaised,
        })}
      >
        {isChip ? null : (
          <Ionicons
            name={section.icon}
            size={16}
            color={active ? accentColor : colors.textSecondary}
          />
        )}

        <Text
          className="text-[12px] font-black"
          style={{ color: active ? accentColor : colors.textSecondary }}
          numberOfLines={1}
        >
          {section.label}
        </Text>
      </Pressable>
    )
  }

  if (variant === 'side') {
    return (
      <View className="w-[220px] self-start rounded-xl p-3" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View className="gap-1">
          {sections.map(renderMenuItem)}
        </View>

        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          hitSlop={6}
          className="mt-4 flex-row items-center gap-2 rounded-xl px-3 py-3"
          style={({ pressed }) => ({ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="log-out-outline" size={15} color="#F87171" />
          <Text className="text-[12px] font-bold text-semantic-danger">Cerrar sesión</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="rounded-xl p-2" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 8,
          paddingRight: 8,
        }}
      >
        {sections.map(renderMenuItem)}
      </ScrollView>
    </View>
  )
}

export function Panel({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  const { colors } = useAppTheme()
  return (
    <View className={`rounded-xl border p-5 ${className}`} style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
      <Text className="mb-4 text-[16px] font-black" style={{ color: colors.text }}>{title}</Text>
      {children}
    </View>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useAppTheme()
  return (
    <View>
      <Text className="mb-2 text-[13px] font-semibold" style={{ color: colors.textSecondary }}>{label}</Text>
      {children}
    </View>
  )
}

export function SelectPill({
  value,
  selectedValue,
  open = false,
  onToggle,
  options,
  onSelect,
  optionLabel,
  disabled = false,
  loading = false,
}: {
  value: string
  selectedValue: string
  open?: boolean
  onToggle: () => void
  options: string[]
  onSelect: (value: string) => void
  optionLabel: (value: string) => string
  disabled?: boolean
  loading?: boolean
}) {
  const { accentColor, colors } = useAppTheme()

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value}
        accessibilityState={{ expanded: open, disabled }}
        hitSlop={6}
        onPress={onToggle}
        disabled={disabled}
        className="flex-row items-center justify-between rounded-lg border px-4 py-3"
        style={({ pressed }) => ({
          borderColor: colors.border,
          backgroundColor: colors.surfaceRaised,
          opacity: disabled ? 0.7 : pressed ? 0.86 : 1,
        })}
      >
        <Text className="min-w-0 flex-1 text-[13px] font-semibold" style={{ color: colors.text }}>{value}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
        )}
      </Pressable>

      {open ? (
        <View className="mt-2 overflow-hidden rounded-lg border" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
          {options.map((option, index) => (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              accessibilityRole="button"
              accessibilityLabel={optionLabel(option)}
              accessibilityState={{ selected: option === selectedValue }}
              className="flex-row items-center justify-between px-4 py-3"
              style={{ borderBottomWidth: index < options.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
            >
              <Text className="min-w-0 flex-1 text-[13px]" style={{ color: colors.textSecondary }}>{optionLabel(option)}</Text>
              {option === selectedValue ? (
                <Ionicons name="checkmark" size={16} color={accentColor} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export function PreferenceRow({
  label,
  value,
  selectedValue,
  open = false,
  onToggle,
  options,
  onSelect,
  optionLabel,
  disabled = false,
  loading = false,
}: {
  label: string
  value: string
  selectedValue: string
  open?: boolean
  onToggle: () => void
  options: string[]
  onSelect: (value: string) => void
  optionLabel: (value: string) => string
  disabled?: boolean
  loading?: boolean
}) {
  const { colors } = useAppTheme()
  return (
    <View className="mb-4 flex-row items-start gap-4">
      <Text className="w-[125px] text-[12px] font-semibold" style={{ color: colors.textSecondary }}>{label}</Text>
      <View className="min-w-0 flex-1">
        <SelectPill
          value={value}
          selectedValue={selectedValue}
          open={open}
          onToggle={onToggle}
          options={options}
          onSelect={onSelect}
          optionLabel={optionLabel}
          disabled={disabled}
          loading={loading}
        />
      </View>
    </View>
  )
}

export function NotificationRow({
  icon,
  title,
  description,
  enabled,
  onPress,
  disabled = false,
  loading = false,
}: {
  icon: IconName
  title: string
  description: string
  enabled: boolean
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}) {
  const { accentColor, colors } = useAppTheme()

  return (
    <View className="flex-row items-center gap-3 border-b py-3" style={{ borderBottomColor: colors.border }}>
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: colors.surfaceMuted }}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold" style={{ color: colors.text }}>{title}</Text>
        <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }}>{description}</Text>
      </View>
      <View className="items-end">
        {loading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
        <Switch
          accessibilityLabel={title}
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled, disabled: disabled || loading }}
          value={enabled}
          onValueChange={onPress}
          disabled={disabled || loading}
          trackColor={{ false: colors.borderStrong, true: accentColor }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  )
}

export function ActionRow({
  icon,
  title,
  description,
  onPress,
  disabled = false,
  loading = false,
}: {
  icon: IconName
  title: string
  description: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}) {
  const { colors } = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      hitSlop={6}
      onPress={disabled || loading ? undefined : onPress}
      className={`flex-row items-center gap-3 border-b py-3 ${disabled || loading ? 'opacity-50' : ''}`}
      style={{ borderBottomColor: colors.border }}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: colors.surfaceMuted }}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Ionicons name={icon} size={18} color={colors.textSecondary} />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold" style={{ color: disabled || loading ? colors.textMuted : colors.text }}>{title}</Text>
        <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={colors.textSecondary} />
    </Pressable>
  )
}

export function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { accentColor } = useAppTheme()

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} className="mt-2 flex-row items-center justify-between py-2">
      <Text className="text-[12px] font-semibold" style={{ color: accentColor }}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={accentColor} />
    </Pressable>
  )
}
