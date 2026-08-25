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
  selectionColor?: string
}

export default function DateCalendar({
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
  subtitle = 'Selecciona una fecha',
  locale = 'es-ES',
  minimumDate = null,
  selectionColor,
}: DateCalendarProps) {
  const { accentColor, tokens } = useAppTheme()
  const activeColor = selectionColor || accentColor
  const days = useMemo(() => getMonthGrid(month), [month])
  const weeks = useMemo(() => Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7)), [days])
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, index + 1))), [locale])
  const today = new Date()
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)
  const minimumDay = minimumDate ? startOfDay(minimumDate) : null

  return (
    <View style={[styles.card, { borderColor: tokens.border.default, backgroundColor: tokens.surface.default }]}>
      <View style={styles.header}>
        <AppPressable
          accessibilityLabel={locale === 'en-US' ? 'Previous month' : 'Mes anterior'}
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
          accessibilityLabel={locale === 'en-US' ? 'Next month' : 'Mes siguiente'}
          onPress={() => onMonthChange(addMonths(month, 1))}
          style={({ pressed }) => [styles.iconButton, { borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive, opacity: pressed ? 0.72 : 1 }]}
        >
          <Ionicons name="chevron-forward" size={20} color={tokens.text.primary} />
        </AppPressable>
      </View>

      <View style={styles.weekRow}>
        {weekdays.map((day, index) => (
          <Text key={`${day}-${index}`} style={[styles.weekday, { color: tokens.text.muted }]}>{day}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.dayRow}>
            {week.map((date) => {
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
                      borderColor: isSelected ? activeColor : isToday ? withAlpha(activeColor, '75') : 'transparent',
                      backgroundColor: isSelected ? withAlpha(activeColor, '24') : pressed ? tokens.surface.interactive : 'transparent',
                      opacity: disabled ? 0.28 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: isSelected ? activeColor : isCurrentMonth ? tokens.text.primary : withAlpha(tokens.text.muted, '80') },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </AppPressable>
              )
            })}
          </View>
        ))}
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
  weekRow: { marginTop: 12, flexDirection: 'row', gap: 4 },
  weekday: { minWidth: 0, flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '900' },
  grid: { marginTop: 5, gap: 4 },
  dayRow: { flexDirection: 'row', gap: 4 },
  day: { minWidth: 0, flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 12, fontWeight: '900' },
})
