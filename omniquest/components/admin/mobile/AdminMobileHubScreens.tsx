import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAdminData } from '../hooks/useAdminData'
import { AdminScaffold } from '../shared/AdminScaffold'
import { Panel } from '../shared/AdminPrimitives'
import { supabase } from '../../../lib/supabase'
import type { AdminPermission, IconName } from '../types/admin'
import { signOutCurrentDeviceSession } from '../../../lib/pushNotifications'

export function AdminUsersHubScreen() {
  const data = useAdminData()
  return <AdminScaffold activeSection="users" title="Usuarios" subtitle="Elige la entidad que quieres supervisar. Los filtros y la búsqueda aparecen al entrar." data={data}><HubGrid items={[{ title: 'Profesores', description: 'Cuentas docentes, cursos, seguridad y actividad.', icon: 'school-outline', href: '/(admin)/teachers', permission: 'users.read' }, { title: 'Alumnos', description: 'Cuentas, matrículas, progreso y actividad reciente.', icon: 'people-outline', href: '/(admin)/students', permission: 'users.read' }]} permissions={data.portalContext?.permissions} /></AdminScaffold>
}

export function AdminContentHubScreen() {
  const data = useAdminData()
  return <AdminScaffold activeSection="content" title="Contenido" subtitle="Accede a cursos o clases sin duplicar buscadores y filtros en esta vista inicial." data={data}><HubGrid items={[{ title: 'Cursos', description: 'Propiedad, archivo, conservación y estructura.', icon: 'book-outline', href: '/(admin)/courses', permission: 'courses.read' }, { title: 'Clases', description: 'Estado, códigos de acceso, curso y alumnado.', icon: 'albums-outline', href: '/(admin)/classrooms', permission: 'courses.read' }]} permissions={data.portalContext?.permissions} /></AdminScaffold>
}

export function AdminMoreScreen() {
  const data = useAdminData()
  const router = useRouter()
  const signOut = async () => { await signOutCurrentDeviceSession(); router.replace('/(auth)/login' as any) }
  return <AdminScaffold activeSection="more" title="Más" subtitle="Soporte, cuenta y configuración administrativa." data={data}><HubGrid items={[{ title: 'Soporte', description: 'Cola de tickets, asignación, SLA y conversación.', icon: 'headset-outline', href: '/(admin)/support', permission: 'support.read' }, { title: 'Perfil', description: 'Identidad de la cuenta y rol administrativo.', icon: 'person-circle-outline', href: '/(admin)/profile', permission: 'dashboard.read' }, { title: 'Configuración', description: 'Seguridad, privacidad y preferencias del portal.', icon: 'settings-outline', href: '/(admin)/settings', permission: 'dashboard.read' }]} permissions={data.portalContext?.permissions} /><Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={() => void signOut()} className="mt-4 flex-row items-center justify-center gap-3 rounded-2xl border border-semantic-danger bg-semantic-surface-danger px-5 py-4"><Ionicons name="log-out-outline" size={21} /><Text className="font-black text-semantic-danger">Cerrar sesión</Text></Pressable></AdminScaffold>
}

export function AdminProfileScreen() {
  const data = useAdminData()
  const profile = data.profiles.find((item) => item.id === data.portalContext?.user_id)
  return <AdminScaffold activeSection="profile" title="Perfil" subtitle="Identidad y alcance de tu cuenta administrativa." data={data}><Panel title="Cuenta administrativa" icon="person-circle-outline" className="mt-5"><View className="items-center py-4"><View className="h-24 w-24 items-center justify-center rounded-full bg-surface-selected"><Text className="text-[30px] font-black text-brand-admin">{getInitials(profile?.alias || 'Administrador')}</Text></View><Text className="mt-4 text-[22px] font-black text-text-primary">{profile?.alias || 'Administrador'}</Text><Text className="mt-1 text-[13px] text-text-muted">{profile?.email || 'Correo protegido'}</Text><View className="mt-5 w-full gap-3"><InfoRow icon="shield-checkmark-outline" label="Rol" value={data.portalContext?.role_name || 'Administrador'} /><InfoRow icon="key-outline" label="Permisos" value={`${data.portalContext?.permissions.length || 0} asignados`} /><InfoRow icon="checkmark-circle-outline" label="Estado" value={profile?.active === false ? 'Inactivo' : 'Activo'} /></View></View></Panel></AdminScaffold>
}

export function AdminSettingsScreen() {
  const data = useAdminData()
  return <AdminScaffold activeSection="settings" title="Configuración" subtitle="Opciones de seguridad y gobierno del portal administrativo." data={data}><HubGrid items={[{ title: 'Seguridad de la cuenta', description: 'Sesiones, dispositivos y cierre seguro.', icon: 'shield-checkmark-outline', href: '/(admin)/security', permission: 'dashboard.read' }, { title: 'Auditoría y retención', description: 'Consulta la política efectiva y verifica la integridad.', icon: 'finger-print-outline', href: '/(admin)/audit', permission: 'audit.read' }, { title: 'Preferencias de soporte', description: 'Gestiona tickets, plantillas y comunicación.', icon: 'options-outline', href: '/(admin)/support', permission: 'support.read' }]} permissions={data.portalContext?.permissions} /></AdminScaffold>
}

type HubItem = { title: string; description: string; icon: IconName; href: string; permission: AdminPermission }
function HubGrid({ items, permissions }: { items: HubItem[]; permissions?: AdminPermission[] }) {
  const router = useRouter()
  const visible = items.filter((item) => !permissions || permissions.includes(item.permission))
  return <View className="mt-5 flex-row flex-wrap gap-4">{visible.map((item) => <Pressable key={item.href} accessibilityRole="link" accessibilityLabel={`Abrir ${item.title}`} onPress={() => router.push(item.href as any)} className="min-w-[250px] flex-1 rounded-[24px] border border-border-default bg-surface-default p-5" style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}><View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-selected"><Ionicons name={item.icon} size={25} /></View><Text className="mt-4 text-[18px] font-black text-text-primary">{item.title}</Text><Text className="mt-2 text-[13px] leading-5 text-text-secondary">{item.description}</Text><View className="mt-4 flex-row items-center gap-2"><Text className="font-black text-brand-admin">Entrar</Text><Ionicons name="arrow-forward" size={17} /></View></Pressable>)}</View>
}
function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) { return <View className="flex-row items-center gap-3 rounded-2xl border border-border-default bg-surface-raised px-4 py-3"><Ionicons name={icon} size={19} /><View className="min-w-0 flex-1"><Text className="text-[10px] font-black uppercase tracking-[0.7px] text-text-muted">{label}</Text><Text className="mt-1 text-[13px] font-black text-text-primary">{value}</Text></View></View> }
function getInitials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A' }
