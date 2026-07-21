import { useMemo } from 'react'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import MobileBottomNavigation, {
  MobileBottomNavigationItem,
} from '../ui/mobile/MobileBottomNavigation'

type AdminBottomNavSection = 'home' | 'teachers' | 'students' | 'courses' | 'classrooms' | 'support' | 'audit'

export default function AdminBottomNav({ active }: { active: AdminBottomNavSection }) {
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  const navItems = useMemo<MobileBottomNavigationItem<AdminBottomNavSection>[]>(() => [
    { key: 'home', label: t('nav.admin.home'), href: '/(admin)/homeAdmin', icon: 'home-outline', activeIcon: 'home' },
    { key: 'teachers', label: t('nav.admin.teachers'), href: '/(admin)/teachers', icon: 'school-outline', activeIcon: 'school' },
    { key: 'students', label: t('nav.admin.students'), href: '/(admin)/students', icon: 'people-outline', activeIcon: 'people' },
    { key: 'courses', label: t('nav.admin.courses'), href: '/(admin)/courses', icon: 'book-outline', activeIcon: 'book' },
    { key: 'classrooms', label: t('nav.admin.classrooms'), href: '/(admin)/classrooms', icon: 'albums-outline', activeIcon: 'albums' },
    { key: 'support', label: t('nav.admin.support'), href: '/(admin)/support', icon: 'headset-outline', activeIcon: 'headset' },
    { key: 'audit', label: t('nav.admin.audit'), href: '/(admin)/audit', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
  ], [t])

  return (
    <MobileBottomNavigation
      activeKey={active}
      accentColor={tokens.brand.admin}
      items={navItems}
      scrollable
    />
  )
}
