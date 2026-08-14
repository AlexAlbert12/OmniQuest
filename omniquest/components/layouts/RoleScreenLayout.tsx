import React from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
  type RefreshControlProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '../../lib/appTheme'
import type { AppRole } from '../../lib/designTokens'
import { useResponsiveLayout } from '../../lib/responsive'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import OmniGuide from '../OmniGuide'
import { useI18n } from '../../lib/i18n'

type RoleScreenLayoutProps = {
  role: AppRole
  children: React.ReactNode
  desktopSidebar?: React.ReactNode
  mobileBottomNavigation?: React.ReactNode
  scroll?: boolean
  loading?: boolean
  loadingLabel?: string
  contentLabel?: string
  refreshControl?: React.ReactElement<RefreshControlProps>
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  isDesktop?: boolean
  maxContentWidth?: number
  fluidContent?: boolean
  horizontalPadding?: number
  topPadding?: number
  bottomPadding?: number
  showsVerticalScrollIndicator?: boolean
  scrollViewProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle' | 'refreshControl' | 'showsVerticalScrollIndicator'>
}

export default function RoleScreenLayout({
  role,
  children,
  desktopSidebar,
  mobileBottomNavigation,
  scroll = true,
  loading = false,
  loadingLabel,
  contentLabel,
  refreshControl,
  contentContainerStyle,
  style,
  isDesktop: isDesktopOverride,
  maxContentWidth,
  fluidContent = false,
  horizontalPadding,
  topPadding,
  bottomPadding,
  showsVerticalScrollIndicator = false,
  scrollViewProps,
}: RoleScreenLayoutProps) {
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  const isDesktop = isDesktopOverride ?? responsive.isDesktop
  const resolvedHorizontalPadding = horizontalPadding ?? responsive.horizontalPadding
  const resolvedTopPadding = topPadding ?? responsive.verticalPadding
  const resolvedBottomPadding = bottomPadding ?? (isDesktop ? 36 : mobileBottomNavigation ? MOBILE_BOTTOM_NAV_SPACER : 32)
  const resolvedMaxWidth = maxContentWidth ?? responsive.contentMaxWidth

  const resolvedLoadingLabel = loadingLabel || t('loading.omni')
  const content = loading ? (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={resolvedLoadingLabel}>
      {role === 'admin' ? <ActivityIndicator size="large" color={tokens.brand.admin} /> : <OmniGuide state="blink" size={116} />}
      <Text maxFontSizeMultiplier={2} style={[styles.loadingLabel, { color: role === 'admin' ? tokens.brand.admin : tokens.text.muted }]}>{resolvedLoadingLabel}</Text>
    </View>
  ) : (
    children
  )

  const mainContentStyle: StyleProp<ViewStyle> = [
    styles.content,
    {
      ...(fluidContent ? {} : { maxWidth: resolvedMaxWidth }),
      paddingHorizontal: resolvedHorizontalPadding,
      paddingTop: resolvedTopPadding,
      paddingBottom: resolvedBottomPadding,
    },
    contentContainerStyle,
    loading ? styles.loadingViewport : null,
  ]

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: tokens.background.primary }, style]}
    >
      <View style={styles.row}>
        {isDesktop ? desktopSidebar : null}
        <View style={styles.main} accessibilityLabel={contentLabel || `Contenido ${role}`}>
          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={mainContentStyle}
              refreshControl={refreshControl}
              showsVerticalScrollIndicator={showsVerticalScrollIndicator}
              keyboardShouldPersistTaps="handled"
              {...scrollViewProps}
            >
              {content}
            </ScrollView>
          ) : (
            <View style={mainContentStyle}>{content}</View>
          )}
        </View>
      </View>
      {!isDesktop ? mobileBottomNavigation : null}
    </SafeAreaView>
  )
}

const styles = {
  root: { flex: 1 } satisfies ViewStyle,
  row: { flex: 1, flexDirection: 'row' } satisfies ViewStyle,
  main: { flex: 1, minWidth: 0 } satisfies ViewStyle,
  scroll: { flex: 1 } satisfies ViewStyle,
  content: { width: '100%', alignSelf: 'center' } satisfies ViewStyle,
  loadingViewport: { minHeight: '100%' } satisfies ViewStyle,
  loading: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' } satisfies ViewStyle,
  loadingLabel: { marginTop: 16, fontSize: 14, lineHeight: 20, textAlign: 'center' } as const,
}
