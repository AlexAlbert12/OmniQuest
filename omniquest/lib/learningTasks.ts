export type LearningTaskStatus = 'draft' | 'published' | 'closed'
export type LearningTaskPriority = 'low' | 'normal' | 'high'
export type StudentTaskFilter = 'upcoming' | 'overdue' | 'completed' | 'all'

export type LearningTask = {
  id: number
  subject_id: number
  classroom_id: number
  topic_id: number | null
  teacher_id?: string
  title: string
  description: string | null
  starts_at: string | null
  due_at: string
  status: LearningTaskStatus
  priority: LearningTaskPriority
  created_at?: string
  updated_at?: string
  subject_name: string
  classroom_name: string
  topic_name: string | null
  theme_color: string | null
  completed_count?: number
  student_count?: number
  is_completed?: boolean
  completed_at?: string | null
  student_status?: 'upcoming' | 'overdue' | 'completed'
}

export type LearningTaskPage = {
  items: LearningTask[]
  total: number
}

export const taskStatusOptions: { value: LearningTaskStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicada' },
  { value: 'closed', label: 'Cerrada' },
]

export const taskPriorityOptions: { value: LearningTaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Baja', color: '#60A5FA' },
  { value: 'normal', label: 'Normal', color: '#A78BFA' },
  { value: 'high', label: 'Alta', color: '#F59E0B' },
]

export function getTaskPriorityMeta(priority: LearningTaskPriority | string | null | undefined) {
  return taskPriorityOptions.find((item) => item.value === priority) || taskPriorityOptions[1]
}

export function getTaskStatusLabel(status: LearningTaskStatus | string | null | undefined) {
  return taskStatusOptions.find((item) => item.value === status)?.label || 'Sin estado'
}

export function isTaskOverdue(task: Pick<LearningTask, 'due_at' | 'is_completed'>) {
  return !task.is_completed && new Date(task.due_at).getTime() < Date.now()
}

export function formatTaskDate(value: string | null | undefined, includeTime = true) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
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

export function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

export function endOfMonthExclusive(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 1)
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
