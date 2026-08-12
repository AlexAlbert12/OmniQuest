import React from 'react'
import { Text, View } from 'react-native'
import OmniGuide from '../OmniGuide'
import { useI18n } from '../../lib/i18n'

export default function OmniLoadingScreen({ message }: { message?: string }) {
  const { t } = useI18n()
  const label = message || t('loading.omni')
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} className="w-full flex-1 items-center justify-center bg-background-primary px-6">
      <OmniGuide state="blink" size={116} />
      <Text maxFontSizeMultiplier={2} className="mt-4 text-center text-text-muted">{label}</Text>
    </View>
  )
}
