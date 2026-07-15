import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import BrandLogo from '../../BrandLogo'

type IconName = keyof typeof Ionicons.glyphMap

type MobileHeaderProps = {
  title: string
  subtitle?: string
  icon?: IconName
  iconColor?: string
  iconBackgroundColor?: string
  right?: React.ReactNode
  showLogo?: boolean
  logoSize?: number
  className?: string
  titleNumberOfLines?: number
}

export default function MobileHeader({
  title,
  subtitle,
  icon,
  iconColor = '#9FD6FF',
  iconBackgroundColor = '#12325B',
  right,
  showLogo = true,
  logoSize = 32,
  className = '',
  titleNumberOfLines = 2,
}: MobileHeaderProps) {
  return (
    <View className={className}>
      <View className="flex-row items-center justify-between gap-4">
        {showLogo ? <BrandLogo size={logoSize} /> : <View />}
        {right ? <View className="flex-row items-center gap-3">{right}</View> : null}
      </View>

      <View className="mt-7 flex-row items-center gap-3">
        {icon ? (
          <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: iconBackgroundColor }}>
            <Ionicons name={icon} size={26} color={iconColor} />
          </View>
        ) : null}
        <Text className="min-w-0 flex-1 text-[34px] font-black leading-[40px] text-white" numberOfLines={titleNumberOfLines}>
          {title}
        </Text>
      </View>

      {subtitle ? (
        <Text className="mt-3 max-w-[350px] text-[15px] leading-6 text-[#B8C6DC]">
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}
