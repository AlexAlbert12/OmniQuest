import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAppModal } from '../../components/AppModalProvider'
import { useAdminPortalContext } from '../../components/admin/hooks/useAdminPortalContext'
import { AdminScaffold } from '../../components/admin/shared/AdminScaffold'
import ManagedSessionsCard from '../../components/settings/ManagedSessionsCard'
import AppBackButton from '../../components/ui/AppBackButton'
import { useAppTheme } from '../../lib/appTheme'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

export default function AdminSecurityScreen() {
  const router = useRouter()
  const data = useAdminPortalContext()
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()

  const signOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as any)
  }

  const requestSignOut = () => showModal({ title: 'Cerrar sesión', message: 'Se cerrará tu sesión administrativa en este dispositivo.', variant: 'warning', buttons: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Cerrar sesión', role: 'danger', onPress: signOut }] })

  return (
    <AdminScaffold activeSection="security" title="Seguridad administrativa" subtitle="Gestiona sesiones, dispositivos y códigos de recuperación de tu cuenta administrativa." data={data}>
      <View className="w-full">
        <AppBackButton accessibilityHint="Abre el menú Más del portal administrativo" label="Volver a Más" style={{ marginBottom: 20 }} onPress={() => router.replace('/(admin)/more' as any)} />
        <ManagedSessionsCard role="admin" splitSections />
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar esta sesión" accessibilityHint="Pide confirmación antes de cerrar esta sesión administrativa" onPress={requestSignOut} className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-semantic-danger bg-surface-default px-4 py-4" style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
          <Ionicons name="log-out-outline" size={18} color={tokens.semantic.danger} />
          <Text className="font-black text-semantic-danger">Cerrar esta sesión</Text>
        </Pressable>
      </View>
    </AdminScaffold>
  )
}
