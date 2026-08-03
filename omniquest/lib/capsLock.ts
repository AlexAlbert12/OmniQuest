export function readCapsLockFromKeyEvent(event: unknown): boolean | null {
  const nativeEvent = (event as { nativeEvent?: unknown })?.nativeEvent as {
    getModifierState?: (key: string) => boolean
  } | undefined
  if (typeof nativeEvent?.getModifierState !== 'function') return null
  return nativeEvent.getModifierState('CapsLock')
}
