import { ReactNode } from 'react'
import StudentSidebar, { StudentSection } from './StudentSidebar'
import StudentBottomNav, { StudentBottomNavKey } from './StudentBottomNav'
import StudentScreenLayout from '../layouts/StudentScreenLayout'

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

/** Backwards-compatible student shell backed by the shared responsive layout. */
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
  return (
    <StudentScreenLayout
      contentLabel={`Pantalla de estudiante: ${activeSection}`}
      desktopSidebar={(
        <StudentSidebar
          activeSection={activeSection}
          alias={alias}
          avatar={avatar}
          level={level}
          points={points}
          nextLevelProgress={nextLevelProgress}
          onSignOut={onSignOut}
        />
      )}
      mobileBottomNavigation={<StudentBottomNav active={bottomNavActive} />}
      isDesktop={isDesktop}
      loading={loading}
      loadingLabel={loadingLabel}
    >
      {children}
    </StudentScreenLayout>
  )
}
