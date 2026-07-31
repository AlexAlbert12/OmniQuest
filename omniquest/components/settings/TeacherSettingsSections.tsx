import React, { useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { useSettingsData } from '../../hooks/useSettingsData'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import AppButton from '../ui/AppButton'
import {
  SettingsAboutPanel,
  SettingsDataPanel,
  SettingsNotificationsPanel,
  SettingsPreferencesPanel,
  SettingsPrivacyPanel,
  SettingsProfilePanel,
  SettingsSecurityPanel,
} from './SettingsSections'
import { NotificationRow, Panel } from './SettingsUi'
import type {
  SettingsMenuSectionKey,
  TeacherDigestFrequency,
} from './SettingsTypes'

type SettingsData = ReturnType<typeof useSettingsData>

type TeacherSettingsSectionsProps = {
  activeSettingsSection: SettingsMenuSectionKey
  accentColor: string
  data: SettingsData
  isDesktop: boolean
  onOpenHelpCenter: () => void
  onOpenSecurity: () => void
  onSelectSection: (section: SettingsMenuSectionKey) => void
  onAccentColorChange: (color: string) => void
  securityOnly: boolean
  width: number
}

export default function TeacherSettingsSections({
  activeSettingsSection,
  accentColor,
  data,
  isDesktop,
  onOpenHelpCenter,
  onOpenSecurity,
  onAccentColorChange,
  securityOnly,
  width,
}: TeacherSettingsSectionsProps) {
  const { t } = useI18n()
  return (
    <>
      {!securityOnly && activeSettingsSection === 'personal' ? (
        <>
          <SettingsSectionIntro
            icon="person-circle-outline"
            title={t('settings.section.personal')}
            description={t('settings.teacher.personal.description')}
          />
          <SettingsProfilePanel
            isTeacher
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
        </>
      ) : null}

      {!securityOnly && activeSettingsSection === 'teaching' ? (
        <>
          <SettingsSectionIntro
            icon="school-outline"
            title={t('settings.section.teaching')}
            description={t('settings.teacher.teaching.description')}
          />
          <TeacherCommunicationPanel data={data} />
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
            onShowServerPreferences={() => data.showAlert(
              t('settings.teacher.notifications.title'),
              t('settings.teacher.notifications.description'),
            )}
          />
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
          <SettingsDataPanel
            isTeacher
            deletingData={data.deletingData}
            deletingAccount={data.deletingAccount}
            onRequestDeletion={data.handleDeleteAccount}
            onDeletePartialData={data.handleDeletePartialData}
          />
        </>
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

function TeacherCommunicationPanel({ data }: { data: SettingsData }) {
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  const settings = data.teacherNotificationSettings
  const [emailDraft, setEmailDraft] = useState(settings.reminderEmail)

  useEffect(() => {
    setEmailDraft(settings.reminderEmail)
  }, [settings.reminderEmail])

  const saveEmail = async () => {
    await data.updateTeacherNotificationPreference('reminderEmail', emailDraft)
  }

  return (
    <Panel title={t('settings.teacher.communication.title')}>
      <View
        className="rounded-xl border p-4"
        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}
      >
        <Text className="text-[13px] font-black" style={{ color: tokens.text.primary }}>
          {t('settings.teacher.reminderEmail.title')}
        </Text>
        <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>
          {t('settings.teacher.reminderEmail.description')}
        </Text>
        <View className="mt-3 gap-3 md:flex-row md:items-end">
          <TextInput
            accessibilityLabel={t('settings.teacher.reminderEmail.accessibility')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmailDraft}
            placeholder="profesor@centro.es"
            placeholderTextColor={tokens.text.muted}
            value={emailDraft}
            className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-[14px]"
            style={{
              borderColor: tokens.border.default,
              backgroundColor: tokens.surface.default,
              color: tokens.text.primary,
            }}
          />
          <AppButton
            label={t('settings.teacher.reminderEmail.save')}
            icon="mail-outline"
            role="teacher"
            loading={data.savingTeacherNotificationKey === 'reminderEmail'}
            onPress={() => void saveEmail()}
          />
        </View>
      </View>

      <View className="mt-4 gap-3">
        <NotificationRow
          icon="time-outline"
          title={t('settings.teacher.inactive.title')}
          description={t('settings.teacher.inactive.description')}
          enabled={settings.inactiveStudentAlerts}
          loading={data.savingTeacherNotificationKey === 'inactiveStudentAlerts'}
          onPress={() => void data.updateTeacherNotificationPreference('inactiveStudentAlerts', !settings.inactiveStudentAlerts)}
        />
        <NotificationRow
          icon="create-outline"
          title={t('settings.teacher.reviews.title')}
          description={t('settings.teacher.reviews.description')}
          enabled={settings.openReviewAlerts}
          loading={data.savingTeacherNotificationKey === 'openReviewAlerts'}
          onPress={() => void data.updateTeacherNotificationPreference('openReviewAlerts', !settings.openReviewAlerts)}
        />
        <NotificationRow
          icon="shield-checkmark-outline"
          title={t('settings.teacher.sensitive.title')}
          description={t('settings.teacher.sensitive.description')}
          enabled={settings.sensitiveActionAlerts}
          loading={data.savingTeacherNotificationKey === 'sensitiveActionAlerts'}
          onPress={() => void data.updateTeacherNotificationPreference('sensitiveActionAlerts', !settings.sensitiveActionAlerts)}
        />
      </View>

      <View className="mt-5">
        <Text className="text-[13px] font-black" style={{ color: tokens.text.primary }}>
          {t('settings.teacher.digest.title')}
        </Text>
        <Text className="mt-1 text-[12px]" style={{ color: tokens.text.secondary }}>
          {t('settings.teacher.digest.description')}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {([
            ['off', t('settings.teacher.digest.off')],
            ['daily', t('settings.teacher.digest.daily')],
            ['weekly', t('settings.teacher.digest.weekly')],
          ] as [TeacherDigestFrequency, string][]).map(([value, label]) => (
            <DigestChoice
              key={value}
              label={label}
              selected={settings.digestFrequency === value}
              loading={data.savingTeacherNotificationKey === 'digestFrequency'}
              onPress={() => void data.updateTeacherNotificationPreference('digestFrequency', value)}
            />
          ))}
        </View>
      </View>
    </Panel>
  )
}

function DigestChoice({
  label,
  selected,
  loading,
  onPress,
}: {
  label: string
  selected: boolean
  loading: boolean
  onPress: () => void
}) {
  return (
    <AppButton
      label={label}
      accessibilityLabel={`Frecuencia ${label}`}
      icon={selected ? 'checkmark-circle' : 'ellipse-outline'}
      role="teacher"
      variant={selected ? 'primary' : 'secondary'}
      disabled={loading}
      onPress={onPress}
    />
  )
}

function SettingsSectionIntro({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
}) {
  const { tokens } = useAppTheme()
  return (
    <View
      className="flex-row items-start gap-3 rounded-2xl border p-4"
      style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: tokens.surface.interactive }}
      >
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
    <View
      className="rounded-2xl border p-4"
      style={{ borderColor: tokens.semantic.info, backgroundColor: tokens.surface.raised }}
    >
      <Text className="font-black" style={{ color: tokens.text.primary }}>{t('settings.teacher.privacy.title')}</Text>
      <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>
        {t('settings.teacher.privacy.description')}
      </Text>
    </View>
  )
}

function TeacherDataNotice() {
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  return (
    <View
      className="rounded-2xl border p-4"
      style={{ borderColor: tokens.semantic.warning, backgroundColor: tokens.surface.raised }}
    >
      <Text className="font-black" style={{ color: tokens.text.primary }}>{t('settings.teacher.data.title')}</Text>
      <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>
        {t('settings.teacher.data.description')}
      </Text>
    </View>
  )
}
