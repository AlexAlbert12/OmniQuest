import React from 'react'
import { View } from 'react-native'
import { createShadowStyle } from '../../../lib/platformShadow'
import { MOBILE_BOTTOM_NAV_HEIGHT } from '../../../lib/mobileLayout'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppButton from '../../ui/AppButton'

export default function CreateCourseCTA({ label = 'Crear curso', onPress, sticky = false }: {
  label?: string
  onPress: () => void
  sticky?: boolean
}) {
  const insets = useSafeAreaInsets()

  return (
    <View
      className={sticky ? 'absolute left-4 right-4' : 'mt-5'}
      style={sticky ? [createShadowStyle({
        color: '#000000',
        opacity: 0.35,
        radius: 14,
        offsetY: 8,
        elevation: 12,
        web: '0 8px 28px rgba(0, 0, 0, 0.35)',
      }), { bottom: MOBILE_BOTTOM_NAV_HEIGHT + insets.bottom + 18, zIndex: 30 }] : undefined}
    >
      <AppButton
        accessibilityLabel={label}
        fullWidth
        icon="add"
        label={label}
        role="teacher"
        size="lg"
        onPress={onPress}
      />
    </View>
  )
}
