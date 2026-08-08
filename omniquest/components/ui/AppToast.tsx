import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Platform, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppIconButton from './AppIconButton'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import type { SemanticColorKey } from '../../lib/designTokens'
import { USE_NATIVE_ANIMATION_DRIVER } from '../../lib/animation'
import { createShadowStyle } from '../../lib/platformShadow'

export type AppToastVariant = SemanticColorKey | 'neutral'

export type AppToastOptions = {
  title: string
  message?: string
  variant?: AppToastVariant
  durationMs?: number
}

type ToastState = AppToastOptions & { id: number }

type AppToastContextValue = {
  showToast: (options: AppToastOptions) => void
  dismissToast: () => void
}

const AppToastContext = createContext<AppToastContextValue | null>(null)

const ICONS: Record<AppToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  warning: 'warning',
  danger: 'alert-circle',
  info: 'information-circle',
  neutral: 'notifications',
}

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const sequence = useRef(0)

  const dismissToast = useCallback(() => setToast(null), [])
  const showToast = useCallback((options: AppToastOptions) => {
    sequence.current += 1
    setToast({ ...options, id: sequence.current })
  }, [])

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <AppToastContext.Provider value={value}>
      {children}
      <AppToastHost toast={toast} onDismiss={dismissToast} />
    </AppToastContext.Provider>
  )
}

export function useAppToast() {
  const context = useContext(AppToastContext)
  if (!context) throw new Error('useAppToast debe usarse dentro de AppToastProvider')
  return context
}

function AppToastHost({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  const { tokens } = useAppTheme()
  const translateY = useRef(new Animated.Value(-24)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!toast) return
    translateY.setValue(-24)
    opacity.setValue(0)
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: USE_NATIVE_ANIMATION_DRIVER }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: USE_NATIVE_ANIMATION_DRIVER }),
    ]).start()

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -16, duration: 150, useNativeDriver: USE_NATIVE_ANIMATION_DRIVER }),
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: USE_NATIVE_ANIMATION_DRIVER }),
      ]).start(onDismiss)
    }, toast.durationMs ?? 3600)

    return () => clearTimeout(timer)
  }, [onDismiss, opacity, toast, translateY])

  if (!toast) return null

  const variant = toast.variant ?? 'info'
  const color = variant === 'neutral' ? tokens.text.secondary : tokens.semantic[variant]
  const background = variant === 'neutral' ? tokens.surface.raised : tokens.semanticSurface[variant]

  return (
    <View pointerEvents="box-none" style={styles.viewport}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }],
            backgroundColor: background,
            borderColor: withAlpha(color, '99'),
            ...createShadowStyle({
              color: tokens.background.secondary,
              opacity: 0.32,
              radius: 18,
              offsetY: 9,
              elevation: 8,
              web: `0 9px 36px ${withAlpha(tokens.background.secondary, '52')}`,
            }),
          },
        ]}
      >
        <Ionicons name={ICONS[variant]} size={23} color={color} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: tokens.text.primary }]}>{toast.title}</Text>
          {toast.message ? <Text style={[styles.message, { color: tokens.text.secondary }]}>{toast.message}</Text> : null}
        </View>
        <AppIconButton accessibilityLabel="Cerrar aviso" icon="close" size="sm" onPress={onDismiss} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 18 : 48,
    left: 0,
    right: 0,
    zIndex: 10000,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    width: '100%',
    maxWidth: 520,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  message: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
})
