import OmniLoadingScreen from '../../components/ui/OmniLoadingScreen'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ScrollView,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import AppConfirmModal from '../../components/AppConfirmModal'
import StudentSidebar from '../../components/student/StudentSidebar'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import RolePageHeader from '../../components/ui/RolePageHeader'
import AppBackButton from '../../components/ui/AppBackButton'
import AppButton from '../../components/ui/AppButton'
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
import { useI18n } from '../../lib/i18n'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { useResponsiveLayout } from '../../lib/responsive'

type AppHref = Href
type SettingsSectionDefinition = { key: SettingsMenuSectionKey; labelKey: string; mobileLabelKey?: string; icon: IconName; anchor: SettingsAnchorKey }

const ROUTES = {
  studentHelpCenter: '/(student)/help-center' as AppHref,
  studentNotifications: '/(student)/notifications' as AppHref,
  studentSecurity: '/(student)/security' as AppHref,
  teacherHelpCenter: '/(teacher)/help-center' as AppHref,
  teacherNotifications: '/(teacher)/notifications' as AppHref,
  teacherSecurity: '/(teacher)/security' as AppHref,
  studentSettings: '/(student)/settings' as AppHref,
  teacherSettings: '/(teacher)/settings' as AppHref,
}

const studentSettingsSectionDefinitions: SettingsSectionDefinition[] = [
  { key: 'general', labelKey: 'settings.section.general', icon: 'settings-outline', anchor: 'general' },
  { key: 'profile', labelKey: 'settings.section.profile', icon: 'person-outline', anchor: 'profile' },
  { key: 'preferences', labelKey: 'settings.section.preferences.short', mobileLabelKey: 'settings.section.preferences.mobile', icon: 'globe-outline', anchor: 'preferences' },
  { key: 'notifications', labelKey: 'settings.section.notifications', mobileLabelKey: 'settings.section.notifications.mobile', icon: 'notifications-outline', anchor: 'notifications' },
  { key: 'privacy', labelKey: 'settings.section.privacy', icon: 'shield-checkmark-outline', anchor: 'privacy' },
  { key: 'data', labelKey: 'settings.section.data', icon: 'server-outline', anchor: 'data' },
  { key: 'security', labelKey: 'settings.section.security', icon: 'lock-closed-outline', anchor: 'security' },
  { key: 'about', labelKey: 'settings.section.about', icon: 'information-circle-outline', anchor: 'about' },
]

const teacherSettingsSectionDefinitions: SettingsSectionDefinition[] = [
  { key: 'personal', labelKey: 'settings.section.personal', icon: 'person-circle-outline', anchor: 'personal' },
  { key: 'teaching', labelKey: 'settings.section.teaching', icon: 'school-outline', anchor: 'teaching' },
  { key: 'privacy', labelKey: 'settings.section.privacy', icon: 'shield-checkmark-outline', anchor: 'privacy' },
  { key: 'data', labelKey: 'settings.section.data', icon: 'server-outline', anchor: 'data' },
  { key: 'about', labelKey: 'settings.section.about', icon: 'help-circle-outline', anchor: 'about' },
]

function roleRoute(isTeacher: boolean, teacherRoute: AppHref, studentRoute: AppHref) {
  return isTeacher ? teacherRoute : studentRoute
}

export function UnifiedSettingsScreen({ forcedRole, securityOnly = false }: { forcedRole?: AppRole; securityOnly?: boolean }) {
  const responsive = useResponsiveLayout()
  const { width } = responsive
  const router = useRouter()
  const { section } = useLocalSearchParams<{ section?: string }>()
  const { colors, accentColor } = useAppTheme()
  const { t } = useI18n()
  const scrollRef = useRef<ScrollView | null>(null)
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsMenuSectionKey>('general')
  const data = useSettingsData({ forcedRole })

  const isDesktop = responsive.isDesktop
  const settingsSections = useMemo(
    () => (data.isTeacher ? teacherSettingsSectionDefinitions : studentSettingsSectionDefinitions)
      .map((item) => ({ ...item, label: t(responsive.isMobile && item.mobileLabelKey ? item.mobileLabelKey : item.labelKey) })),
    [data.isTeacher, responsive.isMobile, t]
  )
  const isLargeDesktop = responsive.isWide
  const isMediumSettings = !responsive.isMobile
  const settingsMenuVariant: SettingsMenuVariant = isLargeDesktop ? 'side' : isMediumSettings ? 'tabs' : 'chips'
  const settingsHorizontalPadding = isDesktop ? 28 : 16
  const RoleSections = data.isTeacher ? TeacherSettingsSections : StudentSettingsSections

  useEffect(() => {
    if (data.isTeacher && activeSettingsSection === 'general') {
      setActiveSettingsSection('personal')
      return
    }
    if (!settingsSections.some((item) => item.key === activeSettingsSection)) {
      setActiveSettingsSection(data.isTeacher ? 'personal' : 'general')
    }
  }, [activeSettingsSection, data.isTeacher, settingsSections])

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

  const backToSettings = () => {
    router.replace(roleRoute(data.isTeacher, ROUTES.teacherSettings, ROUTES.studentSettings))
  }

  if (data.loading) return <OmniLoadingScreen />

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: colors.background }}>
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
            {securityOnly ? (
              <AppBackButton
                accessibilityLabel={t('settings.back')}
                label={t('settings.back')}
                onPress={backToSettings}
                size="sm"
                style={{ marginBottom: 12 }}
              />
            ) : null}

            <RolePageHeader
              role={data.isTeacher ? 'teacher' : 'student'}
              icon={securityOnly ? 'lock-closed' : 'settings'}
              isDesktop={isDesktop}
              title={securityOnly ? t('settings.section.security') : t('settings.title')}
              notificationOnPress={() => router.push(roleRoute(data.isTeacher, ROUTES.teacherNotifications, ROUTES.studentNotifications))}
              className="mb-4"
            />

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
                  onOpenHelpCenter={openHelpCenter}
                  onOpenSecurity={openSecurity}
                  onSelectSection={setActiveSettingsSection}
                  securityOnly={securityOnly}
                  width={width}
                />
                {!securityOnly && !isDesktop && data.isTeacher ? (
                  <View className="rounded-2xl border border-border-default bg-surface-default p-4">
                    <AppButton
                      label={t('settings.signOut')}
                      icon="log-out-outline"
                      role="teacher"
                      variant="danger"
                      fullWidth
                      onPress={data.handleSignOut}
                    />
                  </View>
                ) : null}
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
      {securityOnly && !isDesktop && !data.isTeacher ? <StudentBottomNav active="security" /> : null}
      {securityOnly && !isDesktop && data.isTeacher ? <TeacherBottomNav active="settings" /> : null}
    </SafeAreaView>
  )
}

export default function StudentSettingsScreen() {
  return <UnifiedSettingsScreen />
}
