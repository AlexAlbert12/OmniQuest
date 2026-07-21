import React from 'react'
import { Animated, Easing, Image, Platform, Pressable, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import BrandLogo from '../BrandLogo'
import { useAppTheme } from '../../lib/appTheme'
import { supabase } from '../../lib/supabase'

export type TeacherSection = 'home' | 'classes' | 'planning' | 'students' | 'reviews' | 'notifications' | 'audit' | 'profile' | 'settings'

type TeacherSidebarProps = {
  activeSection: TeacherSection
  subjectsCount: number
  onSignOut: () => void
  alias?: string | null
  avatar?: string | null
}
const navItems: {
  section: TeacherSection
  label: string
  icon: keyof typeof Ionicons.glyphMap
  href?: string
}[] = [
    { section: 'home', label: 'Inicio', icon: 'home-outline', href: '/(teacher)/homeTeacher' },
    { section: 'classes', label: 'Cursos', icon: 'book-outline', href: '/(teacher)/classes' },
    { section: 'planning', label: 'Planificación', icon: 'calendar-outline', href: '/(teacher)/planning' },
    { section: 'students', label: 'Estudiantes', icon: 'people-outline', href: '/(teacher)/students' },
    { section: 'reviews', label: 'Revisión', icon: 'create-outline', href: '/(teacher)/reviews' },
    { section: 'audit', label: 'Auditoría', icon: 'shield-checkmark-outline', href: '/(teacher)/audit' },
    { section: 'notifications', label: 'Notificaciones', icon: 'notifications-outline', href: '/(teacher)/notifications' },
    { section: 'profile', label: 'Perfil', icon: 'person-outline', href: '/(teacher)/profile' },
    { section: 'settings', label: 'Configuración', icon: 'settings-outline', href: '/(teacher)/settings' },
  ]

export default function TeacherSidebar({
  activeSection,
  subjectsCount,
  onSignOut,
  alias,
  avatar,
}: TeacherSidebarProps) {
  const { theme, accentColor } = useAppTheme()
  const isDark = theme === 'dark'

  const [localAlias, setLocalAlias] = React.useState<string | null | undefined>(alias)
  const [localAvatar, setLocalAvatar] = React.useState<string | null | undefined>(avatar)

  React.useEffect(() => {
    let canceled = false

    if (alias !== undefined) {
      setLocalAlias(alias)
    }

    if (avatar !== undefined) {
      setLocalAvatar(avatar)
    }

    if (alias !== undefined && avatar !== undefined) {
      return
    }

    ; (async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const userId = session.session?.user.id

        if (!userId) return

        const { data, error } = await supabase
          .from('profiles')
          .select('alias, avatar')
          .eq('id', userId)
          .single()

        if (!canceled && !error && data) {
          if (alias === undefined) {
            setLocalAlias(data.alias ?? null)
          }

          if (avatar === undefined) {
            setLocalAvatar(data.avatar ?? null)
          }
        }
      } catch {
      }
    })()

    return () => {
      canceled = true
    }
  }, [alias, avatar])

  const displayAlias = (localAlias ?? '').trim() || 'Profesor'
  const classesLabel = `${subjectsCount} ${subjectsCount === 1 ? 'curso activo' : 'cursos activos'}`

  return (
    <View
      className="w-[244px] border-r px-4 py-7"
      style={{
        borderColor: isDark ? '#183052' : '#29466F',
        backgroundColor: isDark ? '#041024' : '#0E1E38',
      }}
    >
      <View className="mb-7 flex-row items-center gap-2 px-2">
        <BrandLogo size={30} />
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
      <Link href="/(teacher)/profile" asChild>
        <Pressable
          className="mt-auto rounded-2xl border p-4"
          style={{
            borderColor: isDark ? '#162B50' : '#2E4E78',
            backgroundColor: isDark ? '#091A35' : '#132A4D',
          }}
        >
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#192C62]">
              {localAvatar && localAvatar.startsWith('http') ? (
                <Image source={{ uri: localAvatar }} className="h-full w-full" />
              ) : (
                <Text className="font-black text-white">{getInitials(displayAlias)}</Text>
              )}
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[14px] font-bold text-white" numberOfLines={1}>
                {displayAlias}
              </Text>
              <Text className="text-[12px] text-[#9BAEC9]">
                Profesor
              </Text>
              <View className="mt-2 flex-row items-center gap-1">
                <Ionicons name="book-outline" size={13} color="#8FA7C7" />
                <Text className="text-[11px] text-[#8FA7C7]">
                  {classesLabel}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Link>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
        onPress={onSignOut}
        className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-[#4A1E2B] bg-[#2A0B18] px-4 py-3"
      >
        <Ionicons name="log-out-outline" size={19} color="#FB7185" />
        <Text className="text-[13px] font-black text-[#FCA5A5]">Cerrar sesión</Text>
      </Pressable>
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
          ...(Platform.OS === 'web'
            ? ({ boxShadow: isActive ? '0 10px 24px rgba(124, 92, 255, 0.18)' : 'none' } as any)
            : {
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: hoverProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, isActive ? 0.25 : 0.15],
                }),
                shadowRadius: hoverProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20],
                }),
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
