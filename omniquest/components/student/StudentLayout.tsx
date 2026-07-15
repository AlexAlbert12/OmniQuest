import { ReactNode } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import StudentSidebar, { StudentSection } from './StudentSidebar'
import StudentBottomNav, { StudentBottomNavKey } from './StudentBottomNav'
import { useAppTheme } from '../../lib/appTheme'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'

type StudentLayoutProps = {
  activeSection: StudentSection
  alias: string
  avatar?: string | null
  bottomNavActive: StudentBottomNavKey
  children: ReactNode
  isDesktop: boolean
  loading?: boolean
  loadingLabel?: string
  nextLevelProgress: number
  onSignOut: () => void
  points: number
  level: number
}

export default function StudentLayout({
  activeSection,
  alias,
  avatar,
  bottomNavActive,
  children,
  isDesktop,
  level,
  loading,
  loadingLabel = 'Cargando...',
  nextLevelProgress,
  onSignOut,
  points,
}: StudentLayoutProps) {
  const { accentColor } = useAppTheme()

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-4 text-[#8FA7C7]">{loadingLabel}</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection={activeSection}
            alias={alias}
            avatar={avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={onSignOut}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 22 : 18,
            paddingBottom: isDesktop ? 28 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>

      {!isDesktop ? <StudentBottomNav active={bottomNavActive} /> : null}
    </View>
  )
}
