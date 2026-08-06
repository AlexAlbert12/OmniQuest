import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createShadowStyle } from '../../../lib/platformShadow'

export default function CreateCourseCTA({ label = 'Crear curso', onPress, sticky = false }: {
  label?: string
  onPress: () => void
  sticky?: boolean
}) {
  return (
    <View
      className={sticky ? 'absolute bottom-[82px] left-4 right-4' : 'mt-5'}
      style={sticky ? createShadowStyle({
        color: '#000000',
        opacity: 0.35,
        radius: 14,
        offsetY: 8,
        elevation: 12,
        web: '0 8px 28px rgba(0, 0, 0, 0.35)',
      }) : undefined}
    >
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={onPress}
        className="h-14 flex-row items-center justify-center gap-2 rounded-2xl border border-border-active bg-brand-teacher px-5"
        style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
      >
        <Ionicons name="add" size={21} color="#FFFFFF" />
        <Text className="text-[15px] font-black text-white">{label}</Text>
      </Pressable>
    </View>
  )
}
