import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import NotificationBadge from '../NotificationBadge'
import StudentHeaderAvatar from '../student/StudentHeaderAvatar'
import TeacherHeaderAvatar from '../teacher/TeacherHeaderAvatar'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'

export type PageHeaderRole = 'student' | 'teacher'
export type PageHeaderIcon = keyof typeof Ionicons.glyphMap
export type PageHeaderActionsPosition = 'auto' | 'top' | 'below'

export type RolePageHeaderProps = {
  /** Controls the notification destination and avatar rendered by default. */
  role: PageHeaderRole
  /** Extra controls rendered before notifications and avatar. */
  actions?: ReactNode
  /** Utility controls that always stay in the top-right area (for example global search). */
  utilityActions?: ReactNode
  /** `auto` keeps actions on top on desktop and below the title on mobile. */
  actionsPosition?: PageHeaderActionsPosition
  /** Optional back navigation rendered above the title on detail/form screens. */
  backAction?: {
    label?: string
    onPress: () => void
  }
  className?: string
  /** Ionicons icon displayed beside the title. Omit it when `leading` is provided. */
  icon?: PageHeaderIcon
  iconColor?: string
  /** Pass the screen breakpoint so the shared component keeps deterministic typography. */
  isDesktop: boolean
  /** Replaces the default icon with any custom leading visual. */
  leading?: ReactNode
  /** Optional shorter title used on mobile. */
  mobileTitle?: string
  /** Optional shorter supporting copy used only on mobile. */
  mobileSubtitle?: string
  /** Gives detail screens a dedicated mobile utility row and a full-width identity row. */
  mobileStackedIdentity?: boolean
  /** Slightly reduces only the mobile title scale for long screen names. */
  compactMobileTitle?: boolean
  notificationCount?: number
  notificationOnPress?: () => void
  showAvatar?: boolean
  showNotifications?: boolean
  showStreak?: boolean
  subtitle?: string
  subtitleNumberOfLines?: number
  title: string
  titleNumberOfLines?: number
}

/**
 * Shared page header for authenticated student and teacher screens.
 *
 * `mobileStackedIdentity` is used by dense detail screens: utilities stay in
 * the first row while the icon/title receive almost the full mobile width.
 */
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
  mobileSubtitle,
  mobileStackedIdentity = false,
  compactMobileTitle = false,
  notificationCount,
  notificationOnPress,
  showAvatar = true,
  showNotifications = true,
  showStreak = false,
  subtitle,
  subtitleNumberOfLines = 3,
  title,
  titleNumberOfLines = 2,
}: RolePageHeaderProps) {
  const { colors, tokens } = useAppTheme()
  const { t } = useI18n()
  const displayTitle = !isDesktop && mobileTitle ? mobileTitle : title
  const displaySubtitle = !isDesktop && mobileSubtitle !== undefined ? mobileSubtitle : subtitle
  const resolvedIconColor = iconColor || tokens.brand[role]
  const Avatar = role === 'teacher' ? TeacherHeaderAvatar : StudentHeaderAvatar
  const actionsOnTop = Boolean(actions) && (actionsPosition === 'top' || (actionsPosition === 'auto' && isDesktop))
  const actionsBelow = Boolean(actions) && (actionsPosition === 'below' || (actionsPosition === 'auto' && !isDesktop))
  const showTopControls = Boolean(utilityActions) || actionsOnTop || showNotifications || showAvatar

  const backControl = backAction ? (
    <Pressable
      accessibilityLabel={backAction.label || t('common.back')}
      accessibilityHint="Vuelve a la pantalla anterior"
      accessibilityRole="button"
      focusable
      hitSlop={8}
      onPress={backAction.onPress}
      className="flex-row items-center gap-2 self-start rounded-xl px-3 py-2"
      style={({ pressed }) => ({ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.78 : 1 })}
    >
      <Ionicons name="arrow-back" size={16} color={colors.text} />
      <Text allowFontScaling maxFontSizeMultiplier={2} className="text-[12px] font-bold" style={{ color: colors.text, lineHeight: 18 }}>
        {backAction.label || t('common.back')}
      </Text>
    </Pressable>
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

  const supportingCopy = displaySubtitle ? (
    <Text allowFontScaling maxFontSizeMultiplier={2} className="mt-1 max-w-[780px] text-[13px] leading-5" style={{ color: colors.textMuted }} numberOfLines={subtitleNumberOfLines}>
      {displaySubtitle}
    </Text>
  ) : null

  if (!isDesktop && mobileStackedIdentity) {
    return (
      <View className={`mb-6 ${className}`}>
        <View className="flex-row items-center justify-between gap-3">
          {backControl ?? <View />}
          {topControls}
        </View>
        <View className="mt-4">
          {identity}
          {supportingCopy}
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
          {supportingCopy}
        </View>
        {topControls}
      </View>
      {actionsBelow ? <View className="mt-4 flex-row flex-wrap items-center justify-end gap-3">{actions}</View> : null}
    </View>
  )
}
