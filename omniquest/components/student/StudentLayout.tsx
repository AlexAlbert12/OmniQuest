import { ReactNode, type ReactElement } from 'react'
import type { RefreshControlProps } from 'react-native'
import StudentSidebar, { StudentSection } from './StudentSidebar'
import StudentBottomNav, { StudentBottomNavKey } from './StudentBottomNav'
import StudentScreenLayout from '../layouts/StudentScreenLayout'

type StudentLayoutProps = {
  activeSection: StudentSection
  alias: string
  avatar?: string | null
  bottomNavActive: StudentBottomNavKey
  children: ReactNode
  guestMode?: boolean
  isDesktop: boolean
  loading?: boolean
  loadingLabel?: string
  nextLevelProgress: number
  onSignOut: () => void
  points: number
  level: number
  refreshControl?: ReactElement<RefreshControlProps>
}

export default function StudentLayout({
  activeSection,
  alias,
  avatar,
  bottomNavActive,
  children,
  guestMode = false,
  isDesktop,
  level,
  loading,
  loadingLabel = 'Cargando...',
  nextLevelProgress,
  onSignOut,
  points,
  refreshControl,
}: StudentLayoutProps) {
  return (
    <StudentScreenLayout
      contentLabel={guestMode ? `Modo invitado: ${activeSection}` : `Pantalla de estudiante: ${activeSection}`}
      desktopSidebar={(
        <StudentSidebar
          activeSection={activeSection}
          alias={alias}
          avatar={avatar}
          guestMode={guestMode}
          level={level}
          points={points}
          nextLevelProgress={nextLevelProgress}
          onSignOut={onSignOut}
        />
      )}
      mobileBottomNavigation={<StudentBottomNav active={bottomNavActive} guestMode={guestMode} />}
      isDesktop={isDesktop}
      fluidContent
      horizontalPadding={isDesktop ? 28 : 18}
      topPadding={isDesktop ? 24 : 18}
      loading={loading}
      loadingLabel={loadingLabel}
      refreshControl={refreshControl}
    >
      {children}
    </StudentScreenLayout>
  )
}
