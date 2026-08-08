import { Platform } from 'react-native'

/**
 * Releases focus before a web route or modal hides the current React Native
 * view. This prevents focused descendants from becoming aria-hidden.
 */
export function releaseWebFocus() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return

  const activeElement = document.activeElement as (Element & { blur?: () => void }) | null
  activeElement?.blur?.()
}
