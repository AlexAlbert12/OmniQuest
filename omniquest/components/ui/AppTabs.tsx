import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import AppPressable from './AppPressable'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { useResponsiveLayout } from '../../lib/responsive'
import type { AppRole } from '../../lib/designTokens'

type IconName = keyof typeof Ionicons.glyphMap

type TabLayout = { x: number; width: number }

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
  mobileRail?: boolean
}

export default function AppTabs<Key extends string | number>({
  items,
  value,
  onChange,
  role,
  compact = false,
  fill = false,
  accessibilityLabel = 'Secciones',
  mobileRail = false,
}: AppTabsProps<Key>) {
  const { accentColor, tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  const activeColor = role ? tokens.brand[role] : accentColor
  const rail = !fill && (mobileRail || responsive.isMobile)
  const scrollRef = useRef<ScrollView>(null)
  const itemLayouts = useRef(new Map<string, TabLayout>())
  const [viewportWidth, setViewportWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [scrollX, setScrollX] = useState(0)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const scrollable = rail && contentWidth > viewportWidth + 2
  const showStartFade = scrollable && scrollX > 4
  const showEndFade = scrollable && scrollX + viewportWidth < contentWidth - 4

  const registerItemLayout = useCallback((key: Key, event: LayoutChangeEvent) => {
    const next = { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width }
    const mapKey = String(key)
    const previous = itemLayouts.current.get(mapKey)
    if (previous && Math.abs(previous.x - next.x) < 0.5 && Math.abs(previous.width - next.width) < 0.5) return
    itemLayouts.current.set(mapKey, next)
    setLayoutVersion((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!rail || viewportWidth <= 0 || contentWidth <= 0) return
    const layout = itemLayouts.current.get(String(value))
    if (!layout) return
    const maxOffset = Math.max(0, contentWidth - viewportWidth)
    const centeredOffset = layout.x + (layout.width / 2) - (viewportWidth / 2)
    const nextOffset = Math.max(0, Math.min(maxOffset, centeredOffset))
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ x: nextOffset, animated: true }), 0)
    return () => clearTimeout(timer)
  }, [contentWidth, layoutVersion, rail, value, viewportWidth])

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (rail) setScrollX(Math.max(0, event.nativeEvent.contentOffset.x))
  }, [rail])

  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.shell, { borderColor: tokens.border.default, backgroundColor: tokens.surface.default }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContentWidth(width)}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.row, rail && styles.mobileRailRow, fill && styles.fillRow]}
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
              onLayout={(event) => registerItemLayout(item.key, event)}
              onPress={() => onChange(item.key)}
              style={({ pressed }) => [
                styles.tab,
                compact ? styles.compactTab : styles.regularTab,
                rail ? styles.mobileRailTab : null,
                fill ? styles.fillTab : null,
                { backgroundColor: selected ? withAlpha(activeColor, '24') : 'transparent', borderColor: selected ? withAlpha(activeColor, 'A0') : 'transparent', opacity: pressed ? 0.78 : 1 },
              ]}
            >
              {item.icon ? <Ionicons name={selected ? item.activeIcon || filledIcon(item.icon) : item.icon} size={compact ? 15 : 17} color={selected ? activeColor : tokens.text.muted} /> : null}
              <Text
                numberOfLines={rail ? 1 : 2}
                ellipsizeMode={rail ? 'clip' : 'tail'}
                maxFontSizeMultiplier={2}
                style={[styles.label, compact ? styles.compactLabel : styles.regularLabel, { color: selected ? activeColor : tokens.text.secondary }]}
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

      {showStartFade ? (
        <LinearGradient colors={[tokens.surface.default, withAlpha(tokens.surface.default, '00')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.fadeLeft, { pointerEvents: 'none' }]} />
      ) : null}
      {showEndFade ? (
        <LinearGradient colors={[withAlpha(tokens.surface.default, '00'), tokens.surface.default]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.fadeRight, { pointerEvents: 'none' }]} />
      ) : null}
    </View>
  )
}

function filledIcon(icon: IconName): IconName {
  return icon.endsWith('-outline') ? (icon.replace('-outline', '') as IconName) : icon
}

const styles = StyleSheet.create({
  shell: { position: 'relative', borderWidth: 1, borderRadius: 16, padding: 5, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fillRow: { minWidth: '100%' },
  mobileRailRow: { paddingLeft: 8, paddingRight: 36 },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 11 },
  regularTab: { minHeight: 42, paddingHorizontal: 14 },
  compactTab: { minHeight: 36, paddingHorizontal: 11 },
  mobileRailTab: { minHeight: 42, flexShrink: 0 },
  fillTab: { flex: 1 },
  label: { flexShrink: 1, textAlign: 'center', fontWeight: '900' },
  regularLabel: { fontSize: 12 },
  compactLabel: { fontSize: 11 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '900' },
  fade: { position: 'absolute', top: 5, bottom: 5, width: 28, zIndex: 3 },
  fadeLeft: { left: 5 },
  fadeRight: { right: 5 },
})
