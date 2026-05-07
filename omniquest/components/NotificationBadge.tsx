import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type NotificationBadgeProps = {
  count: number
  onPress: () => void
}

export default function NotificationBadge({ count, onPress }: NotificationBadgeProps) {
  return (
    <Pressable
      onPress={onPress}
      className="relative rounded-2xl border border-[#20375E] bg-[#09162C] p-3"
    >
      <Ionicons name="notifications-outline" size={22} color="#AFC2DB" />
      {count > 0 ? (
        <View className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-[#EF4444]">
          <Text className="text-[10px] font-black text-white">
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}
