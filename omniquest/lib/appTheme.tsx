import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SystemUI from 'expo-system-ui'
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Platform, useColorScheme } from 'react-native'
import { createDesignColorTokens, type DesignColorTokens } from './designTokens'

export type AppThemeMode = 'dark' | 'light'
export type AppThemePreference = AppThemeMode | 'system'

export type AppThemeColors = {
  background: string
  backgroundAlt: string
  surface: string
  surfaceRaised: string
  surfaceMuted: string
  border: string
  borderStrong: string
  text: string
  textSecondary: string
  textMuted: string
  navigation: string
  danger: string
  success: string
  warning: string
}

type AppThemeContextValue = {
  theme: AppThemeMode
  themePreference: AppThemePreference
  colors: AppThemeColors
  tokens?: DesignColorTokens
  accentColor: string
  setTheme: (nextTheme: AppThemePreference) => void
  setAccentColor: (nextAccent: string) => void
  ready: boolean
}

const APP_THEME_STORAGE_KEY = 'omniquest:theme'
const APP_ACCENT_STORAGE_KEY = 'omniquest:accent'
const DEFAULT_THEME: AppThemePreference = 'system'
const DEFAULT_ACCENT = '#7C5CFF'

function createLegacyThemeColors(tokens: DesignColorTokens): AppThemeColors {
  return {
    background: tokens.background.primary,
    backgroundAlt: tokens.background.secondary,
    surface: tokens.surface.default,
    surfaceRaised: tokens.surface.raised,
    surfaceMuted: tokens.surface.interactive,
    border: tokens.border.default,
    borderStrong: tokens.border.active,
    text: tokens.text.primary,
    textSecondary: tokens.text.secondary,
    textMuted: tokens.text.muted,
    navigation: tokens.background.secondary,
    danger: tokens.semantic.danger,
    success: tokens.semantic.success,
    warning: tokens.semantic.warning,
  }
}

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined)

function getWebStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

async function readStorageItem(key: string) {
  if (Platform.OS === 'web') return getWebStorage()?.getItem(key) ?? null
  return AsyncStorage.getItem(key)
}

async function writeStorageItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    getWebStorage()?.setItem(key, value)
    return
  }
  await AsyncStorage.setItem(key, value)
}

function isThemePreference(value: string | null): value is AppThemePreference {
  return value === 'dark' || value === 'light' || value === 'system'
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useColorScheme()
  const [themePreference, setThemePreference] = useState<AppThemePreference>(DEFAULT_THEME)
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT)
  const [ready, setReady] = useState(false)
  const theme: AppThemeMode = themePreference === 'system'
    ? systemTheme === 'light' ? 'light' : 'dark'
    : themePreference
  const tokens = useMemo(() => createDesignColorTokens(theme, accentColor), [accentColor, theme])
  const colors = useMemo(() => createLegacyThemeColors(tokens), [tokens])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [savedTheme, savedAccent] = await Promise.all([
          readStorageItem(APP_THEME_STORAGE_KEY),
          readStorageItem(APP_ACCENT_STORAGE_KEY),
        ])
        if (!mounted) return
        if (isThemePreference(savedTheme)) setThemePreference(savedTheme)
        if (savedAccent && /^#([0-9A-F]{3}){1,2}$/i.test(savedAccent)) setAccentColorState(savedAccent)
      } catch {
        // Keep the device defaults when storage is temporarily unavailable.
      } finally {
        if (mounted) setReady(true)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = theme
      document.documentElement.dataset.theme = theme
      document.documentElement.style.setProperty('--omni-border-active', accentColor)
    }
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined)
  }, [accentColor, colors.background, theme])

  const setTheme = (nextTheme: AppThemePreference) => {
    setThemePreference(nextTheme)
    void writeStorageItem(APP_THEME_STORAGE_KEY, nextTheme)
  }

  const setAccentColor = (nextAccent: string) => {
    if (!/^#([0-9A-F]{3}){1,2}$/i.test(nextAccent)) return
    setAccentColorState(nextAccent)
    void writeStorageItem(APP_ACCENT_STORAGE_KEY, nextAccent)
  }

  const value = useMemo(() => ({
    theme,
    themePreference,
    colors,
    tokens,
    accentColor,
    setTheme,
    setAccentColor,
    ready,
  }), [theme, themePreference, colors, tokens, accentColor, ready])

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
}

export type ResolvedAppThemeContextValue = Omit<AppThemeContextValue, 'tokens'> & {
  tokens: DesignColorTokens
}

export function useAppTheme(): ResolvedAppThemeContextValue {
  const context = useContext(AppThemeContext)
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider')

  // Fast Refresh or a partial file copy can temporarily leave mounted consumers
  // with the legacy context shape, which did not include `tokens`. Resolve the
  // canonical palette here so every consumer always receives a complete theme.
  const tokens = context.tokens ?? createDesignColorTokens(context.theme, context.accentColor)

  if (context.tokens) {
    return context as ResolvedAppThemeContextValue
  }

  return {
    ...context,
    tokens,
  }
}
