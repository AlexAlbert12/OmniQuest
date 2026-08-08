import React from 'react'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import BrandLogo from '../../BrandLogo'
import AdminBottomNav from '../AdminBottomNav'
import AdminScreenLayout from '../../layouts/AdminScreenLayout'
import GlobalSearchButton from '../../search/GlobalSearchButton'
import { AppButton } from '../../ui'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import { supabase } from '../../../lib/supabase'
import { adminSections, type AdminData, type AdminSection, type IconName } from '../types/admin'
import { filledIconFor, getAdminSectionIcon } from '../utils/adminUtils'
import { signOutCurrentDeviceSession } from '../../../lib/pushNotifications'

export function AdminScaffold({ activeSection, children, data, subtitle, title }: { activeSection: AdminSection; children: React.ReactNode; data: AdminData; subtitle: string; title: string }) {
  const responsive = useResponsiveLayout()
  const router = useRouter()
  const { tokens } = useAppTheme()
  const isDesktop = responsive.isDesktop
  const activeIcon = activeSection === 'home' ? 'shield-checkmark' : getAdminSectionIcon(activeSection)
  const handleSignOut = async () => { await signOutCurrentDeviceSession(); router.replace('/(auth)/login' as any) }
  return <AdminScreenLayout contentLabel={`Portal de administración: ${title}`} desktopSidebar={<AdminSidebar activeSection={activeSection} data={data} onSignOut={handleSignOut} />} mobileBottomNavigation={<AdminBottomNav active={activeSection} permissions={data.portalContext?.permissions} />} isDesktop={isDesktop} loading={data.loading} loadingLabel="Cargando portal de administrador..." refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.onRefresh} tintColor={tokens.brand.admin} />}>
    {isDesktop ? <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4"><View className="min-w-[260px] flex-1"><View className="flex-row items-center gap-3"><Ionicons name={activeIcon} size={42} color={tokens.semantic.info} /><Text accessibilityRole="header" maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[36px] font-black text-text-primary">{title}</Text></View><Text maxFontSizeMultiplier={2} className="mt-2 text-[14px] leading-5 text-text-secondary">{subtitle}</Text>{data.portalContext ? <Text className="mt-2 text-[11px] font-bold text-text-muted">Rol administrativo: {data.portalContext.role_name}</Text> : null}</View><GlobalSearchButton role="admin" /></View> : <View className="mb-6 rounded-[28px] border border-border-default bg-surface-default p-5"><View className="flex-row items-start gap-4"><View className="h-14 w-14 items-center justify-center rounded-3xl bg-surface-selected"><Ionicons name={activeIcon} size={30} color={tokens.brand.admin} /></View><View className="min-w-0 flex-1"><Text accessibilityRole="header" maxFontSizeMultiplier={2} className="text-[30px] font-black leading-[38px] text-text-primary" numberOfLines={2}>{title}</Text><Text maxFontSizeMultiplier={2} className="mt-2 text-[14px] leading-5 text-text-secondary" numberOfLines={4}>{subtitle}</Text></View></View><View className="mt-5 flex-row items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-default px-4 py-3"><View className="min-w-0 flex-1 flex-row items-center gap-2"><Ionicons name="lock-closed-outline" size={15} color={tokens.brand.admin} /><Text className="min-w-0 flex-1 text-[12px] font-black uppercase tracking-[0.8px] text-brand-admin">{data.portalContext?.role_name || 'Portal privado'}</Text></View><AppButton accessibilityHint="Actualiza los datos del portal" icon="refresh-outline" label="Actualizar" size="sm" variant="ghost" onPress={data.onRefresh} /></View></View>}
    {children}
  </AdminScreenLayout>
}

export function AdminSidebar({ activeSection, data, onSignOut }: { activeSection: AdminSection; data: AdminData; onSignOut: () => void }) {
  const { tokens } = useAppTheme()
  const permittedSections = adminSections.filter((item) => !data.portalContext || data.portalContext.permissions.includes(item.permission))
  return <View className="w-[244px] border-r border-border-default bg-background-secondary px-4 py-7"><View className="mb-5 flex-row items-center gap-2 px-2"><BrandLogo size={30} /><Ionicons name="shield-checkmark" size={19} color={tokens.semantic.info} /></View><View style={{ gap: 8 }}>{permittedSections.map((item) => <AdminNavButton key={item.section} item={item} active={item.section === activeSection} />)}</View><View className="mt-auto" style={{ gap: 10 }}><View className="rounded-2xl border border-border-subtle bg-surface-default p-4"><Text className="text-[14px] font-bold text-text-primary">{data.portalContext?.role_name || 'Administrador'}</Text><Text className="mt-1 text-[12px] text-text-muted">{data.portalContext?.permissions.length || 0} permisos asignados</Text><View className="mt-3 flex-row items-center gap-1"><Ionicons name="lock-closed-outline" size={13} color={tokens.text.muted} /><Text className="text-[12px] text-text-secondary">Gestión interna</Text></View></View><AppButton label="Cerrar sesión" icon="log-out-outline" variant="danger" fullWidth onPress={onSignOut} /></View></View>
}

export function AdminNavButton({ active, item }: { active: boolean; item: { section: AdminSection; label: string; icon: IconName; href: string } }) { const { tokens } = useAppTheme(); const router = useRouter(); return <Pressable testID={`admin-nav-${item.section}`} accessibilityRole="link" accessibilityLabel={`Abrir ${item.label}`} accessibilityState={{ selected: active }} onPress={() => router.push(item.href as any)} className="flex-row items-center gap-3 rounded-xl px-4 py-3" style={({ pressed }) => ({ backgroundColor: active ? tokens.surface.selected : 'transparent', borderWidth: 1, borderColor: active ? tokens.border.active : 'transparent', opacity: pressed ? 0.82 : 1 })}><Ionicons name={active ? filledIconFor(item.icon) : item.icon} size={19} color={active ? tokens.text.primary : tokens.text.secondary} /><Text className={`font-black ${active ? 'text-text-primary' : 'text-text-secondary'}`}>{item.label}</Text></Pressable> }
