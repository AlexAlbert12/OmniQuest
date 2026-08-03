import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import type { StudentHomeAchievementPreview } from './types'

function StudentHomeAchievements({
  achievements,
  onOpen,
}: {
  achievements: StudentHomeAchievementPreview[]
  onOpen: () => void
}) {
  const { tokens } = useAppTheme()

  return (
    <View className="rounded-[24px] border border-border-default bg-surface-default p-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[18px] font-black text-white">Logros próximos</Text>
          <Text className="mt-1 text-[13px] text-text-muted">Tres objetivos para mantener el ritmo.</Text>
        </View>
        <Ionicons name="ribbon-outline" size={25} color={tokens.brand.student} />
      </View>

      <View className="mt-4 gap-3">
        {achievements.map((achievement) => <StudentHomeAchievementRow key={achievement.id} achievement={achievement} />)}
      </View>

      <AppButton label="Ver todos los logros" variant="ghost" size="sm" icon="arrow-forward" iconPosition="right" onPress={onOpen} style={{ marginTop: 14 }} />
    </View>
  )
}

export default React.memo(StudentHomeAchievements)

const StudentHomeAchievementRow = React.memo(function StudentHomeAchievementRow({ achievement }: { achievement: StudentHomeAchievementPreview }) {
  const { tokens } = useAppTheme()
  const color = getAchievementColor(achievement.colorRole, tokens)
  const progress = Math.min(100, Math.round((achievement.current / Math.max(achievement.target, 1)) * 100))

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised p-3">
      <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(color, '24') }}>
        <Ionicons name={achievement.unlocked ? 'checkmark-circle' : achievement.icon} size={22} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text maxFontSizeMultiplier={2} className="text-[13px] font-black text-white">{achievement.title}</Text>
        <Text maxFontSizeMultiplier={2} className="mt-0.5 text-[11px] text-text-muted">{achievement.description}</Text>
        <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-interactive">
          <View className="h-full rounded-full" style={{ width: `${Math.max(achievement.current > 0 ? 4 : 0, progress)}%`, backgroundColor: color }} />
        </View>
      </View>
      <Text className="text-[11px] font-black" style={{ color }}>
        {achievement.unlocked ? 'Hecho' : `${Math.min(achievement.current, achievement.target)}/${achievement.target}`}
      </Text>
    </View>
  )
})

function getAchievementColor(
  role: StudentHomeAchievementPreview['colorRole'],
  tokens: ReturnType<typeof useAppTheme>['tokens'],
) {
  if (role === 'xp') return tokens.gamification.xp
  if (role === 'streak') return tokens.gamification.streak
  if (role === 'success') return tokens.semantic.success
  return tokens.semantic.info
}
