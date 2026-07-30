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
  return (
    <Panel title="Configuración general">
      <View className="gap-4">
        <ActionRow
          icon="person-outline"
          title="Editar perfil"
          description="Actualiza tu alias, idioma preferido y datos básicos."
          onPress={() => onSelectSection('profile')}
        />
        <ActionRow
          icon="globe-outline"
          title="Idioma y región"
          description="Ajusta idioma, zona horaria, fecha, hora e inicio de semana."
          onPress={() => onSelectSection('preferences')}
        />
        <ActionRow
          icon="notifications-outline"
          title="Preferencias de notificación"
          description="Configura avisos, resumen diario y novedades."
          onPress={() => onSelectSection('notifications')}
        />
        <ActionRow
          icon="shield-checkmark-outline"
          title="Privacidad"
          description="Controla la visibilidad de tu perfil y revisa el centro de privacidad."
          onPress={() => onSelectSection('privacy')}
        />
        <ActionRow
          icon="server-outline"
          title="Datos"
          description="Exporta o elimina datos asociados a tu cuenta."
          onPress={() => onSelectSection('data')}
        />
        <ActionRow
          icon="lock-closed-outline"
          title="Seguridad"
          description="Cambia tu contraseña o revisa el estado de tu cuenta."
          onPress={() => onSelectSection('security')}
        />
        {!isDesktop ? (
          <ActionRow
            icon="log-out-outline"
            title="Cerrar sesión"
            description="Salir de tu cuenta en este dispositivo."
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
  return (
    <Panel title={`Información del ${isTeacher ? 'profesor' : 'alumno'}`}>
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
            <Text className="text-[12px] font-bold text-white">{saving ? 'Guardando...' : 'Guardar perfil'}</Text>
          </Pressable>
        </View>

        <View className="min-w-0 flex-1 gap-3">
          <Field label="Alias">
            <TextInput
              value={name}
              onChangeText={onNameChange}
              placeholder={isTeacher ? 'Profesor' : 'Alumno'}
              placeholderTextColor="#64748B"
              className="rounded-lg border px-4 py-3 text-[13px]"
              style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.text }}
            />
          </Field>
          <Field label="Correo electrónico">
            <TextInput
              value={email}
              editable={false}
              placeholderTextColor="#64748B"
              className="rounded-lg border px-4 py-3 text-[13px]"
              style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.textSecondary }}
            />
          </Field>
          <Field label="Idioma preferido">
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
          title="Gestionar seguridad"
          description="Cambiar contraseña y revisar acciones críticas de la cuenta."
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
        <Text className="text-[12px] font-bold" style={{ color: colors.text }}>Color de acento</Text>
        <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }}>
          Se aplica a navegación, botones principales y estados seleccionados.
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-3">
          {accentColors.map((color) => (
            <Pressable
              key={color}
              accessibilityLabel={`Usar color de acento ${color}`}
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
        title="Respuesta táctil"
        description="Vibra al responder, desbloquear logros y completar acciones importantes."
        enabled={preferences.hapticsEnabled}
        onPress={() => onToggleHaptics(!preferences.hapticsEnabled)}
        disabled={savingHaptics}
        loading={savingHaptics}
      />

      <PreferenceRow
        label="Idioma"
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
            timezone: 'Zona horaria',
            dateFormat: 'Formato de fecha',
            timeFormat: 'Formato de hora',
            weekStart: 'Inicio de semana',
            language: 'Idioma',
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
            label="Frecuencia"
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
        title="Preferencia por email"
        description="Se guardará para futuros resúmenes y avisos por correo."
        enabled={notificationSettings.email}
        onPress={() => onToggleNotification('email')}
        disabled={Boolean(savingNotificationKey)}
        loading={savingNotificationKey === 'email'}
      />
      <NotificationRow
        icon="calendar-outline"
        title="Resumen diario"
        description="Preferencia para futuros resúmenes de progreso."
        enabled={notificationSettings.daily}
        onPress={() => onToggleNotification('daily')}
        disabled={Boolean(savingNotificationKey)}
        loading={savingNotificationKey === 'daily'}
      />
      <NotificationRow
        icon="clipboard-outline"
        title="Actividades y preguntas"
        description="Controla avisos de cursos, logros, inscripciones y señales de aprendizaje."
        enabled={notificationSettings.activities}
        onPress={() => onToggleNotification('activities')}
        disabled={Boolean(savingNotificationKey)}
        loading={savingNotificationKey === 'activities'}
      />
      <NotificationRow
        icon="megaphone-outline"
        title="Actualizaciones y novedades"
        description="Controla avisos informativos y novedades generales de OmniQuest."
        enabled={notificationSettings.news}
        onPress={() => onToggleNotification('news')}
        disabled={Boolean(savingNotificationKey)}
        loading={savingNotificationKey === 'news'}
      />
      <FooterLink
        label="Preferencias aplicadas en servidor"
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
  return (
    <Panel title="Privacidad">
      <View className="mb-4 rounded-lg border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-bold" style={{ color: colors.text }}>Visibilidad del perfil</Text>
            <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }}>
              {isTeacher
                ? 'Decide cómo se muestra tu perfil docente dentro de OmniQuest.'
                : 'Decide si otros estudiantes pueden ver tu perfil en rankings y logros.'}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <VisibilityButton
              label="Público"
              value="public"
              selected={profileVisibility === 'public'}
              available={profileVisibilityAvailable}
              accentColor={accentColor}
              colors={colors}
              onPress={onProfileVisibilityChange}
            />
            <VisibilityButton
              label="Privado"
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
            Esta preferencia no se guardará hasta aplicar la migración y regenerar types/database.types.ts.
          </Text>
        ) : null}
      </View>

      <View className="mb-4 overflow-hidden rounded-xl border" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <NotificationRow
          icon="analytics-outline"
          title="Analítica de producto"
          description="Permite enviar métricas pseudonimizadas de navegación, formularios y rendimiento para mejorar OmniQuest. Puedes retirarlo cuando quieras."
          enabled={analyticsEnabled}
          onPress={() => onAnalyticsEnabledChange(!analyticsEnabled)}
          disabled={savingAnalytics}
          loading={savingAnalytics}
        />
        <Text className="px-4 pb-4 text-[11px] leading-4 text-text-muted">
          Los eventos se anonimizan a los 90 días y se eliminan como máximo a los 395 días. Los errores operativos esenciales no incluyen contenido académico ni credenciales.
        </Text>
      </View>

      <View className="rounded-xl border p-4" style={{ borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised }}>
        <View className="flex-row gap-3">
          <Ionicons name="shield-checkmark-outline" size={22} color={accentColor} />
          <View className="min-w-0 flex-1">
            <Text className="font-black" style={{ color: colors.text }}>Tu privacidad es importante</Text>
            <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>
              Protegemos tu información y tu historial académico.
            </Text>
            <Pressable onPress={onShowPrivacyCenter} className="mt-2 flex-row items-center gap-1">
              <Text className="text-[12px] font-bold" style={{ color: colors.textSecondary }}>Centro de privacidad</Text>
              <Ionicons name="open-outline" size={13} color="#A78BFA" />
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
  return (
    <Panel title="Datos">
      <AccountDataRequestsCard
        deletingAccount={deletingAccount}
        onRequestDeletion={onRequestDeletion}
      />

      <View className="mt-4 rounded-lg border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <Text className="font-bold" style={{ color: colors.text }}>Zona de datos</Text>
        <Text className="mb-3 mt-1 text-[12px]" style={{ color: colors.textSecondary }}>
          {isTeacher
            ? 'Puedes limpiar progreso o reiniciar por completo tu espacio docente. Estas acciones no se pueden deshacer.'
            : 'Elimina selectivamente progreso, cursos o preferencias guardadas. Estas acciones no se pueden deshacer.'}
        </Text>

        <View className="gap-2">
          <DangerDataRow
            icon="trash-outline"
            title={isTeacher ? 'Eliminar progreso de alumnos' : 'Eliminar puntuaciones'}
            description={isTeacher ? 'Borra puntuaciones e intentos de alumnos en tus cursos.' : 'Borra tus puntuaciones y reinicia tu XP global.'}
            deletingData={deletingData}
            onPress={() => onDeletePartialData('scores')}
          />
          <DangerDataRow
            icon={isTeacher ? 'folder-open-outline' : 'exit-outline'}
            title={isTeacher ? 'Eliminar cursos y contenido' : 'Salir de todos los cursos'}
            description={isTeacher ? 'Borra cursos, clases, temas, preguntas, respuestas e inscripciones.' : undefined}
            deletingData={deletingData}
            onPress={() => onDeletePartialData('enrollments')}
          />
          <DangerDataRow
            icon="warning-outline"
            title={isTeacher ? 'Eliminar todos mis datos docentes' : 'Eliminar datos de uso'}
            description={
              isTeacher
                ? 'Borra cursos, clases, temas, preguntas, respuestas, inscripciones, puntuaciones, intentos, preferencias, notificaciones y avatar.'
                : 'Borra progreso, intentos, preferencias, notificaciones y avatar.'
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
        <Ionicons name={icon} size={16} color="#FB7185" />
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-semibold" style={{ color: colors.text }}>{title}</Text>
          {description ? <Text className="mt-1 text-[12px]" style={{ color: colors.textSecondary }}>{description}</Text> : null}
        </View>
      </View>

      {deletingData ? (
        <ActivityIndicator size="small" color="#FB7185" />
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#FB7185" />
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
  return (
    <Panel title="Seguridad">
      {!securityOnly ? (
        <ActionRow
          icon="lock-closed-outline"
          title="Gestionar seguridad"
          description="Cambiar contraseña y borrar cuenta en una pantalla dedicada."
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
  return (
    <Panel title="Acerca de OmniQuest">
      <View className="gap-4">
        <Text className="text-[13px] leading-5" style={{ color: colors.textSecondary }}>
          OmniQuest es una plataforma educativa gamificada para practicar contenidos mediante cursos, clases, temas y preguntas interactivas.
        </Text>

        <View className="rounded-xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
          <Text className="text-[12px]" style={{ color: colors.textMuted }}>Versión</Text>
          <Text className="mt-1 font-black" style={{ color: colors.text }}>1.0.0</Text>
        </View>

        <ActionRow
          icon="help-circle-outline"
          title="Centro de ayuda"
          description="Consulta ayuda, soporte y preguntas frecuentes."
          onPress={onOpenHelpCenter}
        />
      </View>
    </Panel>
  )
}
