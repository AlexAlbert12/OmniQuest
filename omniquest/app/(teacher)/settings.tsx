import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import TeacherSidebar from '../../components/TeacherSidebar';

type IconName = keyof typeof Ionicons.glyphMap

type TeacherProfile = {
  id: string
  alias: string | null
  avatar: string | null
  points: number | null
}

type ToggleKey = 'push' | 'daily' | 'activities' | 'news' | 'twoFactor'

const settingsSections: { label: string; icon: IconName; active?: boolean }[] = [
  { label: 'General', icon: 'settings-outline', active: true },
  { label: 'Perfil', icon: 'person-outline' },
  { label: 'Notificaciones', icon: 'notifications-outline' },
  { label: 'Privacidad', icon: 'shield-checkmark-outline' },
  { label: 'Seguridad', icon: 'lock-closed-outline' },
  { label: 'Integraciones', icon: 'extension-puzzle-outline' },
  { label: 'Apariencia', icon: 'color-palette-outline' },
  { label: 'Idioma y región', icon: 'globe-outline' },
  { label: 'Plan y facturación', icon: 'card-outline' },
  { label: 'Acerca de', icon: 'information-circle-outline' },
]

export default function TeacherSettingsScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [name, setName] = useState('Profesor');
  const [email, setEmail] = useState('profesor@omniquest.com');
  const [subjectsCount, setSubjectsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    push: true,
    daily: true,
    activities: true,
    news: false,
    twoFactor: false,
  });

  const isDesktop = width >= 1080;
  const isWide = width >= 820;

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const showComingSoon = (feature: string) => {
    showAlert('Próximamente', `${feature} estará disponible en una próxima iteración.`);
  };

  const fetchSettings = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.replace('/(auth)/login' as any);
        return;
      }

      setEmail(session.user.email || 'profesor@omniquest.com');

      const [profileResult, subjectsResult] = await Promise.all([
        supabase.from('profiles').select('id, alias, avatar, points').eq('id', session.user.id).single(),
        supabase.from('subjects').select('id').eq('teacher_id', session.user.id),
      ]);

      if (profileResult.error && profileResult.error.code !== 'PGRST116') throw profileResult.error;
      if (subjectsResult.error) throw subjectsResult.error;

      const nextProfile = profileResult.data as TeacherProfile | null;
      setProfile(nextProfile);
      setName(nextProfile?.alias || 'Profesor');
      setSubjectsCount(subjectsResult.data?.length || 0);
    } catch (error: any) {
      console.error('Error cargando configuración del profesor:', error.message);
      showAlert('No se pudo cargar la configuración', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
    }, [fetchSettings])
  );

  const handleSaveProfile = async () => {
    if (!profile?.id) return;

    try {
      setSaving(true);
      const cleanName = name.trim() || 'Profesor';
      const { error } = await supabase.from('profiles').update({ alias: cleanName }).eq('id', profile.id);
      if (error) throw error;
      setName(cleanName);
      showAlert('Perfil actualizado', 'Tu información de profesor se ha guardado correctamente.');
    } catch (error: any) {
      console.error('Error actualizando perfil del profesor:', error.message);
      showAlert('No se pudo guardar', 'Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login' as any);
  };

  const updateToggle = (key: ToggleKey) => {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            activeSection="settings"
            subjectsCount={subjectsCount}
            onSignOut={handleSignOut}
            onComingSoon={showComingSoon}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 14,
            paddingTop: isDesktop ? 24 : 18,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-5 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[260px] flex-1">
              {!isDesktop ? (
                <Text className="mb-3 text-[#9FD6FF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 30 }}>
                  OmniQuest
                </Text>
              ) : null}
              <View className="flex-row items-center gap-2">
                <Text className="text-[25px] font-black text-white">Configuración</Text>
                <Ionicons name="settings-outline" size={22} color="#8B5CF6" />
              </View>
              <Text className="mt-2 text-[13px] text-[#B7C4D7]">
                Personaliza tu experiencia y gestiona los ajustes de tu cuenta.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Pressable className="relative rounded-2xl border border-[#20375E] bg-[#09162C] p-3">
                <Ionicons name="notifications-outline" size={21} color="#AFC2DB" />
                <View className="absolute right-2 top-2 h-4 w-4 items-center justify-center rounded-full bg-[#EF4444]">
                  <Text className="text-[9px] font-black text-white">3</Text>
                </View>
              </Pressable>
              <View className="h-11 w-11 items-center justify-center rounded-full bg-[#5B4BC4]">
                <Text className="font-black text-white">PR</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color="#AFC2DB" />
            </View>
          </View>

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <SettingsMenu onSignOut={handleSignOut} isDesktop={isDesktop} />

            <View className="flex-1 gap-5">
              <View className={isWide ? 'flex-row gap-5' : 'gap-5'}>
                <Panel title="Información del profesor" className={isWide ? 'flex-1' : ''}>
                  <View className={width >= 520 ? 'flex-row gap-5' : 'gap-4'}>
                    <View className="items-center">
                      <View className="h-24 w-24 items-center justify-center rounded-full bg-[#4E3CB7]">
                        <Text className="text-[28px] font-black text-white">PR</Text>
                        <View className="absolute bottom-1 right-1 h-7 w-7 items-center justify-center rounded-full border border-[#20375E] bg-[#09162C]">
                          <Ionicons name="camera-outline" size={14} color="#DCE7F8" />
                        </View>
                      </View>
                      <Pressable
                        onPress={handleSaveProfile}
                        disabled={saving}
                        className="mt-5 rounded-lg bg-[#5A46D8] px-5 py-3"
                      >
                        <Text className="text-[12px] font-bold text-white">{saving ? 'Guardando...' : 'Editar perfil'}</Text>
                      </Pressable>
                    </View>

                    <View className="min-w-0 flex-1 gap-3">
                      <Field label="Nombre">
                        <TextInput
                          value={name}
                          onChangeText={setName}
                          placeholder="Profesor"
                          placeholderTextColor="#64748B"
                          className="rounded-lg border border-[#183052] bg-[#071A32] px-4 py-3 text-[13px] text-white"
                        />
                      </Field>
                      <Field label="Correo electrónico">
                        <TextInput
                          value={email}
                          editable={false}
                          placeholderTextColor="#64748B"
                          className="rounded-lg border border-[#183052] bg-[#071A32] px-4 py-3 text-[13px] text-[#B7C4D7]"
                        />
                      </Field>
                      <Field label="Idioma preferido">
                        <SelectPill value="🇪🇸  Español" onPress={() => showComingSoon('Idioma preferido')} />
                      </Field>
                    </View>
                  </View>
                </Panel>

                <Panel title="Preferencias generales" className={isWide ? 'flex-1' : ''}>
                  <PreferenceRow label="Zona horaria" value="(GMT+02:00) Madrid, España" onPress={() => showComingSoon('Zona horaria')} />
                  <PreferenceRow label="Formato de fecha" value="DD/MM/YYYY" onPress={() => showComingSoon('Formato de fecha')} />
                  <PreferenceRow label="Formato de hora" value="24 horas" onPress={() => showComingSoon('Formato de hora')} />
                  <PreferenceRow label="Inicio de semana" value="Lunes" onPress={() => showComingSoon('Inicio de semana')} />
                </Panel>
              </View>

              <View className={isWide ? 'flex-row gap-5' : 'gap-5'}>
                <Panel title="Notificaciones" className={isWide ? 'flex-1' : ''}>
                  <NotificationRow
                    icon="notifications-outline"
                    title="Notificaciones push"
                    description="Recibe notificaciones en tu dispositivo."
                    enabled={toggles.push}
                    onPress={() => updateToggle('push')}
                  />
                  <NotificationRow
                    icon="calendar-outline"
                    title="Resumen diario"
                    description="Recibe un resumen diario de la actividad."
                    enabled={toggles.daily}
                    onPress={() => updateToggle('daily')}
                  />
                  <NotificationRow
                    icon="clipboard-outline"
                    title="Actividades y retos"
                    description="Alertas sobre actividades y retos de tus clases."
                    enabled={toggles.activities}
                    onPress={() => updateToggle('activities')}
                  />
                  <NotificationRow
                    icon="megaphone-outline"
                    title="Actualizaciones y novedades"
                    description="Novedades, funciones y mejoras de OmniQuest."
                    enabled={toggles.news}
                    onPress={() => updateToggle('news')}
                  />
                  <FooterLink label="Gestionar notificaciones" onPress={() => showComingSoon('Gestión de notificaciones')} />
                </Panel>

                <Panel title="Privacidad y datos" className={isWide ? 'flex-1' : ''}>
                  <ActionRow
                    icon="lock-closed-outline"
                    title="Privacidad"
                    description="Gestiona la visibilidad de tus datos y actividades."
                    onPress={() => showComingSoon('Privacidad')}
                  />
                  <ActionRow
                    icon="archive-outline"
                    title="Gestión de datos"
                    description="Descarga o elimina tus datos personales."
                    onPress={() => showComingSoon('Gestión de datos')}
                  />
                  <View className="mt-3 rounded-xl border border-[#4733B7] bg-[#151A47] p-4">
                    <View className="flex-row gap-3">
                      <Ionicons name="shield-checkmark-outline" size={22} color="#8B5CF6" />
                      <View className="min-w-0 flex-1">
                        <Text className="font-black text-white">Tu privacidad es importante</Text>
                        <Text className="mt-1 text-[12px] leading-5 text-[#B7C4D7]">
                          En OmniQuest protegemos tus datos y los de tus estudiantes.
                        </Text>
                        <Pressable onPress={() => showComingSoon('Centro de privacidad')} className="mt-2 flex-row items-center gap-1">
                          <Text className="text-[12px] font-bold text-[#A78BFA]">Saber más</Text>
                          <Ionicons name="open-outline" size={13} color="#A78BFA" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </Panel>
              </View>

              <View className={isWide ? 'flex-row gap-5' : 'gap-5'}>
                <Panel title="Seguridad" className={isWide ? 'flex-1' : ''}>
                  <ActionRow
                    icon="lock-closed-outline"
                    title="Cambiar contraseña"
                    description="Actualiza tu contraseña regularmente."
                    onPress={() => router.push('/(auth)/forgot-password' as any)}
                  />
                  <NotificationRow
                    icon="shield-checkmark-outline"
                    title="Verificación en dos pasos"
                    description="Añade una capa extra de seguridad a tu cuenta."
                    enabled={toggles.twoFactor}
                    onPress={() => updateToggle('twoFactor')}
                  />
                </Panel>

                <Panel title="Integraciones" className={isWide ? 'flex-1' : ''}>
                  <IntegrationRow
                    icon="school-outline"
                    color="#34D399"
                    title="Google Classroom"
                    description="Conecta tus clases y sincroniza estudiantes."
                    onPress={() => showComingSoon('Google Classroom')}
                  />
                  <IntegrationRow
                    icon="people-circle-outline"
                    color="#60A5FA"
                    title="Microsoft Teams"
                    description="Importa tus clases y equipos."
                    onPress={() => showComingSoon('Microsoft Teams')}
                  />
                </Panel>
              </View>
            </View>
          </View>

          <View className="mt-6 flex-row flex-wrap items-center justify-end gap-6">
            <Text className="text-[12px] text-[#8FA7C7]">Versión 2.4.0</Text>
            <Pressable onPress={() => showComingSoon('Centro de ayuda')} className="flex-row items-center gap-2">
              <Ionicons name="help-circle-outline" size={16} color="#A78BFA" />
              <Text className="text-[12px] font-semibold text-[#A78BFA]">Centro de ayuda</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function SettingsMenu({ onSignOut, isDesktop }: { onSignOut: () => void; isDesktop: boolean }) {
  return (
    <View
      className={`rounded-xl border border-[#183052] bg-[#07162D] p-3 ${
        isDesktop ? 'w-[205px] self-start' : ''
      }`}
    >
      <View className={isDesktop ? 'gap-1' : 'flex-row flex-wrap gap-2'}>
        {settingsSections.map((section) => (
          <Pressable
            key={section.label}
            className={`flex-row items-center gap-3 rounded-lg px-3 py-3 ${
              section.active ? 'border border-[#6D5AF6] bg-[#1A1E55]' : ''
            }`}
          >
            <Ionicons name={section.icon} size={16} color={section.active ? '#9FD6FF' : '#AFC2DB'} />
            <Text className={`text-[12px] font-semibold ${section.active ? 'text-white' : 'text-[#B7C4D7]'}`}>
              {section.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={onSignOut}
        className="mt-4 flex-row items-center gap-2 rounded-lg border border-[#20375E] bg-[#071326] px-3 py-3"
      >
        <Ionicons name="log-out-outline" size={15} color="#F87171" />
        <Text className="text-[12px] font-bold text-[#F87171]">Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

function Panel({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <View className={`rounded-xl border border-[#183052] bg-[#07162D] p-5 ${className}`}>
      <Text className="mb-4 text-[16px] font-black text-white">{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-2 text-[11px] font-semibold text-[#B7C4D7]">{label}</Text>
      {children}
    </View>
  );
}

function SelectPill({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-lg border border-[#183052] bg-[#071A32] px-4 py-3"
    >
      <Text className="text-[13px] font-semibold text-white">{value}</Text>
      <Ionicons name="chevron-down" size={16} color="#AFC2DB" />
    </Pressable>
  );
}

function PreferenceRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View className="mb-4 flex-row items-center gap-4">
      <Text className="w-[125px] text-[12px] font-semibold text-[#B7C4D7]">{label}</Text>
      <View className="min-w-0 flex-1">
        <SelectPill value={value} onPress={onPress} />
      </View>
    </View>
  );
}

function NotificationRow({
  icon,
  title,
  description,
  enabled,
  onPress,
}: {
  icon: IconName
  title: string
  description: string
  enabled: boolean
  onPress: () => void
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-[#13284A] py-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#10233F]">
        <Ionicons name={icon} size={18} color="#AFC2DB" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]">{description}</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onPress}
        trackColor={{ false: '#223554', true: '#6D5AF6' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function ActionRow({
  icon,
  title,
  description,
  onPress,
}: {
  icon: IconName
  title: string
  description: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 border-b border-[#13284A] py-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#10233F]">
        <Ionicons name={icon} size={18} color="#AFC2DB" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]">{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#AFC2DB" />
    </Pressable>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mt-2 flex-row items-center justify-between py-2">
      <Text className="text-[12px] font-semibold text-[#A78BFA]">{label}</Text>
      <Ionicons name="chevron-forward" size={15} color="#A78BFA" />
    </Pressable>
  );
}

function IntegrationRow({
  icon,
  color,
  title,
  description,
  onPress,
}: {
  icon: IconName
  color: string
  title: string
  description: string
  onPress: () => void
}) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}26` }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <Text className="mt-1 text-[12px] text-[#B7C4D7]">{description}</Text>
      </View>
      <Pressable onPress={onPress} className="rounded-lg border border-[#6D5AF6] px-4 py-2">
        <Text className="text-[12px] font-bold text-[#A78BFA]">Conectar</Text>
      </Pressable>
    </View>
  );
}
