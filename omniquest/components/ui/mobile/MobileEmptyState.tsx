import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import OmniGuide, { type OmniSize, type OmniState } from '../../OmniGuide'

type IconName = keyof typeof Ionicons.glyphMap

type MobileEmptyStateProps = {
  icon?: IconName
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  color?: string
  className?: string
  omniSize?: OmniSize | number
  omniState?: OmniState
}

export default function MobileEmptyState({
  icon = 'sparkles-outline',
  title,
  description,
  actionLabel,
  onAction,
  color = '#8B5CF6',
  className = '',
  omniSize = 'md',
  omniState,
}: MobileEmptyStateProps) {
  return (
    <View className={`items-center rounded-[24px] border border-dashed border-border-default bg-surface-default px-5 py-8 ${className}`}>
      {omniState ? (
        <OmniGuide state={omniState} size={omniSize} autoBlink={omniState === 'normal'} />
      ) : (
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
          <Ionicons name={icon} size={30} color={color} />
        </View>
      )}
      <Text className="mt-4 text-center text-[19px] font-black text-white">{title}</Text>
      {description ? (
        <Text className="mt-2 max-w-[280px] text-center text-[13px] leading-5 text-text-secondary">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          className="mt-5 rounded-2xl px-5 py-3"
          style={({ pressed }) => ({ backgroundColor: color, opacity: pressed ? 0.82 : 1 })}
        >
          <Text className="font-black text-white">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
