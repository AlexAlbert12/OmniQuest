import { useMemo } from 'react'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import MobileBottomNavigation, {
  MobileBottomNavigationItem,
} from '../ui/mobile/MobileBottomNavigation'

export type StudentBottomNavKey = 'home' | 'classes' | 'progress' | 'profile' | 'settings' | 'ranking' | 'badges' | 'notifications' | 'activity' | 'security' | 'help' | 'more'
type VisibleStudentBottomNavKey = 'home' | 'classes' | 'progress' | 'ranking' | 'more' | 'settings'

export default function StudentBottomNav({ active, guestMode = false }: { active: StudentBottomNavKey | null; guestMode?: boolean }) {
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  const navItems = useMemo<MobileBottomNavigationItem<VisibleStudentBottomNavKey>[]>(() => guestMode
    ? [
        { key: 'home', label: t('nav.guest.play'), href: '/(student)/homeStudent', icon: 'game-controller-outline', activeIcon: 'game-controller', testID: 'guest-nav-play' },
        { key: 'settings', label: t('nav.guest.settings'), href: '/(student)/settings', icon: 'settings-outline', activeIcon: 'settings', testID: 'guest-nav-settings' },
      ]
    : [
        { key: 'home', label: t('nav.student.home'), href: '/(student)/homeStudent', icon: 'home-outline', activeIcon: 'home', testID: 'student-nav-home' },
        { key: 'classes', label: t('nav.student.courses'), href: '/(student)/classes', icon: 'book-outline', activeIcon: 'book', testID: 'student-nav-classes' },
        { key: 'progress', label: t('nav.student.progress'), href: '/(student)/progress', icon: 'stats-chart-outline', activeIcon: 'stats-chart', testID: 'student-nav-progress' },
        { key: 'ranking', label: t('nav.student.ranking'), href: '/(student)/ranking', icon: 'trophy-outline', activeIcon: 'trophy', testID: 'student-nav-ranking' },
        { key: 'more', label: 'Más', href: '/(student)/more', icon: 'ellipsis-horizontal-circle-outline', activeIcon: 'ellipsis-horizontal-circle', testID: 'student-nav-more' },
      ], [guestMode, t])

  const activeKey = guestMode ? (active === 'settings' ? 'settings' : 'home') : getVisibleActiveKey(active)
  const disabledKey = guestMode ? activeKey : getDisabledVisibleKey(active)

  return (
    <MobileBottomNavigation
      activeKey={activeKey}
      disabledKey={disabledKey}
      accentColor={tokens.brand.student}
      items={navItems}
    />
  )
}

function getVisibleActiveKey(active: StudentBottomNavKey | null): VisibleStudentBottomNavKey | null {
  if (active === 'more' || active === 'profile' || active === 'badges' || active === 'notifications' || active === 'settings' || active === 'activity' || active === 'security' || active === 'help') return 'more'
  return active
}

function getDisabledVisibleKey(active: StudentBottomNavKey | null): VisibleStudentBottomNavKey | null {
  if (active === 'home' || active === 'classes' || active === 'progress' || active === 'ranking' || active === 'more') return active
  return null
}
