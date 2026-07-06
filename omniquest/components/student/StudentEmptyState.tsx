import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type StudentEmptyStateProps = {
  className?: string
  icon: keyof typeof Ionicons.glyphMap
  message?: string
  title: string
}

export default function StudentEmptyState({
  className = '',
  icon,
  message,
  title,
}: StudentEmptyStateProps) {
  return (
    <View className={`items-center rounded-xl border border-dashed border-[#20375E] bg-[#0D1D3B] px-4 py-6 ${className}`}>
      <Ionicons name={icon} size={34} color="#60799C" />
      <Text className="mt-3 text-center font-black text-white">{title}</Text>
      {message ? <Text className="mt-1 text-center text-[13px] leading-5 text-[#8FA7C7]">{message}</Text> : null}
    </View>
  )
}
