export function formatShortDate(value?: string | Date | null, locale = 'es-ES') {
  const date = toValidDate(value)
  if (!date) return locale.toLowerCase().startsWith('en') ? 'Date not recorded' : 'Fecha sin registrar'

  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(date)
}

export function formatLongDate(value?: string | Date | null, fallback?: string, locale = 'es-ES') {
  const date = toValidDate(value)
  if (!date) return fallback ?? (locale.toLowerCase().startsWith('en') ? 'Date not recorded' : 'Fecha sin registrar')

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatRelativeDate(value?: string | Date | null, locale = 'es-ES') {
  const date = toValidDate(value)
  const english = locale.toLowerCase().startsWith('en')
  if (!date) return english ? 'No date' : 'Sin fecha'

  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return english ? 'Today' : 'Hoy'
  if (diffDays === 1) return english ? 'Yesterday' : 'Ayer'
  if (diffDays < 7) return english ? `${diffDays} days ago` : `Hace ${diffDays} días`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    if (english) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
    return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  }

  return formatShortDate(date, locale)
}

function toValidDate(value?: string | Date | null) {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
