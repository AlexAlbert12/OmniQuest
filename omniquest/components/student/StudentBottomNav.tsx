import { useMemo } from 'react'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import MobileBottomNavigation, {
  MobileBottomNavigationItem,
} from '../ui/mobile/MobileBottomNavigation'

export type StudentBottomNavKey = 'home' | 'classes' | 'progress' | 'profile' | 'settings' | 'ranking' | 'badges' | 'notifications'
type VisibleStudentBottomNavKey = 'home' | 'classes' | 'progress' | 'ranking' | 'profile'

export default function StudentBottomNav({ active }: { active: StudentBottomNavKey }) {
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  const navItems = useMemo<MobileBottomNavigationItem<VisibleStudentBottomNavKey>[]>(() => [
    { key: 'home', label: t('nav.student.home'), href: '/(student)/homeStudent', icon: 'home-outline', activeIcon: 'home', testID: 'student-nav-home' },
    { key: 'classes', label: t('nav.student.courses'), href: '/(student)/classes', icon: 'book-outline', activeIcon: 'book', testID: 'student-nav-classes' },
    { key: 'progress', label: t('nav.student.progress'), href: '/(student)/progress', icon: 'stats-chart-outline', activeIcon: 'stats-chart', testID: 'student-nav-progress' },
    { key: 'ranking', label: t('nav.student.ranking'), href: '/(student)/ranking', icon: 'trophy-outline', activeIcon: 'trophy', testID: 'student-nav-ranking' },
    { key: 'profile', label: t('nav.student.profile'), href: '/(student)/profile', icon: 'person-outline', activeIcon: 'person', testID: 'student-nav-profile' },
  ], [t])

  return (
    <MobileBottomNavigation
      activeKey={getVisibleActiveKey(active)}
      accentColor={tokens.brand.student}
      items={navItems}
    />
  )
}

function getVisibleActiveKey(active: StudentBottomNavKey): VisibleStudentBottomNavKey {
  if (active === 'badges' || active === 'notifications' || active === 'settings') return 'profile'
  return active
}
