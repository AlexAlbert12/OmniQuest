import React from 'react'
import type { useSettingsData } from '../../hooks/useSettingsData'
import { useI18n } from '../../lib/i18n'
import {
  SettingsAboutPanel,
  SettingsDataPanel,
  SettingsGeneralPanel,
  SettingsNotificationsPanel,
  SettingsPreferencesPanel,
  SettingsPrivacyPanel,
  SettingsProfilePanel,
  SettingsSecurityPanel,
} from './SettingsSections'
import type { SettingsMenuSectionKey } from './SettingsTypes'

type SettingsData = ReturnType<typeof useSettingsData>

export type RoleSettingsSectionsProps = {
  activeSettingsSection: SettingsMenuSectionKey
  accentColor: string
  data: SettingsData
  isDesktop: boolean
  isTeacher: boolean
  onOpenHelpCenter: () => void
  onOpenSecurity: () => void
  onSelectSection: (section: SettingsMenuSectionKey) => void
  securityOnly: boolean
  width: number
}

export function RoleSettingsSections({
  activeSettingsSection,
  accentColor,
  data,
  isDesktop,
  isTeacher,
  onOpenHelpCenter,
  onOpenSecurity,
  onSelectSection,
  securityOnly,
  width,
}: RoleSettingsSectionsProps) {
  const { t } = useI18n()
  return (
    <>
      {!securityOnly && activeSettingsSection === 'general' ? (
        <SettingsGeneralPanel
          isDesktop={isDesktop}
          onSelectSection={onSelectSection}
          onSignOut={data.handleSignOut}
        />
      ) : null}

      {!securityOnly && activeSettingsSection === 'profile' ? (
        <SettingsProfilePanel
          isTeacher={isTeacher}
          width={width}
          userInitials={data.userInitials}
          avatar={data.profile?.avatar}
          saving={data.saving}
          name={data.name}
          email={data.email}
          onNameChange={data.setName}
          onSaveProfile={data.handleSaveProfile}
          onOpenSecurity={onOpenSecurity}
        />
      ) : null}

      {!securityOnly && activeSettingsSection === 'preferences' ? (
        <SettingsPreferencesPanel
          accentColor={accentColor}
          preferences={data.preferences}
          openPreferenceKey={data.openPreferenceKey}
          preferenceOptions={data.preferenceOptions}
          savingPreference={data.savingPreference}
          savingHaptics={data.savingHaptics}
          onTogglePreferenceMenu={data.togglePreferenceMenu}
          onSelectPreference={(key, value) => void data.selectPreference(key, value)}
          onToggleHaptics={(enabled) => void data.updateHapticsEnabled(enabled)}
          formatPreferenceLabel={data.formatPreferenceLabel}
          guestMode={data.isGuest}
        />
      ) : null}

      {!securityOnly && activeSettingsSection === 'notifications' ? (
        <SettingsNotificationsPanel
          notificationSettings={data.notificationSettings}
          openNotificationFrequency={data.openNotificationFrequency}
          notificationFrequencyOptions={data.notificationFrequencyOptions}
          savingNotificationKey={data.savingNotificationKey}
          onToggleFrequencyMenu={data.toggleNotificationFrequencyMenu}
          onSelectFrequency={(value) => void data.selectNotificationFrequency(value)}
          onToggleNotification={(key) => void data.updateNotificationToggle(key)}
          formatNotificationFrequencyLabel={data.formatNotificationFrequencyLabel}
          pushRegistrationStatus={data.pushRegistrationStatus}
          onShowServerPreferences={() => data.showAlert(t('settings.section.notifications'), t('settings.notifications.serverDescription'))}
        />
      ) : null}

      {!securityOnly && activeSettingsSection === 'privacy' ? (
        <SettingsPrivacyPanel
          isTeacher={isTeacher}
          profileVisibility={data.profileVisibility}
          profileVisibilityAvailable={data.profileVisibilityAvailable}
          savingProfileVisibility={data.savingProfileVisibility}
          isGuest={data.profile?.role_id === 'guest'}
          analyticsEnabled={data.preferences.analyticsEnabled}
          savingAnalytics={data.savingAnalytics}
          accentColor={accentColor}
          onProfileVisibilityChange={data.handleProfileVisibilityChange}
          onAnalyticsEnabledChange={(enabled) => void data.updateAnalyticsEnabled(enabled)}
          onShowPrivacyCenter={data.showPrivacyCenter}
        />
      ) : null}

      {!securityOnly && activeSettingsSection === 'data' ? (
        <SettingsDataPanel
          isTeacher={isTeacher}
          deletingData={data.deletingData}
          deletingAccount={data.deletingAccount}
          onRequestDeletion={data.handleDeleteAccount}
          onDeletePartialData={(dataType) => data.handleDeletePartialData(dataType)}
        />
      ) : null}

      {securityOnly || activeSettingsSection === 'security' ? (
        <SettingsSecurityPanel
          securityOnly={securityOnly}
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

      {!securityOnly && activeSettingsSection === 'about' ? (
        <SettingsAboutPanel onOpenHelpCenter={onOpenHelpCenter} />
      ) : null}
    </>
  )
}

export default function StudentSettingsSections(props: Omit<RoleSettingsSectionsProps, 'isTeacher'>) {
  return <RoleSettingsSections {...props} isTeacher={false} />
}
