import React from 'react'
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native'
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
import { useI18n } from '../../lib/i18n'
import { useResponsiveLayout } from '../../lib/responsive'

export type StudentSection = 'home' | 'classes' | 'progress' | 'ranking' | 'badges' | 'notifications' | 'profile' | 'settings' | 'more'

type StudentSidebarProps = {
  activeSection: StudentSection
  alias: string
  avatar?: string | null
  guestMode?: boolean
  level: number
  points: number
  nextLevelProgress: number
  onSignOut: () => void
}

type IoniconName = keyof typeof Ionicons.glyphMap

type NavItem = {
  section?: StudentSection
  label: string
  labelKey: string
  icon: IoniconName
  href?: string
  testID?: string
}

const studentNavItems: NavItem[] = [
  { section: 'home', label: 'Inicio', labelKey: 'nav.student.home', icon: 'home-outline', href: '/(student)/homeStudent', testID: 'student-nav-home' },
  { section: 'classes', label: 'Cursos', labelKey: 'nav.student.courses', icon: 'book-outline', href: '/(student)/classes', testID: 'student-nav-classes' },
  { section: 'progress', label: 'Progreso', labelKey: 'nav.student.progress', icon: 'stats-chart-outline', href: '/(student)/progress', testID: 'student-nav-progress' },
  { section: 'ranking', label: 'Ranking', labelKey: 'nav.student.ranking', icon: 'trophy-outline', href: '/(student)/ranking', testID: 'student-nav-ranking' },
  { section: 'badges', label: 'Logros', labelKey: 'nav.student.badges', icon: 'ribbon-outline', href: '/(student)/badges', testID: 'student-nav-badges' },
  { section: 'notifications', label: 'Notificaciones', labelKey: 'nav.student.notifications', icon: 'notifications-outline', href: '/(student)/notifications', testID: 'student-nav-notifications' },
  { section: 'profile', label: 'Perfil', labelKey: 'nav.student.profile', icon: 'person-outline', href: '/(student)/profile', testID: 'student-nav-profile' },
  { section: 'settings', label: 'Configuración', labelKey: 'nav.student.settings', icon: 'settings-outline', href: '/(student)/settings', testID: 'student-nav-settings' },
]

const guestNavItems: NavItem[] = [
  { section: 'home', label: 'Jugar', labelKey: 'nav.guest.play', icon: 'game-controller-outline', href: '/(student)/homeStudent', testID: 'guest-nav-play' },
  { section: 'settings', label: 'Configuración', labelKey: 'nav.guest.settings', icon: 'settings-outline', href: '/(student)/settings', testID: 'guest-nav-settings' },
]

export default function StudentSidebar(props: StudentSidebarProps) {
  return props.guestMode ? <GuestStudentSidebar {...props} /> : <RegisteredStudentSidebar {...props} />
}

function RegisteredStudentSidebar({
  activeSection,
  alias,
  avatar,
  level,
  points,
  nextLevelProgress,
  onSignOut,
}: StudentSidebarProps) {
  const { theme, tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  const { cosmetics } = useProfileCosmetics()
  const isDark = theme === 'dark'
  const accentColor = tokens.brand.student
  const isCompact = responsive.isDesktop && !responsive.isWide
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
        {studentNavItems.map((item) => {
          const isActive = item.section === activeSection
          return (
            <StudentNavButton
              key={item.labelKey}
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

function GuestStudentSidebar({
  activeSection,
  alias,
  onSignOut,
}: StudentSidebarProps) {
  const { theme, tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  const { t } = useI18n()
  const isDark = theme === 'dark'
  const isCompact = responsive.isDesktop && !responsive.isWide
  const accentColor = tokens.brand.student
  const initial = alias.trim().charAt(0).toUpperCase() || 'I'

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
        }}
      >
        {isCompact ? (
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-border-default bg-surface-default">
            <OmniGuide size={24} state="happy" />
          </View>
        ) : <BrandLogo size={30} />}
      </View>

      <View style={{ gap: isCompact ? 9 : 8 }}>
        {guestNavItems.map((item) => (
          <StudentNavButton
            key={item.labelKey}
            item={item}
            isActive={item.section === activeSection}
            accentColor={accentColor}
            isDark={isDark}
            compact={isCompact}
          />
        ))}
      </View>

      <View className="mt-auto rounded-2xl border border-border-default bg-surface-default p-3">
        <View className={`flex-row items-center ${isCompact ? 'justify-center' : 'gap-3'}`}>
          <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-brand-student bg-surface-raised">
            <Text className="text-[16px] font-black text-white">{initial}</Text>
          </View>
          {!isCompact ? (
            <View className="min-w-0 flex-1">
              <Text className="text-[14px] font-black text-white" numberOfLines={1}>{alias}</Text>
              <Text className="mt-0.5 text-[11px] font-bold text-brand-student">{t('guest.temporarySession')}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel={t('guest.exit')}
          accessibilityRole="button"
          className={`${isCompact ? 'mt-2 h-10 items-center justify-center' : 'mt-3 min-h-10 flex-row items-center justify-center gap-2'} rounded-xl border border-semantic-danger bg-semantic-surface-danger`}
          onPress={onSignOut}
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
        >
          <Ionicons name="exit-outline" size={18} color={tokens.semantic.danger} />
          {!isCompact ? <Text className="text-[12px] font-black text-semantic-danger">{t('guest.exit')}</Text> : null}
        </Pressable>
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
  const { t } = useI18n()
  const label = t(item.labelKey)
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
      accessibilityLabel={label}
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
                {label}
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
