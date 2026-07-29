import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { useI18n } from '../../lib/i18n'

export default function AuthRoleNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  return (
    <View className="rounded-2xl border border-border-default bg-surface-default px-4 py-3" style={{ gap: compact ? 6 : 9 }}>
      <View className="flex-row items-start gap-2">
        <Ionicons name="person-add-outline" size={18} color="#8CD5FF" />
        <Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[12px] font-bold leading-5 text-text-secondary">
          {t('auth.roles.student')}
        </Text>
      </View>
      <View className="flex-row items-start gap-2">
        <Ionicons name="shield-checkmark-outline" size={18} color="#C4B5FD" />
        <Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[12px] font-bold leading-5 text-text-secondary">
          {t('auth.roles.staff')}
        </Text>
      </View>
    </View>
  )
}
