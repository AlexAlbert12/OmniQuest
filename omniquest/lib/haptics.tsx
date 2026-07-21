import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

const HAPTICS_STORAGE_KEY = 'omniquest:haptics-enabled'

type AppHapticsContextValue = {
  enabled: boolean
  ready: boolean
  setEnabled: (enabled: boolean) => Promise<void>
  success: () => Promise<void>
  error: () => Promise<void>
  selection: () => Promise<void>
  impact: (style?: Haptics.ImpactFeedbackStyle) => Promise<void>
}

const AppHapticsContext = createContext<AppHapticsContextValue | null>(null)

export function AppHapticsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true

    AsyncStorage.getItem(HAPTICS_STORAGE_KEY)
      .then((stored) => {
        if (!mounted || stored === null) return
        setEnabledState(stored !== 'false')
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setReady(true)
      })

    return () => {
      mounted = false
    }
  }, [])

  const setEnabled = useCallback(async (nextEnabled: boolean) => {
    setEnabledState(nextEnabled)
    await AsyncStorage.setItem(HAPTICS_STORAGE_KEY, String(nextEnabled)).catch(() => undefined)
  }, [])

  const run = useCallback(async (callback: () => Promise<void>) => {
    if (!enabled || Platform.OS === 'web') return

    try {
      await callback()
    } catch {
      // Haptics are progressive enhancement and must never block the main action.
    }
  }, [enabled])

  const value = useMemo<AppHapticsContextValue>(() => ({
    enabled,
    ready,
    setEnabled,
    success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
    selection: () => run(() => Haptics.selectionAsync()),
    impact: (style = Haptics.ImpactFeedbackStyle.Medium) => run(() => Haptics.impactAsync(style)),
  }), [enabled, ready, run, setEnabled])

  return (
    <AppHapticsContext.Provider value={value}>
      {children}
    </AppHapticsContext.Provider>
  )
}

export function useAppHaptics() {
  const context = useContext(AppHapticsContext)
  if (!context) {
    throw new Error('useAppHaptics must be used inside AppHapticsProvider')
  }
  return context
}
