import * as Clipboard from 'expo-clipboard'
import { Platform, Share } from 'react-native'

export type ShareCourseCodeResult = 'shared' | 'copied' | 'cancelled'

export async function copyCourseCode(code: string) {
  const normalizedCode = code.trim()
  if (!normalizedCode) throw new Error('No hay un código de curso disponible.')
  const copied = await Clipboard.setStringAsync(normalizedCode)
  if (!copied) throw new Error('No se pudo copiar el código al portapapeles.')
}

export async function shareCourseCode({ code, subjectName, locale = 'es-ES' }: { code: string; subjectName: string; locale?: 'es-ES' | 'en-US' }): Promise<ShareCourseCodeResult> {
  const normalizedCode = code.trim()
  if (!normalizedCode) throw new Error('No hay un código de curso disponible.')
  const title = locale === 'en-US' ? `Join ${subjectName} in OmniQuest` : `Únete a ${subjectName} en OmniQuest`
  const message = locale === 'en-US' ? `Use course code ${normalizedCode} to join ${subjectName} in OmniQuest.` : `Usa el código ${normalizedCode} para unirte a ${subjectName} en OmniQuest.`

  if (Platform.OS === 'web') {
    const webNavigator = typeof navigator !== 'undefined' ? navigator as unknown as { share?: (data: { title?: string; text?: string }) => Promise<void> } : null
    if (webNavigator?.share) {
      try {
        await webNavigator.share({ title, text: message })
        return 'shared'
      } catch (error) {
        if (isShareCancelled(error)) return 'cancelled'
      }
    }
    await copyCourseCode(normalizedCode)
    return 'copied'
  }

  const result = await Share.share({ title, message })
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared'
}

function isShareCancelled(error: unknown) {
  return error instanceof Error && (error.name === 'AbortError' || /cancel/i.test(error.message))
}
