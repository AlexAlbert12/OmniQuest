import React from 'react'
import { Text, View } from 'react-native'
import OmniGuide from '../../OmniGuide'
import { useI18n } from '../../../lib/i18n'

export default function SubjectTabState({ error, loading }: { error: string | null; loading: boolean }) {
  const { t } = useI18n()
  if (loading) {
    return (
      <View className="items-center rounded-2xl border border-border-default bg-surface-default p-10">
        <OmniGuide state="blink" size={88} />
        <Text className="mt-3 text-center text-text-muted">{t('loading.omni')}</Text>
      </View>
    )
  }
  if (error) {
    return (
      <View className="rounded-xl border border-semantic-danger bg-semantic-surface-danger p-4">
        <Text className="font-bold text-semantic-danger">{error}</Text>
      </View>
    )
  }
  return null
}
