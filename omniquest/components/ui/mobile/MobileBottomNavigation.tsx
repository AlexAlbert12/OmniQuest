import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '../../../lib/appTheme'
import { releaseWebFocus } from '../../../lib/webFocus'
import { withAlpha } from '../../../lib/color'
import { createShadowStyle } from '../../../lib/platformShadow'
import AppPressable from '../AppPressable'

export type MobileBottomNavigationItem<Key extends string> = {
  key: Key
  label: string
  href: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
  testID?: string
}

type MobileBottomNavigationProps<Key extends string> = {
  activeKey: Key | null
  accentColor: string
  items: MobileBottomNavigationItem<Key>[]
  scrollable?: boolean
}

const ICON_SIZE = 25

export default function MobileBottomNavigation<Key extends string>({
  activeKey,
  accentColor,
  items,
  scrollable = false,
}: MobileBottomNavigationProps<Key>) {
  const router = useRouter()
  const { colors, tokens } = useAppTheme()
  const inactiveColor = tokens.text.secondary

  const navigationItems = items.map((item) => {
    const isActive = item.key === activeKey

    return (
      <AppPressable
        key={item.key}
        testID={item.testID}
        accessibilityLabel={item.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        disabled={isActive}
        hitSlop={4}
        onPress={() => {
          releaseWebFocus()
          router.push(item.href as never)
        }}
        style={({ pressed }) => [
          styles.item,
          scrollable ? styles.scrollableItem : styles.flexItem,
          {
            backgroundColor: isActive ? withAlpha(accentColor, '30') : 'transparent',
            borderColor: isActive ? withAlpha(accentColor, 'D0') : 'transparent',
          },
          pressed && !isActive && styles.pressedItem,
        ]}
      >
        <View style={styles.iconShell}>
          <Ionicons
            name={isActive ? item.activeIcon : item.icon}
            size={ICON_SIZE}
            color={isActive ? accentColor : inactiveColor}
            style={styles.icon}
          />
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.activeIndicator, { backgroundColor: isActive ? accentColor : 'transparent' }]}
          />
        </View>

        <Text
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
          minimumFontScale={0.8}
          numberOfLines={1}
          style={[
            styles.label,
            { color: isActive ? accentColor : inactiveColor },
          ]}
        >
          {item.label}
        </Text>
      </AppPressable>
    )
  })

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[
        styles.safeArea,
        { backgroundColor: colors.navigation, borderTopColor: colors.border },
        createShadowStyle({
          color: tokens.background.overlay,
          opacity: 0.24,
          radius: 13,
          offsetY: -5,
          elevation: 22,
          web: `0 -7px 22px ${tokens.background.overlay}`,
        }),
      ]}
    >
      <View style={[styles.navigationSurface, { backgroundColor: colors.navigation }]}>
        {scrollable ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {navigationItems}
          </ScrollView>
        ) : (
          <View style={styles.row}>{navigationItems}</View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    borderTopWidth: 1,
  },
  navigationSurface: {
    height: 86,
    width: '100%',
    paddingHorizontal: 8,
  },
  row: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  scrollContent: {
    minWidth: '100%',
    height: 86,
    alignItems: 'center',
    paddingHorizontal: 2,
    gap: 6,
  },
  item: {
    height: 72,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  flexItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  scrollableItem: {
    width: 80,
    flexShrink: 0,
  },
  iconShell: {
    width: 38,
    height: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 30,
    textAlign: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    height: 3,
    borderRadius: 999,
  },
  pressedItem: {
    opacity: 0.68,
  },
  label: {
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
    marginTop: 2,
    paddingHorizontal: 0,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
})
