import { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import NotificationBadge from '../NotificationBadge'
import StudentHeaderAvatar from './StudentHeaderAvatar'

type StudentPageHeaderProps = {
  actions?: ReactNode
  icon: keyof typeof Ionicons.glyphMap
  iconColor?: string
  isDesktop: boolean
  mobileTitle?: string
  subtitle: string
  title: string
  variant?: 'default' | 'compact'
}

export default function StudentPageHeader({
  actions,
  icon,
  iconColor = '#9FD6FF',
  isDesktop,
  mobileTitle,
  subtitle,
  title,
  variant = 'default',
}: StudentPageHeaderProps) {
  const displayTitle = !isDesktop && mobileTitle ? mobileTitle : title
  const titleClassName = isDesktop
    ? 'text-[40px] leading-[46px]'
    : variant === 'compact'
      ? 'text-[30px] leading-[35px]'
      : 'text-[34px] leading-[38px]'

  return (
    <View className="mb-6 flex-row items-start justify-between gap-4">
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-3">
          <View className={!isDesktop ? 'h-12 w-12 items-center justify-center rounded-2xl bg-[#0D1D3B]' : ''}>
            <Ionicons name={icon} size={isDesktop ? 40 : 30} color={iconColor} />
          </View>
          <Text className={`min-w-0 flex-1 font-black text-white ${titleClassName}`} numberOfLines={2}>{displayTitle}</Text>
        </View>
        <Text className="mt-1 text-[13px] leading-5 text-[#9BAEC9]" numberOfLines={2}>{subtitle}</Text>
      </View>

      <View className="flex-row items-center gap-3">
        {actions}
        <NotificationBadge />
        <StudentHeaderAvatar />
      </View>
    </View>
  )
}
