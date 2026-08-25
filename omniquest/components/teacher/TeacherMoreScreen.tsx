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
}

const quickAccesses: QuickAccess[] = [
  { title: 'Perfil docente', description: 'Consulta tu identidad y el impacto de tu actividad.', icon: 'person-circle-outline', href: '/(teacher)/profile' },
  { title: 'Configuración', description: 'Ajusta tu perfil, preferencias y privacidad.', icon: 'settings-outline', href: '/(teacher)/settings' },
  { title: 'Seguridad', description: 'Gestiona la contraseña y la seguridad de tu cuenta.', icon: 'lock-closed-outline', href: '/(teacher)/security' },
  { title: 'Auditoría', description: 'Revisa cambios y eventos importantes de tus cursos.', icon: 'shield-checkmark-outline', href: '/(teacher)/audit' },
  { title: 'Notificaciones', description: 'Consulta avisos, revisiones y alertas docentes.', icon: 'notifications-outline', href: '/(teacher)/notifications' },
  { title: 'Centro de ayuda', description: 'Encuentra soporte y respuestas sobre OmniQuest.', icon: 'help-buoy-outline', href: '/(teacher)/help-center' },
]

export default function TeacherMoreScreen() {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const profile = useTeacherProfile()

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
      <TeacherPageHeader
        icon="ellipsis-horizontal-circle"
        isDesktop={responsive.isDesktop}
        title="Más opciones"
        mobileTitle="Más"
        notificationOnPress={() => router.push('/(teacher)/notifications')}
      />

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: responsive.isMobile ? 10 : 14,
        }}
      >
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
        <View
          style={{
            marginTop: 18,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: tokens.border.default,
            backgroundColor: tokens.surface.default,
            padding: 16,
          }}
        >
          <AppButton
            label="Cerrar sesión"
            icon="log-out-outline"
            role="teacher"
            variant="danger"
            fullWidth
            onPress={requestSignOut}
          />
        </View>
      ) : null}
    </TeacherScreenLayout>
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
        minWidth: 0,
        minHeight: compact ? 142 : 122,
        flexGrow: 1,
        flexBasis: compact ? '46%' : 280,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: pressed ? tokens.border.active : tokens.border.default,
        backgroundColor: pressed ? tokens.surface.selected : tokens.surface.default,
        padding: compact ? 14 : 18,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View
        style={{
          width: compact ? 42 : 46,
          height: compact ? 42 : 46,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(tokens.brand.teacher, '22'),
        }}
      >
        <Ionicons name={item.icon} size={compact ? 21 : 23} color={tokens.brand.teacher} />
      </View>
      <Text numberOfLines={2} style={{ marginTop: 12, color: tokens.text.primary, fontSize: compact ? 14 : 16, lineHeight: compact ? 18 : 21, fontWeight: '900' }}>
        {item.title}
      </Text>
      <Text numberOfLines={compact ? 3 : 2} style={{ marginTop: 4, color: tokens.text.secondary, fontSize: compact ? 10 : 12, lineHeight: compact ? 14 : 17 }}>
        {item.description}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={tokens.brand.teacher} style={{ position: 'absolute', top: compact ? 25 : 29, right: 14 }} />
    </AppPressable>
  )
}
