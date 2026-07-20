import AsyncStorage from '@react-native-async-storage/async-storage'
import { getLocales } from 'expo-localization'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

export type AppLocale = 'es-ES' | 'en-US'

type TranslationParams = Record<string, string | number>
type TranslationDictionary = Record<string, string>

type I18nContextValue = {
  locale: AppLocale
  ready: boolean
  setLocale: (locale: AppLocale) => Promise<void>
  t: (key: string, params?: TranslationParams) => string
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
}

const LOCALE_STORAGE_KEY = 'omniquest:locale'

const es: TranslationDictionary = {
  'common.back': 'Volver',
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.continue': 'Continuar',
  'common.loading': 'Cargando...',
  'common.next': 'Siguiente',
  'common.notifications': 'Notificaciones',
  'common.unreadNotifications': '{count} notificaciones sin leer',
  'common.openNotifications': 'Abre el centro de notificaciones',
  'common.previous': 'Anterior',
  'common.retry': 'Reintentar',
  'common.save': 'Guardar',
  'common.search': 'Buscar',
  'common.settings': 'Configuración',
  'root.preparing': 'Omni está preparando tu aventura...',
  'nav.student.home': 'Inicio',
  'nav.student.courses': 'Cursos',
  'nav.student.progress': 'Progreso',
  'nav.student.ranking': 'Ranking',
  'nav.student.profile': 'Perfil',
  'nav.teacher.home': 'Inicio',
  'nav.teacher.courses': 'Cursos',
  'nav.teacher.students': 'Alumnos',
  'nav.teacher.audit': 'Auditoría',
  'nav.teacher.profile': 'Perfil',
  'nav.admin.home': 'Inicio',
  'nav.admin.teachers': 'Profesores',
  'nav.admin.students': 'Alumnos',
  'nav.admin.courses': 'Cursos',
  'nav.admin.classrooms': 'Clases',
  'nav.admin.audit': 'Auditoría',
  'settings.title': 'Configuración',
  'settings.subtitle.student': 'Personaliza tu experiencia y controla tu cuenta de alumno.',
  'settings.subtitle.teacher': 'Personaliza tu experiencia y controla tu cuenta de profesor.',
  'settings.loading': 'Cargando configuración...',
  'settings.section.general': 'General',
  'settings.section.profile': 'Perfil',
  'settings.section.preferences': 'Idioma, región y apariencia',
  'settings.section.notifications': 'Notificaciones',
  'settings.section.privacy': 'Privacidad',
  'settings.section.data': 'Datos',
  'settings.section.security': 'Seguridad',
  'settings.section.about': 'Acerca de',
  'settings.appearance.title': 'Apariencia',
  'settings.appearance.description': 'Elige un tema o usa el aspecto configurado en tu dispositivo.',
  'settings.appearance.system': 'Sistema',
  'settings.appearance.dark': 'Oscuro',
  'settings.appearance.light': 'Claro',
  'settings.language.spanish': '🇪🇸 Español',
  'settings.language.english': '🇺🇸 English',
  'settings.notifications.push.title': 'Notificaciones push',
  'settings.notifications.push.enabled': 'Este dispositivo recibirá avisos importantes de OmniQuest.',
  'settings.notifications.push.disabled': 'Activa los avisos y concede permiso para registrar este dispositivo.',
  'settings.notifications.push.unsupported': 'Las notificaciones push requieren una compilación de desarrollo o producción.',
  'settings.notifications.saved': 'Preferencias guardadas',
  'settings.notifications.description': 'Los canales activos se aplican al crear y enviar nuevas notificaciones.',
  'offline.banner': 'Sin conexión. Tu partida queda guardada en este dispositivo.',
  'offline.pending': 'La respuesta está pendiente de sincronizar.',
  'offline.resumed': 'Partida recuperada',
  'offline.resumed.detail': 'Continuamos desde la última pregunta guardada.',
  'pagination.page': 'Página {page} de {pages}',
  'pagination.range': '{from}-{to} de {total}',
}

const en: TranslationDictionary = {
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.continue': 'Continue',
  'common.loading': 'Loading...',
  'common.next': 'Next',
  'common.notifications': 'Notifications',
  'common.unreadNotifications': '{count} unread notifications',
  'common.openNotifications': 'Opens the notification center',
  'common.previous': 'Previous',
  'common.retry': 'Retry',
  'common.save': 'Save',
  'common.search': 'Search',
  'common.settings': 'Settings',
  'root.preparing': 'Omni is preparing your adventure...',
  'nav.student.home': 'Home',
  'nav.student.courses': 'Courses',
  'nav.student.progress': 'Progress',
  'nav.student.ranking': 'Ranking',
  'nav.student.profile': 'Profile',
  'nav.teacher.home': 'Home',
  'nav.teacher.courses': 'Courses',
  'nav.teacher.students': 'Students',
  'nav.teacher.audit': 'Audit',
  'nav.teacher.profile': 'Profile',
  'nav.admin.home': 'Home',
  'nav.admin.teachers': 'Teachers',
  'nav.admin.students': 'Students',
  'nav.admin.courses': 'Courses',
  'nav.admin.classrooms': 'Classes',
  'nav.admin.audit': 'Audit',
  'settings.title': 'Settings',
  'settings.subtitle.student': 'Personalize your experience and manage your student account.',
  'settings.subtitle.teacher': 'Personalize your experience and manage your teacher account.',
  'settings.loading': 'Loading settings...',
  'settings.section.general': 'General',
  'settings.section.profile': 'Profile',
  'settings.section.preferences': 'Language, region and appearance',
  'settings.section.notifications': 'Notifications',
  'settings.section.privacy': 'Privacy',
  'settings.section.data': 'Data',
  'settings.section.security': 'Security',
  'settings.section.about': 'About',
  'settings.appearance.title': 'Appearance',
  'settings.appearance.description': 'Choose a theme or follow your device appearance.',
  'settings.appearance.system': 'System',
  'settings.appearance.dark': 'Dark',
  'settings.appearance.light': 'Light',
  'settings.language.spanish': '🇪🇸 Español',
  'settings.language.english': '🇺🇸 English',
  'settings.notifications.push.title': 'Push notifications',
  'settings.notifications.push.enabled': 'This device will receive important OmniQuest alerts.',
  'settings.notifications.push.disabled': 'Enable alerts and grant permission to register this device.',
  'settings.notifications.push.unsupported': 'Push notifications require a development or production build.',
  'settings.notifications.saved': 'Saved preferences',
  'settings.notifications.description': 'Enabled channels are applied when new notifications are created and sent.',
  'offline.banner': 'You are offline. Your game is saved on this device.',
  'offline.pending': 'This answer is waiting to sync.',
  'offline.resumed': 'Game restored',
  'offline.resumed.detail': 'Continuing from your last saved question.',
  'pagination.page': 'Page {page} of {pages}',
  'pagination.range': '{from}-{to} of {total}',
}

const dictionaries: Record<AppLocale, TranslationDictionary> = {
  'es-ES': es,
  'en-US': en,
}

const I18nContext = createContext<I18nContextValue | null>(null)

function normalizeLocale(value: string | null | undefined): AppLocale {
  return String(value || '').toLowerCase().startsWith('en') ? 'en-US' : 'es-ES'
}

function webStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

async function readLocale(): Promise<AppLocale> {
  const saved = Platform.OS === 'web'
    ? webStorage()?.getItem(LOCALE_STORAGE_KEY)
    : await AsyncStorage.getItem(LOCALE_STORAGE_KEY)

  if (saved) return normalizeLocale(saved)
  return normalizeLocale(getLocales()[0]?.languageTag)
}

async function persistLocale(locale: AppLocale) {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(LOCALE_STORAGE_KEY, locale)
    return
  }
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale)
}

function interpolate(template: string, params?: TranslationParams) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(params[key] ?? `{${key}}`))
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('es-ES')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    void readLocale()
      .then((nextLocale) => {
        if (mounted) setLocaleState(nextLocale)
      })
      .catch(() => {
        if (mounted) setLocaleState('es-ES')
      })
      .finally(() => {
        if (mounted) setReady(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = locale.split('-')[0]
    }
  }, [locale])

  const setLocale = useCallback(async (nextLocale: AppLocale) => {
    setLocaleState(nextLocale)
    await persistLocale(nextLocale)
  }, [])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    ready,
    setLocale,
    t: (key, params) => interpolate(dictionaries[locale][key] ?? dictionaries['es-ES'][key] ?? key, params),
    formatDate: (input, options) => new Intl.DateTimeFormat(locale, options).format(new Date(input)),
    formatNumber: (input, options) => new Intl.NumberFormat(locale, options).format(input),
  }), [locale, ready, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
