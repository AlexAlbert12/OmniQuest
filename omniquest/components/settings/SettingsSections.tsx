import React from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme, type AppThemePreference } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import { withAlpha } from '../../lib/color'
import {
  ActionRow,
  Field,
  FooterLink,
  NotificationRow,
  Panel,
  PreferenceRow,
  SelectPill,
} from './SettingsUi'
import ManagedSessionsCard from './ManagedSessionsCard'
import AccountDataRequestsCard from './AccountDataRequestsCard'
import {
  SecurityAccountStatusCard,
  SecurityDangerCard,
  SecurityPasswordCard,
  type PasswordChecks,
} from './SettingsSecurity'
import type {
  IconName,
  NotificationFrequency,
  NotificationSettingKey,
  NotificationSettingsState,
  PreferenceKey,
  ProfileVisibility,
  SettingsMenuSectionKey,
  UserPreferencesState,
} from './SettingsTypes'

type PreferenceOptions = Record<PreferenceKey, string[]>
type FormatPreferenceLabel = (key: PreferenceKey, value: string) => string

export function SettingsGeneralPanel({
  isDesktop,
  onSelectSection,
  onSignOut,
}: {
  isDesktop: boolean
  onSelectSection: (section: SettingsMenuSectionKey) => void
  onSignOut: () => void
}) {
  const { t } = useI18n()
  return (
    <Panel title={t('settings.general.title')}>
      <View className="gap-4">
        <ActionRow
          icon="person-outline"
          title={t('settings.general.profile.title')}
          description={t('settings.general.profile.description')}
          onPress={() => onSelectSection('profile')}
        />
        <ActionRow
          icon="globe-outline"
          title={t('settings.general.locale.title')}
          description={t('settings.general.locale.description')}
          onPress={() => onSelectSection('preferences')}
        />
        <ActionRow
          icon="notifications-outline"
          title={t('settings.general.notifications.title')}
          description={t('settings.general.notifications.description')}
          onPress={() => onSelectSection('notifications')}
        />
        <ActionRow
          icon="shield-checkmark-outline"
          title={t('settings.section.privacy')}
          description={t('settings.general.privacy.description')}
          onPress={() => onSelectSection('privacy')}
        />
        <ActionRow
          icon="server-outline"
          title={t('settings.section.data')}
          description={t('settings.general.data.description')}
          onPress={() => onSelectSection('data')}
        />
        <ActionRow
          icon="lock-closed-outline"
          title={t('settings.section.security')}
          description={t('settings.general.security.description')}
          onPress={() => onSelectSection('security')}
        />
        {!isDesktop ? (
          <ActionRow
            icon="log-out-outline"
            title={t('settings.signOut')}
            description={t('settings.signOut.description')}
            onPress={onSignOut}
          />
        ) : null}
      </View>
    </Panel>
  )
}

export function SettingsProfilePanel({
  isTeacher,
  width,
  userInitials,
  saving,
  accentColor,
  name,
  email,
  preferences,
  openPreferenceKey,
  preferenceOptions,
  savingPreference,
  onNameChange,
  onSaveProfile,
  onTogglePreferenceMenu,
  onSelectPreference,
  formatPreferenceLabel,
  onOpenSecurity,
}: {
  isTeacher: boolean
  width: number
  userInitials: string
  saving: boolean
  accentColor: string
  name: string
  email: string
  preferences: UserPreferencesState
  openPreferenceKey: PreferenceKey | null
  preferenceOptions: PreferenceOptions
  savingPreference: PreferenceKey | null
  onNameChange: (value: string) => void
  onSaveProfile: () => void
  onTogglePreferenceMenu: (key: PreferenceKey) => void
  onSelectPreference: (key: PreferenceKey, value: string) => void
  formatPreferenceLabel: FormatPreferenceLabel
  onOpenSecurity: () => void
}) {
  const { colors } = useAppTheme()
  const { t } = useI18n()
  return (
    <Panel title={t(isTeacher ? 'settings.profile.title.teacher' : 'settings.profile.title.student')}>
      <View className={width >= 520 ? 'flex-row gap-5' : 'gap-4'}>
        <View className="items-center">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-surface-selected">
            <Text className="text-[28px] font-black text-white">{userInitials}</Text>
          </View>
          <Pressable
            onPress={onSaveProfile}
            disabled={saving}
            className="mt-5 rounded-lg px-5 py-3"
            style={{ backgroundColor: accentColor }}
          >
            <Text className="text-[12px] font-bold text-white">{saving ? t('settings.profile.saving') : t('settings.profile.save')}</Text>
          </Pressable>
        </View>

        <View className="min-w-0 flex-1 gap-3">
          <Field label={t('settings.profile.alias')}>
            <TextInput
              value={name}
              onChangeText={onNameChange}
              placeholder={t(isTeacher ? 'settings.profile.placeholder.teacher' : 'settings.profile.placeholder.student')}
              placeholderTextColor={colors.textMuted}
              className="rounded-lg border px-4 py-3 text-[13px]"
              style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.text }}
            />
          </Field>
          <Field label={t('settings.profile.email')}>
            <TextInput
              value={email}
              editable={false}
              placeholderTextColor={colors.textMuted}
              className="rounded-lg border px-4 py-3 text-[13px]"
              style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.textSecondary }}
            />
          </Field>
          <Field label={t('settings.profile.language')}>
            <SelectPill
              value={formatPreferenceLabel('language', preferences.language)}
              selectedValue={preferences.language}
              open={openPreferenceKey === 'language'}
              onToggle={() => onTogglePreferenceMenu('language')}
              options={preferenceOptions.language}
              onSelect={(value) => onSelectPreference('language', value)}
              optionLabel={(value) => formatPreferenceLabel('language', value)}
              disabled={Boolean(savingPreference)}
              loading={savingPreference === 'language'}
            />
          </Field>
        </View>
      </View>
      <View className="mt-4 border-t border-border-subtle pt-4">
        <ActionRow
          icon="lock-closed-outline"
          title={t('settings.security.manage')}
          description={t('settings.security.manageDescription')}
          onPress={onOpenSecurity}
        />
      </View>
    </Panel>
  )
}

export function SettingsPreferencesPanel({
  accentColor,
  accentColors,
  preferences,
  openPreferenceKey,
  preferenceOptions,
  savingPreference,
  savingHaptics,
  onAccentColorChange,
  onTogglePreferenceMenu,
  onSelectPreference,
  onToggleHaptics,
  formatPreferenceLabel,
}: {
  accentColor: string
  accentColors: readonly string[]
  preferences: UserPreferencesState
  openPreferenceKey: PreferenceKey | null
  preferenceOptions: PreferenceOptions
  savingPreference: PreferenceKey | null
  savingHaptics: boolean
  onAccentColorChange: (color: string) => void
  onTogglePreferenceMenu: (key: PreferenceKey) => void
  onSelectPreference: (key: PreferenceKey, value: string) => void
  onToggleHaptics: (enabled: boolean) => void
  formatPreferenceLabel: FormatPreferenceLabel
}) {
  const { themePreference, setTheme, colors } = useAppTheme()
  const { t } = useI18n()
  const themeOptions: { value: AppThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'system', label: t('settings.appearance.system'), icon: 'phone-portrait-outline' },
    { value: 'dark', label: t('settings.appearance.dark'), icon: 'moon-outline' },
    { value: 'light', label: t('settings.appearance.light'), icon: 'sunny-outline' },
  ]

  return (
    <Panel title={t('settings.section.preferences')}>
      <View
        className="mb-4 rounded-lg border p-3"
        style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.border }}
      >
        <Text className="text-[12px] font-bold" style={{ color: colors.text }}>{t('settings.appearance.title')}</Text>
        <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }}>
          {t('settings.appearance.description')}
        </Text>
        <View className="mt-3 flex-row gap-2">
          {themeOptions.map((option) => {
            const selected = themePreference === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityLabel={`${t('settings.appearance.title')}: ${option.label}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                hitSlop={4}
                onPress={() => setTheme(option.value)}
                className="min-h-[48px] flex-1 items-center justify-center rounded-xl border px-2 py-2"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.82 : 1,
                  borderColor: selected ? accentColor : colors.border,
                  backgroundColor: selected ? withAlpha(accentColor, '20') : colors.surface,
                })}
              >
                <Ionicons name={option.icon} size={20} color={selected ? accentColor : colors.textMuted} />
                <Text className="mt-1 text-[11px] font-black" style={{ color: selected ? accentColor : colors.textSecondary }}>
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View
        className="mb-4 rounded-lg border p-3"
        style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.border }}
      >
        <Text className="text-[12px] font-bold" style={{ color: colors.text }}>{t('settings.accent.title')}</Text>
        <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }}>
          {t('settings.accent.description')}
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-3">
          {accentColors.map((color) => (
            <Pressable
              key={color}
              accessibilityLabel={t('settings.accent.use', { color })}
              accessibilityRole="radio"
              accessibilityState={{ selected: accentColor === color }}
              hitSlop={5}
              onPress={() => onAccentColorChange(color)}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: color,
                borderWidth: accentColor === color ? 3 : 1,
                borderColor: accentColor === color ? colors.text : colors.border,
              }}
            >
              {accentColor === color ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      <NotificationRow
        icon="phone-portrait-outline"
        title={t('settings.haptics.title')}
        description={t('settings.haptics.description')}
        enabled={preferences.hapticsEnabled}
        onPress={() => onToggleHaptics(!preferences.hapticsEnabled)}
        disabled={savingHaptics}
        loading={savingHaptics}
      />

      <PreferenceRow
        label={t('settings.preference.language')}
        value={formatPreferenceLabel('language', preferences.language)}
        selectedValue={preferences.language}
        open={openPreferenceKey === 'language'}
        onToggle={() => onTogglePreferenceMenu('language')}
        options={preferenceOptions.language}
        onSelect={(value) => onSelectPreference('language', value)}
        optionLabel={(value) => formatPreferenceLabel('language', value)}
        disabled={Boolean(savingPreference)}
        loading={savingPreference === 'language'}
      />

      {(['timezone', 'dateFormat', 'timeFormat', 'weekStart'] as PreferenceKey[]).map((key) => (
        <PreferenceRow
          key={key}
          label={{
            timezone: t('settings.preference.timezone'),
            dateFormat: t('settings.preference.dateFormat'),
            timeFormat: t('settings.preference.timeFormat'),
            weekStart: t('settings.preference.weekStart'),
            language: t('settings.preference.language'),
          }[key]}
          value={formatPreferenceLabel(key, preferences[key])}
          selectedValue={preferences[key]}
          open={openPreferenceKey === key}
          onToggle={() => onTogglePreferenceMenu(key)}
          options={preferenceOptions[key]}
          onSelect={(value) => onSelectPreference(key, value)}
          optionLabel={(value) => formatPreferenceLabel(key, value)}
          disabled={Boolean(savingPreference)}
          loading={savingPreference === key}
        />
      ))}
    </Panel>
  )
}

export function SettingsNotificationsPanel({
  notificationSettings,
  openNotificationFrequency,
  notificationFrequencyOptions,
  savingNotificationKey,
  onToggleFrequencyMenu,
  onSelectFrequency,
  onToggleNotification,
  formatNotificationFrequencyLabel,
  onShowServerPreferences,
  pushRegistrationStatus = 'idle',
}: {
  notificationSettings: NotificationSettingsState
  openNotificationFrequency: boolean
  notificationFrequencyOptions: NotificationFrequency[]
  savingNotificationKey: NotificationSettingKey | 'frequency' | null
  onToggleFrequencyMenu: () => void
  onSelectFrequency: (value: NotificationFrequency) => void
  onToggleNotification: (key: NotificationSettingKey) => void
  formatNotificationFrequencyLabel: (value: NotificationFrequency) => string
  onShowServerPreferences: () => void
  pushRegistrationStatus?: 'idle' | 'registered' | 'denied' | 'unsupported' | 'error'
}) {
  const { t } = useI18n()
  const { colors } = useAppTheme()
  return (
    <Panel title={t('settings.section.notifications')}>
      <View className="mb-4 rounded-lg border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <Text className="text-[12px] font-bold" style={{ color: colors.text }}>{t('settings.notifications.saved')}</Text>
        <Text className="mt-1 text-[13px]" style={{ color: colors.textSecondary }}>
          {t('settings.notifications.description')}
        </Text>
        <View className="mt-3">
          <PreferenceRow
            label={t('settings.notifications.frequency')}
            value={formatNotificationFrequencyLabel(notificationSettings.frequency)}
            selectedValue={notificationSettings.frequency}
            open={openNotificationFrequency}
            onToggle={onToggleFrequencyMenu}
            options={notificationFrequencyOptions}
            onSelect={(value) => onSelectFrequency(value as NotificationFrequency)}
            optionLabel={(value) => formatNotificationFrequencyLabel(value as NotificationFrequency)}
            disabled={Boolean(savingNotificationKey)}
            loading={savingNotificationKey === 'frequency'}
          />
        </View>
      </View>
      <NotificationRow
        icon="notifications-outline"
        title={t('settings.notifications.push.title')}
        description={pushRegistrationStatus === 'unsupported'
          ? t('settings.notifications.push.unsupported')
          : notificationSettings.push
            ? t('settings.notifications.push.enabled')
            : t('settings.notifications.push.disabled')}
        enabled={notificationSettings.push}
        onPress={() => onToggleNotification('push')}
        disabled={Boolean(savingNotificationKey)}
        loading={savingNotificationKey === 'push'}
      />
      <NotificationRow
        icon="mail-outline"
        title={t('settings.notifications.email.title')}
        description={t('settings.notifications.email.description')}
        enabled={notificationSettings.email}
        onPress={() => onToggleNotification('email')}
        disabled={Boolean(savingNotificationKey)}
        loading={savingNotificationKey === 'email'}
      />
      <NotificationRow
        icon="calendar-outline"
        title={t('settings.notifications.daily.title')}
        description={t('settings.notifications.daily.description')}
        enabled={notificationSettings.daily}
        onPress={() => onToggleNotification('daily')}
        disabled={Boolean(savingNotificationKey)}
        loading={savingNotificationKey === 'daily'}
      />
      <NotificationRow
        icon="clipboard-outline"
        title={t('settings.notifications.activities.title')}
        description={t('settings.notifications.activities.description')}
        enabled={notificationSettings.activities}
        onPress={() => onToggleNotification('activities')}
        disabled={Boolean(savingNotificationKey)}
        loading={savingNotificationKey === 'activities'}
      />
      <NotificationRow
        icon="megaphone-outline"
        title={t('settings.notifications.news.title')}
        description={t('settings.notifications.news.description')}
        enabled={notificationSettings.news}
        onPress={() => onToggleNotification('news')}
        disabled={Boolean(savingNotificationKey)}
        loading={savingNotificationKey === 'news'}
      />
      <FooterLink
        label={t('settings.notifications.server')}
        onPress={onShowServerPreferences}
      />
    </Panel>
  )
}

export function SettingsPrivacyPanel({
  isTeacher,
  profileVisibility,
  profileVisibilityAvailable,
  analyticsEnabled,
  savingAnalytics,
  accentColor,
  onProfileVisibilityChange,
  onAnalyticsEnabledChange,
  onShowPrivacyCenter,
}: {
  isTeacher: boolean
  profileVisibility: ProfileVisibility | null
  profileVisibilityAvailable: boolean
  analyticsEnabled: boolean
  savingAnalytics: boolean
  accentColor: string
  onProfileVisibilityChange: (visibility: ProfileVisibility) => void
  onAnalyticsEnabledChange: (enabled: boolean) => void
  onShowPrivacyCenter: () => void
}) {
  const { colors } = useAppTheme()
  const { t } = useI18n()
  return (
    <Panel title={t('settings.section.privacy')}>
      <View className="mb-4 rounded-lg border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-bold" style={{ color: colors.text }}>{t('settings.privacy.visibility')}</Text>
            <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }}>
              {isTeacher
                ? t('settings.privacy.visibility.teacher')
                : t('settings.privacy.visibility.student')}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <VisibilityButton
              label={t('settings.privacy.public')}
              value="public"
              selected={profileVisibility === 'public'}
              available={profileVisibilityAvailable}
              accentColor={accentColor}
              colors={colors}
              onPress={onProfileVisibilityChange}
            />
            <VisibilityButton
              label={t('settings.privacy.private')}
              value="private"
              selected={profileVisibility === 'private'}
              available={profileVisibilityAvailable}
              accentColor={accentColor}
              colors={colors}
              onPress={onProfileVisibilityChange}
            />
          </View>
        </View>

        {!profileVisibilityAvailable ? (
          <Text className="mt-3 text-[12px] leading-5 text-gamification-xp">
            {t('settings.privacy.unavailable')}
          </Text>
        ) : null}
      </View>

      <View className="mb-4 overflow-hidden rounded-xl border" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <NotificationRow
          icon="analytics-outline"
          title={t('settings.privacy.analytics.title')}
          description={t('settings.privacy.analytics.description')}
          enabled={analyticsEnabled}
          onPress={() => onAnalyticsEnabledChange(!analyticsEnabled)}
          disabled={savingAnalytics}
          loading={savingAnalytics}
        />
        <Text className="px-4 pb-4 text-[11px] leading-4 text-text-muted">
          {t('settings.privacy.analytics.retention')}
        </Text>
      </View>

      <View className="rounded-xl border p-4" style={{ borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised }}>
        <View className="flex-row gap-3">
          <Ionicons name="shield-checkmark-outline" size={22} color={accentColor} />
          <View className="min-w-0 flex-1">
            <Text className="font-black" style={{ color: colors.text }}>{t('settings.privacy.important')}</Text>
            <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>
              {t('settings.privacy.importantDescription')}
            </Text>
            <Pressable onPress={onShowPrivacyCenter} className="mt-2 flex-row items-center gap-1">
              <Text className="text-[12px] font-bold" style={{ color: colors.textSecondary }}>{t('settings.privacy.center')}</Text>
              <Ionicons name="open-outline" size={13} color={accentColor} />
            </Pressable>
          </View>
        </View>
      </View>
    </Panel>
  )
}

function VisibilityButton({
  label,
  value,
  selected,
  available,
  accentColor,
  colors,
  onPress,
}: {
  label: string
  value: ProfileVisibility
  selected: boolean
  available: boolean
  accentColor: string
  colors: ReturnType<typeof useAppTheme>['colors']
  onPress: (visibility: ProfileVisibility) => void
}) {
  return (
    <Pressable
      onPress={() => onPress(value)}
      disabled={!available}
      className="rounded-lg border px-3 py-2"
      style={{
        borderColor: selected ? accentColor : colors.border,
        backgroundColor: selected ? withAlpha(accentColor, '24') : colors.surface,
      }}
    >
      <Text className="text-[12px] font-semibold" style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  )
}

export function SettingsDataPanel({
  isTeacher,
  deletingData,
  deletingAccount,
  onRequestDeletion,
  onDeletePartialData,
}: {
  isTeacher: boolean
  deletingData: boolean
  deletingAccount: boolean
  onRequestDeletion: () => void
  onDeletePartialData: (dataType: 'scores' | 'enrollments' | 'all') => void
}) {
  const { colors } = useAppTheme()
  const { t } = useI18n()
  return (
    <Panel title={t('settings.section.data')}>
      <AccountDataRequestsCard
        deletingAccount={deletingAccount}
        onRequestDeletion={onRequestDeletion}
      />

      <View className="mt-4 rounded-lg border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <Text className="font-bold" style={{ color: colors.text }}>{t('settings.data.zone')}</Text>
        <Text className="mb-3 mt-1 text-[12px]" style={{ color: colors.textSecondary }}>
          {isTeacher
            ? t('settings.data.description.teacher')
            : t('settings.data.description.student')}
        </Text>

        <View className="gap-2">
          <DangerDataRow
            icon="trash-outline"
            title={t(isTeacher ? 'danger.scores.teacher.title' : 'danger.scores.student.title')}
            description={t(isTeacher ? 'settings.data.scores.teacher' : 'settings.data.scores.student')}
            deletingData={deletingData}
            onPress={() => onDeletePartialData('scores')}
          />
          <DangerDataRow
            icon={isTeacher ? 'folder-open-outline' : 'exit-outline'}
            title={t(isTeacher ? 'danger.enrollments.teacher.title' : 'danger.enrollments.student.title')}
            description={isTeacher ? t('settings.data.enrollments.teacher') : undefined}
            deletingData={deletingData}
            onPress={() => onDeletePartialData('enrollments')}
          />
          <DangerDataRow
            icon="warning-outline"
            title={t(isTeacher ? 'danger.all.teacher.title' : 'danger.all.student.title')}
            description={
              isTeacher
                ? t('settings.data.all.teacher')
                : t('settings.data.all.student')
            }
            deletingData={deletingData}
            onPress={() => onDeletePartialData('all')}
          />
        </View>
      </View>
    </Panel>
  )
}

function DangerDataRow({
  icon,
  title,
  description,
  deletingData,
  onPress,
}: {
  icon: IconName
  title: string
  description?: string
  deletingData: boolean
  onPress: () => void
}) {
  const { colors } = useAppTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={deletingData}
      className="flex-row items-center justify-between rounded-lg border border-semantic-danger bg-semantic-surface-danger p-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
    >
      <View className="flex-row items-center gap-3">
        <Ionicons name={icon} size={16} color={colors.danger} />
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-semibold" style={{ color: colors.text }}>{title}</Text>
          {description ? <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }}>{description}</Text> : null}
        </View>
      </View>

      {deletingData ? (
        <ActivityIndicator size="small" color={colors.danger} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.danger} />
      )}
    </Pressable>
  )
}

export function SettingsSecurityPanel({
  securityOnly,
  accentColor,
  currentPassword,
  newPassword,
  confirmPassword,
  showCurrentPassword,
  showNewPassword,
  showConfirmPassword,
  changingPassword,
  passwordChecks,
  email,
  emailConfirmedAt,
  lastSignInAt,
  deletingAccount,
  onOpenSecurity,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onToggleCurrentPassword,
  onToggleNewPassword,
  onToggleConfirmPassword,
  onChangePassword,
  onSignOut,
  onDeleteAccount,
}: {
  securityOnly: boolean
  accentColor: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
  showCurrentPassword: boolean
  showNewPassword: boolean
  showConfirmPassword: boolean
  changingPassword: boolean
  passwordChecks: PasswordChecks
  email: string
  emailConfirmedAt: string | null
  lastSignInAt: string | null
  deletingAccount: boolean
  onOpenSecurity: () => void
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onToggleCurrentPassword: () => void
  onToggleNewPassword: () => void
  onToggleConfirmPassword: () => void
  onChangePassword: () => void
  onSignOut: () => void
  onDeleteAccount: () => void
}) {
  const { colors } = useAppTheme()
  const { t } = useI18n()
  return (
    <Panel title={t('settings.section.security')}>
      {!securityOnly ? (
        <ActionRow
          icon="lock-closed-outline"
          title={t('settings.security.manage')}
          description={t('settings.security.dedicatedDescription')}
          onPress={onOpenSecurity}
        />
      ) : (
        <View className="gap-4">
          <SecurityPasswordCard
            accentColor={accentColor}
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            showCurrentPassword={showCurrentPassword}
            showNewPassword={showNewPassword}
            showConfirmPassword={showConfirmPassword}
            changingPassword={changingPassword}
            checks={passwordChecks}
            onCurrentPasswordChange={onCurrentPasswordChange}
            onNewPasswordChange={onNewPasswordChange}
            onConfirmPasswordChange={onConfirmPasswordChange}
            onToggleCurrentPassword={onToggleCurrentPassword}
            onToggleNewPassword={onToggleNewPassword}
            onToggleConfirmPassword={onToggleConfirmPassword}
            onSubmit={onChangePassword}
          />

          <SecurityAccountStatusCard
            email={email}
            emailConfirmedAt={emailConfirmedAt}
            lastSignInAt={lastSignInAt}
            onSignOut={onSignOut}
          />

          <ManagedSessionsCard />

          <SecurityDangerCard
            deletingAccount={deletingAccount}
            onDeleteAccount={onDeleteAccount}
          />
        </View>
      )}
    </Panel>
  )
}

export function SettingsAboutPanel({
  onOpenHelpCenter,
}: {
  onOpenHelpCenter: () => void
}) {
  const { colors } = useAppTheme()
  const { t } = useI18n()
  return (
    <Panel title={t('settings.about.title')}>
      <View className="gap-4">
        <Text className="text-[13px] leading-5" style={{ color: colors.textSecondary }}>
          {t('settings.about.description')}
        </Text>

        <View className="rounded-xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
          <Text className="text-[12px]" style={{ color: colors.textMuted }}>{t('settings.about.version')}</Text>
          <Text className="mt-1 font-black" style={{ color: colors.text }}>1.0.0</Text>
        </View>

        <ActionRow
          icon="help-circle-outline"
          title={t('support.title')}
          description={t('settings.about.helpDescription')}
          onPress={onOpenHelpCenter}
        />
      </View>
    </Panel>
  )
}
