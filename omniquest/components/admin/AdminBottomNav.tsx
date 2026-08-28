import { useMemo } from 'react'
import { useAppTheme } from '../../lib/appTheme'
import type { AdminPermission, AdminSection } from './types/admin'
import MobileBottomNavigation, { MobileBottomNavigationItem } from '../ui/mobile/MobileBottomNavigation'

type AdminMobileGroup = 'home' | 'users' | 'content' | 'audit' | 'more'

function resolveActiveGroup(active: AdminSection): AdminMobileGroup {
  if (active === 'teachers' || active === 'students' || active === 'users') return 'users'
  if (active === 'courses' || active === 'classrooms' || active === 'content') return 'content'
  if (active === 'audit') return 'audit'
  if (active === 'support' || active === 'more' || active === 'profile' || active === 'security' || active === 'exports' || active === 'permissions' || active === 'push') return 'more'
  return 'home'
}


function resolveDisabledGroup(active: AdminSection): AdminMobileGroup | null {
  if (active === 'home' || active === 'users' || active === 'content' || active === 'audit' || active === 'more') return active
  return null
}

export default function AdminBottomNav({ active, permissions }: { active: AdminSection; permissions?: AdminPermission[] }) {
  const { tokens } = useAppTheme()
  const activeGroup = resolveActiveGroup(active)
  const navItems = useMemo<MobileBottomNavigationItem<AdminMobileGroup>[]>(() => {
    const availablePermissions = permissions || []
    const allItems: (MobileBottomNavigationItem<AdminMobileGroup> & { permission: AdminPermission })[] = [
      { key: 'home', label: 'Inicio', href: '/(admin)/homeAdmin', icon: 'home-outline', activeIcon: 'home', testID: 'admin-nav-home', permission: 'dashboard.read' },
      { key: 'users', label: 'Usuarios', href: '/(admin)/users', icon: 'people-outline', activeIcon: 'people', testID: 'admin-nav-users', permission: 'users.read' },
      { key: 'content', label: 'Contenido', href: '/(admin)/content', icon: 'book-outline', activeIcon: 'book', testID: 'admin-nav-content', permission: 'courses.read' },
      { key: 'audit', label: 'Auditoría', href: '/(admin)/audit', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', testID: 'admin-nav-audit', permission: 'audit.read' },
      { key: 'more', label: 'Más', href: '/(admin)/more', icon: 'ellipsis-horizontal-circle-outline', activeIcon: 'ellipsis-horizontal-circle', testID: 'admin-nav-more', permission: 'dashboard.read' },
    ]
    return allItems.filter((item) => availablePermissions.includes(item.permission)).map(({ permission: _permission, ...item }) => item)
  }, [permissions])
  const disabledKey = resolveDisabledGroup(active)
  return <MobileBottomNavigation activeKey={activeGroup} disabledKey={disabledKey} accentColor={tokens.brand.admin} items={navItems} />
}
