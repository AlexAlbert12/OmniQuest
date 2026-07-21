import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import { getSemanticColor, semanticIcons, type SemanticIconKey } from '../../lib/designTokens'
import { withAlpha } from '../../lib/color'

type SemanticIconProps = {
  semantic: SemanticIconKey
  active?: boolean
  contained?: boolean
  size?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Canonical icon treatment for concepts that repeat across OmniQuest.
 * It prevents XP, warnings, courses or audit events from changing meaning
 * and colour between screens.
 */
export default function SemanticIcon({
  semantic,
  active = true,
  contained = true,
  size = 20,
  style,
}: SemanticIconProps) {
  const { tokens } = useAppTheme()
  const definition = semanticIcons[semantic]
  const color = getSemanticColor(tokens, definition.colorKey)
  const icon = active ? definition.activeIcon : definition.icon

  if (!contained) {
    return <Ionicons name={icon} size={size} color={color} />
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.shell,
        {
          width: size + 22,
          height: size + 22,
          borderColor: withAlpha(color, '55'),
          backgroundColor: withAlpha(color, '22'),
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
  },
})
