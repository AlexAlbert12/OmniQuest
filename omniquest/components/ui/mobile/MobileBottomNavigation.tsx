import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
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
const ICON_SIZE = 26

export default function MobileBottomNavigation<Key extends string>({
  activeKey,
  accentColor,
  items,
  scrollable = false,
}: MobileBottomNavigationProps<Key>) {
  const router = useRouter()

  const navigationItems = items.map((item) => {
    const isActive = item.key === activeKey

    return (
      <Pressable
        key={item.key}
        accessibilityLabel={item.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        disabled={isActive}
        hitSlop={4}
        onPress={() => router.push(item.href as never)}
        style={({ pressed }) => [
          styles.item,
          scrollable ? styles.scrollableItem : styles.flexItem,
          pressed && !isActive && styles.pressedItem,
        ]}
      >
        <View style={styles.iconShell}>
          <Ionicons
            name={isActive ? item.activeIcon : item.icon}
            size={ICON_SIZE}
            color={isActive ? accentColor : INACTIVE_COLOR}
            style={styles.icon}
          />
        </View>

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
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.24,
        shadowRadius: 13,
      },
      android: {
        elevation: 22,
      },
      default: {
        boxShadow: '0 -7px 22px rgba(0, 0, 0, 0.32)',
      },
    }),
  },
  navigationSurface: {
    height: 82,
    width: '100%',
    backgroundColor: NAV_BACKGROUND,
    paddingHorizontal: 8,
  },
  row: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    minWidth: '100%',
    height: 82,
    alignItems: 'center',
    paddingHorizontal: 2,
    gap: 4,
  },
  item: {
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  flexItem: {
    flex: 1,
    minWidth: 0,
  },
  scrollableItem: {
    width: 82,
    flexShrink: 0,
  },
  iconShell: {
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 30,
    textAlign: 'center',
  },
  pressedItem: {
    opacity: 0.65,
  },
  label: {
    width: '100%',
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
})