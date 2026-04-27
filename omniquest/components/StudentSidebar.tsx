import React from 'react'
import { Pressable, Text, View, Image } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export type StudentSection = 'home' | 'classes' | 'progress' | 'ranking' | 'profile' | 'settings'

type StudentSidebarProps = {
  activeSection: StudentSection
  alias: string
  avatar?: string | null
  level: number
  points: number
  nextLevelProgress: number
  onSignOut: () => void
  onComingSoon: (feature: string) => void
}

const navItems: {
  section?: StudentSection
  label: string
  icon: keyof typeof Ionicons.glyphMap
  href?: string
}[] = [
  { section: 'home', label: 'Inicio', icon: 'home-outline', href: '/(student)/homeStudent' },
  { section: 'classes', label: 'Mis Clases', icon: 'book-outline', href: '/(student)/classes' },
  { section: 'progress', label: 'Progreso', icon: 'stats-chart-outline', href: '/(student)/progress' },
  { section: 'ranking', label: 'Ranking', icon: 'trophy-outline', href: '/(student)/ranking' },
  { section: 'profile', label: 'Perfil', icon: 'person-outline', href: '/(student)/profile' },
  { section: 'settings', label: 'Configuración', icon: 'settings-outline', href: '/(student)/settings' },
]

export default function StudentSidebar({
  activeSection,
  alias,
  avatar,
  level,
  points,
  nextLevelProgress,
  onSignOut,
  onComingSoon,
}: StudentSidebarProps) {
  return (
    <View className="w-[244px] border-r border-[#183052] bg-[#041024] px-4 py-7">
      <View className="mb-7 flex-row items-center gap-2 px-2">
        <Text className="text-[#9FD6FF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}>
          OmniQuest
        </Text>
        <Ionicons name="rocket" size={18} color="#9FD6FF" />
      </View>

      <View style={{ gap: 8 }}>
        {navItems.map((item) => {
          const isActive = item.section === activeSection
          const content = (
            <View
              className={`flex-row items-center gap-4 rounded-xl px-4 py-4 ${
                isActive ? 'border border-[#5364F5] bg-[#102157]' : ''
              }`}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={isActive ? '#9FD6FF' : '#94A7C4'}
              />
              <Text className={`text-[14px] font-semibold ${isActive ? 'text-white' : 'text-[#A7B6CE]'}`}>
                {item.label}
              </Text>
            </View>
          )

          if (item.href && !isActive) {
            return (
              <Link href={item.href as any} asChild key={item.label}>
                <Pressable>{content}</Pressable>
              </Link>
            )
          }

          return (
            <Pressable key={item.label} onPress={() => !isActive && onComingSoon(item.label)}>
              {content}
            </Pressable>
          )
        })}
      </View>

      <View className="mt-auto rounded-2xl border border-[#162B50] bg-[#091A35] p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-[#192C62] overflow-hidden">
            {avatar && avatar.startsWith('http') ? (
              <Image source={{ uri: avatar }} className="h-full w-full" />
            ) : (
          <Ionicons name="person" size={16} color="#9FD6FF" />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] font-bold text-white">{alias}</Text>
            <Text className="text-[12px] text-[#9BAEC9]">Nivel {level}</Text>
          </View>
        </View>
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full bg-[#6574FF]" style={{ width: `${nextLevelProgress}%` }} />
        </View>
        <Text className="mt-2 text-[11px] text-[#8FA7C7]">{points.toLocaleString()} XP</Text>

        <Pressable onPress={onSignOut} className="mt-4 flex-row items-center gap-2">
          <Ionicons name="log-out-outline" size={16} color="#F87171" />
          <Text className="text-[12px] font-semibold text-[#FCA5A5]">Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  )
}
