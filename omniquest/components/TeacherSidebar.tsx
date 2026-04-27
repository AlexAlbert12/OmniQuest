import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export type TeacherSection = 'home' | 'classes' | 'students' | 'settings'

type TeacherSidebarProps = {
  activeSection: TeacherSection
  subjectsCount: number
  onSignOut: () => void
  onComingSoon: (feature: string) => void
}

const navItems: {
  section: TeacherSection
  label: string
  icon: keyof typeof Ionicons.glyphMap
  href?: string
}[] = [
  { section: 'home', label: 'Inicio', icon: 'home-outline', href: '/(teacher)/homeTeacher' },
  { section: 'classes', label: 'Mis Clases', icon: 'book-outline', href: '/(teacher)/classes' },
  { section: 'students', label: 'Estudiantes', icon: 'people-outline', href: '/(teacher)/students' },
  { section: 'settings', label: 'Configuración', icon: 'settings-outline', href: '/(teacher)/settings' },
]

export default function TeacherSidebar({
  activeSection,
  subjectsCount,
  onSignOut,
  onComingSoon,
}: TeacherSidebarProps) {
  return (
    <View className="w-[250px] border-r border-[#183052] bg-[#041024] px-5 py-8">
      <View className="mb-8 flex-row items-center gap-2">
        <Text className="text-[#9FD6FF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}>
          OmniQuest
        </Text>
        <Ionicons name="rocket" size={22} color="#7FCBFF" />
      </View>

      <View style={{ gap: 8 }}>
        {navItems.map((item) => {
          const isActive = item.section === activeSection
          const content = (
            <View
              className={`flex-row items-center gap-4 rounded-xl px-4 py-4 ${
                isActive ? 'border border-[#6D5AF6] bg-[#1A1E55]' : ''
              }`}
            >
              <Ionicons name={item.icon} size={22} color={isActive ? '#9FD6FF' : '#AFC2DB'} />
              <Text className={`text-[15px] font-semibold ${isActive ? 'text-white' : 'text-[#C4D0E3]'}`}>
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

      <View className="mt-auto gap-5">
        <View className="rounded-2xl border border-[#183052] bg-[#09162C] p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#5B4BC4]">
              <Text className="font-black text-white">PR</Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-black text-white">Profesor</Text>
              <Text className="text-[12px] text-[#B7C4D7]">Nivel {Math.max(1, subjectsCount + 6)}</Text>
            </View>
          </View>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13294C]">
            <View className="h-full rounded-full bg-[#8B5CF6]" style={{ width: '65%' }} />
          </View>
          <Text className="mt-2 text-[11px] text-[#AFC2DB]">2,450 / 3,000 XP</Text>
          <Pressable onPress={onSignOut} className="mt-4 flex-row items-center gap-2">
            <Ionicons name="log-out-outline" size={16} color="#F87171" />
            <Text className="text-[12px] font-semibold text-[#FCA5A5]">Cerrar sesión</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
