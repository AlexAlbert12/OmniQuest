import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import type { TeacherSection } from './TeacherSidebar'

type VisibleTeacherBottomNavKey = 'home' | 'classes' | 'students' | 'audit' | 'profile'

const navItems: {
  key: VisibleTeacherBottomNavKey
  label: string
  href: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
}[] = [
  { key: 'home', label: 'Inicio', href: '/(teacher)/homeTeacher', icon: 'home-outline', activeIcon: 'home' },
  { key: 'classes', label: 'Cursos', href: '/(teacher)/classes', icon: 'book-outline', activeIcon: 'book' },
  { key: 'students', label: 'Alumnos', href: '/(teacher)/students', icon: 'people-outline', activeIcon: 'people' },
  { key: 'audit', label: 'Auditoría', href: '/(teacher)/audit', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
  { key: 'profile', label: 'Perfil', href: '/(teacher)/profile', icon: 'person-outline', activeIcon: 'person' },
]

export default function TeacherBottomNav({ active }: { active: TeacherSection }) {
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
          gap: 6,
        }}
      >
        {navItems.map((item) => {
          const isActive = item.key === visibleActive
          const content = (
            <Pressable
              hitSlop={8}
              className="min-h-[58px] min-w-[68px] items-center justify-center rounded-2xl px-3"
              style={({ pressed }) => ({
                opacity: pressed ? 0.82 : isActive ? 1 : 0.72,
                backgroundColor: isActive ? `${accentColor}24` : 'transparent',
              })}
            >
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={22}
                color={isActive ? accentColor : '#AFC2DB'}
              />
              <Text className="mt-1 text-[11px] font-bold" style={{ color: isActive ? accentColor : '#AFC2DB' }} numberOfLines={1}>
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

function getVisibleActiveKey(active: TeacherSection): VisibleTeacherBottomNavKey {
  if (active === 'notifications' || active === 'settings') {
    return 'profile'
  }

  return active
}
