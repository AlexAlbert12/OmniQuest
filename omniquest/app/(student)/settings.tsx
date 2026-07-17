import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AppConfirmModal from '../../components/AppConfirmModal'
import StudentSidebar from '../../components/student/StudentSidebar'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherHeaderAvatar from '../../components/teacher/TeacherHeaderAvatar'
import NotificationBadge from '../../components/NotificationBadge'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import { DestructiveConfirmModal } from '../../components/settings/SettingsDangerZone'
import { SettingsMenu } from '../../components/settings/SettingsUi'
import StudentSettingsSections from '../../components/settings/StudentSettingsSections'
import TeacherSettingsSections from '../../components/settings/TeacherSettingsSections'
import type {
  AppRole,
  IconName,
  SettingsAnchorKey,
  SettingsMenuSectionKey,
  SettingsMenuVariant,
} from '../../components/settings/SettingsTypes'
import { useSettingsData } from '../../hooks/useSettingsData'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'

type AppHref = Href

const ROUTES = {
  studentHelpCenter: '/(student)/help-center' as AppHref,
  studentNotifications: '/(student)/notifications' as AppHref,
  studentSecurity: '/(student)/security' as AppHref,
  teacherHelpCenter: '/(teacher)/help-center' as AppHref,
  teacherNotifications: '/(teacher)/notifications' as AppHref,
  teacherSecurity: '/(teacher)/security' as AppHref,
}

const studentSettingsSections: { key: SettingsMenuSectionKey; label: string; icon: IconName; anchor: SettingsAnchorKey }[] = [
  { key: 'general', label: 'General', icon: 'settings-outline', anchor: 'general' },
  { key: 'profile', label: 'Perfil', icon: 'person-outline', anchor: 'profile' },
  { key: 'preferences', label: 'Idioma y región', icon: 'globe-outline', anchor: 'preferences' },
  { key: 'notifications', label: 'Notificaciones', icon: 'notifications-outline', anchor: 'notifications' },
  { key: 'privacy', label: 'Privacidad', icon: 'shield-checkmark-outline', anchor: 'privacy' },
  { key: 'data', label: 'Datos', icon: 'server-outline', anchor: 'data' },
  { key: 'security', label: 'Seguridad', icon: 'lock-closed-outline', anchor: 'security' },
  { key: 'about', label: 'Acerca de', icon: 'information-circle-outline', anchor: 'about' },
]

const teacherSettingsSections = [...studentSettingsSections]

function roleRoute(isTeacher: boolean, teacherRoute: AppHref, studentRoute: AppHref) {
  return isTeacher ? teacherRoute : studentRoute
}

export function UnifiedSettingsScreen({ forcedRole, securityOnly = false }: { forcedRole?: AppRole; securityOnly?: boolean }) {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const { section } = useLocalSearchParams<{ section?: string }>()
  const { theme, accentColor, setAccentColor } = useAppTheme()
  const scrollRef = useRef<ScrollView | null>(null)
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsMenuSectionKey>('general')
  const data = useSettingsData({ forcedRole })

  const isDesktop = width >= 1080
  const isDark = theme === 'dark'
  const settingsSections = data.isTeacher ? teacherSettingsSections : studentSettingsSections
  const isLargeDesktop = width >= 1280
  const isMediumSettings = width >= 760
  const settingsMenuVariant: SettingsMenuVariant = isLargeDesktop ? 'side' : isMediumSettings ? 'tabs' : 'chips'
  const settingsHorizontalPadding = isDesktop ? 28 : 16
  const RoleSections = data.isTeacher ? TeacherSettingsSections : StudentSettingsSections

  useEffect(() => {
    if (!settingsSections.some((item) => item.key === activeSettingsSection)) {
      setActiveSettingsSection('general')
    }
  }, [activeSettingsSection, settingsSections])

  useEffect(() => {
    if (!section) return

    const exists = settingsSections.some((item) => item.key === section)
    if (exists) {
      setActiveSettingsSection(section as SettingsMenuSectionKey)
    }
  }, [section, settingsSections])

  const handleMenuSectionPress = (menuSection: { key: SettingsMenuSectionKey; anchor: SettingsAnchorKey }) => {
    setActiveSettingsSection(menuSection.key)
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }

  const openSecurity = () => {
    router.push(roleRoute(data.isTeacher, ROUTES.teacherSecurity, ROUTES.studentSecurity))
  }

  const openHelpCenter = () => {
    router.push(roleRoute(data.isTeacher, ROUTES.teacherHelpCenter, ROUTES.studentHelpCenter))
  }

  if (data.loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: isDark ? '#061126' : '#0F2442' }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando configuración...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#061126' : '#0F2442' }}>
      <View className="flex-1 flex-row">
        {isDesktop ? (
          data.isTeacher ? (
            <TeacherSidebar
              activeSection="settings"
              subjectsCount={data.subjectsCount}
              onSignOut={data.handleSignOut}
              alias={data.alias}
              avatar={data.profile?.avatar}
            />
          ) : (
            <StudentSidebar
              activeSection="settings"
              alias={data.alias}
              avatar={data.profile?.avatar}
              level={data.level}
              points={data.points}
              nextLevelProgress={data.nextLevelProgress}
              onSignOut={data.handleSignOut}
            />
          )
        ) : null}

        <View className="flex-1">
          <View
            style={{
              paddingHorizontal: settingsHorizontalPadding,
              paddingTop: isDesktop ? 24 : 18,
            }}
          >
            <View className="mb-4 flex-row flex-wrap items-start justify-between gap-4">
              <View className="min-w-[260px] flex-1">

                <View className="flex-row items-center gap-3">
                  <Ionicons name={securityOnly ? 'lock-closed' : 'settings'} size={40} color="#9FD6FF" />
                  <Text className={`${isDesktop ? 'text-[40px]' : 'text-[32px]'} flex-shrink font-black text-white`} numberOfLines={1}>
                    {securityOnly ? 'Seguridad' : 'Configuración'}
                  </Text>
                </View>

                <Text className="mt-2 text-[13px] text-[#B7C4D7]">
                  {securityOnly
                    ? 'Gestiona acceso, contraseña y acciones críticas de tu cuenta.'
                    : `Personaliza tu experiencia y controla tu cuenta de ${data.isTeacher ? 'profesor' : 'alumno'}.`}
                </Text>
              </View>

              <View className="flex-row items-center gap-3">
                <NotificationBadge
                  audience={data.isTeacher ? 'teacher' : 'student'}
                  onPress={() => router.push(roleRoute(data.isTeacher, ROUTES.teacherNotifications, ROUTES.studentNotifications))}
                />
                {data.isTeacher ? <TeacherHeaderAvatar /> : null}
                {!data.isTeacher ? <StudentHeaderAvatar /> : null}
              </View>
            </View>

            {!securityOnly && settingsMenuVariant !== 'side' ? (
              <SettingsMenu
                variant={settingsMenuVariant}
                onSignOut={data.handleSignOut}
                activeSection={activeSettingsSection}
                onSectionPress={handleMenuSectionPress}
                sections={settingsSections}
              />
            ) : null}
          </View>

          <View
            className={settingsMenuVariant === 'side' ? 'flex-1 flex-row gap-5' : 'flex-1'}
            style={{
              paddingHorizontal: settingsHorizontalPadding,
              paddingTop: 16,
            }}
          >
            {!securityOnly && settingsMenuVariant === 'side' ? (
              <SettingsMenu
                variant="side"
                onSignOut={data.handleSignOut}
                activeSection={activeSettingsSection}
                onSectionPress={handleMenuSectionPress}
                sections={settingsSections}
              />
            ) : null}

            <ScrollView
              ref={scrollRef}
              className="flex-1"
              contentContainerStyle={{ paddingBottom: isDesktop ? 96 : MOBILE_BOTTOM_NAV_SPACER + 8 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-5">
                <RoleSections
                  activeSettingsSection={activeSettingsSection}
                  accentColor={accentColor}
                  data={data}
                  isDesktop={isDesktop}
                  onAccentColorChange={setAccentColor}
                  onOpenHelpCenter={openHelpCenter}
                  onOpenSecurity={openSecurity}
                  onSelectSection={setActiveSettingsSection}
                  securityOnly={securityOnly}
                  width={width}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      <DestructiveConfirmModal
        visible={Boolean(data.pendingDestructiveAction)}
        action={data.pendingDestructiveAction}
        isTeacher={data.isTeacher}
        value={data.destructiveConfirmationText}
        busy={data.deletingData || data.deletingAccount}
        onChangeText={data.setDestructiveConfirmationText}
        onCancel={data.closeDestructiveConfirmation}
        onConfirm={() => void data.confirmDestructiveAction()}
      />
      <AppConfirmModal
        visible={data.showSignOutConfirm}
        variant="warning"
        title="¿Cerrar sesión?"
        message="Saldrás de tu cuenta en este dispositivo. Podrás volver a entrar con tu correo y contraseña."
        cancelLabel="Cancelar"
        confirmLabel="Cerrar sesión"
        onCancel={() => data.setShowSignOutConfirm(false)}
        onConfirm={() => {
          data.setShowSignOutConfirm(false)
          void data.executeSignOut()
        }}
      />

      {!securityOnly && !isDesktop && !data.isTeacher ? <StudentBottomNav active="settings" /> : null}
      {!securityOnly && !isDesktop && data.isTeacher ? <TeacherBottomNav active="settings" /> : null}
      {securityOnly && !isDesktop && data.isTeacher ? <TeacherBottomNav active="settings" /> : null}
    </View>
  )
}

export default function StudentSettingsScreen() {
  return <UnifiedSettingsScreen />
}
