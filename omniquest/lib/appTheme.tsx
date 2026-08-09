import * as SystemUI from 'expo-system-ui'
import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { vars } from 'nativewind'
import { createDesignColorTokens, type DesignColorTokens } from './designTokens'

export type AppThemeMode = 'dark'
export type AppThemePreference = 'dark'

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

export const OFFICIAL_ACCENT_COLOR = '#09acf4'
export const OFFICIAL_THEME: AppThemeMode = 'dark'

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

function keepOfficialTheme(_nextTheme: AppThemePreference) {
  // OmniQuest ships with a single official dark visual theme.
}

function keepStructuralAccent(_nextAccent: string) {
  // OmniQuest keeps the structural accent fixed to the product cyan.
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = OFFICIAL_THEME
  const themePreference = OFFICIAL_THEME
  const accentColor = OFFICIAL_ACCENT_COLOR
  const tokens = useMemo(() => createDesignColorTokens(theme, accentColor), [theme, accentColor])
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
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = OFFICIAL_THEME
      document.documentElement.dataset.theme = OFFICIAL_THEME
      document.documentElement.style.setProperty('--omni-border-active', accentColor)
    }
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined)
  }, [accentColor, colors.background])

  const value = useMemo(() => ({
    theme,
    themePreference,
    colors,
    tokens,
    accentColor,
    setTheme: keepOfficialTheme,
    setAccentColor: keepStructuralAccent,
    ready: true,
  }), [theme, themePreference, colors, tokens, accentColor])

  return (
    <AppThemeContext.Provider value={value}>
      <View style={[styles.themeRoot, nativeWindVariables]}>{children}</View>
    </AppThemeContext.Provider>
  )
}

export type ResolvedAppThemeContextValue = Omit<AppThemeContextValue, 'tokens'> & { tokens: DesignColorTokens }

export function useAppTheme(): ResolvedAppThemeContextValue {
  const context = useContext(AppThemeContext)
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider')
  const tokens = context.tokens ?? createDesignColorTokens(context.theme, context.accentColor)
  return context.tokens ? context as ResolvedAppThemeContextValue : { ...context, tokens }
}

const styles = StyleSheet.create({ themeRoot: { flex: 1, minWidth: 0 } })
