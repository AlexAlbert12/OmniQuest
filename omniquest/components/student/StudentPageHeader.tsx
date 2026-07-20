import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import NotificationBadge from '../NotificationBadge'
import StudentHeaderAvatar from './StudentHeaderAvatar'

type StudentPageHeaderProps = {
  /** Additional controls rendered before notifications and avatar. */
  actions?: ReactNode
  /** Ionicons icon displayed beside the title. */
  icon: keyof typeof Ionicons.glyphMap
  iconColor?: string
  /** Controls the desktop typography without reading window size internally. */
  isDesktop: boolean
  /** Optional shorter title used on mobile. */
  mobileTitle?: string
  /** Hides the avatar for screens where it would be redundant. */
  showAvatar?: boolean
  /** Hides the notifications shortcut when the screen provides its own one. */
  showNotifications?: boolean
  subtitle: string
  title: string
}

/**
 * Shared student page heading based on the Ranking screen layout.
 *
 * It keeps icon, title, subtitle, notifications and avatar aligned in the same
 * way across mobile and desktop student screens. Screen-specific controls can
 * be injected through `actions` without duplicating the header structure.
 */
export default function StudentPageHeader({
  actions,
  icon,
  iconColor = '#9FD6FF',
  isDesktop,
  mobileTitle,
  showAvatar = true,
  showNotifications = true,
  subtitle,
  title,
}: StudentPageHeaderProps) {
  const displayTitle = !isDesktop && mobileTitle ? mobileTitle : title

  return (
    <View className="mb-6 flex-row items-start justify-between gap-4">
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-3">
          <Ionicons
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            name={icon}
            size={isDesktop ? 40 : 30}
            color={iconColor}
          />
          <Text
            accessibilityRole="header"
            className={`${isDesktop ? 'text-[40px] leading-[46px]' : 'text-[30px] leading-[36px]'} min-w-0 flex-1 font-black text-white`}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
        </View>
        <Text className="mt-1 text-[13px] leading-5 text-[#9BAEC9]" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      {actions || showNotifications || showAvatar ? (
        <View className="flex-row items-center gap-3">
          {actions}
          {showNotifications ? <NotificationBadge /> : null}
          {showAvatar ? <StudentHeaderAvatar /> : null}
        </View>
      ) : null}
    </View>
  )
}
