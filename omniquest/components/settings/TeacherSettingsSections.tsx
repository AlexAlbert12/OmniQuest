import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Text, View } from 'react-native'
import type { useSettingsData } from '../../hooks/useSettingsData'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import TeacherDeliveryPreferencesPanel from './TeacherDeliveryPreferencesPanel'
import {
  SettingsAboutPanel,
  SettingsDataPanel,
  SettingsPreferencesPanel,
  SettingsPrivacyPanel,
  SettingsProfilePanel,
  SettingsSecurityPanel,
} from './SettingsSections'
import type { SettingsMenuSectionKey } from './SettingsTypes'

type SettingsData = ReturnType<typeof useSettingsData>

type TeacherSettingsSectionsProps = {
  activeSettingsSection: SettingsMenuSectionKey
  accentColor: string
  data: SettingsData
  isDesktop: boolean
  onOpenHelpCenter: () => void
  onOpenSecurity: () => void
  onSelectSection: (section: SettingsMenuSectionKey) => void
  securityOnly: boolean
  width: number
}

export default function TeacherSettingsSections({
  activeSettingsSection,
  accentColor,
  data,
  onOpenHelpCenter,
  onOpenSecurity,
  securityOnly,
  width,
}: TeacherSettingsSectionsProps) {
  const { t } = useI18n()
  return (
    <>
      {!securityOnly && activeSettingsSection === 'personal' ? (
        <>
          <SettingsSectionIntro icon="person-circle-outline" title="Ajustes personales" description={t('settings.teacher.personal.description')} />
          <SettingsProfilePanel
            isTeacher
            width={width}
            userInitials={data.userInitials}
            avatar={data.profile?.avatar}
            saving={data.saving}
            accentColor={accentColor}
            name={data.name}
            email={data.email}
            onNameChange={data.setName}
            onSaveProfile={data.handleSaveProfile}
            onOpenSecurity={onOpenSecurity}
          />
          <SettingsPreferencesPanel
            accentColor={accentColor}
            preferences={data.preferences}
            openPreferenceKey={data.openPreferenceKey}
            preferenceOptions={data.preferenceOptions}
            savingPreference={data.savingPreference}
            savingHaptics={data.savingHaptics}
            hideTimezone
            onTogglePreferenceMenu={data.togglePreferenceMenu}
            onSelectPreference={(key, value) => void data.selectPreference(key, value)}
            onToggleHaptics={(enabled) => void data.updateHapticsEnabled(enabled)}
            formatPreferenceLabel={data.formatPreferenceLabel}
          />
        </>
      ) : null}

      {!securityOnly && activeSettingsSection === 'teaching' ? (
        <>
          <SettingsSectionIntro icon="school-outline" title="Preferencias docentes" description={t('settings.teacher.teaching.description')} />
          <TeacherDeliveryPreferencesPanel dateFormat={data.preferences.dateFormat} timeFormat={data.preferences.timeFormat} weekStart={data.preferences.weekStart} />
        </>
      ) : null}

      {!securityOnly && activeSettingsSection === 'privacy' ? (
        <>
          <TeacherPrivacyNotice />
          <SettingsPrivacyPanel
            isTeacher
            profileVisibility={data.profileVisibility}
            profileVisibilityAvailable={data.profileVisibilityAvailable}
            analyticsEnabled={data.preferences.analyticsEnabled}
            savingAnalytics={data.savingAnalytics}
            accentColor={accentColor}
            onProfileVisibilityChange={data.handleProfileVisibilityChange}
            onAnalyticsEnabledChange={(enabled) => void data.updateAnalyticsEnabled(enabled)}
            onShowPrivacyCenter={data.showPrivacyCenter}
          />
        </>
      ) : null}

      {!securityOnly && activeSettingsSection === 'data' ? (
        <>
          <TeacherDataNotice />
          <SettingsDataPanel isTeacher deletingData={data.deletingData} deletingAccount={data.deletingAccount} onRequestDeletion={data.handleDeleteAccount} onDeletePartialData={data.handleDeletePartialData} />
        </>
      ) : null}

      {securityOnly ? (
        <SettingsSecurityPanel
          securityOnly
          accentColor={accentColor}
          currentPassword={data.currentPassword}
          newPassword={data.newPassword}
          confirmPassword={data.confirmPassword}
          showCurrentPassword={data.showCurrentPassword}
          showNewPassword={data.showNewPassword}
          showConfirmPassword={data.showConfirmPassword}
          changingPassword={data.changingPassword}
          passwordChecks={data.passwordChecks}
          email={data.email}
          emailConfirmedAt={data.emailConfirmedAt}
          lastSignInAt={data.lastSignInAt}
          onOpenSecurity={onOpenSecurity}
          onCurrentPasswordChange={data.setCurrentPassword}
          onNewPasswordChange={data.setNewPassword}
          onConfirmPasswordChange={data.setConfirmPassword}
          onToggleCurrentPassword={() => data.setShowCurrentPassword((value) => !value)}
          onToggleNewPassword={() => data.setShowNewPassword((value) => !value)}
          onToggleConfirmPassword={() => data.setShowConfirmPassword((value) => !value)}
          onChangePassword={data.handleChangePassword}
          onSignOut={data.handleSignOut}
        />
      ) : null}

      {!securityOnly && activeSettingsSection === 'about' ? <SettingsAboutPanel onOpenHelpCenter={onOpenHelpCenter} /> : null}
    </>
  )
}

function SettingsSectionIntro({ icon, title, description }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }) {
  const { tokens } = useAppTheme()
  return (
    <View className="flex-row items-start gap-3 rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
      <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: tokens.surface.interactive }}>
        <Ionicons name={icon} size={21} color={tokens.brand.teacher} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[16px] font-black" style={{ color: tokens.text.primary }}>{title}</Text>
        <Text className="mt-1 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>{description}</Text>
      </View>
    </View>
  )
}

function TeacherPrivacyNotice() {
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: tokens.semantic.info, backgroundColor: tokens.surface.raised }}>
      <Text className="font-black" style={{ color: tokens.text.primary }}>{t('settings.teacher.privacy.title')}</Text>
      <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>{t('settings.teacher.privacy.description')}</Text>
    </View>
  )
}

function TeacherDataNotice() {
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: tokens.semantic.warning, backgroundColor: tokens.surface.raised }}>
      <Text className="font-black" style={{ color: tokens.text.primary }}>{t('settings.teacher.data.title')}</Text>
      <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>{t('settings.teacher.data.description')}</Text>
    </View>
  )
}
