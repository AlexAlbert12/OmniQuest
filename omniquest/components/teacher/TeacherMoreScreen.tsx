import React, { useCallback } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, type Href } from 'expo-router'
import { useAppModal } from '../AppModalProvider'
import TeacherScreenLayout from '../layouts/TeacherScreenLayout'
import AppButton from '../ui/AppButton'
import AppPressable from '../ui/AppPressable'
import { useTeacherProfile } from '../../hooks/teacher/useTeacherProfile'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'
import { useResponsiveLayout } from '../../lib/responsive'
import TeacherBottomNav from './TeacherBottomNav'
import TeacherPageHeader from './TeacherPageHeader'
import TeacherSidebar from './TeacherSidebar'

type QuickAccess = {
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  href: Href
  testID: string
}

const quickAccesses: QuickAccess[] = [
  { title: 'Perfil docente', description: 'Consulta tu identidad y el impacto de tu actividad.', icon: 'person-circle-outline', href: '/(teacher)/profile', testID: 'teacher-more-profile' },
  { title: 'Configuración', description: 'Ajusta tu perfil, preferencias y privacidad.', icon: 'settings-outline', href: '/(teacher)/settings', testID: 'teacher-more-settings' },
  { title: 'Seguridad', description: 'Gestiona la contraseña y la seguridad de tu cuenta.', icon: 'lock-closed-outline', href: '/(teacher)/security', testID: 'teacher-more-security' },
  { title: 'Auditoría', description: 'Revisa cambios y eventos importantes de tus cursos.', icon: 'shield-checkmark-outline', href: '/(teacher)/audit', testID: 'teacher-more-audit' },
  { title: 'Notificaciones', description: 'Consulta avisos, revisiones y alertas docentes.', icon: 'notifications-outline', href: '/(teacher)/notifications', testID: 'teacher-more-notifications' },
  { title: 'Centro de ayuda', description: 'Encuentra soporte y respuestas sobre OmniQuest.', icon: 'help-buoy-outline', href: '/(teacher)/help-center', testID: 'teacher-more-help' },
]

export default function TeacherMoreScreen() {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const profile = useTeacherProfile()
  const compact = !responsive.isDesktop

  const signOut = useCallback(async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login')
  }, [router])

  const requestSignOut = useCallback(() => {
    showModal({
      title: 'Cerrar sesión',
      message: 'Se cerrará tu sesión docente en este dispositivo.',
      variant: 'warning',
      buttons: [
        { label: 'Cancelar', role: 'cancel' },
        { label: 'Cerrar sesión', role: 'danger', onPress: signOut },
      ],
    })
  }, [showModal, signOut])

  return (
    <TeacherScreenLayout
      isDesktop={responsive.isDesktop}
      loading={profile.loading}
      loadingLabel="Cargando accesos docentes…"
      desktopSidebar={(
        <TeacherSidebar
          activeSection="more"
          subjectsCount={profile.summary.metrics.activeCourses}
          alias={profile.summary.identity.alias}
          avatar={profile.summary.identity.avatar}
          onSignOut={requestSignOut}
        />
      )}
      mobileBottomNavigation={<TeacherBottomNav active="more" />}
    >
      <TeacherPageHeader icon="ellipsis-horizontal-circle" isDesktop={responsive.isDesktop} title="Más opciones" mobileTitle="Más" notificationOnPress={() => router.push('/(teacher)/notifications')} />

      <View style={{ flexDirection: compact ? 'column' : 'row', flexWrap: compact ? 'nowrap' : 'wrap', gap: compact ? 10 : 14 }}>
        {quickAccesses.map((item) => <QuickAccessCard key={item.testID} item={item} compact={compact} onPress={() => router.push(item.href)} />)}
      </View>

      {compact ? (
        <View style={{ marginTop: 18, borderRadius: 20, borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.surface.default, padding: 16 }}>
          <AppButton label="Cerrar sesión" icon="log-out-outline" role="teacher" variant="danger" fullWidth onPress={requestSignOut} />
        </View>
      ) : null}
    </TeacherScreenLayout>
  )
}

function QuickAccessCard({ item, compact, onPress }: { item: QuickAccess; compact: boolean; onPress: () => void }) {
  const { tokens } = useAppTheme()
  const accent = tokens.brand.teacher

  if (compact) {
    return (
      <AppPressable
        testID={item.testID}
        accessibilityRole="link"
        accessibilityLabel={item.title}
        accessibilityHint={item.description}
        onPress={onPress}
        style={({ pressed }) => ({
          width: '100%',
          minHeight: 88,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: pressed ? accent : tokens.border.default,
          backgroundColor: pressed ? withAlpha(accent, '18') : tokens.surface.default,
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.995 : 1 }],
        })}
      >
        <View style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 14, borderWidth: 1, borderColor: withAlpha(accent, '45'), alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(accent, '20') }}>
          <Ionicons name={item.icon} size={23} color={accent} />
        </View>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text maxFontSizeMultiplier={1.5} style={{ color: tokens.text.primary, fontSize: 15, lineHeight: 20, fontWeight: '900', includeFontPadding: false }}>{item.title}</Text>
          <Text maxFontSizeMultiplier={1.5} numberOfLines={2} style={{ marginTop: 3, color: tokens.text.secondary, fontSize: 11, lineHeight: 16, includeFontPadding: false }}>{item.description}</Text>
        </View>
        <View style={{ width: 34, height: 34, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: withAlpha(accent, '16') }}>
          <Ionicons name="chevron-forward" size={18} color={accent} />
        </View>
      </AppPressable>
    )
  }

  return (
    <AppPressable
      testID={item.testID}
      accessibilityRole="link"
      accessibilityLabel={item.title}
      accessibilityHint={item.description}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 280,
        minHeight: 132,
        flexGrow: 1,
        flexBasis: 300,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: pressed ? accent : tokens.border.default,
        backgroundColor: pressed ? withAlpha(accent, '18') : tokens.surface.default,
        padding: 18,
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.995 : 1 }],
      })}
    >
      <View style={{ width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: withAlpha(accent, '45'), alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(accent, '20') }}>
        <Ionicons name={item.icon} size={23} color={accent} />
      </View>
      <Text maxFontSizeMultiplier={1.5} numberOfLines={2} style={{ marginTop: 12, paddingRight: 30, color: tokens.text.primary, fontSize: 16, lineHeight: 21, fontWeight: '900' }}>{item.title}</Text>
      <Text maxFontSizeMultiplier={1.5} numberOfLines={2} style={{ marginTop: 4, paddingRight: 18, color: tokens.text.secondary, fontSize: 12, lineHeight: 17 }}>{item.description}</Text>
      <View style={{ position: 'absolute', top: 20, right: 16, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: withAlpha(accent, '16') }}>
        <Ionicons name="chevron-forward" size={18} color={accent} />
      </View>
    </AppPressable>
  )
}
