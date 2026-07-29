import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { useI18n } from '../../lib/i18n'

export default function AuthCapsLockWarning({ visible }: { visible: boolean }) {
  const { t } = useI18n()
  if (!visible) return null

  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-start gap-2 rounded-2xl border border-semantic-warning bg-semantic-surface-warning px-3 py-2.5"
    >
      <Ionicons name="keypad-outline" size={17} color="#FBBF24" />
      <Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[12px] font-bold leading-5 text-semantic-warning">
        {t('auth.capsLock.warning')}
      </Text>
    </View>
  )
}
