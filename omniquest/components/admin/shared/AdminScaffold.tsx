import React from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import BrandLogo from '../../BrandLogo'
import AdminBottomNav from '../AdminBottomNav'
import AdminScreenLayout from '../../layouts/AdminScreenLayout'
import GlobalSearchButton from '../../search/GlobalSearchButton'
import { AppButton, AppIconButton } from '../../ui'
import { useAppTheme } from '../../../lib/appTheme'
import { useResponsiveLayout } from '../../../lib/responsive'
import { supabase } from '../../../lib/supabase'
import { adminSections, type AdminData, type AdminSection, type IconName } from '../types/admin'
import { filledIconFor, getAdminSectionIcon } from '../utils/adminUtils'

export function AdminScaffold({ activeSection, children, data, subtitle, title }: {
  activeSection: AdminSection
  children: React.ReactNode
  data: AdminData
  subtitle: string
  title: string
}) {
  const responsive = useResponsiveLayout()
  const router = useRouter()
  const { tokens } = useAppTheme()
  const isDesktop = responsive.isDesktop
  const activeIcon = activeSection === 'home' ? 'shield-checkmark' : getAdminSectionIcon(activeSection)
  const handleSignOut = async () => { await supabase.auth.signOut(); router.replace('/(auth)/login' as any) }

  return (
    <AdminScreenLayout
      contentLabel={`Portal de administración: ${title}`}
      desktopSidebar={<AdminSidebar activeSection={activeSection} data={data} onSignOut={handleSignOut} />}
      mobileBottomNavigation={<AdminBottomNav active={activeSection} permissions={data.portalContext?.permissions} />}
      isDesktop={isDesktop}
      loading={data.loading}
      loadingLabel="Cargando portal de administrador..."
      refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.onRefresh} tintColor={tokens.brand.admin} />}
    >
      {isDesktop ? (
        <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
          <View className="min-w-[260px] flex-1">
            <View className="flex-row items-center gap-3"><Ionicons name={activeIcon} size={42} color={tokens.semantic.info} /><Text accessibilityRole="header" maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[36px] font-black text-text-primary">{title}</Text></View>
            <Text maxFontSizeMultiplier={2} className="mt-2 text-[14px] leading-5 text-text-secondary">{subtitle}</Text>
            {data.portalContext ? <Text className="mt-2 text-[11px] font-bold text-text-muted">Rol administrativo: {data.portalContext.role_name}</Text> : null}
          </View>
          <GlobalSearchButton role="admin" />
        </View>
      ) : (
        <View className="mb-6">
          <View className="mb-6 flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 flex-row items-center gap-3"><View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-selected"><Ionicons name={activeIcon} size={25} color={tokens.brand.admin} /></View><Text accessibilityRole="header" maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[28px] font-black text-text-primary" numberOfLines={2}>{title}</Text></View>
            <View className="flex-row items-center gap-2"><GlobalSearchButton role="admin" compact /><AppIconButton accessibilityLabel="Cerrar sesión" accessibilityHint="Cierra la sesión administrativa" icon="log-out-outline" variant="danger" onPress={handleSignOut} /></View>
          </View>
          <View className="rounded-[28px] border border-border-default bg-surface-default p-5">
            <View className="flex-row items-start gap-4"><View className="h-16 w-16 items-center justify-center rounded-3xl bg-surface-selected"><Ionicons name={activeIcon} size={34} color={tokens.brand.admin} /></View><View className="min-w-0 flex-1"><Text maxFontSizeMultiplier={2} className="text-[34px] font-black leading-[42px] text-text-primary" numberOfLines={2}>{title}</Text><Text maxFontSizeMultiplier={2} className="mt-2 text-[14px] leading-5 text-text-secondary" numberOfLines={4}>{subtitle}</Text></View></View>
            <View className="mt-5 flex-row items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-default px-4 py-3"><View className="min-w-0 flex-1 flex-row items-center gap-2"><Ionicons name="lock-closed-outline" size={15} color={tokens.brand.admin} /><Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[12px] font-black uppercase tracking-[0.8px] text-brand-admin">{data.portalContext?.role_name || 'Portal privado'}</Text></View><AppButton accessibilityHint="Actualiza los datos del portal" icon="refresh-outline" label="Actualizar" size="sm" variant="ghost" onPress={data.onRefresh} /></View>
          </View>
        </View>
      )}
      {!isDesktop && activeSection !== 'home' && activeSection !== 'support' ? <View className="mb-4"><AdminMobileSectionTabs activeSection={activeSection} data={data} /></View> : null}
      {children}
    </AdminScreenLayout>
  )
}

export function AdminSidebar({ activeSection, data, onSignOut }: { activeSection: AdminSection; data: AdminData; onSignOut: () => void }) {
  const { tokens } = useAppTheme()
  const permittedSections = adminSections.filter((item) => !data.portalContext || data.portalContext.permissions.includes(item.permission))
  return (
    <View className="w-[244px] border-r border-border-default bg-background-secondary px-4 py-7">
      <View className="mb-5 flex-row items-center gap-2 px-2"><BrandLogo size={30} /><Ionicons name="shield-checkmark" size={19} color={tokens.semantic.info} /></View>
      <View style={{ gap: 8 }}>{permittedSections.map((item) => <AdminNavButton key={item.section} item={item} active={item.section === activeSection} />)}</View>
      <View className="mt-auto" style={{ gap: 10 }}>
        <View className="rounded-2xl border border-border-subtle bg-surface-default p-4"><Text className="text-[14px] font-bold text-text-primary">{data.portalContext?.role_name || 'Administrador'}</Text><Text className="mt-1 text-[12px] text-text-muted">{data.portalContext?.permissions.length || 0} permisos asignados</Text><View className="mt-3 flex-row items-center gap-1"><Ionicons name="lock-closed-outline" size={13} color={tokens.text.muted} /><Text className="text-[12px] text-text-secondary">Gestión interna</Text></View></View>
        <AppButton label="Cerrar sesión" icon="log-out-outline" variant="danger" fullWidth onPress={onSignOut} />
      </View>
    </View>
  )
}

export function AdminNavButton({ active, item }: { active: boolean; item: { label: string; icon: IconName; href: string } }) {
  const { tokens } = useAppTheme()
  const router = useRouter()
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Abrir ${item.label}`} accessibilityState={{ selected: active }} onPress={() => router.push(item.href as any)} className="flex-row items-center gap-3 rounded-xl px-4 py-3" style={({ pressed }) => ({ backgroundColor: active ? tokens.surface.selected : 'transparent', borderWidth: 1, borderColor: active ? tokens.border.active : 'transparent', opacity: pressed ? 0.82 : 1 })}>
      <Ionicons name={active ? filledIconFor(item.icon) : item.icon} size={19} color={active ? tokens.text.primary : tokens.text.secondary} /><Text className={`font-black ${active ? 'text-text-primary' : 'text-text-secondary'}`}>{item.label}</Text>
    </Pressable>
  )
}

export function AdminMobileSectionTabs({ activeSection, data }: { activeSection: AdminSection; data: AdminData }) {
  const { tokens } = useAppTheme()
  const router = useRouter()
  return (
    <View className="rounded-[24px] border border-border-default bg-surface-default p-4">
      <Text className="text-[17px] font-black text-text-primary">Secciones</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 mt-3" contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {adminSections.filter((item) => ['teachers', 'students', 'courses', 'classrooms', 'audit'].includes(item.section) && (!data.portalContext || data.portalContext.permissions.includes(item.permission))).map((item) => {
          const active = item.section === activeSection
          return <Pressable key={item.section} accessibilityRole="tab" accessibilityLabel={`Sección ${item.label}`} accessibilityState={{ selected: active }} onPress={() => router.push(item.href as any)} className="min-h-11 flex-row items-center gap-2 rounded-2xl border px-4 py-2" style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1, borderColor: active ? tokens.border.active : tokens.border.default, backgroundColor: active ? tokens.surface.selected : tokens.surface.default })}><Ionicons name={active ? filledIconFor(item.icon) : item.icon} size={17} color={active ? tokens.text.inverse : tokens.text.secondary} /><Text className="text-[13px] font-black" style={{ color: active ? tokens.text.inverse : tokens.text.primary }} numberOfLines={2}>{item.label}</Text></Pressable>
        })}
      </ScrollView>
    </View>
  )
}
