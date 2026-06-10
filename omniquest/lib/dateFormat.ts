export function formatShortDate(value?: string | Date | null) {
  const date = toValidDate(value)
  if (!date) return 'Fecha sin registrar'

  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date)
}

export function formatLongDate(value?: string | Date | null, fallback = 'Fecha sin registrar') {
  const date = toValidDate(value)
  if (!date) return fallback

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatRelativeDate(value?: string | Date | null) {
  const date = toValidDate(value)
  if (!date) return 'Sin fecha'

  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} dias`
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`

  return formatShortDate(date)
}

function toValidDate(value?: string | Date | null) {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
