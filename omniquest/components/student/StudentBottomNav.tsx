import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export type StudentBottomNavKey = 'home' | 'classes' | 'progress' | 'profile' | 'settings' | 'ranking' | 'badges' | 'notifications'

const navItems: {
  key: StudentBottomNavKey
  label: string
  href: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
}[] = [
  { key: 'home', label: 'Inicio', href: '/(student)/homeStudent', icon: 'home-outline', activeIcon: 'home' },
  { key: 'classes', label: 'Clases', href: '/(student)/classes', icon: 'book-outline', activeIcon: 'book' },
  { key: 'progress', label: 'Progreso', href: '/(student)/progress', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  { key: 'ranking', label: 'Ranking', href: '/(student)/ranking', icon: 'trophy-outline', activeIcon: 'trophy' },
  { key: 'profile', label: 'Perfil', href: '/(student)/profile', icon: 'person-outline', activeIcon: 'person' },
  { key: 'settings', label: 'Ajustes', href: '/(student)/settings', icon: 'settings-outline', activeIcon: 'settings' },
]

export default function StudentBottomNav({ active }: { active: StudentBottomNavKey }) {
  return (
    <View className="absolute bottom-3 left-4 right-4 flex-row justify-around rounded-2xl border border-[#1A3155] bg-[#09162C] py-3">
      {navItems.map((item) => {
        const isActive = item.key === active
        const content = (
          <Pressable className={`items-center ${isActive ? '' : 'opacity-70'}`}>
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={22}
              color={isActive ? '#B09BFF' : '#AFC2DB'}
            />
            <Text className={`mt-1 text-[11px] ${isActive ? 'font-bold text-[#B09BFF]' : 'text-[#AFC2DB]'}`}>
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
