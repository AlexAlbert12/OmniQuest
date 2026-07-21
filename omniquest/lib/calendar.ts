export function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

export function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1)
}

export function sameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function getMonthGrid(value: Date) {
  const first = startOfMonth(value)
  const mondayBasedOffset = (first.getDay() + 6) % 7
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - mondayBasedOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

export function toDateTimeInputValue(value: string | Date | null | undefined) {
  const date = value instanceof Date ? value : value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function parseDateTimeInput(value: string) {
  const normalized = value.trim().replace('T', ' ')
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/)
  if (!match) return null
  const [, year, month, day, hour = '23', minute = '59'] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0)
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
    || date.getHours() !== Number(hour)
    || date.getMinutes() !== Number(minute)
  ) return null
  return date
}

export function combineDateAndTime(date: Date, time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  const hour = match ? Math.min(23, Number(match[1])) : 23
  const minute = match ? Math.min(59, Number(match[2])) : 59
  const result = new Date(date)
  result.setHours(hour, minute, 0, 0)
  return result
}
