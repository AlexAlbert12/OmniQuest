import React, { useCallback } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, type Href } from 'expo-router'
import { useAppModal } from '../AppModalProvider'
import StudentScreenLayout from '../layouts/StudentScreenLayout'
import AppButton from '../ui/AppButton'
import AppPressable from '../ui/AppPressable'
import { useStudentProfile } from '../../hooks/student/useStudentProfile'
import { useAppTheme } from '../../lib/appTheme'
import { withAlpha } from '../../lib/color'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'
import { useResponsiveLayout } from '../../lib/responsive'
import StudentBottomNav from './StudentBottomNav'
import StudentPageHeader from './StudentPageHeader'
import StudentSidebar from './StudentSidebar'

type QuickAccess = {
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  href: Href
}

const quickAccesses: QuickAccess[] = [
  { title: 'Mi perfil', description: 'Consulta tu identidad, nivel y personalización.', icon: 'person-circle-outline', href: '/(student)/profile' },
  { title: 'Actividad', description: 'Revisa tus intentos y actividad de aprendizaje.', icon: 'time-outline', href: '/(student)/activity-log' },
  { title: 'Logros', description: 'Consulta lo que has desbloqueado y tus próximos objetivos.', icon: 'ribbon-outline', href: '/(student)/badges' },
  { title: 'Notificaciones', description: 'Lee avisos sobre cursos, actividad y recompensas.', icon: 'notifications-outline', href: '/(student)/notifications' },
  { title: 'Configuración', description: 'Ajusta tu perfil, preferencias y privacidad.', icon: 'settings-outline', href: '/(student)/settings' },
  { title: 'Seguridad', description: 'Gestiona tu contraseña y las sesiones de la cuenta.', icon: 'lock-closed-outline', href: '/(student)/security' },
  { title: 'Centro de ayuda', description: 'Encuentra tutoriales, soporte y respuestas.', icon: 'help-buoy-outline', href: '/(student)/help-center' },
]

export default function StudentMoreScreen() {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const profile = useStudentProfile()

  const signOut = useCallback(async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login')
  }, [router])

  const requestSignOut = useCallback(() => {
    showModal({
      title: 'Cerrar sesión',
      message: 'Se cerrará tu sesión de alumno en este dispositivo.',
      variant: 'warning',
      buttons: [
        { label: 'Cancelar', role: 'cancel' },
        { label: 'Cerrar sesión', role: 'danger', onPress: signOut },
      ],
    })
  }, [showModal, signOut])

  return (
    <StudentScreenLayout
      isDesktop={responsive.isDesktop}
      loading={profile.loading}
      loadingLabel="Cargando tus accesos…"
      desktopSidebar={(
        <StudentSidebar
          activeSection="more"
          alias={profile.alias}
          avatar={profile.profile?.avatar}
          level={profile.level}
          points={profile.points}
          nextLevelProgress={profile.nextLevelProgress}
          onSignOut={requestSignOut}
        />
      )}
      mobileBottomNavigation={<StudentBottomNav active="more" />}
    >
      <StudentPageHeader
        compactMobileTitle
        icon="ellipsis-horizontal-circle"
        isDesktop={responsive.isDesktop}
        title="Más opciones"
        mobileTitle="Más"
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: responsive.isMobile ? 10 : 14 }}>
        {quickAccesses.map((item) => (
          <QuickAccessCard
            key={item.title}
            item={item}
            compact={responsive.isMobile}
            onPress={() => router.push(item.href)}
          />
        ))}
      </View>

      {!responsive.isDesktop ? (
        <View style={{ marginTop: 18, borderRadius: 20, borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.surface.default, padding: 16 }}>
          <AppButton label="Cerrar sesión" icon="log-out-outline" role="student" variant="danger" fullWidth onPress={requestSignOut} />
        </View>
      ) : null}
    </StudentScreenLayout>
  )
}

function QuickAccessCard({ item, compact, onPress }: { item: QuickAccess; compact: boolean; onPress: () => void }) {
  const { tokens } = useAppTheme()

  return (
    <AppPressable
      accessibilityRole="link"
      accessibilityLabel={item.title}
      accessibilityHint={item.description}
      onPress={onPress}
      style={({ pressed }) => ({
        width: compact ? '100%' : undefined,
        minWidth: 0,
        minHeight: compact ? 82 : 122,
        flexGrow: compact ? 0 : 1,
        flexBasis: compact ? 'auto' : 280,
        flexDirection: compact ? 'row' : 'column',
        alignItems: compact ? 'center' : 'flex-start',
        gap: compact ? 12 : 0,
        borderRadius: compact ? 18 : 20,
        borderWidth: 1,
        borderColor: pressed ? tokens.border.active : tokens.border.default,
        backgroundColor: pressed ? tokens.surface.selected : tokens.surface.default,
        padding: compact ? 14 : 18,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(tokens.brand.student, '22') }}>
        <Ionicons name={item.icon} size={22} color={tokens.brand.student} />
      </View>
      <View style={{ minWidth: 0, flex: compact ? 1 : undefined }}>
        <Text numberOfLines={2} style={{ marginTop: compact ? 0 : 12, color: tokens.text.primary, fontSize: compact ? 15 : 16, lineHeight: compact ? 20 : 21, fontWeight: '900', includeFontPadding: false }}>
          {item.title}
        </Text>
        <Text numberOfLines={2} style={{ marginTop: 3, color: tokens.text.secondary, fontSize: compact ? 11 : 12, lineHeight: compact ? 16 : 17, includeFontPadding: false }}>
          {item.description}
        </Text>
      </View>
      <View style={{ width: 32, height: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: tokens.surface.interactive, position: compact ? 'relative' : 'absolute', top: compact ? undefined : 22, right: compact ? undefined : 14 }}>
        <Ionicons name="chevron-forward" size={18} color={tokens.brand.student} />
      </View>
    </AppPressable>
  )
}
