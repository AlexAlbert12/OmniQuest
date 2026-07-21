import React from 'react'
import type { useSettingsData } from '../../hooks/useSettingsData'
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
  onAccentColorChange: (color: string) => void
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
  onAccentColorChange,
  securityOnly,
  width,
}: RoleSettingsSectionsProps) {
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
          saving={data.saving}
          accentColor={accentColor}
          name={data.name}
          email={data.email}
          preferences={data.preferences}
          openPreferenceKey={data.openPreferenceKey}
          preferenceOptions={data.preferenceOptions}
          savingPreference={data.savingPreference}
          onNameChange={data.setName}
          onSaveProfile={data.handleSaveProfile}
          onTogglePreferenceMenu={data.togglePreferenceMenu}
          onSelectPreference={(key, value) => void data.selectPreference(key, value)}
          formatPreferenceLabel={data.formatPreferenceLabel}
          onOpenSecurity={onOpenSecurity}
        />
      ) : null}

      {!securityOnly && activeSettingsSection === 'preferences' ? (
        <SettingsPreferencesPanel
          accentColor={accentColor}
          accentColors={data.accentColors}
          preferences={data.preferences}
          openPreferenceKey={data.openPreferenceKey}
          preferenceOptions={data.preferenceOptions}
          savingPreference={data.savingPreference}
          savingHaptics={data.savingHaptics}
          onAccentColorChange={onAccentColorChange}
          onTogglePreferenceMenu={data.togglePreferenceMenu}
          onSelectPreference={(key, value) => void data.selectPreference(key, value)}
          onToggleHaptics={(enabled) => void data.updateHapticsEnabled(enabled)}
          formatPreferenceLabel={data.formatPreferenceLabel}
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
          onShowServerPreferences={() => data.showAlert('Notificaciones', 'OmniQuest aplica las preferencias en servidor y usa los dispositivos registrados para enviar avisos push.')}
        />
      ) : null}

      {!securityOnly && activeSettingsSection === 'privacy' ? (
        <SettingsPrivacyPanel
          isTeacher={isTeacher}
          profileVisibility={data.profileVisibility}
          profileVisibilityAvailable={data.profileVisibilityAvailable}
          accentColor={accentColor}
          onProfileVisibilityChange={data.handleProfileVisibilityChange}
          onShowPrivacyCenter={data.showPrivacyCenter}
        />
      ) : null}

      {!securityOnly && activeSettingsSection === 'data' ? (
        <SettingsDataPanel
          isTeacher={isTeacher}
          exportingData={data.exportingData}
          deletingData={data.deletingData}
          onExportData={data.handleExportData}
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
          deletingAccount={data.deletingAccount}
          onOpenSecurity={onOpenSecurity}
          onCurrentPasswordChange={data.setCurrentPassword}
          onNewPasswordChange={data.setNewPassword}
          onConfirmPasswordChange={data.setConfirmPassword}
          onToggleCurrentPassword={() => data.setShowCurrentPassword((value) => !value)}
          onToggleNewPassword={() => data.setShowNewPassword((value) => !value)}
          onToggleConfirmPassword={() => data.setShowConfirmPassword((value) => !value)}
          onChangePassword={data.handleChangePassword}
          onSignOut={data.handleSignOut}
          onDeleteAccount={data.handleDeleteAccount}
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
