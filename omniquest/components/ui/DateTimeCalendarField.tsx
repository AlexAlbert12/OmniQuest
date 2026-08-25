import React, { useMemo, useState } from 'react'
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from './AppButton'
import AppPressable from './AppPressable'
import DateCalendar from './DateCalendar'
import { combineDateAndTime, parseDateTimeInput, toDateTimeInputValue } from '../../lib/calendar'
import { useAppTheme } from '../../lib/appTheme'

type DateTimeCalendarFieldProps = {
  value: string
  onChange: (next: string) => void
  label?: string
  helperText?: string
  minimumDate?: Date | null
}

export default function DateTimeCalendarField({
  value,
  onChange,
  label = 'Fecha límite opcional',
  minimumDate = new Date(),
}: DateTimeCalendarFieldProps) {
  const { tokens } = useAppTheme()
  const parsedValue = useMemo(() => parseDateTimeInput(value), [value])
  const [visible, setVisible] = useState(false)
  const [month, setMonth] = useState(parsedValue || new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsedValue)
  const [time, setTime] = useState(parsedValue ? formatTime(parsedValue) : '23:59')

  const open = () => {
    const next = parseDateTimeInput(value)
    setSelectedDate(next)
    setMonth(next || new Date())
    setTime(next ? formatTime(next) : '23:59')
    setVisible(true)
  }

  const confirm = () => {
    if (!selectedDate) {
      onChange('')
      setVisible(false)
      return
    }
    onChange(toDateTimeInputValue(combineDateAndTime(selectedDate, time)))
    setVisible(false)
  }

  return (
    <View>
      <Text style={[styles.label, { color: tokens.text.secondary }]}>{label}</Text>
      <AppPressable
        accessibilityLabel={label}
        accessibilityHint="Abre un calendario para elegir la fecha límite"
        onPress={open}
        style={({ pressed }) => [
          styles.field,
          {
            borderColor: tokens.border.default,
            backgroundColor: tokens.surface.interactive,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <View style={[styles.iconBox, { backgroundColor: tokens.surface.raised }]}>
          <Ionicons name="calendar-outline" size={19} color={tokens.semantic.warning} />
        </View>
        <View style={styles.fieldText}>
          <Text style={[styles.value, { color: parsedValue ? tokens.text.primary : tokens.text.muted }]} numberOfLines={1}>
            {parsedValue
              ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(parsedValue)
              : 'Sin fecha límite'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
      </AppPressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <AppPressable accessibilityLabel="Cerrar calendario" onPress={() => setVisible(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalCard, { borderColor: tokens.border.default, backgroundColor: tokens.background.primary }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={[styles.modalTitle, { color: tokens.text.primary }]}>Seleccionar fecha límite</Text>
                <Text style={[styles.modalSubtitle, { color: tokens.text.muted }]}>El tema quedará bloqueado después de este momento.</Text>
              </View>
              <AppButton accessibilityLabel="Cerrar" variant="ghost" size="sm" icon="close" iconOnly onPress={() => setVisible(false)} />
            </View>

            <DateCalendar
              month={month}
              selectedDate={selectedDate}
              onMonthChange={setMonth}
              onSelectDate={setSelectedDate}
              subtitle="Elige el último día disponible"
              minimumDate={minimumDate}
            />

            <View style={styles.timeSection}>
              <Text style={[styles.label, { color: tokens.text.secondary }]}>Hora de cierre</Text>
              <View style={styles.timeControls}>
                <TextInput
                  accessibilityLabel="Hora de cierre"
                  value={time}
                  onChangeText={(next) => setTime(normalizeTime(next))}
                  placeholder="23:59"
                  placeholderTextColor={tokens.text.muted}
                  keyboardType="numbers-and-punctuation"
                  style={[styles.timeInput, { color: tokens.text.primary, borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }]}
                />
                <AppButton
                  label="Sin límite"
                  variant="secondary"
                  icon="infinite-outline"
                  onPress={() => {
                    setSelectedDate(null)
                    onChange('')
                    setVisible(false)
                  }}
                />
              </View>
            </View>

            <View style={styles.actions}>
              <AppButton label="Cancelar" variant="secondary" onPress={() => setVisible(false)} style={styles.footerButton} />
              <AppButton label="Aplicar fecha" icon="checkmark" onPress={confirm} style={styles.footerButton} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function formatTime(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

function normalizeTime(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '800' },
  field: { minHeight: 68, marginTop: 8, borderWidth: 1, borderRadius: 13, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fieldText: { minWidth: 0, flex: 1 },
  value: { fontSize: 13, fontWeight: '900' },
  helper: { marginTop: 2, fontSize: 10, lineHeight: 14 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(1, 5, 15, 0.82)' },
  modalCard: { width: '100%', maxWidth: 560, borderWidth: 1, borderRadius: 22, padding: 18 },
  modalHeader: { marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalHeaderText: { minWidth: 0, flex: 1 },
  modalTitle: { fontSize: 19, fontWeight: '900' },
  modalSubtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  timeSection: { marginTop: 12, gap: 6 },
  timeControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeInput: { minWidth: 0, flex: 1, height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, textAlign: 'center', fontSize: 15, fontWeight: '900' },
  actions: { marginTop: 14, flexDirection: 'row', gap: 10 },
  footerButton: { minWidth: 0, flex: 1 },
})
