import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import OmniGuide, { type OmniSize, type OmniState } from '../OmniGuide'

type StudentEmptyStateProps = {
  className?: string
  icon?: keyof typeof Ionicons.glyphMap
  message?: string
  omniSize?: OmniSize | number
  omniState?: OmniState
  title: string
}

export default function StudentEmptyState({
  className = '',
  icon,
  message,
  omniSize = 'md',
  omniState,
  title,
}: StudentEmptyStateProps) {
  return (
    <View className={`items-center rounded-xl border border-dashed border-border-default bg-surface-raised px-4 py-6 ${className}`}>
      {omniState ? (
        <OmniGuide state={omniState} size={omniSize} autoBlink={omniState === 'normal'} />
      ) : icon ? (
        <Ionicons name={icon} size={34} color="#60799C" />
      ) : null}
      <Text className="mt-3 text-center font-black text-white">{title}</Text>
      {message ? <Text className="mt-1 text-center text-[13px] leading-5 text-text-muted">{message}</Text> : null}
    </View>
  )
}
