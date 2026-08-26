import React from 'react'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import HomeVisualBackground from '../../HomeVisualBackground'
import { useResponsiveLayout } from '../../../lib/responsive'

export default function GameShell({ children }: { children: React.ReactNode }) {
  const responsive = useResponsiveLayout()
  const isDesktop = responsive.isDesktop

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 overflow-hidden bg-background-secondary">
      <View className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        <HomeVisualBackground isDesktop={isDesktop} />
      </View>

      <View className="relative z-10 flex-1">
        {children}
      </View>
    </SafeAreaView>
  )
}
