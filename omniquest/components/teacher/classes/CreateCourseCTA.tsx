import React from 'react'
import { View } from 'react-native'
import AppButton from '../../ui/AppButton'

export default function CreateCourseCTA({ label = 'Crear curso', onPress }: {
  label?: string
  onPress: () => void
}) {
  return (
    <View className="mt-5">
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
