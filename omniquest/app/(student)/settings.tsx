import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Link, useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import StudentSidebar from '../../components/StudentSidebar'

type Profile = {
  id: string
  alias: string
  avatar: string | null
  points: number | null
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const accentColors = ['#7C5CFF', '#3B82F6', '#38BDF8', '#58D17A', '#F6A64A', '#EF5350', '#D94A9A'] as const

const privacyRows: { icon: IoniconName; title: string; detail: string }[] = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Privacidad',
    detail: 'Gestiona tu privacidad',
  },
  {
    icon: 'server-outline',
    title: 'Datos y almacenamiento',
    detail: 'Gestiona tus datos y espacio',
  },
]

const supportRows: { icon: IoniconName; title: string; detail: string }[] = [
  {
    icon: 'help-circle-outline',
    title: 'Centro de ayuda',
    detail: 'Preguntas frecuentes y guías',
  },
  {
    icon: 'mail-outline',
    title: 'Contactar soporte',
    detail: 'Envíanos un mensaje',
  },
  {
    icon: 'document-text-outline',
    title: 'Términos y condiciones',
    detail: 'Lee nuestros términos de uso',
  },
  {
    icon: 'information-circle-outline',
    title: 'Acerca de OmniQuest',
    detail: 'Versión 1.2.0',
  },
]

export default function SettingsScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [accentColor, setAccentColor] = useState<(typeof accentColors)[number]>('#7C5CFF')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [animations, setAnimations] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [studyReminders, setStudyReminders] = useState(true)
  const [updates, setUpdates] = useState(false)
  const [newAlias, setNewAlias] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingAlias, setChangingAlias] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const isDesktop = width >= 1024
  const isTwoColumn = width >= 900
  const points = profile?.points ?? 0
  const alias = profile?.alias || 'Alex'
  const level = Math.floor(points / 100) + 1
  const nextLevelProgress = points % 100

  const fetchSettings = useCallback(async () => {
    setLoading(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      setEmail(session.session?.user.email || 'alex@example.com')

      if (!userId) return

      const { data, error } = await supabase
        .from('profiles')
        .select('id, alias, points, avatar')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
      setNewAlias(data.alias)
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchSettings()
    }, [fetchSettings])
  )

  const handleChangeAlias = async () => {
    const cleanAlias = newAlias.trim()
    if (!cleanAlias || !profile) return

    if (cleanAlias.length < 3) {
      showAlert('Error', 'El alias debe tener al menos 3 caracteres.')
      return
    }

    setChangingAlias(true)
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { alias: cleanAlias },
      })

      if (authError) throw authError

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ alias: cleanAlias })
        .eq('id', profile.id)

      if (profileError) throw profileError

      setProfile({ ...profile, alias: cleanAlias })
      showAlert('Éxito', 'Alias actualizado correctamente.')
    } catch (error: any) {
      showAlert('Error', error.message)
    } finally {
      setChangingAlias(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) {
      showAlert('Error', 'Verifica que las contraseñas coincidan y estén completas.')
      return
    }

    if (newPassword.length < 6) {
      showAlert('Error', 'La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (!email) {
      showAlert('Error', 'No se ha podido verificar tu correo actual.')
      return
    }

    setChangingPassword(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })

      if (signInError) {
        throw new Error('La contraseña actual no es correcta.')
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) throw error

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showAlert('Éxito', 'Contraseña actualizada correctamente.')
    } catch (error: any) {
      showAlert('Error', error.message)
    } finally {
      setChangingPassword(false)
    }
  }

  const executeDeleteAccount = async () => {
    setDeletingAccount(true)

    try {
      const { error } = await supabase.rpc('delete_my_account')

      if (error) throw error

      await supabase.auth.signOut({ scope: 'local' })
      showAlert('Cuenta borrada', 'Tu cuenta se ha eliminado correctamente.')
      router.replace('/(auth)/login')
    } catch (error: any) {
      showAlert(
        'No se pudo borrar la cuenta',
        error.message || 'Revisa que la función delete_my_account exista en Supabase.'
      )
    } finally {
      setDeletingAccount(false)
    }
  }

  const handleDeleteAccount = () => {
    const message = 'Esta acción eliminará tu usuario, perfil, clases y progreso. No se puede deshacer.'

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        void executeDeleteAccount()
      }
      return
    }

    Alert.alert('Borrar mi cuenta', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar cuenta',
        style: 'destructive',
        onPress: () => void executeDeleteAccount(),
      },
    ])
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.replace('/(auth)/login')
    } catch {
      showAlert('Error', 'No se pudo cerrar sesión.')
    }
  }

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  const showComingSoon = (feature: string) => {
    showAlert('Próximamente', `${feature} estará disponible en una próxima iteración.`)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando configuración...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="settings"
            alias={alias}
            avatar={profile?.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={handleSignOut}
            onComingSoon={showComingSoon}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 22 : 18,
            paddingBottom: isDesktop ? 28 : 104,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              {!isDesktop ? (
                <Text
                  className="mb-3 text-[#9FD6FF]"
                  style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}
                >
                  OmniQuest
                </Text>
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="settings" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Configuración</Text>
              </View>
              <Text className="mt-1 text-[13px] text-[#DDE7F4]">
                Personaliza tu experiencia en OmniQuest
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-3 rounded-2xl border border-[#162B50] bg-[#0B1933] px-4 py-3">
                <Ionicons name="flash" size={20} color="#FFD34D" />
                <View>
                  <Text className="text-[16px] font-black text-white">7</Text>
                  <Text className="text-[11px] text-[#8FA7C7]">Días de racha</Text>
                </View>
              </View>
              <Pressable
                onPress={() => showComingSoon('Las notificaciones')}
                className="rounded-2xl border border-[#162B50] bg-[#0B1933] p-3"
              >
                <Ionicons name="notifications-outline" size={22} color="#AFC2DB" />
                <View className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-[#FF5D6C]" />
              </Pressable>
            </View>
          </View>

          <View className={isTwoColumn ? 'flex-row gap-5' : 'gap-5'}>
            <View className={isTwoColumn ? 'flex-[1.3] gap-4' : 'gap-4'}>
              <Panel title="Apariencia" icon="color-palette-outline">
                <View className={width >= 700 ? 'flex-row gap-4' : 'gap-4'}>
                  <ThemeOption
                    title="Tema claro"
                    detail="Interfaz clara y luminosa"
                    icon="sunny-outline"
                    active={theme === 'light'}
                    onPress={() => setTheme('light')}
                  />
                  <ThemeOption
                    title="Tema oscuro"
                    detail="Interfaz oscura y relajante"
                    icon="moon"
                    active={theme === 'dark'}
                    onPress={() => setTheme('dark')}
                  />
                </View>

                <View className="mt-5">
                  <Text className="mb-3 text-[13px] text-white">Color de acento</Text>
                  <View className="flex-row flex-wrap items-center gap-4">
                    {accentColors.map((color) => (
                      <Pressable
                        key={color}
                        onPress={() => setAccentColor(color)}
                        className="h-9 w-9 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: color,
                          borderColor: accentColor === color ? '#B9C7FF' : 'transparent',
                          borderWidth: accentColor === color ? 2 : 0,
                        }}
                      >
                        {accentColor === color ? <Ionicons name="checkmark" size={22} color="#FFFFFF" /> : null}
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Divider />
                <SelectRow icon="globe-outline" title="Idioma" value="Español (España)" />
                <Divider />
                <FontSizeRow />
                <Divider />
                <SettingLine
                  icon="sparkles-outline"
                  title="Animaciones"
                  detail="Habilitar animaciones en la aplicación"
                  trailing={<Toggle active={animations} onPress={() => setAnimations((value) => !value)} />}
                />
              </Panel>

              <Panel title="Notificaciones" icon="notifications-outline">
                <View className="overflow-hidden rounded-xl border border-[#172A4A] bg-[#0D1D3B]">
                  <NotificationRow
                    icon="notifications-outline"
                    color="#7C5CFF"
                    title="Notificaciones push"
                    detail="Recibe notificaciones sobre preguntas, logros y recordatorios"
                    active={pushNotifications}
                    onPress={() => setPushNotifications((value) => !value)}
                  />
                  <NotificationRow
                    icon="alarm-outline"
                    color="#F6A64A"
                    title="Recordatorios de estudio"
                    detail="Te avisaremos para que mantengas tu racha activa"
                    active={studyReminders}
                    onPress={() => setStudyReminders((value) => !value)}
                  />
                  <NotificationRow
                    icon="megaphone"
                    color="#43D991"
                    title="Novedades y actualizaciones"
                    detail="Información sobre nuevas funciones y mejoras"
                    active={updates}
                    onPress={() => setUpdates((value) => !value)}
                    last
                  />
                </View>
              </Panel>
            </View>

            <View className={isTwoColumn ? 'flex-1 gap-4' : 'gap-4'}>
              <Panel title="Cuenta" icon="person-outline">
                <View className="mb-4 flex-row items-center gap-4">
                  <View className="h-16 w-16 items-center justify-center rounded-full border-2 border-[#9AB9FF] bg-[#D8E7FF]">
                    <Ionicons name="person" size={40} color="#9FD6FF" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[20px] font-black text-white" numberOfLines={1}>
                      {alias}
                    </Text>
                    <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={1}>
                      {email}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => showComingSoon('La edición de perfil')}
                    className="rounded-lg bg-[#5A46D8] px-4 py-3"
                  >
                    <Text className="font-bold text-white">Editar perfil</Text>
                  </Pressable>
                </View>

                <View className="mb-4 gap-3">
                  <Text className="text-[14px] font-bold text-white">Cambiar Alias</Text>
                  <View className="flex-row gap-3">
                    <TextInput
                      className="min-w-0 flex-1 rounded-lg border border-[#35557C] bg-[#0B2145] px-4 py-3 text-[15px] text-[#F5FBFF]"
                      placeholder="Nuevo alias"
                      placeholderTextColor="#8AAED0"
                      value={newAlias}
                      onChangeText={setNewAlias}
                    />
                    <Pressable
                      onPress={handleChangeAlias}
                      disabled={changingAlias || !newAlias.trim() || newAlias.trim() === alias}
                      className="items-center justify-center rounded-lg bg-[#4FB8FF] px-4 py-3"
                      style={({ pressed }) => ({
                        opacity: changingAlias || !newAlias.trim() || newAlias.trim() === alias ? 0.7 : pressed ? 0.86 : 1,
                      })}
                    >
                      {changingAlias ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text className="font-bold text-white">Guardar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>

                <View className="overflow-hidden rounded-xl border border-[#172A4A] bg-[#0D1D3B]">
                  <AccountRow icon="lock-closed-outline" title="Cambiar contraseña" onPress={() => { }} expandable>
                    <View className="gap-3 px-4 pb-4">
                      <TextInput
                        className="rounded-lg border border-[#35557C] bg-[#0B2145] px-4 py-3 text-[15px] text-[#F5FBFF]"
                        placeholder="Contraseña actual"
                        placeholderTextColor="#8AAED0"
                        secureTextEntry
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                      />
                      <TextInput
                        className="rounded-lg border border-[#35557C] bg-[#0B2145] px-4 py-3 text-[15px] text-[#F5FBFF]"
                        placeholder="Nueva contraseña"
                        placeholderTextColor="#8AAED0"
                        secureTextEntry
                        value={newPassword}
                        onChangeText={setNewPassword}
                      />
                      <TextInput
                        className="rounded-lg border border-[#35557C] bg-[#0B2145] px-4 py-3 text-[15px] text-[#F5FBFF]"
                        placeholder="Confirmar nueva contraseña"
                        placeholderTextColor="#8AAED0"
                        secureTextEntry
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                      />
                      <Pressable
                        onPress={handleChangePassword}
                        disabled={changingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                        className="items-center justify-center rounded-lg bg-[#4FB8FF] py-3"
                        style={({ pressed }) => ({ opacity: changingPassword ? 0.7 : pressed ? 0.86 : 1 })}
                      >
                        {changingPassword ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text className="font-bold text-white">Cambiar Contraseña</Text>
                        )}
                      </Pressable>
                    </View>
                  </AccountRow>
                  <AccountRow icon="mail-outline" title="Correo electrónico" value={email} onPress={() => showComingSoon('Cambiar correo electrónico')} />
                  <LinkedAccountRow onPress={() => showComingSoon('Cuentas vinculadas')} />
                  <Pressable onPress={handleSignOut} className="flex-row items-center gap-3 px-4 py-4">
                    <Ionicons name="log-out-outline" size={20} color="#FF4D4D" />
                    <Text className="min-w-0 flex-1 font-bold text-[#FF4D4D]">Cerrar sesión</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="flex-row items-center gap-3 border-t border-[#3D1A2A] bg-[#2A0B18] px-4 py-4"
                    style={({ pressed }) => ({ opacity: deletingAccount ? 0.7 : pressed ? 0.86 : 1 })}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                    <Text className="min-w-0 flex-1 font-bold text-[#FF6B6B]">Borrar mi cuenta</Text>
                    {deletingAccount ? <ActivityIndicator color="#FF6B6B" /> : null}
                  </Pressable>
                </View>
              </Panel>

              <Panel title="Privacidad y seguridad" icon="shield-checkmark-outline">
                <View>
                  {privacyRows.map((row, index) => (
                    <MenuRow
                      key={row.title}
                      icon={row.icon}
                      title={row.title}
                      detail={row.detail}
                      onPress={() => showComingSoon(row.title)}
                      last={index === privacyRows.length - 1}
                    />
                  ))}
                </View>
              </Panel>

              <Panel title="Soporte e información" icon="help-circle-outline">
                <View>
                  {supportRows.map((row, index) => (
                    <MenuRow
                      key={row.title}
                      icon={row.icon}
                      title={row.title}
                      detail={row.detail}
                      onPress={() => showComingSoon(row.title)}
                      last={index === supportRows.length - 1}
                    />
                  ))}
                </View>
              </Panel>
            </View>
          </View>

          {isDesktop ? <DesktopNav /> : null}
        </ScrollView>
      </View>

      {!isDesktop ? <BottomNav /> : null}
    </View>
  )
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  children: React.ReactNode
}) {
  return (
    <View className="rounded-2xl border border-[#1A3155] bg-[#09162C] p-5">
      <View className="mb-5 flex-row items-center gap-3">
        <Ionicons name={icon} size={22} color="#C5D0E2" />
        <Text className="text-[16px] font-black text-white">{title}</Text>
      </View>
      {children}
    </View>
  )
}

function ThemeOption({
  title,
  detail,
  icon,
  active,
  onPress,
}: {
  title: string
  detail: string
  icon: keyof typeof Ionicons.glyphMap
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-w-[220px] flex-1 flex-row items-center gap-4 rounded-xl border p-5 ${active ? 'border-[#7C5CFF] bg-[#121B4C]' : 'border-[#172A4A] bg-[#0D1D3B]'
        }`}
    >
      <Ionicons name={icon} size={34} color={icon === 'sunny-outline' ? '#FBBF24' : '#6170A5'} />
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white">{title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]">{detail}</Text>
      </View>
      {active ? (
        <View className="h-6 w-6 items-center justify-center rounded-full bg-white">
          <Ionicons name="checkmark" size={17} color="#4F46E5" />
        </View>
      ) : null}
    </Pressable>
  )
}

function Divider() {
  return <View className="my-4 h-px bg-[#172A4A]" />
}

function SelectRow({
  icon,
  title,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value: string
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-4">
      <View className="flex-row items-center gap-3">
        <Ionicons name={icon} size={22} color="#C5D0E2" />
        <Text className="text-[15px] font-black text-white">{title}</Text>
      </View>
      <Pressable className="min-w-[220px] flex-1 flex-row items-center justify-between rounded-xl border border-[#172A4A] bg-[#0D1D3B] px-4 py-3">
        <Text className="font-semibold text-white">{value}</Text>
        <Ionicons name="chevron-down" size={18} color="#B7C4D7" />
      </Pressable>
    </View>
  )
}

function FontSizeRow() {
  return (
    <View className="flex-row flex-wrap items-center gap-4">
      <View className="w-[130px] flex-row items-center gap-3">
        <Text className="text-[22px] font-semibold text-[#C5D0E2]">Aa</Text>
        <Text className="text-[15px] font-black text-white">Fuente</Text>
      </View>
      <Text className="min-w-[160px] flex-1 text-[12px] text-[#B7C4D7]">Tamaño de la fuente</Text>
      <View className="h-11 min-w-[260px] flex-row overflow-hidden rounded-xl border border-[#172A4A] bg-[#0D1D3B]">
        <Pressable className="w-14 items-center justify-center border-r border-[#213556]">
          <Text className="text-[18px] font-semibold text-[#C5D0E2]">A</Text>
        </Pressable>
        <View className="flex-1 items-center justify-center">
          <Text className="font-semibold text-white">Mediano</Text>
        </View>
        <Pressable className="w-14 items-center justify-center border-l border-[#213556]">
          <Text className="text-[20px] font-semibold text-[#C5D0E2]">A</Text>
        </Pressable>
      </View>
    </View>
  )
}

function SettingLine({
  icon,
  title,
  detail,
  trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  detail: string
  trailing: React.ReactNode
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-4">
      <View className="flex-row items-center gap-3">
        <Ionicons name={icon} size={22} color="#C5D0E2" />
        <Text className="text-[15px] font-black text-white">{title}</Text>
      </View>
      <Text className="min-w-[220px] flex-1 text-[12px] text-[#B7C4D7]">{detail}</Text>
      {trailing}
    </View>
  )
}

function Toggle({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-8 w-14 justify-center rounded-full px-1 ${active ? 'items-end bg-[#6D5AF6]' : 'items-start bg-[#243555]'}`}
    >
      <View className="h-6 w-6 rounded-full bg-white" />
    </Pressable>
  )
}

function NotificationRow({
  icon,
  color,
  title,
  detail,
  active,
  onPress,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  title: string
  detail: string
  active: boolean
  onPress: () => void
  last?: boolean
}) {
  return (
    <View className={`flex-row items-center gap-4 px-4 py-3 ${last ? '' : 'border-b border-[#172A4A]'}`}>
      <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${color}36` }}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white">{title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]">{detail}</Text>
      </View>
      <Toggle active={active} onPress={onPress} />
    </View>
  )
}

function AccountRow({
  icon,
  title,
  value,
  onPress,
  expandable = false,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value?: string
  onPress: () => void
  expandable?: boolean
  children?: React.ReactNode
}) {
  return (
    <>
      <Pressable onPress={onPress} className="flex-row items-center gap-3 border-b border-[#172A4A] px-4 py-4">
        <Ionicons name={icon} size={20} color="#C5D0E2" />
        <Text className="min-w-0 flex-1 font-semibold text-white">{title}</Text>
        {value ? (
          <Text className="max-w-[180px] text-[12px] text-[#B7C4D7]" numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color="#B7C4D7" />
      </Pressable>
      {expandable && children ? <View>{children}</View> : null}
    </>
  )
}

function LinkedAccountRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 border-b border-[#172A4A] px-4 py-4">
      <Ionicons name="link-outline" size={20} color="#C5D0E2" />
      <Text className="min-w-0 flex-1 font-semibold text-white">Cuenta vinculada</Text>
      <Text className="text-[18px] font-black text-white">G</Text>
      <View className="h-4 w-4 rounded-sm bg-[#F25022]" />
      <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
      <Ionicons name="chevron-forward" size={18} color="#B7C4D7" />
    </Pressable>
  )
}

function MenuRow({
  icon,
  title,
  detail,
  onPress,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  detail: string
  onPress: () => void
  last?: boolean
}) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-[#172A4A]'}`}>
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#10213E]">
        <Ionicons name={icon} size={18} color="#C5D0E2" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]">{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#B7C4D7" />
    </Pressable>
  )
}

function DesktopNav() {
  return (
    <View className="mt-4 flex-row justify-around rounded-2xl border border-[#1A3155] bg-[#09162C] py-3">
      <Link href="/(student)/homeStudent" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="home-outline" size={24} color="#AFC2DB" />
          <Text className="mt-1 text-[12px] text-[#AFC2DB]">Inicio</Text>
        </Pressable>
      </Link>
      <Link href="/(student)/ranking" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="trophy-outline" size={24} color="#AFC2DB" />
          <Text className="mt-1 text-[12px] text-[#AFC2DB]">Ranking</Text>
        </Pressable>
      </Link>
      <Link href="/(student)/profile" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="person-outline" size={24} color="#AFC2DB" />
          <Text className="mt-1 text-[12px] text-[#AFC2DB]">Perfil</Text>
        </Pressable>
      </Link>
      <Pressable className="items-center">
        <Ionicons name="settings" size={24} color="#B09BFF" />
        <Text className="mt-1 text-[12px] font-bold text-[#B09BFF]">Configuración</Text>
      </Pressable>
    </View>
  )
}

function BottomNav() {
  return (
    <View className="absolute bottom-3 left-4 right-4 flex-row justify-around rounded-2xl border border-[#1A3155] bg-[#09162C] py-3">
      <Link href="/(student)/homeStudent" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="home-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Inicio</Text>
        </Pressable>
      </Link>

      <Link href="/(student)/ranking" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="trophy-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Ranking</Text>
        </Pressable>
      </Link>

      <Link href="/(student)/profile" asChild>
        <Pressable className="items-center opacity-70">
          <Ionicons name="person-outline" size={22} color="#AFC2DB" />
          <Text className="mt-1 text-[11px] text-[#AFC2DB]">Perfil</Text>
        </Pressable>
      </Link>

      <Pressable className="items-center">
        <Ionicons name="settings" size={22} color="#B09BFF" />
        <Text className="mt-1 text-[11px] font-bold text-[#B09BFF]">Configuración</Text>
      </Pressable>
    </View>
  )
}
