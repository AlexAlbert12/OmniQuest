import React from 'react'
import { View } from 'react-native'
import AppButton from '../../ui/AppButton'

type Props = {
  onOpenProgress: () => void
  onOpenActivity: () => void
  onOpenAchievements: () => void
  onOpenSettings: () => void
}

export default function StudentProfileQuickActions({
  onOpenProgress,
  onOpenActivity,
  onOpenAchievements,
  onOpenSettings,
}: Props) {
  return (
    <View className="flex-row flex-wrap gap-3">
      <AppButton label="Progreso" icon="stats-chart-outline" role="student" variant="secondary" onPress={onOpenProgress} />
      <AppButton label="Actividad" icon="time-outline" role="student" variant="secondary" onPress={onOpenActivity} />
      <AppButton label="Logros" icon="ribbon-outline" role="student" variant="secondary" onPress={onOpenAchievements} />
      <AppButton label="Configuración" icon="settings-outline" role="student" variant="secondary" onPress={onOpenSettings} />
    </View>
  )
}
