import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SystemUI from 'expo-system-ui'
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Platform, useColorScheme } from 'react-native'

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
  accentColor: string
  setTheme: (nextTheme: AppThemePreference) => void
  setAccentColor: (nextAccent: string) => void
  ready: boolean
}

const APP_THEME_STORAGE_KEY = 'omniquest:theme'
const APP_ACCENT_STORAGE_KEY = 'omniquest:accent'
const DEFAULT_THEME: AppThemePreference = 'system'
const DEFAULT_ACCENT = '#7C5CFF'

const DARK_COLORS: AppThemeColors = {
  background: '#061126',
  backgroundAlt: '#020B1B',
  surface: '#07162C',
  surfaceRaised: '#0D1D3B',
  surfaceMuted: '#10213E',
  border: '#1A3155',
  borderStrong: '#27456F',
  text: '#FFFFFF',
  textSecondary: '#C9D7EA',
  textMuted: '#8FA7C7',
  navigation: '#050E1F',
  danger: '#FB7185',
  success: '#43D991',
  warning: '#FBBF24',
}

const LIGHT_COLORS: AppThemeColors = {
  background: '#F4F7FF',
  backgroundAlt: '#EAF0FC',
  surface: '#FFFFFF',
  surfaceRaised: '#F8FAFF',
  surfaceMuted: '#E7EEFA',
  border: '#CCD8EA',
  borderStrong: '#AFC0D8',
  text: '#13233D',
  textSecondary: '#334A68',
  textMuted: '#657B98',
  navigation: '#FFFFFF',
  danger: '#C93855',
  success: '#178A5D',
  warning: '#A86600',
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
  const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS

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
    }
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined)
  }, [colors.background, theme])

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
    accentColor,
    setTheme,
    setAccentColor,
    ready,
  }), [theme, themePreference, colors, accentColor, ready])

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
}

export function useAppTheme() {
  const context = useContext(AppThemeContext)
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider')
  return context
}
