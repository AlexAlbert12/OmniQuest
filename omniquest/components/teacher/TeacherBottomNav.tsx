import { useAppTheme } from '../../lib/appTheme'
import MobileBottomNavigation, {
  MobileBottomNavigationItem,
} from '../ui/mobile/MobileBottomNavigation'
import type { TeacherSection } from './TeacherSidebar'

type VisibleTeacherBottomNavKey = 'home' | 'classes' | 'students' | 'audit' | 'profile'

const navItems: MobileBottomNavigationItem<VisibleTeacherBottomNavKey>[] = [
  { key: 'home', label: 'Inicio', href: '/(teacher)/homeTeacher', icon: 'home-outline', activeIcon: 'home' },
  { key: 'classes', label: 'Cursos', href: '/(teacher)/classes', icon: 'book-outline', activeIcon: 'book' },
  { key: 'students', label: 'Alumnos', href: '/(teacher)/students', icon: 'people-outline', activeIcon: 'people' },
  { key: 'audit', label: 'Auditoría', href: '/(teacher)/audit', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
  { key: 'profile', label: 'Perfil', href: '/(teacher)/profile', icon: 'person-outline', activeIcon: 'person' },
]

export default function TeacherBottomNav({ active }: { active: TeacherSection }) {
  const { accentColor } = useAppTheme()

  return (
    <MobileBottomNavigation
      activeKey={getVisibleActiveKey(active)}
      accentColor={accentColor}
      items={navItems}
    />
  )
}

function getVisibleActiveKey(active: TeacherSection): VisibleTeacherBottomNavKey {
  if (active === 'notifications' || active === 'settings') {
    return 'profile'
  }

  return active
}
