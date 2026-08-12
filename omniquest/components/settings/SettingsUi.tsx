import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, useWindowDimensions, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { useI18n } from '../../lib/i18n'
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
  const { t } = useI18n()
  const horizontalScrollRef = React.useRef<ScrollView | null>(null)
  const itemLayoutsRef = React.useRef<Record<string, { x: number; width: number }>>({})
  const scrollXRef = React.useRef(0)
  const [viewportWidth, setViewportWidth] = React.useState(0)
  const [contentWidth, setContentWidth] = React.useState(0)
  const [scrollX, setScrollX] = React.useState(0)
  const [layoutVersion, setLayoutVersion] = React.useState(0)

  React.useEffect(() => {
    if (variant === 'side' || viewportWidth <= 0) return
    const layout = itemLayoutsRef.current[activeSection]
    if (!layout) return

    const safeInset = 16
    const currentX = scrollXRef.current
    const visibleLeft = currentX + safeInset
    const visibleRight = currentX + viewportWidth - safeInset
    let targetX = currentX

    if (layout.x < visibleLeft) targetX = Math.max(0, layout.x - safeInset)
    else if (layout.x + layout.width > visibleRight) targetX = Math.max(0, layout.x + layout.width - viewportWidth + safeInset)

    if (Math.abs(targetX - currentX) > 1) horizontalScrollRef.current?.scrollTo({ x: targetX, animated: true })
  }, [activeSection, layoutVersion, variant, viewportWidth])

  const renderMenuItem = (section: SettingsMenuItem) => {
    const active = section.key === activeSection
    const isChip = variant === 'chips'

    return (
      <Pressable
        key={section.key}
        onLayout={(event) => {
          const { x, width } = event.nativeEvent.layout
          const previous = itemLayoutsRef.current[section.key]
          itemLayoutsRef.current[section.key] = { x, width }
          if (active && (!previous || previous.x !== x || previous.width !== width)) setLayoutVersion((value) => value + 1)
        }}
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
          accessibilityLabel={t('settings.signOut')}
          hitSlop={6}
          className="mt-4 flex-row items-center gap-2 rounded-xl px-3 py-3"
          style={({ pressed }) => ({ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="log-out-outline" size={15} color="#F87171" />
          <Text className="text-[12px] font-bold text-semantic-danger">{t('settings.signOut')}</Text>
        </Pressable>
      </View>
    )
  }

  const showStartFade = scrollX > 2
  const showEndFade = contentWidth > viewportWidth + 2 && scrollX < contentWidth - viewportWidth - 2

  return (
    <View className="relative overflow-hidden rounded-xl p-2" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContentWidth(width)}
        onScroll={(event) => {
          const nextX = event.nativeEvent.contentOffset.x
          scrollXRef.current = nextX
          setScrollX(nextX)
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {sections.map(renderMenuItem)}
      </ScrollView>
      {showStartFade ? <LinearGradient colors={[colors.surface, withAlpha(colors.surface, '00')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 8, top: 8, bottom: 8, width: 28, pointerEvents: 'none' }} /> : null}
      {showEndFade ? <LinearGradient colors={[withAlpha(colors.surface, '00'), colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', right: 8, top: 8, bottom: 8, width: 28, pointerEvents: 'none' }} /> : null}
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
        className="flex-row items-center justify-between rounded-lg px-4 py-3"
        style={({ pressed }) => ({
          borderColor: withAlpha(accentColor, open ? 'B8' : '73'),
          borderWidth: open ? 2 : 1.5,
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
        <View
          className="mt-2 overflow-hidden rounded-lg"
          style={{
            borderColor: withAlpha(accentColor, '8F'),
            borderWidth: 1.5,
            backgroundColor: colors.surfaceRaised,
          }}
        >
          {options.map((option, index) => (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              accessibilityRole="button"
              accessibilityLabel={optionLabel(option)}
              accessibilityState={{ selected: option === selectedValue }}
              className="flex-row items-center justify-between px-4 py-3"
              style={{
                borderBottomWidth: index < options.length - 1 ? 1 : 0,
                borderBottomColor: withAlpha(accentColor, '52'),
                backgroundColor: option === selectedValue ? withAlpha(accentColor, '14') : 'transparent',
              }}
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
  const { width } = useWindowDimensions()
  const stacked = width < 520
  return (
    <View className={`mb-4 ${stacked ? 'gap-2' : 'flex-row items-start gap-4'}`}>
      <Text className={`${stacked ? '' : 'w-[125px]'} text-[12px] font-semibold`} style={{ color: colors.textSecondary }}>{label}</Text>
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
  const { accentColor, colors, theme } = useAppTheme()
  const offTrackColor = theme === 'dark' ? '#334155' : '#CBD5E1'

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
          hitSlop={8}
          value={enabled}
          onValueChange={onPress}
          disabled={disabled || loading}
          trackColor={{ false: offTrackColor, true: accentColor }}
          ios_backgroundColor={offTrackColor}
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
