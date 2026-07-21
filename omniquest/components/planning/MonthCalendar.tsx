import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { addMonths, getMonthGrid, sameCalendarDay, type LearningTask } from '../../lib/learningTasks'

type MonthCalendarProps = {
  month: Date
  selectedDate: Date | null
  tasks: LearningTask[]
  onMonthChange: (next: Date) => void
  onSelectDate: (date: Date) => void
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function MonthCalendar({
  month,
  selectedDate,
  tasks,
  onMonthChange,
  onSelectDate,
}: MonthCalendarProps) {
  const { colors, accentColor } = useAppTheme()
  const days = useMemo(() => getMonthGrid(month), [month])
  const countsByDay = useMemo(() => {
    const counts = new Map<string, number>()
    tasks.forEach((task) => {
      const date = new Date(task.due_at)
      if (Number.isNaN(date.getTime())) return
      const key = dayKey(date)
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return counts
  }, [tasks])
  const today = new Date()
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(month)

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Mes anterior"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onMonthChange(addMonths(month, -1))}
          style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.72 : 1 }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{capitalize(monthLabel)}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Selecciona un día para filtrar la planificación</Text>
        </View>
        <Pressable
          accessibilityLabel="Mes siguiente"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onMonthChange(addMonths(month, 1))}
          style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.72 : 1 }]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={[styles.weekday, { color: colors.textMuted }]}>{day}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((date) => {
          const isCurrentMonth = date.getMonth() === month.getMonth()
          const isSelected = selectedDate ? sameCalendarDay(date, selectedDate) : false
          const isToday = sameCalendarDay(date, today)
          const count = countsByDay.get(dayKey(date)) || 0
          return (
            <Pressable
              key={date.toISOString()}
              accessibilityLabel={`${date.toLocaleDateString('es-ES')}${count ? `, ${count} tareas` : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectDate(date)}
              style={({ pressed }) => [
                styles.day,
                {
                  borderColor: isSelected ? accentColor : isToday ? withAlpha(accentColor, '75') : 'transparent',
                  backgroundColor: isSelected ? withAlpha(accentColor, '24') : pressed ? colors.surfaceMuted : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.dayNumber,
                  { color: isSelected ? accentColor : isCurrentMonth ? colors.text : withAlpha(colors.textMuted, '80') },
                ]}
              >
                {date.getDate()}
              </Text>
              <View style={styles.dots}>
                {Array.from({ length: Math.min(count, 3) }, (_, index) => (
                  <View key={index} style={[styles.dot, { backgroundColor: index === 0 ? accentColor : colors.textMuted }]} />
                ))}
                {count > 3 ? <Text style={[styles.more, { color: colors.textMuted }]}>+{count - 3}</Text> : null}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { minWidth: 0, flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { marginTop: 2, fontSize: 11, textAlign: 'center' },
  iconButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  weekRow: { marginTop: 16, flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  grid: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: `${100 / 7}%`, minHeight: 54, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 13, fontWeight: '900' },
  dots: { minHeight: 10, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 999 },
  more: { fontSize: 8, fontWeight: '800' },
})
