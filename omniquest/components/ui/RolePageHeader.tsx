import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import NotificationBadge from '../NotificationBadge'
import StudentHeaderAvatar from '../student/StudentHeaderAvatar'
import TeacherHeaderAvatar from '../teacher/TeacherHeaderAvatar'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import AppBackButton from './AppBackButton'

export type PageHeaderRole = 'student' | 'teacher'
export type PageHeaderIcon = keyof typeof Ionicons.glyphMap
export type PageHeaderActionsPosition = 'auto' | 'top' | 'below'

export type RolePageHeaderProps = {

  role: PageHeaderRole

  actions?: ReactNode

  utilityActions?: ReactNode

  actionsPosition?: PageHeaderActionsPosition

  backAction?: {
    label?: string
    onPress: () => void
  }
  className?: string

  icon?: PageHeaderIcon
  iconColor?: string

  isDesktop: boolean

  leading?: ReactNode

  mobileTitle?: string

  mobileStackedIdentity?: boolean

  mobileInlineActions?: boolean

  compactMobileTitle?: boolean
  notificationCount?: number
  notificationOnPress?: () => void
  showAvatar?: boolean
  showNotifications?: boolean
  showStreak?: boolean
  title: string
  titleNumberOfLines?: number
}

export default function RolePageHeader({
  role,
  actions,
  utilityActions,
  actionsPosition = 'auto',
  backAction,
  className = '',
  icon,
  iconColor,
  isDesktop,
  leading,
  mobileTitle,
  mobileStackedIdentity = false,
  mobileInlineActions = false,
  compactMobileTitle = false,
  notificationCount,
  notificationOnPress,
  showAvatar = true,
  showNotifications = true,
  showStreak = false,
  title,
  titleNumberOfLines = 2,
}: RolePageHeaderProps) {
  const { colors, tokens } = useAppTheme()
  const { t } = useI18n()
  const displayTitle = !isDesktop && mobileTitle ? mobileTitle : title
  const resolvedIconColor = iconColor || tokens.brand[role]
  const Avatar = role === 'teacher' ? TeacherHeaderAvatar : StudentHeaderAvatar
  const actionsInline = Boolean(actions) && !isDesktop && mobileInlineActions
  const actionsOnTop = Boolean(actions) && !actionsInline && (actionsPosition === 'top' || (actionsPosition === 'auto' && isDesktop))
  const actionsBelow = Boolean(actions) && !actionsInline && (actionsPosition === 'below' || (actionsPosition === 'auto' && !isDesktop))
  const showTopControls = Boolean(utilityActions) || actionsOnTop || showNotifications || showAvatar

  const backControl = backAction ? (
    <AppBackButton
      accessibilityHint="Vuelve a la pantalla anterior"
      accessibilityLabel={backAction.label || t('common.back')}
      label={backAction.label || t('common.back')}
      onPress={backAction.onPress}
      size="sm"
    />
  ) : null

  const topControls = showTopControls ? (
    <View className="flex-row items-center gap-2">
      {utilityActions}
      {actionsOnTop ? actions : null}
      {showNotifications ? <NotificationBadge audience={role} count={notificationCount} onPress={notificationOnPress} showStreak={showStreak} /> : null}
      {showAvatar ? <Avatar /> : null}
    </View>
  ) : null

  const identity = (
    <View className="flex-row items-center gap-3">
      {leading ?? (icon ? (
        <Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={icon} size={isDesktop ? 40 : 30} color={resolvedIconColor} />
      ) : null)}
      <Text
        accessibilityRole="header"
        allowFontScaling
        maxFontSizeMultiplier={2}
        className={`${isDesktop ? 'text-[40px]' : compactMobileTitle ? 'text-[27px]' : 'text-[30px]'} min-w-0 flex-1 font-black`}
        style={{ color: colors.text, lineHeight: isDesktop ? 54 : compactMobileTitle ? 38 : 42, paddingBottom: isDesktop ? 4 : 3, includeFontPadding: true, overflow: 'visible' }}
        numberOfLines={titleNumberOfLines}
      >
        {displayTitle}
      </Text>
    </View>
  )

  if (!isDesktop && mobileStackedIdentity) {
    return (
      <View className={`mb-6 ${className}`}>
        <View className="flex-row items-center justify-between gap-3">
          {backControl ?? <View />}
          {topControls}
        </View>
        <View className="mt-4 flex-row items-center gap-3">
          <View className="min-w-0 flex-1">{identity}</View>
          {actionsInline ? <View className="shrink-0 flex-row items-center gap-2">{actions}</View> : null}
        </View>
        {actionsBelow ? <View className="mt-4 flex-row flex-wrap items-center gap-3">{actions}</View> : null}
      </View>
    )
  }

  return (
    <View className={`mb-6 ${className}`}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          {backControl ? <View className="mb-3">{backControl}</View> : null}
          {identity}
        </View>
        {topControls}
      </View>
      {actionsBelow ? <View className="mt-4 flex-row flex-wrap items-center justify-end gap-3">{actions}</View> : null}
    </View>
  )
}
