import React from 'react'
import { useWindowDimensions, View } from 'react-native'
import HomeVisualBackground from '../../HomeVisualBackground'

export default function GameShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1024

  return (
    <View className="flex-1 overflow-hidden bg-background-secondary">
      <View className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        <HomeVisualBackground isDesktop={isDesktop} />
      </View>

      <View className="relative z-10 flex-1">
        {children}
      </View>
    </View>
  )
}