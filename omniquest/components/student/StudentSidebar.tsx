import React from 'react'
import { Animated, Easing, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import BrandLogo from '../BrandLogo'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import OmniGuide from '../../components/OmniGuide'
import GamifiedAvatar from '../gamification/GamifiedAvatar'
import { useProfileCosmetics } from '../../hooks/useProfileCosmetics'
import { releaseWebFocus } from '../../lib/webFocus'

export type StudentSection = 'home' | 'classes' | 'progress' | 'ranking' | 'badges' | 'notifications' | 'profile' | 'settings'

type StudentSidebarProps = {
  activeSection: StudentSection
  alias: string
  avatar?: string | null
  level: number
  points: number
  nextLevelProgress: number
  onSignOut: () => void
}

type IoniconName = keyof typeof Ionicons.glyphMap

type NavItem = {
  section?: StudentSection
  label: string
  icon: IoniconName
  href?: string
  testID?: string
}

const navItems: NavItem[] = [
  { section: 'home', label: 'Inicio', icon: 'home-outline', href: '/(student)/homeStudent', testID: 'student-nav-home' },
  { section: 'classes', label: 'Cursos', icon: 'book-outline', href: '/(student)/classes', testID: 'student-nav-classes' },
  { section: 'progress', label: 'Progreso', icon: 'stats-chart-outline', href: '/(student)/progress', testID: 'student-nav-progress' },
  { section: 'ranking', label: 'Ranking', icon: 'trophy-outline', href: '/(student)/ranking', testID: 'student-nav-ranking' },
  { section: 'badges', label: 'Logros', icon: 'ribbon-outline', href: '/(student)/badges', testID: 'student-nav-badges' },
  { section: 'notifications', label: 'Notificaciones', icon: 'notifications-outline', href: '/(student)/notifications', testID: 'student-nav-notifications' },
  { section: 'profile', label: 'Perfil', icon: 'person-outline', href: '/(student)/profile', testID: 'student-nav-profile' },
  { section: 'settings', label: 'Configuración', icon: 'settings-outline', href: '/(student)/settings', testID: 'student-nav-settings' },
]

export default function StudentSidebar({
  activeSection,
  alias,
  avatar,
  level,
  points,
  nextLevelProgress,
  onSignOut,
}: StudentSidebarProps) {
  const { theme, tokens } = useAppTheme()
  const { width } = useWindowDimensions()
  const { cosmetics } = useProfileCosmetics()
  const isDark = theme === 'dark'
  const accentColor = tokens.brand.student
  const isCompact = width >= 1024 && width < 1280
  const safeProgress = Math.min(Math.max(nextLevelProgress, 0), 100)

  return (
    <View
      className="border-r py-7"
      style={{
        width: isCompact ? 88 : 244,
        paddingHorizontal: isCompact ? 12 : 16,
        borderColor: isDark ? '#183052' : '#29466F',
        backgroundColor: isDark ? '#041024' : '#0E1E38',
      }}
    >
      <View
        className="mb-5 flex-row items-center"
        style={{
          justifyContent: isCompact ? 'center' : 'flex-start',
          paddingHorizontal: isCompact ? 0 : 8,
          gap: isCompact ? 0 : 8,
        }}
      >
        {isCompact ? (
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-border-default bg-surface-default">
          <OmniGuide size={24} state="happy" />
          </View>
        ) : (
          <>
            <BrandLogo size={30} />
          </>
        )}
      </View>

      <View style={{ gap: isCompact ? 9 : 8 }}>
        {navItems.map((item) => {
          const isActive = item.section === activeSection
          return (
            <StudentNavButton
              key={item.label}
              item={item}
              isActive={isActive}
              accentColor={accentColor}
              isDark={isDark}
              compact={isCompact}
            />
          )
        })}
      </View>

      <View className="mt-auto" style={{ gap: 10 }}>
        <Link href="/(student)/profile" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            onPress={releaseWebFocus}
            className="rounded-2xl border"
            style={{
              padding: 8,
              borderColor: isDark ? '#162B50' : '#2E4E78',
              backgroundColor: isDark ? '#091A35' : '#132A4D',
            }}
          >
            {isCompact ? (
              <View className="items-center" style={{ gap: 8 }}>
                <GamifiedAvatar avatarUrl={avatar} alias={alias} cosmetics={cosmetics} level={level} size={44} showLevel={false} />
                <View className="h-1.5 w-full overflow-hidden rounded-full bg-surface-interactive">
                  <View className="h-full rounded-full" style={{ width: `${safeProgress}%`, backgroundColor: accentColor }} />
                </View>
              </View>
            ) : (
              <>
                <View className="flex-row items-center gap-3">
                  <GamifiedAvatar avatarUrl={avatar} alias={alias} cosmetics={cosmetics} level={level} size={48} showLevel={false} />
                  <View className="min-w-0 flex-1">
                    <Text className="text-[14px] font-bold text-white" numberOfLines={1}>{alias}</Text>
                    <View className="mt-1 flex-row items-center gap-1">
                      <View className="h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: accentColor }}>
                        <Ionicons name="star" size={12} color="#FFFFFF" />
                      </View>
                      <Text className="text-[12px] text-brand-student">Nivel {level}</Text>
                    </View>
                  </View>
                </View>
                <Text className="mt-4 text-[12px] text-text-secondary">
                  {(points % 100).toLocaleString()} / 100 XP para Nivel {level + 1}
                </Text>
                <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-interactive">
                  <View className="h-full rounded-full" style={{ width: `${safeProgress}%`, backgroundColor: accentColor }} />
                </View>
              </>
            )}
          </Pressable>
        </Link>
      </View>
    </View>
  )
}

function StudentNavButton({
  item,
  isActive,
  accentColor,
  isDark,
  compact,
}: {
  item: NavItem
  isActive: boolean
  accentColor: string
  isDark: boolean
  compact: boolean
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
      testID={item.testID}
      onPress={releaseWebFocus}
      accessibilityRole="button"
      accessibilityLabel={item.label}
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
          height: compact ? 52 : 52,
          borderRadius: 14,
          paddingHorizontal: compact ? 0 : 10,
          borderColor: hoverProgress.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(83,100,245,0)', isActive ? accentColor : isDark ? 'rgba(159,214,255,0.22)' : 'rgba(96,122,167,0.35)'],
          }),
          backgroundColor: hoverProgress.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(8,24,51,0)', isActive ? 'rgba(26,35,92,0.92)' : 'rgba(11,30,61,0.82)'],
          }),
          ...(Platform.OS === 'web'
            ? ({ boxShadow: isActive ? '0 10px 24px ' + withAlpha(accentColor, '2E') : 'none' } as any)
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
          transform: compact
            ? []
            : [
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
        <View className="h-full flex-row items-center" style={{ justifyContent: compact ? 'center' : 'flex-start' }}>
          <Animated.View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{
              transform: [
                {
                  translateX: compact
                    ? 0
                    : hoverProgress.interpolate({
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
          {!compact ? (
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
          ) : null}
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

function filledIconFor(icon: IoniconName): IoniconName {
  return icon.endsWith('-outline') ? (icon.replace('-outline', '') as IoniconName) : icon
}
