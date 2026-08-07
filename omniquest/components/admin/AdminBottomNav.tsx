import { useMemo } from 'react'
import { useAppTheme } from '../../lib/appTheme'
import type { AdminPermission, AdminSection } from './types/admin'
import MobileBottomNavigation, { MobileBottomNavigationItem } from '../ui/mobile/MobileBottomNavigation'

type AdminMobileGroup = 'home' | 'users' | 'content' | 'audit' | 'more'

function resolveActiveGroup(active: AdminSection): AdminMobileGroup {
  if (active === 'teachers' || active === 'students' || active === 'users') return 'users'
  if (active === 'courses' || active === 'classrooms' || active === 'content') return 'content'
  if (active === 'audit') return 'audit'
  if (active === 'support' || active === 'more' || active === 'profile' || active === 'settings') return 'more'
  return 'home'
}

export default function AdminBottomNav({ active, permissions }: { active: AdminSection; permissions?: AdminPermission[] }) {
  const { tokens } = useAppTheme()
  const activeGroup = resolveActiveGroup(active)
  const navItems = useMemo<MobileBottomNavigationItem<AdminMobileGroup>[]>(() => {
    const allItems: (MobileBottomNavigationItem<AdminMobileGroup> & { permission: AdminPermission })[] = [
      { key: 'home', label: 'Inicio', href: '/(admin)/homeAdmin', icon: 'home-outline', activeIcon: 'home', testID: 'admin-nav-home', permission: 'dashboard.read' },
      { key: 'users', label: 'Usuarios', href: '/(admin)/users', icon: 'people-outline', activeIcon: 'people', testID: 'admin-nav-users', permission: 'users.read' },
      { key: 'content', label: 'Contenido', href: '/(admin)/content', icon: 'book-outline', activeIcon: 'book', testID: 'admin-nav-content', permission: 'courses.read' },
      { key: 'audit', label: 'Auditoría', href: '/(admin)/audit', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', testID: 'admin-nav-audit', permission: 'audit.read' },
      { key: 'more', label: 'Más', href: '/(admin)/more', icon: 'ellipsis-horizontal-circle-outline', activeIcon: 'ellipsis-horizontal-circle', testID: 'admin-nav-more', permission: 'dashboard.read' },
    ]
    return allItems.filter((item) => !permissions || permissions.includes(item.permission)).map(({ permission: _permission, ...item }) => item)
  }, [permissions])
  return <MobileBottomNavigation activeKey={activeGroup} accentColor={tokens.brand.admin} items={navItems} />
}
