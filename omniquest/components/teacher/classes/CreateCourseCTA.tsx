import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function CreateCourseCTA({ label = 'Crear curso', onPress, sticky = false }: {
  label?: string
  onPress: () => void
  sticky?: boolean
}) {
  return (
    <View
      className={sticky ? 'absolute bottom-[82px] left-4 right-4' : 'mt-5'}
      style={sticky ? { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 12 } : undefined}
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
