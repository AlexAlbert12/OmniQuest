import React from 'react'
import AdminButton from './AdminButton'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import BrandLogo from '../../BrandLogo'
import AdminBottomNav from '../AdminBottomNav'
import AdminScreenLayout from '../../layouts/AdminScreenLayout'
import GlobalSearchButton from '../../search/GlobalSearchButton'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import { useResponsiveLayout } from '../../../lib/responsive'
import { adminSections, type AdminData, type AdminPermission, type AdminSection, type IconName } from '../types/admin'
import { filledIconFor, getAdminSectionIcon } from '../utils/adminUtils'
import { signOutCurrentDeviceSession } from '../../../lib/pushNotifications'
import { translateUiText, useI18n } from '../../../lib/i18n'

const SECTION_PERMISSIONS: Record<AdminSection, AdminPermission[]> = {
  home: ['dashboard.read'],
  teachers: ['users.read'],
  students: ['users.read'],
  users: ['users.read'],
  courses: ['courses.read'],
  classrooms: ['courses.read'],
  content: ['courses.read'],
  support: ['support.read'],
  audit: ['audit.read'],
  more: ['dashboard.read'],
  profile: ['dashboard.read'],
  settings: ['dashboard.read'],
  exports: ['users.export', 'courses.read', 'audit.export', 'support.read'],
  permissions: ['admin.roles.manage'],
  push: ['notifications.read'],
}

export function AdminScaffold({ activeSection, children, data, requiredPermissions, subtitle, title }: { activeSection: AdminSection; children: React.ReactNode; data: AdminData; requiredPermissions?: AdminPermission[]; subtitle: string; title: string }) {
  const responsive = useResponsiveLayout()
  const router = useRouter()
  const { tokens } = useAppTheme()
  const isDesktop = responsive.isDesktop
  const activeIcon = activeSection === 'home' ? 'shield-checkmark' : getAdminSectionIcon(activeSection)
  const handleSignOut = async () => { await signOutCurrentDeviceSession(); router.replace('/(auth)/login' as any) }
  const permissions = data.portalContext?.permissions || []
  const expectedPermissions = requiredPermissions?.length ? requiredPermissions : SECTION_PERMISSIONS[activeSection]
  const hasSectionAccess = Boolean(data.portalContext && expectedPermissions.some((permission) => permissions.includes(permission)))
  const loadingLabel = activeSection === 'content' ? 'Cargando área de contenido...' : activeSection === 'courses' ? 'Cargando cursos...' : activeSection === 'classrooms' ? 'Cargando clases...' : 'Cargando portal de administrador...'
  const accessContent = data.portalContextError
    ? <AdminAccessState title="No se ha podido verificar el perfil de permisos" message="Por seguridad, el portal permanece bloqueado hasta que podamos comprobar tu perfil administrativo." actionLabel="Reintentar" onAction={data.onRefresh} />
    : !hasSectionAccess
      ? <AdminAccessState title={data.portalContext?.role_id ? 'Acceso no disponible' : 'Acceso administrativo pendiente'} message={data.portalContext?.role_id ? 'Tu perfil administrativo no incluye permisos para esta sección.' : 'Tu cuenta es administradora, pero todavía no tiene un perfil de permisos asignado. Un administrador global debe concederte acceso explícitamente.'} />
      : children

  return <AdminScreenLayout contentLabel={`Portal de administración: ${title}`} desktopSidebar={<AdminSidebar activeSection={activeSection} data={data} onSignOut={handleSignOut} />} mobileBottomNavigation={data.portalContext && !data.portalContextError ? <AdminBottomNav active={activeSection} permissions={permissions} /> : null} isDesktop={isDesktop} loading={data.loading} loadingLabel={loadingLabel} refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.onRefresh} tintColor={tokens.brand.admin} />}>
    {isDesktop ? <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4"><View className="min-w-[260px] flex-1"><View className="flex-row items-center gap-3"><Ionicons name={activeIcon} size={42} color={tokens.brand.admin} /><Text accessibilityRole="header" maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[36px] font-black text-text-primary">{title}</Text></View><Text maxFontSizeMultiplier={2} className="mt-2 text-[14px] leading-5 text-text-secondary">{subtitle}</Text>{data.portalContext ? <Text className="mt-2 text-[11px] font-bold text-text-muted">Rol administrativo: {data.portalContext.role_name}</Text> : null}</View>{hasSectionAccess ? <GlobalSearchButton role="admin" /> : null}</View> : <View className="mb-6 rounded-[28px] border border-border-default bg-surface-default p-5"><View className="flex-row items-start gap-4"><View className="h-14 w-14 items-center justify-center rounded-3xl" style={{ backgroundColor: withAlpha(tokens.brand.admin, '18') }}><Ionicons name={activeIcon} size={30} color={tokens.brand.admin} /></View><View className="min-w-0 flex-1"><Text accessibilityRole="header" maxFontSizeMultiplier={2} className="text-[30px] font-black leading-[38px] text-text-primary" numberOfLines={2}>{title}</Text><Text maxFontSizeMultiplier={2} className="mt-2 text-[14px] leading-5 text-text-secondary" numberOfLines={4}>{subtitle}</Text></View></View><View className="mt-5 flex-row items-center gap-2 rounded-2xl border border-border-default bg-surface-default px-4 py-3"><Ionicons name="lock-closed-outline" size={15} color={tokens.brand.admin} /><Text className="min-w-0 flex-1 text-[12px] font-black uppercase tracking-[0.8px] text-brand-admin">{data.portalContext?.role_name || 'Permisos sin verificar'}</Text></View></View>}
    {accessContent}
  </AdminScreenLayout>
}

function AdminAccessState({ actionLabel, message, onAction, title }: { actionLabel?: string; message: string; onAction?: () => void; title: string }) {
  const { tokens } = useAppTheme()
  return <View className="rounded-[24px] border border-border-default bg-surface-default p-6"><View className="h-12 w-12 items-center justify-center rounded-2xl bg-semantic-surface-warning"><Ionicons name="lock-closed-outline" size={24} color={tokens.semantic.warning} /></View><Text accessibilityRole="header" className="mt-4 text-[20px] font-black text-text-primary">{title}</Text><Text className="mt-2 max-w-[680px] text-[13px] leading-6 text-text-secondary">{message}</Text>{actionLabel && onAction ? <View className="mt-5 items-start"><AdminButton label={actionLabel} icon="refresh-outline" onPress={onAction} /></View> : null}</View>
}

export function AdminSidebar({ activeSection, data, onSignOut }: { activeSection: AdminSection; data: AdminData; onSignOut: () => void }) {
  const { tokens } = useAppTheme()
  const permissions = data.portalContext?.permissions || []
  const permittedSections = adminSections.filter((item) => permissions.includes(item.permission))
  return <View className="w-[244px] border-r border-border-default bg-background-secondary px-4 py-7"><View className="mb-5 flex-row items-center gap-2 px-2"><BrandLogo size={30} questColor={tokens.brand.admin} /><Ionicons name="shield-checkmark" size={19} color={tokens.brand.admin} /></View><View style={{ gap: 8 }}>{permittedSections.map((item) => <AdminNavButton key={item.section} item={item} active={item.section === activeSection || (item.section === 'more' && ['profile', 'settings', 'exports', 'permissions', 'push'].includes(activeSection))} />)}</View><View className="mt-auto" style={{ gap: 10 }}><View className="rounded-2xl border border-border-subtle bg-surface-default p-4"><Text className="text-[14px] font-bold text-text-primary">{data.portalContext?.role_name || 'Permisos sin verificar'}</Text><Text className="mt-1 text-[12px] text-text-muted">{permissions.length} permisos asignados</Text><View className="mt-3 flex-row items-center gap-1"><Ionicons name="lock-closed-outline" size={13} color={tokens.text.muted} /><Text className="text-[12px] text-text-secondary">Gestión interna</Text></View></View><AdminButton label="Cerrar sesión" icon="log-out-outline" variant="danger" fullWidth onPress={onSignOut} /></View></View>
}

export function AdminNavButton({ active, item }: { active: boolean; item: { section: AdminSection; label: string; icon: IconName; href: string } }) { const { tokens } = useAppTheme(); const { locale } = useI18n(); const router = useRouter(); const label = translateUiText(locale, item.label); const activeBorder = withAlpha(tokens.brand.admin, 'A0'); const activeSurface = withAlpha(tokens.brand.admin, '18'); return <Pressable testID={`admin-nav-${item.section}`} accessibilityRole="link" accessibilityLabel={`Abrir ${label}`} accessibilityState={{ selected: active }} onPress={() => router.push(item.href as any)} className="flex-row items-center gap-3 rounded-xl px-4 py-3" style={({ pressed }) => ({ backgroundColor: active ? activeSurface : 'transparent', borderWidth: 1, borderColor: active ? activeBorder : 'transparent', opacity: pressed ? 0.82 : 1 })}><Ionicons name={active ? filledIconFor(item.icon) : item.icon} size={19} color={active ? tokens.brand.admin : tokens.text.secondary} /><Text className="font-black" style={{ color: active ? tokens.brand.admin : tokens.text.secondary }}>{label}</Text></Pressable> }
