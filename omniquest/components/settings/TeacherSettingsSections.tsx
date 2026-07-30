import React, { useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { useSettingsData } from '../../hooks/useSettingsData'
import { useAppTheme } from '../../lib/appTheme'
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
  TeacherNotificationSettingsState,
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
  return (
    <>
      {!securityOnly && activeSettingsSection === 'personal' ? (
        <>
          <SettingsSectionIntro
            icon="person-circle-outline"
            title="Ajustes personales"
            description="Estos cambios afectan a tu cuenta, tu identidad y la forma en la que ves OmniQuest. No modifican el contenido ni el progreso de tus alumnos."
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
            title="Preferencias docentes"
            description="Decide qué situaciones requieren tu atención, dónde recibir recordatorios y con qué frecuencia quieres un resumen de tus cursos."
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
              'Notificaciones docentes',
              'Las preferencias se guardan en tu cuenta y se aplican a los avisos push, correo y resúmenes operativos.',
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
  const settings = data.teacherNotificationSettings
  const [emailDraft, setEmailDraft] = useState(settings.reminderEmail)

  useEffect(() => {
    setEmailDraft(settings.reminderEmail)
  }, [settings.reminderEmail])

  const saveEmail = async () => {
    await data.updateTeacherNotificationPreference('reminderEmail', emailDraft)
  }

  return (
    <Panel title="Alertas y resúmenes docentes">
      <View
        className="rounded-xl border p-4"
        style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}
      >
        <Text className="text-[13px] font-black" style={{ color: tokens.text.primary }}>
          Correo para recordatorios
        </Text>
        <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.secondary }}>
          Puedes usar un correo distinto al de acceso para recibir resúmenes de actividad y recordatorios operativos.
        </Text>
        <View className="mt-3 gap-3 md:flex-row md:items-end">
          <TextInput
            accessibilityLabel="Correo para recordatorios docentes"
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
            label="Guardar correo"
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
          title="Alumnos sin actividad"
          description="Avísame cuando un alumno lleve varios días sin participar."
          enabled={settings.inactiveStudentAlerts}
          loading={data.savingTeacherNotificationKey === 'inactiveStudentAlerts'}
          onPress={() => void data.updateTeacherNotificationPreference('inactiveStudentAlerts', !settings.inactiveStudentAlerts)}
        />
        <NotificationRow
          icon="create-outline"
          title="Revisiones manuales pendientes"
          description="Avísame cuando una respuesta abierta necesite corrección."
          enabled={settings.openReviewAlerts}
          loading={data.savingTeacherNotificationKey === 'openReviewAlerts'}
          onPress={() => void data.updateTeacherNotificationPreference('openReviewAlerts', !settings.openReviewAlerts)}
        />
        <NotificationRow
          icon="shield-checkmark-outline"
          title="Acciones sensibles"
          description="Avísame de cambios relevantes en cursos, permisos, clases o códigos."
          enabled={settings.sensitiveActionAlerts}
          loading={data.savingTeacherNotificationKey === 'sensitiveActionAlerts'}
          onPress={() => void data.updateTeacherNotificationPreference('sensitiveActionAlerts', !settings.sensitiveActionAlerts)}
        />
      </View>

      <View className="mt-5">
        <Text className="text-[13px] font-black" style={{ color: tokens.text.primary }}>
          Frecuencia del resumen docente
        </Text>
        <Text className="mt-1 text-[12px]" style={{ color: tokens.text.secondary }}>
          Agrupa alumnos sin actividad, revisiones pendientes y alertas de tus cursos.
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {([
            ['off', 'Desactivado'],
            ['daily', 'Diario'],
            ['weekly', 'Semanal'],
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
  const { tokens } = useAppTheme()
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
  return (
    <View
      className="rounded-2xl border p-4"
      style={{ borderColor: tokens.semantic.info, backgroundColor: tokens.surface.raised }}
    >
      <Text className="font-black" style={{ color: tokens.text.primary }}>Privacidad docente</Text>
      <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>
        La visibilidad de tu perfil afecta a tu identidad pública. Los resultados de alumnos solo son accesibles en los cursos y clases que gestionas. Exportar datos no modifica la plataforma.
      </Text>
    </View>
  )
}

function TeacherDataNotice() {
  const { tokens } = useAppTheme()
  return (
    <View
      className="rounded-2xl border p-4"
      style={{ borderColor: tokens.semantic.warning, backgroundColor: tokens.surface.raised }}
    >
      <Text className="font-black" style={{ color: tokens.text.primary }}>Antes de borrar datos docentes</Text>
      <Text className="mt-2 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>
        Exporta primero una copia. Borrar progreso afecta a resultados de alumnos; borrar cursos elimina clases, temas y preguntas. Borrar la cuenta es una acción distinta disponible en Seguridad.
      </Text>
    </View>
  )
}
