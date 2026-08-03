import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import AppPressable from '../../ui/AppPressable'
import type { StudentBadge } from '../../../lib/studentBadges'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

type Props = {
  badges: StudentBadge[]
  onOpenAll: () => void
}

function StudentProfileAchievements({ badges, onOpenAll }: Props) {
  const { tokens } = useAppTheme()
  return (
    <View className="rounded-2xl border p-5" style={{ backgroundColor: tokens.surface.default, borderColor: tokens.border.default }}>
      <View className="mb-4 flex-row flex-wrap items-center justify-between gap-3">
        <View>
          <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>Últimos logros</Text>
          <Text className="mt-1 text-[12px]" style={{ color: tokens.text.muted }}>Solo mostramos tus hitos más recientes.</Text>
        </View>
        <AppButton label="Ver todos" icon="arrow-forward-outline" iconPosition="right" size="sm" variant="ghost" onPress={onOpenAll} />
      </View>

      {badges.length > 0 ? (
        <View className="gap-3">
          {badges.map((badge) => <StudentProfileBadgeRow key={badge.id} badge={badge} onOpen={onOpenAll} />)}
        </View>
      ) : (
        <View className="items-center rounded-xl border border-dashed px-4 py-7" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.raised }}>
          <Ionicons name="ribbon-outline" size={28} color={tokens.text.muted} />
          <Text className="mt-3 text-center text-[14px] font-black" style={{ color: tokens.text.primary }}>Todavía no hay logros</Text>
          <Text className="mt-1 text-center text-[12px]" style={{ color: tokens.text.muted }}>Completa partidas para desbloquear insignias.</Text>
        </View>
      )}
    </View>
  )
}

export default React.memo(StudentProfileAchievements)

const StudentProfileBadgeRow = React.memo(function StudentProfileBadgeRow({ badge, onOpen }: { badge: StudentBadge; onOpen: () => void }) {
  const { tokens } = useAppTheme()
  return (
    <AppPressable
      accessibilityLabel={`${badge.title}. ${badge.requirement}`}
      accessibilityHint="Abre el catálogo de logros"
      onPress={onOpen}
      className="flex-row items-center gap-4 rounded-xl border p-3"
      style={{ backgroundColor: tokens.surface.raised, borderColor: tokens.border.subtle }}
    >
      <View className="h-14 w-14 items-center justify-center rounded-2xl border-2" style={{ backgroundColor: withAlpha(badge.color, '20'), borderColor: badge.color }}>
        <Ionicons name={badge.icon} size={26} color={badge.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-black" style={{ color: tokens.text.primary }}>{badge.title}</Text>
        <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.muted }}>{badge.requirement}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
    </AppPressable>
  )
})
