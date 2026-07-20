import { useAppTheme } from '../../lib/appTheme'
import MobileBottomNavigation, {
  MobileBottomNavigationItem,
} from '../ui/mobile/MobileBottomNavigation'

export type StudentBottomNavKey = 'home' | 'classes' | 'progress' | 'profile' | 'settings' | 'ranking' | 'badges' | 'notifications'
type VisibleStudentBottomNavKey = 'home' | 'classes' | 'progress' | 'ranking' | 'profile'

const navItems: MobileBottomNavigationItem<VisibleStudentBottomNavKey>[] = [
  { key: 'home', label: 'Inicio', href: '/(student)/homeStudent', icon: 'home-outline', activeIcon: 'home' },
  { key: 'classes', label: 'Cursos', href: '/(student)/classes', icon: 'book-outline', activeIcon: 'book' },
  { key: 'progress', label: 'Progreso', href: '/(student)/progress', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  { key: 'ranking', label: 'Ranking', href: '/(student)/ranking', icon: 'trophy-outline', activeIcon: 'trophy' },
  { key: 'profile', label: 'Perfil', href: '/(student)/profile', icon: 'person-outline', activeIcon: 'person' },
]

export default function StudentBottomNav({ active }: { active: StudentBottomNavKey }) {
  const { accentColor } = useAppTheme()

  return (
    <MobileBottomNavigation
      activeKey={getVisibleActiveKey(active)}
      accentColor={accentColor}
      items={navItems}
    />
  )
}

function getVisibleActiveKey(active: StudentBottomNavKey): VisibleStudentBottomNavKey {
  if (active === 'badges' || active === 'notifications' || active === 'settings') {
    return 'profile'
  }

  return active
}
