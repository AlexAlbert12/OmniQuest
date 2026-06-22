import { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import BrandLogo from '../BrandLogo'
import NotificationBadge from '../NotificationBadge'
import StudentHeaderAvatar from './StudentHeaderAvatar'

type StudentPageHeaderProps = {
  actions?: ReactNode
  icon: keyof typeof Ionicons.glyphMap
  iconColor?: string
  isDesktop: boolean
  subtitle: string
  title: string
}

export default function StudentPageHeader({
  actions,
  icon,
  iconColor = '#9FD6FF',
  isDesktop,
  subtitle,
  title,
}: StudentPageHeaderProps) {
  return (
    <View className="mb-6 flex-row items-start justify-between gap-4">
      <View className="min-w-0 flex-1">
        {!isDesktop ? <BrandLogo size={30} style={{ marginBottom: 12 }} /> : null}
        <View className="flex-row items-center gap-3">
          <Ionicons name={icon} size={40} color={iconColor} />
          <Text className="text-[40px] font-black text-white">{title}</Text>
        </View>
        <Text className="mt-1 text-[13px] text-[#9BAEC9]">{subtitle}</Text>
      </View>

      <View className="flex-row items-center gap-3">
        {actions}
        <NotificationBadge />
        <StudentHeaderAvatar />
      </View>
    </View>
  )
}
