import React from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppIconButton from './AppIconButton'
import AppPressable from './AppPressable'
import { useAppTheme } from '../../lib/appTheme'
import { useResponsiveLayout } from '../../lib/responsive'

export type AppBottomSheetProps = {
  visible: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  scrollable?: boolean
  closeOnBackdropPress?: boolean
  contentStyle?: StyleProp<ViewStyle>
  testID?: string
}

export default function AppBottomSheet({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  scrollable = true,
  closeOnBackdropPress = true,
  contentStyle,
  testID,
}: AppBottomSheetProps) {
  const responsive = useResponsiveLayout()
  const insets = useSafeAreaInsets()
  const { tokens } = useAppTheme()
  const isCompact = responsive.isMobile || responsive.isTablet
  const content = scrollable ? (
    <ScrollView
      style={[
        styles.scrollContent,
        { maxHeight: Math.max(160, responsive.height * (isCompact ? 0.68 : 0.62)) },
      ]}
      contentContainerStyle={[
        styles.content,
        contentStyle,
        isCompact ? { paddingBottom: insets.bottom + 16 } : null,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  )

  return (
    <Modal transparent visible={visible} animationType={isCompact ? 'slide' : 'fade'} onRequestClose={onClose}>
      <View
        testID={testID}
        style={[
          styles.overlay,
          isCompact ? styles.compactOverlay : styles.desktopOverlay,
          { backgroundColor: tokens.background.overlay },
        ]}
      >
        <AppPressable
          accessibilityLabel="Cerrar panel"
          accessibilityHint="Cierra este diálogo sin guardar cambios"
          onPress={closeOnBackdropPress ? onClose : () => undefined}
          disabled={!closeOnBackdropPress}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityRole="summary"
          accessibilityViewIsModal
          accessibilityLabel={title || 'Diálogo'}
          importantForAccessibility="yes"
          style={[
            styles.sheet,
            isCompact ? styles.compactSheet : styles.desktopSheet,
            {
              backgroundColor: tokens.surface.default,
              borderColor: tokens.border.default,
            },
          ]}
        >
          {isCompact ? <View style={[styles.handle, { backgroundColor: tokens.border.active }]} /> : null}
          {title || description ? (
            <View style={[styles.header, { borderBottomColor: tokens.border.subtle }]}>
              <View style={styles.headerCopy}>
                {title ? <Text accessibilityRole="header" maxFontSizeMultiplier={2} style={[styles.title, { color: tokens.text.primary }]}>{title}</Text> : null}
                {description ? <Text maxFontSizeMultiplier={2} style={[styles.description, { color: tokens.text.secondary }]}>{description}</Text> : null}
              </View>
              <AppIconButton accessibilityLabel="Cerrar" icon="close" size="sm" onPress={onClose} />
            </View>
          ) : null}
          {content}
          {footer ? (
            <View style={[styles.footer, { borderTopColor: tokens.border.subtle }]}>{footer}</View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  compactOverlay: {
    justifyContent: 'flex-end',
  },
  desktopOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: 1,
  },
  compactSheet: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 12,
  },
  desktopSheet: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '86%',
    borderRadius: 24,
  },
  handle: {
    width: 44,
    height: 4,
    alignSelf: 'center',
    marginTop: 10,
    borderRadius: 999,
    opacity: 0.65,
  },
  header: {
    flexShrink: 0,
    minHeight: 58,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  description: {
    flexShrink: 1,
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  content: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  scrollContent: {
    minHeight: 0,
    flexShrink: 1,
  },
  footer: {
    flexShrink: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
})
