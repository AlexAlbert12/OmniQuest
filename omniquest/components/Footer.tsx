// components/Footer.tsx
import React from 'react'
import { View, Text, Pressable, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function Footer() {
  const isWeb = Platform.OS === 'web'

  return (
    <View 
      className={`w-full p-6 ${
        isWeb ? 'flex-row justify-between items-center' : 'flex-col items-center gap-y-6'
      }`}
    >
      
      <View className={`flex-row items-center gap-x-4 ${!isWeb ? 'justify-center' : ''}`}>
        <Text 
          className="text-[#7CC9FF] font-bold text-xl" 
          style={{ fontFamily: 'Pacifico_400Regular' }}
        >
          OmniQuest
        </Text>
        
        <View className="h-4 w-px bg-[#355276]" />
        
        <Text className="text-[#5176A1] text-[13px]">
          © {new Date().getFullYear()} TFM
        </Text>
      </View>
      
      <View className={`flex-row items-center ${isWeb ? 'gap-6' : 'gap-10'}`}>
        <Pressable className="active:opacity-70">
          <Ionicons 
            name="logo-github" 
            size={isWeb ? 20 : 24} 
            color="#7EA9CA" 
          />
        </Pressable>
        <Pressable className="active:opacity-70">
          <Ionicons 
            name="school-outline" 
            size={isWeb ? 20 : 24} 
            color="#7EA9CA" 
          />
        </Pressable>
        <Pressable className="active:opacity-70">
          <Ionicons 
            name="mail-outline" 
            size={isWeb ? 20 : 24} 
            color="#7EA9CA" 
          />
        </Pressable>
      </View>

    </View>
  )
}