import React, { useMemo, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppBottomSheet from './AppBottomSheet'
import AppPressable from './AppPressable'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import type { AppRole } from '../../lib/designTokens'

export type AppDropdownOption<T extends string | number> = {
  value: T
  label: string
  description?: string
  icon?: keyof typeof Ionicons.glyphMap
  disabled?: boolean
}

type AppDropdownProps<T extends string | number> = {
  label?: string
  value: T | null
  options: AppDropdownOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  accessibilityLabel?: string
  role?: AppRole
  style?: StyleProp<ViewStyle>
}

export default function AppDropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecciona una opción',
  disabled = false,
  accessibilityLabel,
  role,
  style,
}: AppDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const { tokens } = useAppTheme()
  const selected = useMemo(() => options.find((option) => option.value === value) || null, [options, value])
  const resolvedLabel = accessibilityLabel || label || placeholder
  const activeColor = role ? tokens.brand[role] : tokens.border.active
  const activeSurface = role ? withAlpha(activeColor, '18') : tokens.surface.selected

  const select = (nextValue: T) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <View style={style}>
      {label ? <Text maxFontSizeMultiplier={2} style={[styles.fieldLabel, { color: tokens.text.secondary }]}>{label}</Text> : null}
      <AppPressable
        accessibilityLabel={resolvedLabel}
        accessibilityHint="Abre una lista de opciones"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: disabled ? tokens.surface.disabled : tokens.surface.interactive,
            borderColor: open ? activeColor : tokens.border.default,
            opacity: disabled ? 0.56 : pressed ? 0.82 : 1,
          },
        ]}
      >
        {selected?.icon ? <Ionicons name={selected.icon} size={18} color={tokens.text.secondary} /> : null}
        <Text
          numberOfLines={2}
          maxFontSizeMultiplier={2}
          style={[styles.triggerText, { color: selected ? tokens.text.primary : tokens.text.muted }]}
        >
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={tokens.text.muted} />
      </AppPressable>

      <AppBottomSheet visible={open} onClose={() => setOpen(false)} title={label || 'Seleccionar'}>
        <View style={styles.options}>
          {options.map((option) => {
            const active = option.value === value
            return (
              <AppPressable
                key={String(option.value)}
                accessibilityLabel={option.label}
                accessibilityHint={option.description}
                accessibilityRole="radio"
                accessibilityState={{ checked: active, disabled: option.disabled }}
                disabled={option.disabled}
                onPress={() => select(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: active ? activeSurface : tokens.surface.raised,
                    borderColor: active ? activeColor : tokens.border.default,
                    opacity: option.disabled ? 0.45 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {option.icon ? <Ionicons name={option.icon} size={19} color={active ? activeColor : tokens.text.secondary} /> : null}
                <View style={styles.optionCopy}>
                  <Text maxFontSizeMultiplier={2} style={[styles.optionLabel, { color: tokens.text.primary }]}>{option.label}</Text>
                  {option.description ? (
                    <Text maxFontSizeMultiplier={2} style={[styles.optionDescription, { color: tokens.text.secondary }]}>{option.description}</Text>
                  ) : null}
                </View>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={active ? activeColor : tokens.text.muted}
                />
              </AppPressable>
            )
          })}
        </View>
      </AppBottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  fieldLabel: {
    marginBottom: 7,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  trigger: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  triggerText: {
    minWidth: 0,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  options: {
    gap: 9,
  },
  option: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  optionCopy: {
    minWidth: 0,
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  optionDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
})
