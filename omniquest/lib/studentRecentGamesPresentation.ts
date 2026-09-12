export function formatDurationShort(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, '0')}s` : `${seconds}s`
}
