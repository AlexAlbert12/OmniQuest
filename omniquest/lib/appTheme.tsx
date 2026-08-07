import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SystemUI from 'expo-system-ui'
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Platform, StyleSheet, View, useColorScheme } from 'react-native'
import { vars } from 'nativewind'
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
  const nativeWindVariables = useMemo(() => vars({
    '--omni-background-primary': tokens.background.primary,
    '--omni-background-secondary': tokens.background.secondary,
    '--omni-background-overlay': tokens.background.overlay,
    '--omni-surface-default': tokens.surface.default,
    '--omni-surface-raised': tokens.surface.raised,
    '--omni-surface-interactive': tokens.surface.interactive,
    '--omni-surface-selected': tokens.surface.selected,
    '--omni-surface-disabled': tokens.surface.disabled,
    '--omni-border-default': tokens.border.default,
    '--omni-border-subtle': tokens.border.subtle,
    '--omni-border-active': tokens.border.active,
    '--omni-text-primary': tokens.text.primary,
    '--omni-text-secondary': tokens.text.secondary,
    '--omni-text-muted': tokens.text.muted,
    '--omni-text-inverse': tokens.text.inverse,
    '--omni-text-on-accent': tokens.text.onAccent,
    '--omni-text-disabled': tokens.text.disabled,
    '--omni-brand-student': tokens.brand.student,
    '--omni-brand-teacher': tokens.brand.teacher,
    '--omni-brand-admin': tokens.brand.admin,
    '--omni-semantic-success': tokens.semantic.success,
    '--omni-semantic-warning': tokens.semantic.warning,
    '--omni-semantic-danger': tokens.semantic.danger,
    '--omni-semantic-info': tokens.semantic.info,
    '--omni-semantic-surface-success': tokens.semanticSurface.success,
    '--omni-semantic-surface-warning': tokens.semanticSurface.warning,
    '--omni-semantic-surface-danger': tokens.semanticSurface.danger,
    '--omni-semantic-surface-info': tokens.semanticSurface.info,
    '--omni-gamification-xp': tokens.gamification.xp,
    '--omni-gamification-streak': tokens.gamification.streak,
    '--omni-gamification-badge': tokens.gamification.badge,
    '--omni-rank-bronze': tokens.gamification.rank.bronze,
    '--omni-rank-silver': tokens.gamification.rank.silver,
    '--omni-rank-gold': tokens.gamification.rank.gold,
    '--omni-rank-platinum': tokens.gamification.rank.platinum,
    '--omni-rank-diamond': tokens.gamification.rank.diamond,
  }), [tokens])

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

  return (
    <AppThemeContext.Provider value={value}>
      <View style={[styles.themeRoot, nativeWindVariables]}>{children}</View>
    </AppThemeContext.Provider>
  )
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

const styles = StyleSheet.create({
  themeRoot: {
    flex: 1,
    minWidth: 0,
  },
})
