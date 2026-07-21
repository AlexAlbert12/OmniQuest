import { useMemo } from 'react'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import MobileBottomNavigation, {
  MobileBottomNavigationItem,
} from '../ui/mobile/MobileBottomNavigation'
import type { TeacherSection } from './TeacherSidebar'

type VisibleTeacherBottomNavKey = 'home' | 'classes' | 'students' | 'audit' | 'profile'

export default function TeacherBottomNav({ active }: { active: TeacherSection }) {
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  const navItems = useMemo<MobileBottomNavigationItem<VisibleTeacherBottomNavKey>[]>(() => [
    { key: 'home', label: t('nav.teacher.home'), href: '/(teacher)/homeTeacher', icon: 'home-outline', activeIcon: 'home' },
    { key: 'classes', label: t('nav.teacher.courses'), href: '/(teacher)/classes', icon: 'book-outline', activeIcon: 'book' },
    { key: 'students', label: t('nav.teacher.students'), href: '/(teacher)/students', icon: 'people-outline', activeIcon: 'people' },
    { key: 'audit', label: t('nav.teacher.audit'), href: '/(teacher)/audit', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
    { key: 'profile', label: t('nav.teacher.profile'), href: '/(teacher)/profile', icon: 'person-outline', activeIcon: 'person' },
  ], [t])

  return (
    <MobileBottomNavigation
      activeKey={getVisibleActiveKey(active)}
      accentColor={tokens.brand.teacher}
      items={navItems}
    />
  )
}

function getVisibleActiveKey(active: TeacherSection): VisibleTeacherBottomNavKey {
  if (active === 'notifications' || active === 'settings') return 'profile'
  if (active === 'reviews') return 'students'
  return active
}
