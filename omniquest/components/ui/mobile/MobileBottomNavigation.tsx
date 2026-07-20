import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export type MobileBottomNavigationItem<Key extends string> = {
  key: Key
  label: string
  href: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
}

type MobileBottomNavigationProps<Key extends string> = {
  activeKey: Key
  accentColor: string
  items: MobileBottomNavigationItem<Key>[]
  scrollable?: boolean
}

const NAV_BACKGROUND = '#050E1F'
const NAV_BORDER = '#20395F'
const INACTIVE_COLOR = '#9FB2CC'

export default function MobileBottomNavigation<Key extends string>({
  activeKey,
  accentColor,
  items,
  scrollable = false,
}: MobileBottomNavigationProps<Key>) {
  const navigationItems = items.map((item) => {
    const isActive = item.key === activeKey
    const content = (
      <Pressable
        accessibilityLabel={item.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        disabled={isActive}
        hitSlop={6}
        style={({ pressed }) => [
          styles.item,
          scrollable ? styles.scrollableItem : styles.flexItem,
          isActive && { backgroundColor: `${accentColor}1F` },
          pressed && !isActive && styles.pressedItem,
        ]}
      >
        <View
          style={[
            styles.activeIndicator,
            { backgroundColor: isActive ? accentColor : 'transparent' },
          ]}
        />
        <Ionicons
          name={isActive ? item.activeIcon : item.icon}
          size={22}
          color={isActive ? accentColor : INACTIVE_COLOR}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: isActive ? accentColor : INACTIVE_COLOR },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    )

    if (isActive) {
      return <React.Fragment key={item.key}>{content}</React.Fragment>
    }

    return (
      <Link key={item.key} href={item.href as any} asChild>
        {content}
      </Link>
    )
  })

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.navigationSurface}>
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
    backgroundColor: NAV_BACKGROUND,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: NAV_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
      android: {
        elevation: 24,
      },
      default: {
        boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.34)',
      },
    }),
  },
  navigationSurface: {
    minHeight: 72,
    backgroundColor: NAV_BACKGROUND,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 5,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'stretch',
    justifyContent: 'space-around',
    gap: 4,
  },
  item: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 5,
    position: 'relative',
  },
  flexItem: {
    flex: 1,
    minWidth: 56,
    maxWidth: 94,
  },
  scrollableItem: {
    minWidth: 72,
  },
  activeIndicator: {
    position: 'absolute',
    top: 1,
    width: 22,
    height: 3,
    borderRadius: 999,
  },
  pressedItem: {
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
  },
  label: {
    marginTop: 4,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
})
