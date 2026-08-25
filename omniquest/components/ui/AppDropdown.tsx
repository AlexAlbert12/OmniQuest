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
  compact?: boolean
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
  compact = false,
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
      {label ? <Text maxFontSizeMultiplier={2} style={[styles.fieldLabel, compact ? styles.compactFieldLabel : null, { color: tokens.text.secondary }]}>{label}</Text> : null}
      <AppPressable
        accessibilityLabel={resolvedLabel}
        accessibilityHint="Abre una lista de opciones"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          compact ? styles.compactTrigger : null,
          {
            backgroundColor: disabled ? tokens.surface.disabled : tokens.surface.raised,
            borderColor: open ? activeColor : tokens.border.default,
            opacity: disabled ? 0.56 : pressed ? 0.82 : 1,
          },
        ]}
      >
        {selected?.icon && !compact ? (
          <View style={[styles.leadingIcon, compact ? styles.compactLeadingIcon : null, { backgroundColor: activeSurface }]}>
            <Ionicons name={selected.icon} size={compact ? 15 : 17} color={activeColor} />
          </View>
        ) : null}
        <View style={styles.triggerCopy}>
          <Text
            numberOfLines={compact ? 1 : 2}
            maxFontSizeMultiplier={2}
            style={[styles.triggerText, compact ? styles.compactTriggerText : null, { color: selected ? tokens.text.primary : tokens.text.muted }]}
          >
            {selected?.label || placeholder}
          </Text>
          <View style={[styles.chevronBox, compact ? styles.compactChevronBox : null, { backgroundColor: activeSurface }]}>
            <Ionicons name="chevron-down" size={compact ? 14 : 16} color={activeColor} />
          </View>
        </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
                  {option.icon ? (
                    <View style={[styles.optionIcon, { backgroundColor: active ? activeSurface : tokens.surface.interactive }]}>
                      <Ionicons name={option.icon} size={18} color={active ? activeColor : tokens.text.secondary} />
                    </View>
                  ) : null}
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
                </View>
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
    textTransform: 'uppercase',
    letterSpacing: 0.55,
  },
  compactFieldLabel: {
    marginBottom: 5,
    fontSize: 9,
    lineHeight: 12,
  },
  trigger: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  compactTrigger: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 6,
    gap: 4,
  },
  leadingIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLeadingIcon: {
    width: 25,
    height: 25,
    borderRadius: 8,
  },
  triggerCopy: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  triggerText: {
    minWidth: 0,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  compactTriggerText: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactChevronBox: {
    width: 18,
    height: 18,
    borderRadius: 6,
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
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
