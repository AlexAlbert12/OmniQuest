import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'

type AdminBottomNavSection = 'home' | 'teachers' | 'students' | 'courses' | 'classrooms' | 'audit'
type VisibleAdminBottomNavSection = AdminBottomNavSection

const navItems: {
  key: VisibleAdminBottomNavSection
  label: string
  href: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
}[] = [
  { key: 'home', label: 'Inicio', href: '/(admin)/homeAdmin', icon: 'home-outline', activeIcon: 'home' },
  { key: 'teachers', label: 'Profesores', href: '/(admin)/teachers', icon: 'school-outline', activeIcon: 'school' },
  { key: 'students', label: 'Alumnos', href: '/(admin)/students', icon: 'people-outline', activeIcon: 'people' },
  { key: 'courses', label: 'Cursos', href: '/(admin)/courses', icon: 'book-outline', activeIcon: 'book' },
  { key: 'classrooms', label: 'Clases', href: '/(admin)/classrooms', icon: 'albums-outline', activeIcon: 'albums' },
  { key: 'audit', label: 'Auditoría', href: '/(admin)/audit', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
]

export default function AdminBottomNav({ active }: { active: AdminBottomNavSection }) {
  const { accentColor } = useAppTheme()
  const visibleActive = active

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
              <Ionicons name={isActive ? item.activeIcon : item.icon} size={22} color={isActive ? accentColor : '#AFC2DB'} />
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
