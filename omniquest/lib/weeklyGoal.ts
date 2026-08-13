import { supabase } from './supabase'

export function getStartOfWeekMonday(date: Date) {
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export async function getWeeklyAttemptCount(userId: string) {
  try {
    const now = new Date()
    const weekStart = getStartOfWeekMonday(now)
    const weekStartIso = weekStart.toISOString()
    const nowIso = now.toISOString()

    const result = await supabase
      .from('attempt_history')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', userId)
      .gte('attempted_at', weekStartIso)
      .lte('attempted_at', nowIso)

    if (result.error) {
      console.error('Error fetching weekly attempt count:', result.error)
      return 0
    }

    return result.count || 0
  } catch (e) {
    console.error('Unexpected error getting weekly attempt count:', e)
    return 0
  }
}

export function getTimeUntilSundayLabel() {
  const now = new Date()
  const endOfSunday = new Date(now)
  const daysUntilSunday = (7 - now.getDay()) % 7
  endOfSunday.setDate(now.getDate() + daysUntilSunday)
  endOfSunday.setHours(23, 59, 59, 999)

  const diffMs = Math.max(0, endOfSunday.getTime() - now.getTime())
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  if (days <= 0) return `${hours}h restantes`
  return `${days}d ${hours}h restantes`
}
