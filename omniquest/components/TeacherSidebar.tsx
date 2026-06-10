import React from 'react'
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useAppTheme } from '../lib/appTheme'
import { supabase } from '../lib/supabase'

export type TeacherSection = 'home' | 'classes' | 'students' | 'notifications' | 'settings'

type TeacherSidebarProps = {
  activeSection: TeacherSection
  subjectsCount: number
  onSignOut: () => void
  alias?: string | null
  avatar?: string | null
  points?: number | null
  onComingSoon?: (feature: string) => void
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
  { section: 'notifications', label: 'Notificaciones', icon: 'notifications-outline', href: '/(teacher)/notifications' },
  { section: 'settings', label: 'Configuración', icon: 'settings-outline', href: '/(teacher)/settings' },
]

export default function TeacherSidebar({
  activeSection,
  subjectsCount,
  onSignOut,
  alias,
  avatar,
  points,
}: TeacherSidebarProps) {
  const { theme, accentColor } = useAppTheme()
  const isDark = theme === 'dark'

  const [localAlias, setLocalAlias] = React.useState<string | null | undefined>(alias)
  const [localPoints, setLocalPoints] = React.useState<number | null | undefined>(points)

  React.useEffect(() => {
    if (alias !== undefined) {
      setLocalAlias(alias)
      setLocalPoints(points)
      return
    }
    let canceled = false
    ;(async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const userId = session.session?.user.id
        if (!userId) return
        const { data, error } = await supabase.from('profiles').select('alias, avatar, points').eq('id', userId).single()
        if (!canceled && !error && data) {
          setLocalAlias(data.alias ?? null)
          setLocalPoints(data.points ?? null)
        }
      } catch (e) {
      }
    })()
    return () => {
      canceled = true
    }
  }, [alias, avatar, points])

  const displayAlias = (localAlias ?? '').trim()
  const level = Math.max(1, Math.floor(((localPoints ?? 0) / 100)) + subjectsCount + 1)
  const progress = Math.min(100, (((localPoints ?? 0) % 100) || 65))

  return (
    <View
      className="w-[244px] border-r px-4 py-7"
      style={{
        borderColor: isDark ? '#183052' : '#29466F',
        backgroundColor: isDark ? '#041024' : '#0E1E38',
      }}
    >
      <View className="mb-7 flex-row items-center gap-2 px-2">
        <Text className="text-[#9FD6FF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}>
          OmniQuest
        </Text>
        <Ionicons name="rocket" size={18} color="#9FD6FF" />
      </View>

      <View style={{ gap: 10 }}>
        {navItems.map((item) => {
          const isActive = item.section === activeSection
          return (
            <TeacherNavButton
              key={item.label}
              item={item}
              isActive={isActive}
              accentColor={accentColor}
              isDark={isDark}
            />
          )
        })}
      </View>

      <View
        className="mt-auto rounded-2xl border p-4"
        style={{ borderColor: isDark ? '#162B50' : '#2E4E78', backgroundColor: isDark ? '#091A35' : '#132A4D' }}
      >
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#192C62]">
            {avatar && avatar.startsWith('http') ? (
              <Image source={{ uri: avatar }} className="h-full w-full" />
            ) : (
              <Text className="font-black text-white">{getInitials(displayAlias)}</Text>
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] font-bold text-white" numberOfLines={1}>{displayAlias}</Text>
            <Text className="text-[12px] text-[#9BAEC9]">Nivel {level}</Text>
          </View>
        </View>
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#13294C]">
          <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: accentColor }} />
        </View>
        <Text className="mt-2 text-[11px] text-[#8FA7C7]">{(points ?? 0).toLocaleString()} XP</Text>
      </View>
    </View>
  )
}

function TeacherNavButton({
  item,
  isActive,
  accentColor,
  isDark,
}: {
  item: { section: TeacherSection; label: string; icon: keyof typeof Ionicons.glyphMap; href?: string }
  isActive: boolean
  accentColor: string
  isDark: boolean
}) {
  const [isHovered, setIsHovered] = React.useState(false)
  const [isPressed, setIsPressed] = React.useState(false)
  const hoverProgress = React.useRef(new Animated.Value(isActive ? 1 : 0)).current
  const isInteractive = isActive || isHovered || isPressed

  React.useEffect(() => {
    Animated.timing(hoverProgress, {
      toValue: isInteractive ? 1 : 0,
      duration: isInteractive ? 180 : 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [hoverProgress, isInteractive])

  const iconName = isActive ? filledIconFor(item.icon) : item.icon
  const iconColor = isActive ? '#D7F0FF' : isInteractive ? '#C9E8FF' : '#94A7C4'
  const textColor = hoverProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#AFC0D8', '#FFFFFF'],
  })

  const content = (
    <Pressable
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <Animated.View
        className="relative overflow-hidden border"
        style={{
          height: 52,
          borderRadius: 14,
          paddingHorizontal: 10,
          borderColor: hoverProgress.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(83,100,245,0)', isActive ? accentColor : isDark ? 'rgba(159,214,255,0.22)' : 'rgba(96,122,167,0.35)'],
          }),
          backgroundColor: hoverProgress.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(8,24,51,0)', isActive ? 'rgba(26,35,92,0.92)' : 'rgba(11,30,61,0.82)'],
          }),
          shadowColor: '#6574FF',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: hoverProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, isActive ? 0.25 : 0.15],
          }),
          shadowRadius: hoverProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 20],
          }),
          transform: [
            {
              translateX: hoverProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, isActive ? 0 : 3],
              }),
            },
          ],
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: hoverProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, isActive ? 1 : 0.6],
            }),
          }}
        >
          <LinearGradient
            colors={isActive ? ['#142864', '#202B67'] : ['rgba(16,33,87,0.48)', 'rgba(35,53,111,0.5)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 14 }}
          />
        </Animated.View>
        <Animated.View
          className="absolute left-0 top-3 h-7 w-1 rounded-r-full"
          style={{
            backgroundColor: accentColor,
            opacity: hoverProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, isActive ? 1 : 0.72],
            }),
            transform: [
              {
                scaleY: hoverProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35, 1],
                }),
              },
            ],
          }}
        />
        <View className="h-full flex-row items-center">
          <Animated.View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{
              transform: [
                {
                  translateX: hoverProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, isActive ? 0 : 2],
                  }),
                },
                {
                  scale: hoverProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            }}
          >
            <Ionicons name={iconName} size={24} color={iconColor} />
          </Animated.View>
          <Animated.View
            className="min-w-0 flex-1"
            style={{
              marginLeft: 12,
              opacity: hoverProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
              transform: [
                {
                  translateX: hoverProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 4],
                  }),
                },
                {
                  scale: hoverProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02],
                  }),
                },
              ],
            }}
          >
            <Animated.Text
              numberOfLines={1}
              style={{
                color: textColor,
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              {item.label}
            </Animated.Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  )

  if (item.href && !isActive) {
    return (
      <Link href={item.href as any} asChild>
        {content}
      </Link>
    )
  }

  return content
}

function filledIconFor(icon: keyof typeof Ionicons.glyphMap): keyof typeof Ionicons.glyphMap {
  return icon.endsWith('-outline') ? (icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap) : icon
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase()).join('')
}
