import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import type { RankingScope } from '../../../hooks/student/useStudentRanking'

const TABS: { scope: RankingScope; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { scope: 'weekly', label: 'Semanal', icon: 'flash' },
  { scope: 'global', label: 'Global', icon: 'globe' },
  { scope: 'class', label: 'Clase', icon: 'people' },
]

export default function RankingTabs({ value, onChange }: { value: RankingScope; onChange: (scope: RankingScope) => void }) {
  const { tokens } = useAppTheme()
  return (
    <View accessibilityRole="tablist" className="flex-row gap-2 rounded-2xl border border-border-default bg-surface-default p-2">
      {TABS.map((tab) => {
        const selected = value === tab.scope
        return (
          <AppPressable
            key={tab.scope}
            accessibilityLabel={`Ranking ${tab.label}`}
            accessibilityHint="Cambia el ámbito de la clasificación"
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.scope)}
            className="min-h-[44px] min-w-0 flex-1 flex-row items-center justify-center gap-2 rounded-xl px-2 py-2"
            style={{ backgroundColor: selected ? tokens.surface.selected : 'transparent' }}
          >
            <Ionicons name={tab.icon} size={17} color={selected ? tokens.brand.student : tokens.text.secondary} />
            <Text numberOfLines={1} className={selected ? 'font-black text-brand-student' : 'font-bold text-text-secondary'}>{tab.label}</Text>
          </AppPressable>
        )
      })}
    </View>
  )
}
