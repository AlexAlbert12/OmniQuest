import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'

export type StudentBottomNavKey = 'home' | 'classes' | 'progress' | 'profile' | 'settings' | 'ranking' | 'badges' | 'notifications'
type VisibleStudentBottomNavKey = 'home' | 'classes' | 'play' | 'ranking' | 'profile'

const navItems: {
  key: VisibleStudentBottomNavKey
  label: string
  href: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
}[] = [
  { key: 'home', label: 'Inicio', href: '/(student)/homeStudent', icon: 'home-outline', activeIcon: 'home' },
  { key: 'classes', label: 'Clases', href: '/(student)/classes', icon: 'book-outline', activeIcon: 'book' },
  { key: 'play', label: 'Jugar', href: '/(student)/classes', icon: 'game-controller-outline', activeIcon: 'game-controller' },
  { key: 'ranking', label: 'Ranking', href: '/(student)/ranking', icon: 'trophy-outline', activeIcon: 'trophy' },
  { key: 'profile', label: 'Perfil', href: '/(student)/profile', icon: 'person-outline', activeIcon: 'person' },
]

export default function StudentBottomNav({ active }: { active: StudentBottomNavKey }) {
  const { accentColor } = useAppTheme()
  const visibleActive = getVisibleActiveKey(active)

  return (
    <View className="absolute bottom-3 left-4 right-4 flex-row justify-around rounded-2xl border border-[#1A3155] bg-[#09162C] px-2 py-3">
      {navItems.map((item) => {
        const isActive = item.key === visibleActive
        const content = (
          <Pressable className={`min-w-[54px] items-center ${isActive ? '' : 'opacity-70'}`}>
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={22}
              color={isActive ? accentColor : '#AFC2DB'}
            />
            <Text className={`mt-1 text-[11px] ${isActive ? 'font-bold' : 'text-[#AFC2DB]'}`} style={isActive ? { color: accentColor } : undefined}>
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
    </View>
  )
}

function getVisibleActiveKey(active: StudentBottomNavKey): VisibleStudentBottomNavKey {
  if (active === 'badges' || active === 'notifications' || active === 'settings' || active === 'progress') {
    return 'profile'
  }

  return active
}
