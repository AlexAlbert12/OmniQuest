import React from 'react'
import { View } from 'react-native'

export default function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 overflow-hidden bg-[#030B1D]">
      <View className="absolute inset-0 bg-[#030B1D]" />
      <View className="absolute left-[-160px] top-[-140px] h-96 w-96 rounded-full bg-[#10397C]/45" />
      <View className="absolute right-[-140px] top-[160px] h-[420px] w-[420px] rounded-full bg-[#32136C]/50" />
      <View className="absolute bottom-[-180px] left-[8%] h-[460px] w-[460px] rounded-full bg-[#051C48]/70" />
      <View className="absolute bottom-[110px] right-[-120px] h-80 w-80 rounded-full bg-[#190B55]/55" />

      <View className="absolute right-[11%] top-[210px] h-20 w-28 rounded-full border border-[#4E43C8]/70" style={{ transform: [{ rotate: '-19deg' }] }} />
      <View className="absolute right-[7%] top-[235px] h-11 w-11 rounded-full bg-[#342196]" />
      <View className="absolute right-[19%] top-[170px] h-24 w-24 rounded-full bg-[#1D2A8B]/65" />

      <View className="absolute left-[10%] top-[132px] h-1.5 w-1.5 rounded-full bg-[#8B5CF6]" />
      <View className="absolute right-[28%] top-[74px] h-1.5 w-1.5 rounded-full bg-[#5364F5]" />
      <View className="absolute right-[18%] top-[304px] h-2 w-2 rounded-full bg-[#7C5CFF]" />
      <View className="absolute left-[18%] top-[360px] h-1.5 w-1.5 rounded-full bg-[#A78BFA]" />
      <View className="absolute left-[26%] bottom-[180px] h-1 w-1 rounded-full bg-[#60A5FA]" />

      {children}
    </View>
  )
}
