import { Platform } from 'react-native'

export function releaseWebFocus() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return

  const activeElement = document.activeElement as (Element & { blur?: () => void }) | null
  activeElement?.blur?.()
}
