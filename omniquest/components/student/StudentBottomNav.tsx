import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'

export type StudentBottomNavKey = 'home' | 'classes' | 'progress' | 'profile' | 'settings' | 'ranking' | 'badges' | 'notifications'
type VisibleStudentBottomNavKey = 'home' | 'classes' | 'progress' | 'ranking' | 'badges' | 'profile'

const navItems: {
  key: VisibleStudentBottomNavKey
  label: string
  href: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
}[] = [
  { key: 'home', label: 'Inicio', href: '/(student)/homeStudent', icon: 'home-outline', activeIcon: 'home' },
  { key: 'classes', label: 'Cursos', href: '/(student)/classes', icon: 'book-outline', activeIcon: 'book' },
  { key: 'progress', label: 'Progreso', href: '/(student)/progress', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  { key: 'ranking', label: 'Ranking', href: '/(student)/ranking', icon: 'trophy-outline', activeIcon: 'trophy' },
  { key: 'profile', label: 'Perfil', href: '/(student)/profile', icon: 'person-outline', activeIcon: 'person' },
]

export default function StudentBottomNav({ active }: { active: StudentBottomNavKey }) {
  const { accentColor } = useAppTheme()
  const visibleActive = getVisibleActiveKey(active)

  return (
    <View className="absolute bottom-0 left-0 right-0 border-t border-[#1A3155] bg-[#071225]/95 px-2 pb-4 pt-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'space-around',
          gap: 4,
        }}
      >
        {navItems.map((item) => {
          const isActive = item.key === visibleActive
          const content = (
            <Pressable
              hitSlop={8}
              className="min-h-[56px] min-w-[54px] items-center justify-center rounded-2xl px-2"
              style={({ pressed }) => ({
                opacity: pressed ? 0.82 : isActive ? 1 : 0.72,
                backgroundColor: isActive ? `${accentColor}24` : 'transparent',
              })}
            >
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={21}
                color={isActive ? accentColor : '#AFC2DB'}
              />
              <Text className="mt-1 text-[10px] font-bold" style={{ color: isActive ? accentColor : '#AFC2DB' }} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          )

          if (isActive) {
            return <React.Fragment key={item.key}>{content}</React.Fragment>
          }

          return (
            <Link key={item.key} href={item.href as any} asChild>
              {content}
            </Link>
          )
        })}
      </ScrollView>
    </View>
  )
}

function getVisibleActiveKey(active: StudentBottomNavKey): VisibleStudentBottomNavKey {
  if (active === 'badges' || active === 'notifications' || active === 'settings') {
    return 'profile'
  }

  return active
}
