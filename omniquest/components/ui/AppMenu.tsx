import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppBottomSheet from './AppBottomSheet'
import AppPressable from './AppPressable'
import { useAppTheme } from '../../lib/appTheme'

export type AppMenuItem = {
  key: string
  label: string
  description?: string
  icon?: keyof typeof Ionicons.glyphMap
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}

type AppMenuProps = {
  visible: boolean
  onClose: () => void
  title?: string
  description?: string
  items: AppMenuItem[]
}

export default function AppMenu({
  visible,
  onClose,
  title = 'Acciones',
  description,
  items,
}: AppMenuProps) {
  const { tokens } = useAppTheme()

  const handlePress = (item: AppMenuItem) => {
    if (item.disabled) return
    onClose()
    item.onPress()
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      description={description}
      contentStyle={styles.content}
    >
      <View style={styles.list}>
        {items.map((item) => {
          const foreground = item.destructive ? tokens.semantic.danger : tokens.text.primary
          return (
            <AppPressable
              key={item.key}
              accessibilityLabel={item.label}
              accessibilityHint={item.description}
              disabled={item.disabled}
              onPress={() => handlePress(item)}
              style={({ pressed }) => [
                styles.item,
                {
                  borderColor: item.destructive ? tokens.semantic.danger : tokens.border.default,
                  backgroundColor: item.destructive ? tokens.semanticSurface.danger : tokens.surface.raised,
                  opacity: item.disabled ? 0.45 : pressed ? 0.8 : 1,
                },
              ]}
            >
              {item.icon ? (
                <View style={[styles.icon, { backgroundColor: tokens.surface.interactive }]}>
                  <Ionicons name={item.icon} size={20} color={foreground} />
                </View>
              ) : null}
              <View style={styles.copy}>
                <Text style={[styles.label, { color: foreground }]}>{item.label}</Text>
                {item.description ? (
                  <Text style={[styles.description, { color: tokens.text.secondary }]}>{item.description}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={17} color={tokens.text.muted} />
            </AppPressable>
          )
        })}
      </View>
    </AppBottomSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
  },
  list: {
    gap: 10,
  },
  item: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  label: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  description: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
})
