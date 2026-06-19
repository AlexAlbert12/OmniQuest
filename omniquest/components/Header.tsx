import React from 'react'
import { View, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import BrandLogo from './BrandLogo'

export default function Header({
  isDesktop,
  onThemePress,
}: {
  isDesktop: boolean
  onThemePress: () => void
}) {
  return (
    <View
      className="z-10 flex-row items-center justify-between"
      style={{ marginBottom: isDesktop ? 18 : 14 }}
    >
      <View>
        <BrandLogo size={isDesktop ? 28 : 25} />
      </View>

      <Pressable
        onPress={onThemePress}
        className="flex-row items-center gap-2 rounded-full border border-[#4988C4] bg-[#4988C4]/15 px-4 py-3"
        style={({ pressed }) => ({
          opacity: pressed ? 0.82 : 1,
          paddingHorizontal: isDesktop ? 18 : 16,
          paddingVertical: isDesktop ? 10 : 12,
        })}
      >
        <Ionicons name="moon-outline" size={18} color="#4988C4" />
      </Pressable>
    </View>
  )
}
