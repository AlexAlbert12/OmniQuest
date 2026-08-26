import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAdminData } from '../hooks/useAdminData'
import { useAdminPortalContext } from '../hooks/useAdminPortalContext'
import { useAdminExportJobs } from '../hooks/useAdminExportJobs'
import { useAdminAccountExportRequests } from '../hooks/useAdminAccountExportRequests'
import { AdminScaffold } from '../shared/AdminScaffold'
import AdminExportJobsPanel from '../shared/AdminExportJobsPanel'
import AdminAccountExportRequestsPanel from '../shared/AdminAccountExportRequestsPanel'
import { Panel } from '../shared/AdminPrimitives'
import AdminProfileAvatar from '../shared/AdminProfileAvatar'
import AdminRoleManagementPanel from '../users/AdminRoleManagementPanel'
import type { AdminPermission, IconName } from '../types/admin'
import { AppBottomSheet } from '../../ui'
import { signOutCurrentDeviceSession } from '../../../lib/pushNotifications'
import { useAppModal } from '../../AppModalProvider'
import { useResponsiveLayout } from '../../../lib/responsive'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'

export function AdminUsersHubScreen() {
  const data = useAdminData()
  return <AdminScaffold activeSection="users" title="Usuarios" subtitle="Gestiona profesores y alumnos desde un único punto." data={data}><HubGrid items={[{ title: 'Profesores', description: 'Cuentas docentes, cursos, seguridad y actividad.', icon: 'school-outline', href: '/(admin)/teachers', permission: 'users.read' }, { title: 'Alumnos', description: 'Cuentas, matrículas, progreso y actividad reciente.', icon: 'people-outline', href: '/(admin)/students', permission: 'users.read' }]} permissions={data.portalContext?.permissions} /></AdminScaffold>
}

export function AdminContentHubScreen() {
  const data = useAdminData()
  return <AdminScaffold activeSection="content" title="Contenido" subtitle="Supervisa cursos y clases desde un único punto." data={data}><HubGrid items={[{ title: 'Cursos', description: 'Propiedad, archivo, conservación y estructura.', icon: 'book-outline', href: '/(admin)/courses', permission: 'courses.read' }, { title: 'Clases', description: 'Estado, códigos de acceso, curso y alumnado.', icon: 'albums-outline', href: '/(admin)/classrooms', permission: 'courses.read' }]} permissions={data.portalContext?.permissions} /></AdminScaffold>
}

export function AdminMoreScreen() {
  const data = useAdminPortalContext()
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const signOut = async () => { await signOutCurrentDeviceSession(); router.replace('/(auth)/login' as any) }
  const requestSignOut = () => showModal({ title: 'Cerrar sesión', message: 'Se cerrará tu sesión administrativa en este dispositivo.', variant: 'warning', buttons: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Cerrar sesión', role: 'danger', onPress: signOut }] })
  const items: HubItem[] = [
    ...(!responsive.isDesktop ? [{ title: 'Soporte', description: 'Gestiona tickets, asignaciones y conversaciones.', icon: 'headset-outline' as const, href: '/(admin)/support', permission: 'support.read' as const }] : []),
    { title: 'Notificaciones push', description: 'Supervisa envíos, entregas, reintentos y dispositivos registrados.', icon: 'notifications-outline', href: '/(admin)/push', permission: 'notifications.read' },
    { title: 'Exportaciones', description: 'Consulta el estado y descarga los archivos preparados.', icon: 'cloud-download-outline', href: '/(admin)/exports', permission: ['users.export', 'courses.read', 'audit.export', 'support.read'] },
    { title: 'Administración y permisos', description: 'Gestiona el acceso y los permisos de otros administradores.', icon: 'key-outline', href: '/(admin)/permissions', permission: 'admin.roles.manage' },
    { title: 'Perfil', description: 'Identidad de la cuenta y rol administrativo.', icon: 'person-circle-outline', href: '/(admin)/profile', permission: 'dashboard.read' },
    { title: 'Seguridad de la cuenta', description: 'Sesiones, dispositivos y códigos de recuperación.', icon: 'shield-checkmark-outline', href: '/(admin)/security', permission: 'dashboard.read' },
  ]
  return <AdminScaffold activeSection="more" title="Más" subtitle="Soporte, notificaciones, exportaciones, permisos y gestión de tu cuenta." data={data}><HubGrid items={items} permissions={data.portalContext?.permissions} compactOnMobile />{!responsive.isDesktop ? <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" accessibilityHint="Pide confirmación antes de cerrar la sesión administrativa" onPress={requestSignOut} className="mt-4 flex-row items-center justify-center gap-3 rounded-2xl border border-semantic-danger bg-semantic-surface-danger px-5 py-4" style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}><Ionicons name="log-out-outline" size={21} color={tokens.semantic.danger} /><Text className="font-black text-semantic-danger">Cerrar sesión</Text></Pressable> : null}</AdminScaffold>
}

export function AdminExportsScreen() {
  const data = useAdminData()
  const responsive = useResponsiveLayout()
  const canViewAccountExports = Boolean(data.portalContext?.permissions.includes('users.export'))
  const accountPageSize = responsive.isDesktop ? 25 : 8
  const jobPageSize = responsive.isDesktop ? 10 : 8
  const exportJobs = useAdminExportJobs({ loadJobs: true, pageSize: jobPageSize, pollPending: true })
  const accountExports = useAdminAccountExportRequests({ enabled: canViewAccountExports, pageSize: accountPageSize, pollPending: true })
  return (
    <AdminScaffold activeSection="exports" title="Exportaciones" subtitle="Supervisa solicitudes personales y trabajos administrativos sin exponer archivos privados de otros usuarios." data={data}>
      {canViewAccountExports ? <AdminAccountExportRequestsPanel {...accountExports} onPrevious={accountExports.previousPage} onNext={accountExports.nextPage} onRetry={() => void accountExports.refresh()} /> : null}
      <AdminExportJobsPanel {...exportJobs} onPrevious={exportJobs.previousPage} onNext={exportJobs.nextPage} onRetry={() => void exportJobs.refresh()} onDownload={(id) => void exportJobs.download(id)} />
    </AdminScaffold>
  )
}

export function AdminPermissionsScreen() {
  const data = useAdminData()
  const canManage = Boolean(data.portalContext?.permissions.includes('admin.roles.manage'))
  return <AdminScaffold activeSection="permissions" title="Administración y permisos" subtitle="Gestiona el acceso administrativo con perfiles explícitos y mínimo privilegio." data={data}><AdminRoleManagementPanel canManage={canManage} currentAdminId={data.portalContext?.user_id} /><View className="mt-5"><Panel title="Modelo de acceso" icon="lock-closed-outline" compact><Text className="text-[13px] leading-5 text-text-secondary">Cada administrador necesita un perfil de permisos explícito. Una cuenta sin asignación permanece sin acceso operativo hasta que un administrador global le conceda un rol.</Text><Text className="mt-2 text-[12px] leading-5 text-text-muted">Las acciones sensibles siguen protegidas en servidor, requieren permisos concretos y quedan registradas en auditoría.</Text></Panel></View></AdminScaffold>
}

export function AdminProfileScreen() {
  const data = useAdminPortalContext()
  const responsive = useResponsiveLayout()
  const profile = data.portalContext?.profile
  const permissions = data.portalContext?.permissions || []
  const [permissionsVisible, setPermissionsVisible] = React.useState(false)
  const alias = profile?.alias || 'Administrador'
  const email = profile?.email || 'Correo protegido'
  const roleName = data.portalContext?.role_name || 'Sin verificar'
  return <AdminScaffold activeSection="profile" title="Perfil" subtitle="Identidad y alcance de tu cuenta administrativa." data={data}>
    <Panel title="Cuenta administrativa" icon="person-circle-outline" className="mt-5">
      {responsive.isDesktop ? <View className="py-1"><View className="flex-row items-center gap-5 rounded-2xl border border-border-subtle bg-surface-interactive p-5"><AdminProfileAvatar alias={alias} avatar={profile?.avatar} size={96} /><View className="min-w-0 flex-1"><Text className="text-[24px] font-black text-text-primary">{alias}</Text><Text className="mt-1 text-[13px] text-text-muted">{email}</Text><Text className="mt-3 text-[12px] leading-5 text-text-secondary">Cuenta administrativa de solo lectura. Los cambios de permisos se gestionan desde Administración y permisos.</Text></View></View><View className="mt-4 flex-row gap-3"><ProfileInfoCard className="min-w-[220px] flex-1" icon="shield-checkmark-outline" label="Perfil de acceso" value={roleName} /><ProfileInfoCard className="min-w-[220px] flex-1" icon="key-outline" label="Permisos" value={`${permissions.length} asignados`} detail="Ver permisos asignados" onPress={() => setPermissionsVisible(true)} /><ProfileInfoCard className="min-w-[220px] flex-1" icon="lock-closed-outline" label="Seguridad" value="Acceso verificado" detail="Identidad y permisos validados en servidor" /></View></View> : <View className="items-center py-4"><AdminProfileAvatar alias={alias} avatar={profile?.avatar} size={96} /><Text className="mt-4 text-[22px] font-black text-text-primary">{alias}</Text><Text className="mt-1 text-center text-[13px] text-text-muted">{email}</Text><View className="mt-5 w-full gap-3"><InfoRow icon="shield-checkmark-outline" label="Perfil de acceso" value={roleName} /><InfoRow icon="key-outline" label="Permisos" value={`${permissions.length} asignados`} detail="Ver permisos asignados" onPress={() => setPermissionsVisible(true)} /><InfoRow icon="lock-closed-outline" label="Seguridad" value="Acceso verificado" detail="Identidad y permisos validados en servidor" /></View></View>}
    </Panel>
    <AppBottomSheet visible={permissionsVisible} onClose={() => setPermissionsVisible(false)} title={`Permisos de ${roleName}`} description="Alcance funcional confirmado para tu perfil administrativo." testID="admin-profile-permissions-sheet"><View style={{ gap: 10 }}>{ADMIN_PERMISSION_GROUPS.map((group) => <PermissionScopeRow key={group.title} group={group} permissions={permissions} />)}</View></AppBottomSheet>
  </AdminScaffold>
}

type HubItem = { title: string; description: string; icon: IconName; href: string; permission: AdminPermission | AdminPermission[] }
function HubGrid({ compactOnMobile = false, items, permissions }: { compactOnMobile?: boolean; items: HubItem[]; permissions?: AdminPermission[] }) {
  const router = useRouter()
  const { tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  const availablePermissions = permissions || []
  const visible = items.filter((item) => (Array.isArray(item.permission) ? item.permission.some((permission) => availablePermissions.includes(permission)) : availablePermissions.includes(item.permission)))
  if (compactOnMobile && !responsive.isDesktop) {
    return (
      <View className="mt-5 gap-3">
        {visible.map((item) => (
          <Pressable
            key={item.href}
            testID={getHubItemTestID(item)}
            accessibilityRole="link"
            accessibilityLabel={`Abrir ${item.title}`}
            accessibilityHint={item.description}
            onPress={() => router.push(item.href as any)}
            className="min-h-[104px] flex-row items-center gap-4 rounded-2xl border border-border-default bg-surface-default px-4 py-3"
            style={({ pressed }) => ({ borderColor: pressed ? withAlpha(tokens.brand.admin, 'A0') : tokens.border.default, backgroundColor: pressed ? withAlpha(tokens.brand.admin, '16') : tokens.surface.default, opacity: pressed ? 0.84 : 1, transform: [{ scale: pressed ? 0.992 : 1 }] })}
          >
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl border" style={{ backgroundColor: withAlpha(tokens.brand.admin, '18'), borderColor: withAlpha(tokens.brand.admin, '50') }}><Ionicons name={item.icon} size={22} color={tokens.brand.admin} /></View>
            <View className="min-w-0 flex-1"><Text maxFontSizeMultiplier={1.5} className="text-[15px] font-black leading-5 text-text-primary">{item.title}</Text><Text maxFontSizeMultiplier={1.5} numberOfLines={2} className="mt-1 text-[12px] leading-4 text-text-secondary">{item.description}</Text></View>
            <View className="h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(tokens.brand.admin, '14') }}><Ionicons name="chevron-forward" size={18} color={tokens.brand.admin} /></View>
          </Pressable>
        ))}
      </View>
    )
  }
  return (
    <View className="mt-5 flex-row flex-wrap gap-4">
      {visible.map((item) => (
        <Pressable
          key={item.href}
          testID={getHubItemTestID(item)}
          accessibilityRole="link"
          accessibilityLabel={`Abrir ${item.title}`}
          accessibilityHint={item.description}
          onPress={() => router.push(item.href as any)}
          className="min-w-[250px] flex-1 rounded-[24px] border border-border-default bg-surface-default p-5"
          style={({ pressed }) => ({ borderColor: pressed ? withAlpha(tokens.brand.admin, 'A0') : tokens.border.default, backgroundColor: pressed ? withAlpha(tokens.brand.admin, '16') : tokens.surface.default, opacity: pressed ? 0.84 : 1, transform: [{ scale: pressed ? 0.992 : 1 }] })}
        >
          <View className="h-12 w-12 items-center justify-center rounded-2xl border" style={{ backgroundColor: withAlpha(tokens.brand.admin, '18'), borderColor: withAlpha(tokens.brand.admin, '50') }}><Ionicons name={item.icon} size={25} color={tokens.brand.admin} /></View>
          <Text maxFontSizeMultiplier={1.5} className="mt-4 text-[18px] font-black text-text-primary">{item.title}</Text>
          <Text maxFontSizeMultiplier={1.5} className="mt-2 text-[13px] leading-5 text-text-secondary">{item.description}</Text>
          <View className="mt-4 flex-row items-center gap-2"><Text className="font-black text-brand-admin">Entrar</Text><Ionicons name="arrow-forward" size={17} color={tokens.brand.admin} /></View>
        </Pressable>
      ))}
    </View>
  )
}

function getHubItemTestID(item: HubItem) {
  const slug = item.href.split('?')[0].split('/').filter((segment) => segment && !segment.startsWith('(')).at(-1) || item.title
  return `admin-hub-${slug.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`
}
type PermissionGroup = { title: string; icon: IconName; items: { permission: AdminPermission; label: string }[] }
const ADMIN_PERMISSION_GROUPS: PermissionGroup[] = [
  { title: 'Portal administrativo', icon: 'grid-outline', items: [{ permission: 'dashboard.read', label: 'Acceder al portal' }] },
  { title: 'Usuarios', icon: 'people-outline', items: [{ permission: 'users.read', label: 'Consultar usuarios' }, { permission: 'users.manage', label: 'Gestionar usuarios' }, { permission: 'users.security', label: 'Seguridad de cuentas' }, { permission: 'users.export', label: 'Exportar usuarios' }] },
  { title: 'Cursos y clases', icon: 'book-outline', items: [{ permission: 'courses.read', label: 'Consultar cursos y clases' }, { permission: 'courses.manage', label: 'Gestionar contenido' }, { permission: 'courses.transfer', label: 'Transferir cursos' }, { permission: 'courses.delete', label: 'Eliminar cursos tras retención' }] },
  { title: 'Auditoría', icon: 'finger-print-outline', items: [{ permission: 'audit.read', label: 'Consultar auditoría' }, { permission: 'audit.export', label: 'Exportar auditoría' }] },
  { title: 'Soporte', icon: 'headset-outline', items: [{ permission: 'support.read', label: 'Consultar soporte' }, { permission: 'support.manage', label: 'Gestionar soporte' }] },
  { title: 'Notificaciones', icon: 'notifications-outline', items: [{ permission: 'notifications.read', label: 'Supervisar notificaciones' }, { permission: 'notifications.manage', label: 'Gestionar notificaciones' }] },
  { title: 'Administración', icon: 'key-outline', items: [{ permission: 'admin.roles.manage', label: 'Administrar roles y permisos' }] },
]

function InfoRow({ detail, icon, label, onPress, value }: { detail?: string; icon: IconName; label: string; onPress?: () => void; value: string }) {
  const { tokens } = useAppTheme()
  const content = <><Ionicons name={icon} size={19} color={tokens.brand.admin} /><View className="min-w-0 flex-1"><Text className="text-[10px] font-black uppercase tracking-[0.7px] text-text-muted">{label}</Text><Text className="mt-1 text-[13px] font-black text-text-primary">{value}</Text>{detail ? <Text className="mt-1 text-[11px] leading-4 text-text-muted">{detail}</Text> : null}</View>{onPress ? <Ionicons name="chevron-forward" size={18} color={tokens.brand.admin} /> : null}</>
  if (onPress) return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. ${detail || ''}`} accessibilityHint="Muestra el alcance funcional del perfil administrativo" onPress={onPress} className="flex-row items-center gap-3 rounded-2xl border border-border-default bg-surface-raised px-4 py-3" style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>{content}</Pressable>
  return <View className="flex-row items-center gap-3 rounded-2xl border border-border-default bg-surface-raised px-4 py-3">{content}</View>
}

function ProfileInfoCard({ className = '', detail, icon, label, onPress, value }: { className?: string; detail?: string; icon: IconName; label: string; onPress?: () => void; value: string }) {
  const { tokens } = useAppTheme()
  const content = <><View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(tokens.brand.admin, '18') }}><Ionicons name={icon} size={20} color={tokens.brand.admin} /></View><Text className="mt-3 text-[10px] font-black uppercase tracking-[0.7px] text-text-muted">{label}</Text><Text className="mt-1 text-[15px] font-black text-text-primary">{value}</Text>{detail ? <View className="mt-2 flex-row items-center gap-1"><Text className="text-[11px] font-bold" style={{ color: onPress ? tokens.brand.admin : tokens.text.muted }}>{detail}</Text>{onPress ? <Ionicons name="chevron-forward" size={14} color={tokens.brand.admin} /> : null}</View> : null}</>
  if (onPress) return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. ${detail || ''}`} accessibilityHint="Muestra el alcance funcional del perfil administrativo" onPress={onPress} className={`rounded-2xl border border-border-default bg-surface-raised p-4 ${className}`} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>{content}</Pressable>
  return <View className={`rounded-2xl border border-border-default bg-surface-raised p-4 ${className}`}>{content}</View>
}

function PermissionScopeRow({ group, permissions }: { group: PermissionGroup; permissions: AdminPermission[] }) {
  const { tokens } = useAppTheme()
  const included = group.items.filter((item) => permissions.includes(item.permission))
  const summary = included.length === group.items.length ? 'Acceso completo' : included.length === 0 ? 'Sin acceso' : included.map((item) => item.label).join(' · ')
  const active = included.length > 0
  return <View className="flex-row items-start gap-3 rounded-2xl border border-border-default bg-surface-interactive p-4"><View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: active ? withAlpha(tokens.brand.admin, '18') : tokens.surface.disabled }}><Ionicons name={group.icon} size={20} color={active ? tokens.brand.admin : tokens.text.muted} /></View><View className="min-w-0 flex-1"><Text className="text-[13px] font-black text-text-primary">{group.title}</Text><Text className="mt-1 text-[12px] leading-5" style={{ color: active ? tokens.text.secondary : tokens.text.muted }}>{summary}</Text></View></View>
}
