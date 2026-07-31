import { useMemo } from 'react'
import { useAppTheme } from '../../lib/appTheme'
import type { AdminPermission } from './types/admin'
import MobileBottomNavigation, {
  MobileBottomNavigationItem,
} from '../ui/mobile/MobileBottomNavigation'

type AdminSection = 'home' | 'teachers' | 'students' | 'courses' | 'classrooms' | 'support' | 'audit'
type AdminMobileGroup = 'home' | 'users' | 'content' | 'audit' | 'more'

function resolveActiveGroup(active: AdminSection): AdminMobileGroup {
  if (active === 'teachers' || active === 'students') return 'users'
  if (active === 'courses' || active === 'classrooms') return 'content'
  if (active === 'audit') return 'audit'
  if (active === 'support') return 'more'
  return 'home'
}

export default function AdminBottomNav({ active, permissions }: { active: AdminSection; permissions?: AdminPermission[] }) {
  const { tokens } = useAppTheme()
  const activeGroup = resolveActiveGroup(active)
  const navItems = useMemo<MobileBottomNavigationItem<AdminMobileGroup>[]>(() => {
    const allItems: Array<MobileBottomNavigationItem<AdminMobileGroup> & { permission: AdminPermission }> = [
      { key: 'home', label: 'Inicio', href: '/(admin)/homeAdmin', icon: 'home-outline', activeIcon: 'home', permission: 'dashboard.read' },
      { key: 'users', label: 'Usuarios', href: '/(admin)/teachers', icon: 'people-outline', activeIcon: 'people', permission: 'users.read' },
      { key: 'content', label: 'Cursos', href: '/(admin)/courses', icon: 'book-outline', activeIcon: 'book', permission: 'courses.read' },
      { key: 'audit', label: 'Auditoría', href: '/(admin)/audit', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', permission: 'audit.read' },
      { key: 'more', label: 'Más', href: '/(admin)/support', icon: 'ellipsis-horizontal-circle-outline', activeIcon: 'ellipsis-horizontal-circle', permission: 'support.read' },
    ]
    return allItems.filter((item) => !permissions || permissions.includes(item.permission)).map(({ permission: _permission, ...item }) => item)
  }, [permissions])

  return (
    <MobileBottomNavigation
      activeKey={activeGroup}
      accentColor={tokens.brand.admin}
      items={navItems}
    />
  )
}
