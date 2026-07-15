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
import {
  MOBILE_BOTTOM_NAV_SPACER,
  MOBILE_SCREEN_HORIZONTAL_PADDING,
  MOBILE_SCREEN_TOP_PADDING,
} from '../../../lib/mobileLayout'

type MobileScreenProps = {
  children: React.ReactNode
  bottomNav?: React.ReactNode
  scroll?: boolean
  backgroundColor?: string
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
  backgroundColor = '#020B1B',
  horizontalPadding = MOBILE_SCREEN_HORIZONTAL_PADDING,
  topPadding = MOBILE_SCREEN_TOP_PADDING,
  bottomPadding,
  contentContainerStyle,
  style,
  refreshControl,
  showsVerticalScrollIndicator = false,
  scrollViewProps,
}: MobileScreenProps) {
  const insets = useSafeAreaInsets()
  const resolvedBottomPadding = bottomPadding ?? (bottomNav ? MOBILE_BOTTOM_NAV_SPACER : 28 + insets.bottom)

  if (!scroll) {
    return (
      <SafeAreaView className="flex-1" style={[{ backgroundColor }, style]} edges={['top', 'left', 'right']}>
        <View
          className="flex-1"
          style={[
            {
              paddingHorizontal: horizontalPadding,
              paddingTop: topPadding,
              paddingBottom: resolvedBottomPadding,
            },
            contentContainerStyle,
          ]}
        >
          {children}
        </View>
        {bottomNav}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={[{ backgroundColor }, style]} edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={[
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: topPadding,
            paddingBottom: resolvedBottomPadding,
          },
          contentContainerStyle,
        ]}
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
