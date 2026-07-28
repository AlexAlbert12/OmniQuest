import React from 'react'
import {
  RefreshControlProps,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../../lib/mobileLayout'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'

type MobileScreenProps = {
  children: React.ReactNode
  bottomNav?: React.ReactNode
  scroll?: boolean
  backgroundColor?: string
  contentLabel?: string
  horizontalPadding?: number
  topPadding?: number
  bottomPadding?: number
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  refreshControl?: React.ReactElement<RefreshControlProps>
  showsVerticalScrollIndicator?: boolean
  scrollViewProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle' | 'refreshControl' | 'showsVerticalScrollIndicator'>
}

export default function MobileScreen({
  children,
  bottomNav,
  scroll = true,
  backgroundColor,
  contentLabel,
  horizontalPadding,
  topPadding,
  bottomPadding,
  contentContainerStyle,
  style,
  refreshControl,
  showsVerticalScrollIndicator = false,
  scrollViewProps,
}: MobileScreenProps) {
  const insets = useSafeAreaInsets()
  const { tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  const resolvedBackgroundColor = backgroundColor || tokens.background.primary
  const resolvedHorizontalPadding = horizontalPadding ?? responsive.horizontalPadding
  const resolvedTopPadding = topPadding ?? responsive.verticalPadding
  const resolvedBottomPadding = bottomPadding ?? (bottomNav ? MOBILE_BOTTOM_NAV_SPACER : 28 + insets.bottom)

  if (!scroll) {
    return (
      <SafeAreaView className="flex-1" style={[{ backgroundColor: resolvedBackgroundColor }, style]} edges={['top', 'left', 'right']}>
        <View
          className="flex-1"
          style={[
            {
              paddingHorizontal: resolvedHorizontalPadding,
              paddingTop: resolvedTopPadding,
              paddingBottom: resolvedBottomPadding,
            },
            contentContainerStyle,
          ]}
          accessibilityLabel={contentLabel}
        >
          {children}
        </View>
        {bottomNav}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={[{ backgroundColor: resolvedBackgroundColor }, style]} edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={[
          {
            paddingHorizontal: resolvedHorizontalPadding,
            paddingTop: resolvedTopPadding,
            paddingBottom: resolvedBottomPadding,
          },
          contentContainerStyle,
        ]}
        accessibilityLabel={contentLabel}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
      {bottomNav}
    </SafeAreaView>
  )
}
