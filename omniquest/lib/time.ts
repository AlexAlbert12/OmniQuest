export function getTimeAgo(value?: string | null): string {
  if (!value) return 'Sin fecha'

  const date = new Date(value)
  const timestamp = date.getTime()

  if (Number.isNaN(timestamp)) return 'Sin fecha'

  const now = new Date()
  const diffMs = now.getTime() - timestamp
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return 'Hace menos de 1h'
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays === 1) return 'Ayer'
  return `Hace ${diffDays} días`
}

export default { getTimeAgo }
