import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from './AppPressable'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import type { AppRole } from '../../lib/designTokens'

type IconName = keyof typeof Ionicons.glyphMap

export type AppTabItem<Key extends string | number> = {
  key: Key
  label: string
  icon?: IconName
  activeIcon?: IconName
  badge?: string | number
}

type AppTabsProps<Key extends string | number> = {
  items: AppTabItem<Key>[]
  value: Key
  onChange: (key: Key) => void
  role?: AppRole
  compact?: boolean
  fill?: boolean
  accessibilityLabel?: string
}

export default function AppTabs<Key extends string | number>({
  items,
  value,
  onChange,
  role,
  compact = false,
  fill = false,
  accessibilityLabel = 'Secciones',
}: AppTabsProps<Key>) {
  const { accentColor, tokens } = useAppTheme()
  const activeColor = role ? tokens.brand[role] : accentColor

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.shell, { borderColor: tokens.border.default, backgroundColor: tokens.surface.default }]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, fill && styles.fillRow]}
      >
        {items.map((item) => {
          const selected = item.key === value
          return (
            <AppPressable
              key={String(item.key)}
              accessibilityLabel={item.label}
              accessibilityHint={`Cambia a la sección ${item.label}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(item.key)}
              style={({ pressed }) => [
                styles.tab,
                compact ? styles.compactTab : styles.regularTab,
                fill ? styles.fillTab : null,
                {
                  backgroundColor: selected ? withAlpha(activeColor, '24') : 'transparent',
                  borderColor: selected ? withAlpha(activeColor, 'A0') : 'transparent',
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              {item.icon ? (
                <Ionicons
                  name={selected ? item.activeIcon || filledIcon(item.icon) : item.icon}
                  size={compact ? 15 : 17}
                  color={selected ? activeColor : tokens.text.muted}
                />
              ) : null}
              <Text
                numberOfLines={2}
                maxFontSizeMultiplier={2}
                style={[
                  styles.label,
                  compact ? styles.compactLabel : styles.regularLabel,
                  { color: selected ? activeColor : tokens.text.secondary },
                ]}
              >
                {item.label}
              </Text>
              {item.badge !== undefined ? (
                <View style={[styles.badge, { backgroundColor: selected ? withAlpha(activeColor, '35') : tokens.surface.interactive }]}>
                  <Text maxFontSizeMultiplier={2} style={[styles.badgeText, { color: selected ? activeColor : tokens.text.muted }]}>{item.badge}</Text>
                </View>
              ) : null}
            </AppPressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

function filledIcon(icon: IconName): IconName {
  return icon.endsWith('-outline') ? (icon.replace('-outline', '') as IconName) : icon
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 5,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fillRow: {
    minWidth: '100%',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 11,
  },
  regularTab: {
    minHeight: 42,
    paddingHorizontal: 14,
  },
  compactTab: {
    minHeight: 36,
    paddingHorizontal: 11,
  },
  fillTab: {
    flex: 1,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
    fontWeight: '900',
  },
  regularLabel: {
    fontSize: 12,
  },
  compactLabel: {
    fontSize: 11,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
})
