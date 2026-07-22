import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../../lib/appTheme'

type Props = {
  title: string
  subtitle?: string
  icon?: keyof typeof Ionicons.glyphMap
  children: React.ReactNode
}

export default function QuestionFormSection({ title, subtitle, icon, children }: Props) {
  const { tokens } = useAppTheme()
  return (
    <View
      className="rounded-2xl border p-4 md:p-5"
      style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}
    >
      <View className="flex-row items-start gap-3">
        {icon ? (
          <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tokens.surface.interactive }}>
            <Ionicons name={icon} size={20} color={tokens.brand.teacher} />
          </View>
        ) : null}
        <View className="min-w-0 flex-1">
          <Text className="text-[22px] font-black" style={{ color: tokens.text.primary }}>{title}</Text>
          {subtitle ? <Text className="mt-1 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>{subtitle}</Text> : null}
        </View>
      </View>
      <View className="mt-5">{children}</View>
    </View>
  )
}
