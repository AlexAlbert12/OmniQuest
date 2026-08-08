export function formatCount(value: number, singular: string, plural: string) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  return `${safeValue.toLocaleString()} ${safeValue === 1 ? singular : plural}`
}
