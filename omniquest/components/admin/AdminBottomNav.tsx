import { useAppTheme } from '../../lib/appTheme'
import MobileBottomNavigation, {
  MobileBottomNavigationItem,
} from '../ui/mobile/MobileBottomNavigation'

type AdminBottomNavSection = 'home' | 'teachers' | 'students' | 'courses' | 'classrooms' | 'audit'

const navItems: MobileBottomNavigationItem<AdminBottomNavSection>[] = [
  { key: 'home', label: 'Inicio', href: '/(admin)/homeAdmin', icon: 'home-outline', activeIcon: 'home' },
  { key: 'teachers', label: 'Profesores', href: '/(admin)/teachers', icon: 'school-outline', activeIcon: 'school' },
  { key: 'students', label: 'Alumnos', href: '/(admin)/students', icon: 'people-outline', activeIcon: 'people' },
  { key: 'courses', label: 'Cursos', href: '/(admin)/courses', icon: 'book-outline', activeIcon: 'book' },
  { key: 'classrooms', label: 'Clases', href: '/(admin)/classrooms', icon: 'albums-outline', activeIcon: 'albums' },
  { key: 'audit', label: 'Auditoría', href: '/(admin)/audit', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
]

export default function AdminBottomNav({ active }: { active: AdminBottomNavSection }) {
  const { accentColor } = useAppTheme()

  return (
    <MobileBottomNavigation
      activeKey={active}
      accentColor={accentColor}
      items={navItems}
      scrollable
    />
  )
}
