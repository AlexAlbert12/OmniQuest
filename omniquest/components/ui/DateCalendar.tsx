import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from './AppPressable'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { addMonths, getMonthGrid, sameCalendarDay } from '../../lib/calendar'

type DateCalendarProps = {
  month: Date
  selectedDate: Date | null
  onMonthChange: (next: Date) => void
  onSelectDate: (date: Date) => void
  subtitle?: string
  locale?: string
  minimumDate?: Date | null
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function DateCalendar({
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
  subtitle = 'Selecciona una fecha',
  locale = 'es-ES',
  minimumDate = null,
}: DateCalendarProps) {
  const { accentColor, tokens } = useAppTheme()
  const days = useMemo(() => getMonthGrid(month), [month])
  const today = new Date()
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)
  const minimumDay = minimumDate ? startOfDay(minimumDate) : null

  return (
    <View style={[styles.card, { borderColor: tokens.border.default, backgroundColor: tokens.surface.default }]}>
      <View style={styles.header}>
        <AppPressable
          accessibilityLabel="Mes anterior"
          onPress={() => onMonthChange(addMonths(month, -1))}
          style={({ pressed }) => [styles.iconButton, { borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, opacity: pressed ? 0.72 : 1 }]}
        >
          <Ionicons name="chevron-back" size={20} color={tokens.text.primary} />
        </AppPressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tokens.text.primary }]}>{capitalize(monthLabel)}</Text>
          <Text style={[styles.subtitle, { color: tokens.text.muted }]}>{subtitle}</Text>
        </View>
        <AppPressable
          accessibilityLabel="Mes siguiente"
          onPress={() => onMonthChange(addMonths(month, 1))}
          style={({ pressed }) => [styles.iconButton, { borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, opacity: pressed ? 0.72 : 1 }]}
        >
          <Ionicons name="chevron-forward" size={20} color={tokens.text.primary} />
        </AppPressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={[styles.weekday, { color: tokens.text.muted }]}>{day}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((date) => {
          const isCurrentMonth = date.getMonth() === month.getMonth()
          const isSelected = selectedDate ? sameCalendarDay(date, selectedDate) : false
          const isToday = sameCalendarDay(date, today)
          const disabled = minimumDay ? startOfDay(date).getTime() < minimumDay.getTime() : false
          return (
            <AppPressable
              key={date.toISOString()}
              accessibilityLabel={date.toLocaleDateString(locale)}
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onSelectDate(date)}
              style={({ pressed }) => [
                styles.day,
                {
                  borderColor: isSelected ? accentColor : isToday ? withAlpha(accentColor, '75') : 'transparent',
                  backgroundColor: isSelected ? withAlpha(accentColor, '24') : pressed ? tokens.surface.interactive : 'transparent',
                  opacity: disabled ? 0.28 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayNumber,
                  { color: isSelected ? accentColor : isCurrentMonth ? tokens.text.primary : withAlpha(tokens.text.muted, '80') },
                ]}
              >
                {date.getDate()}
              </Text>
            </AppPressable>
          )
        })}
      </View>
    </View>
  )
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { minWidth: 0, flex: 1, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 2, fontSize: 11, textAlign: 'center' },
  iconButton: { width: 40, height: 40, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  weekRow: { marginTop: 14, flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, fontWeight: '900' },
  grid: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: `${100 / 7}%`, minHeight: 44, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 12, fontWeight: '900' },
})
