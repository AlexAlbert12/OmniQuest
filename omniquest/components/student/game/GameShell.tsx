import React from 'react'
import { View } from 'react-native'

export default function GameShell({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 overflow-hidden bg-[#031026]">
      <View className="absolute inset-0 bg-[#050B22]" />
      <View className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-[#132E72]/35" />
      <View className="absolute right-[-110px] top-[180px] h-96 w-96 rounded-full bg-[#2D155F]/45" />
      <View className="absolute bottom-[-160px] left-[18%] h-96 w-96 rounded-full bg-[#071D48]/70" />
      <View className="absolute right-24 top-28 h-2 w-2 rounded-full bg-[#7C5CFF]" />
      <View className="absolute right-[21%] top-14 h-1.5 w-1.5 rounded-full bg-[#5364F5]" />
      <View className="absolute left-[8%] top-40 h-1.5 w-1.5 rounded-full bg-[#7C5CFF]" />
      <View className="absolute right-[12%] top-56 h-24 w-24 rounded-full bg-[#202B91]/70" />
      <View className="absolute right-[9%] top-72 h-9 w-9 rounded-full bg-[#29175F]" />
      <View className="absolute bottom-56 right-[5%] h-72 w-72 rounded-full bg-[#130D5B]/40" />
      <View
        className="absolute right-[9%] top-[235px] h-8 w-32 rounded-full border border-[#3F36A8]"
        style={{ transform: [{ rotate: '-18deg' }] }}
      />
      {children}
    </View>
  )
}
