import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type AppThemeMode = 'dark' | 'light'

type AppThemeContextValue = {
  theme: AppThemeMode
  accentColor: string
  setTheme: (nextTheme: AppThemeMode) => void
  setAccentColor: (nextAccent: string) => void
  ready: boolean
}

const APP_THEME_STORAGE_KEY = 'omniquest:theme'
const APP_ACCENT_STORAGE_KEY = 'omniquest:accent'
const DEFAULT_THEME: AppThemeMode = 'dark'
const DEFAULT_ACCENT = '#7C5CFF'

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined)

function getWebStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

async function readStorageItem(key: string) {
  if (Platform.OS === 'web') {
    return getWebStorage()?.getItem(key) ?? null
  }
  return AsyncStorage.getItem(key)
}

async function writeStorageItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    getWebStorage()?.setItem(key, value)
    return
  }
  await AsyncStorage.setItem(key, value)
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppThemeMode>(DEFAULT_THEME)
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const [savedTheme, savedAccent] = await Promise.all([
          readStorageItem(APP_THEME_STORAGE_KEY),
          readStorageItem(APP_ACCENT_STORAGE_KEY),
        ])

        if (!mounted) return

        if (savedTheme === 'dark' || savedTheme === 'light') {
          setThemeState(savedTheme)
        }
        if (savedAccent && /^#([0-9A-F]{3}){1,2}$/i.test(savedAccent)) {
          setAccentColorState(savedAccent)
        }
      } finally {
        if (mounted) setReady(true)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return

    document.documentElement.dataset.omniquestTheme = theme
    document.documentElement.style.colorScheme = theme
    document.body.dataset.omniquestTheme = theme
  }, [theme])

  const setTheme = (nextTheme: AppThemeMode) => {
    setThemeState(nextTheme)
    void writeStorageItem(APP_THEME_STORAGE_KEY, nextTheme)
  }

  const setAccentColor = (nextAccent: string) => {
    setAccentColorState(nextAccent)
    void writeStorageItem(APP_ACCENT_STORAGE_KEY, nextAccent)
  }

  const value = useMemo(
    () => ({
      theme,
      accentColor,
      setTheme,
      setAccentColor,
      ready,
    }),
    [theme, accentColor, ready]
  )

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
}

export function useAppTheme() {
  const context = useContext(AppThemeContext)
  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider')
  }
  return context
}
