import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, TextInput, View } from 'react-native'
import { useTeacherCommunicationSettings } from '../../hooks/teacher/useTeacherCommunicationSettings'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import AppButton from '../ui/AppButton'
import AppStatusBanner from '../ui/AppStatusBanner'
import { NotificationRow, Panel } from './SettingsUi'
import type { TeacherDigestFrequency } from './SettingsTypes'

const WEEKDAYS = [
  { value: 1, es: 'Lunes', en: 'Monday' },
  { value: 2, es: 'Martes', en: 'Tuesday' },
  { value: 3, es: 'Miércoles', en: 'Wednesday' },
  { value: 4, es: 'Jueves', en: 'Thursday' },
  { value: 5, es: 'Viernes', en: 'Friday' },
  { value: 6, es: 'Sábado', en: 'Saturday' },
  { value: 7, es: 'Domingo', en: 'Sunday' },
]

export default function TeacherDeliveryPreferencesPanel({ dateFormat, timeFormat, weekStart }: { dateFormat: string; timeFormat: string; weekStart: string }) {
  const { tokens } = useAppTheme()
  const { locale, t } = useI18n()
  const settings = useTeacherCommunicationSettings()
  const [emailDraft, setEmailDraft] = useState('')
  const orderedWeekdays = weekStart === 'sunday' ? [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)] : WEEKDAYS
  const formatConfiguredDate = (value: Date | string | number) => formatTeacherDate(value, locale, dateFormat, timeFormat)

  useEffect(() => setEmailDraft(settings.global.reminderEmail), [settings.global.reminderEmail])

  if (settings.loading) {
    return (
      <Panel title="Alertas, entrega y resumen">
        <View style={{ minHeight: 120, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={tokens.brand.teacher} />
          <Text style={{ marginTop: 10, color: tokens.text.muted }}>Cargando preferencias…</Text>
        </View>
      </Panel>
    )
  }

  return (
    <Panel title="Alertas, entrega y resumen">
      {settings.error ? (
        <AppStatusBanner
          style={{ marginBottom: 14 }}
          variant="warning"
          title="Preferencias sin actualizar"
          message={settings.error}
          actionLabel="Reintentar"
          onAction={() => void settings.refresh()}
        />
      ) : null}

      <Section
        icon="notifications-outline"
        title="Alertas"
        description="Decide qué situaciones deben generar avisos para tu actividad docente."
      >
        <View style={{ overflow: 'hidden' }}>
          <NotificationRow
            icon="time-outline"
            title="Alumnos sin actividad"
            description={t('settings.teacher.inactive.description')}
            enabled={settings.global.inactiveStudentAlerts}
            disabled={settings.savingKey !== null}
            loading={settings.savingKey === 'inactiveStudentAlerts'}
            onPress={() => void settings.saveGlobalPreferences({ inactiveStudentAlerts: !settings.global.inactiveStudentAlerts })}
          />
          <NotificationRow
            icon="create-outline"
            title="Revisiones manuales pendientes"
            description={t('settings.teacher.reviews.description')}
            enabled={settings.global.openReviewAlerts}
            disabled={settings.savingKey !== null}
            loading={settings.savingKey === 'openReviewAlerts'}
            onPress={() => void settings.saveGlobalPreferences({ openReviewAlerts: !settings.global.openReviewAlerts })}
          />
          <NotificationRow
            icon="shield-checkmark-outline"
            title="Alertas de auditoría"
            description={t('settings.teacher.sensitive.description')}
            enabled={settings.global.auditAlerts}
            disabled={settings.savingKey !== null}
            loading={settings.savingKey === 'auditAlerts'}
            onPress={() => void settings.saveGlobalPreferences({ auditAlerts: !settings.global.auditAlerts })}
          />
        </View>
      </Section>

      <Section
        icon="phone-portrait-outline"
        title="Canales"
        description="Controla la entrega push en este dispositivo. El correo se gestiona directamente desde el resumen docente."
      >
        <NotificationRow
          icon="notifications-outline"
          title="Notificaciones push"
          description={settings.pushRegistrationStatus === 'unsupported'
            ? 'Este dispositivo no admite notificaciones push.'
            : settings.global.pushEnabled
              ? 'Este dispositivo puede recibir avisos docentes.'
              : 'Actívalas para recibir avisos docentes fuera de la aplicación.'}
          enabled={settings.global.pushEnabled}
          disabled={settings.savingKey !== null}
          loading={settings.savingKey === 'pushEnabled'}
          onPress={() => void settings.saveGlobalPreferences({ pushEnabled: !settings.global.pushEnabled })}
        />
      </Section>

      <Section
        icon="mail-outline"
        title="Frecuencia del resumen docente"
        description="Elige si quieres recibir un resumen diario o semanal y consulta aquí su historial."
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {([
            ['off', 'Desactivado'],
            ['daily', 'Diario'],
            ['weekly', 'Semanal'],
          ] as [TeacherDigestFrequency, string][]).map(([frequency, label]) => (
            <AppButton
              key={frequency}
              label={label}
              icon={settings.global.digestFrequency === frequency ? 'checkmark-circle' : 'ellipse-outline'}
              role="teacher"
              size="sm"
              variant={settings.global.digestFrequency === frequency ? 'primary' : 'secondary'}
              disabled={settings.savingKey === 'digest'}
              onPress={() => void settings.saveDigest({ digestFrequency: frequency })}
            />
          ))}
        </View>

        {settings.global.digestFrequency !== 'off' ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <TextInput
              accessibilityLabel="Correo para recordatorios"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={emailDraft}
              onChangeText={setEmailDraft}
              placeholder="profesor@centro.es"
              placeholderTextColor={tokens.text.muted}
              style={inputStyle(tokens)}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[7, 13, 18].map((hour) => (
                <AppButton
                  key={hour}
                  label={`${String(hour).padStart(2, '0')}:00`}
                  size="sm"
                  variant={settings.global.digestHour === hour ? 'primary' : 'secondary'}
                  onPress={() => settings.setGlobalDraft((current) => ({ ...current, digestHour: hour }))}
                />
              ))}
            </View>
            {settings.global.digestFrequency === 'weekly' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {orderedWeekdays.map((day) => (
                  <AppButton
                    key={day.value}
                    label={(locale === 'en-US' ? day.en : day.es).slice(0, 3)}
                    size="sm"
                    variant={settings.global.digestWeekday === day.value ? 'primary' : 'secondary'}
                    onPress={() => settings.setGlobalDraft((current) => ({ ...current, digestWeekday: day.value }))}
                  />
                ))}
              </View>
            ) : null}
            <AppButton
              label="Guardar programación"
              icon="save-outline"
              role="teacher"
              loading={settings.savingKey === 'digest'}
              onPress={() => void settings.saveDigest({ reminderEmail: emailDraft })}
            />
            <Text style={{ color: tokens.text.muted, fontSize: 11, lineHeight: 16 }}>
              Último envío: {settings.global.lastDigestSentAt ? formatConfiguredDate(settings.global.lastDigestSentAt) : 'todavía no se ha enviado ningún resumen'}.
            </Text>
          </View>
        ) : (
          <Text style={{ marginTop: 10, color: tokens.text.muted, fontSize: 11, lineHeight: 16 }}>Al desactivar el resumen también se desactiva su entrega por email.</Text>
        )}
      </Section>

      <Section
        icon="volume-mute-outline"
        title="Silenciar temporalmente"
        description="Las alertas informativas se aplazan. Las alertas críticas de seguridad o revisión continúan visibles."
      >
        {settings.global.mutedUntil && new Date(settings.global.mutedUntil).getTime() > Date.now() ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: tokens.text.secondary, fontSize: 12 }}>Silenciado hasta {formatConfiguredDate(settings.global.mutedUntil)}.</Text>
            <AppButton label="Reactivar ahora" icon="volume-high-outline" size="sm" variant="secondary" loading={settings.savingKey === 'mute'} onPress={() => void settings.setMute(null)} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AppButton label="1 hora" size="sm" variant="secondary" onPress={() => void settings.setMute(new Date(Date.now() + 60 * 60 * 1000).toISOString())} />
            <AppButton label="8 horas" size="sm" variant="secondary" onPress={() => void settings.setMute(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString())} />
            <AppButton label="24 horas" size="sm" variant="secondary" onPress={() => void settings.setMute(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())} />
          </View>
        )}
      </Section>

      <Section
        icon="book-outline"
        title="Preferencias por curso"
        description="Decide qué cursos generan alertas críticas, informativas y contenido para el resumen."
      >
        <View style={{ gap: 9 }}>
          {settings.courses.map((course) => {
            const saving = settings.savingKey === `course:${course.subjectId}`
            const muted = Boolean(course.mutedUntil && new Date(course.mutedUntil).getTime() > Date.now())
            return (
              <View key={course.subjectId} style={{ borderRadius: 14, borderWidth: 1, borderColor: tokens.border.subtle, backgroundColor: tokens.surface.default, padding: 12 }}>
                <Text style={{ color: tokens.text.primary, fontWeight: '900' }}>{course.subjectName}</Text>
                {muted ? <Text style={{ marginTop: 4, color: tokens.text.muted, fontSize: 11 }}>Informativas silenciadas hasta {formatConfiguredDate(course.mutedUntil as string)}.</Text> : null}
                <View style={{ marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  <ToggleButton label="Críticas" enabled={course.criticalEnabled} disabled={saving} onPress={() => void settings.saveCourse(course.subjectId, { criticalEnabled: !course.criticalEnabled })} />
                  <ToggleButton label="Informativas" enabled={course.informativeEnabled} disabled={saving} onPress={() => void settings.saveCourse(course.subjectId, { informativeEnabled: !course.informativeEnabled })} />
                  <ToggleButton label="En resumen" enabled={course.digestEnabled} disabled={saving} onPress={() => void settings.saveCourse(course.subjectId, { digestEnabled: !course.digestEnabled })} />
                  <AppButton label={muted ? 'Reactivar curso' : 'Silenciar 24 h'} icon={muted ? 'volume-high-outline' : 'volume-mute-outline'} size="sm" variant="secondary" disabled={saving} onPress={() => void settings.saveCourse(course.subjectId, { mutedUntil: muted ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })} />
                </View>
              </View>
            )
          })}
          {settings.courses.length === 0 ? <Text style={{ color: tokens.text.muted }}>No hay cursos activos.</Text> : null}
        </View>
      </Section>

      <Section
        icon="receipt-outline"
        title="Historial del resumen docente"
        description="Últimos resúmenes enviados a tu correo."
      >
        <View style={{ gap: 8 }}>
          {settings.history.slice(0, 5).map((delivery) => (
            <View key={delivery.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 11, backgroundColor: tokens.surface.default }}>
              <Ionicons name={delivery.status === 'sent' ? 'checkmark-circle-outline' : delivery.status === 'failed' ? 'alert-circle-outline' : 'time-outline'} size={19} color={delivery.status === 'sent' ? tokens.semantic.success : delivery.status === 'failed' ? tokens.semantic.danger : tokens.semantic.info} />
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text style={{ color: tokens.text.primary, fontSize: 12, fontWeight: '900' }}>{delivery.frequency === 'weekly' ? 'Resumen semanal' : 'Resumen diario'} · {deliveryStatusLabel(delivery.status, locale)}</Text>
                <Text numberOfLines={1} style={{ marginTop: 2, color: tokens.text.muted, fontSize: 10 }}>{delivery.recipientEmail} · {formatConfiguredDate(delivery.sentAt || delivery.periodEnd)}</Text>
              </View>
            </View>
          ))}
          {settings.history.length === 0 ? <Text style={{ color: tokens.text.muted }}>Aún no hay entregas registradas.</Text> : null}
        </View>
      </Section>
    </Panel>
  )
}

function deliveryStatusLabel(status: string, locale: 'es-ES' | 'en-US') {
  if (status === 'sent') return locale === 'en-US' ? 'Sent' : 'Enviado'
  if (status === 'failed') return locale === 'en-US' ? 'Failed' : 'Fallido'
  if (status === 'processing') return locale === 'en-US' ? 'Processing' : 'Procesando'
  return locale === 'en-US' ? 'Queued' : 'En cola'
}

function formatTeacherDate(value: Date | string | number, locale: 'es-ES' | 'en-US', dateFormat: string, timeFormat: string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  const dateText = dateFormat === 'MM/DD/YYYY' ? `${month}/${day}/${year}` : dateFormat === 'YYYY-MM-DD' ? `${year}-${month}-${day}` : `${day}/${month}/${year}`
  const timeText = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' }).format(date)
  return `${dateText}, ${timeText}`
}

function Section({ icon, title, description, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; children: React.ReactNode }) {
  const { tokens } = useAppTheme()
  return (
    <View style={{ marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.surface.raised, padding: 15 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Ionicons name={icon} size={20} color={tokens.brand.teacher} />
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={{ color: tokens.text.primary, fontSize: 13, fontWeight: '900' }}>{title}</Text>
          <Text style={{ marginTop: 3, color: tokens.text.secondary, fontSize: 11, lineHeight: 17 }}>{description}</Text>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  )
}

function ToggleButton({ label, enabled, disabled, onPress }: { label: string; enabled: boolean; disabled: boolean; onPress: () => void }) {
  return <AppButton label={label} icon={enabled ? 'checkmark-circle' : 'ellipse-outline'} size="sm" disabled={disabled} variant={enabled ? 'primary' : 'secondary'} onPress={onPress} />
}

function inputStyle(tokens: ReturnType<typeof useAppTheme>['tokens']) {
  return { minHeight: 48, borderWidth: 1, borderColor: tokens.border.default, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: tokens.surface.default, color: tokens.text.primary, fontSize: 13 } as const
}
