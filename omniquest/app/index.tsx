import { Ionicons } from '@expo/vector-icons'
import { useRouter, Link } from 'expo-router'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, useWindowDimensions, View, } from 'react-native'
import { useState } from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import SpaceBackground from '../components/SpaceBackground'
import { supabase } from '../lib/supabase'

type Feature = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
  iconColor: string
  iconBackground: string
  iconBorder: string
}

const features: Feature[] = [
  {
    icon: 'book',
    title: 'Aprende a tu ritmo',
    description:
      'Accede a contenidos interactivos y estructurados por niveles. Estudia cuando quieras y desde cualquier dispositivo.',
    iconColor: '#7FCBFF',
    iconBackground: 'rgba(40, 114, 212, 0.22)',
    iconBorder: 'rgba(116, 188, 255, 0.5)',
  },
  {
    icon: 'ribbon',
    title: 'Supera preguntas',
    description:
      'Resuelve desafíos y cuestionarios para poner a prueba lo que sabes. ¡Cada pregunta superada te acerca más a tus metas!',
    iconColor: '#8ED6FF',
    iconBackground: 'rgba(28, 88, 188, 0.24)',
    iconBorder: 'rgba(110, 178, 255, 0.52)',
  },
  {
    icon: 'stats-chart',
    title: 'Sigue tu progreso',
    description:
      'Visualiza tu avance con estadísticas detallas y obtiene recomendaciones pesonalizadas para mejorar cada día.',
    iconColor: '#82C5FF',
    iconBackground: 'rgba(37, 104, 204, 0.22)',
    iconBorder: 'rgba(111, 185, 255, 0.5)',
  },
  {
    icon: 'trophy',
    title: 'Compite y destaca',
    description:
      'Participa en el ranking, gana experiencia y demuestra tus conocimientos frente a otros estudiantes.',
    iconColor: '#B29CFF',
    iconBackground: 'rgba(112, 71, 246, 0.2)',
    iconBorder: 'rgba(175, 145, 255, 0.52)',
  },
  {
    icon: 'flash',
    title: 'Mantén tu racha',
    description:
      'Aprende cada día, suma días consecutivos y desbloquea recompensas exclusivas.',
    iconColor: '#A991FF',
    iconBackground: 'rgba(124, 79, 255, 0.2)',
    iconBorder: 'rgba(170, 142, 255, 0.54)',
  },
  {
    icon: 'gift',
    title: 'Gana recompensas',
    description:
      'Obtén medallas, logros y premios por tu esfuerzo y constancia en el aprendizaje.',
    iconColor: '#B29CFF',
    iconBackground: 'rgba(112, 71, 246, 0.2)',
    iconBorder: 'rgba(175, 145, 255, 0.52)',
  },
]

export default function IndexScreen() {
  const { width, height } = useWindowDimensions()
  const router = useRouter()
  const [guestLoading, setGuestLoading] = useState(false)

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'

  const enterAsGuest = async () => {
    setGuestLoading(true)
    try {
      const guestAlias = `Invitado${Math.floor(1000 + Math.random() * 9000)}`
      const { data, error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            alias: guestAlias,
            role_id: 'guest',
          },
        },
      })

      if (error) throw error

      if (data.user) {
        await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            alias: guestAlias,
            role_id: 'guest',
            points: 0,
          })
      }

      router.replace('/(student)/homeStudent' as any)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo entrar como invitado.'
      if (Platform.OS === 'web') {
        window.alert(`Error\n\n${message}`)
      } else {
        Alert.alert('Error', message)
      }
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-[#04112A]"
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View
        className="overflow-hidden rounded-[34px] border border-[#27436F] bg-[#071630]"
        style={{
          minHeight: isDesktop ? Math.max(height, 860) : Math.max(height - 28, 780),
          shadowColor: '#132C59',
          shadowOpacity: isWeb ? 0 : 0.35,
          shadowRadius: isWeb ? 0 : 28,
          shadowOffset: { width: 0, height: isWeb ? 0 : 18 },
          elevation: isWeb ? 0 : 12,
          borderRadius: isWeb ? 0 : 34,
        }}
      >

        <SpaceBackground isDesktop={isDesktop} />
        <View
          style={{
            flexGrow: 1,
            paddingHorizontal: isDesktop ? 32 : 18,
            paddingTop: isDesktop ? 20 : 18,
            paddingBottom: isDesktop ? 40 : 28,
          }}
        >

          <View
            style={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: isDesktop ? 1080 : 960,
                alignSelf: 'center',
              }}
            >
              <LandingPanel
                isDesktop={isDesktop}
                isTablet={isTablet}
                onLoginPress={() => router.push('/login')}
                onGuestPress={enterAsGuest}
                guestLoading={guestLoading}
              />
            </View>
          </View>
        </View>
      </View>
      <Footer />
    </ScrollView>
  )
}

function LandingPanel({
  isDesktop,
  isTablet,
  onLoginPress,
  onGuestPress,
  guestLoading,
}: {
  isDesktop: boolean
  isTablet: boolean
  onLoginPress: () => void
  onGuestPress: () => void
  guestLoading: boolean
}) {
  const actionsDirection = isTablet ? 'row' : 'column'

  return (
    <View
      style={{
        alignSelf: 'center',
        paddingTop: isDesktop ? 4 : 4,
        paddingBottom: isDesktop ? 18 : 8,
      }}
    >
      <View className="items-center px-2">
        <Text
          style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 72 : 32 }}
          className="text-center text-[#CDEFFF]"
        >
          OmniQuest
        </Text>

        <Text
          style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 28 : 16 }}
          className="text-center text-[#4FB8FF]">
          Tu viaje de aprendizaje comienza aquí.
        </Text>

        <View className="mt-4 mb-2 flex-row items-center gap-3">
          <View className="h-px w-10 bg-[#3B6FA5]" />
          <Ionicons name="rocket" size={18} color="#8CD5FF" />
          <View className="h-px w-10 bg-[#3B6FA5]" />
        </View>
      </View>

      <View
        style={{
          marginTop: isDesktop ? 24 : 20,
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        {features.map((feature) => (
          <FeatureCard
            key={feature.title}
            feature={feature}
          />
        ))}
      </View>

      <View
        style={{
          marginTop: isDesktop ? 26 : 20,
          flexDirection: actionsDirection,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 14,
          maxWidth: isDesktop ? 400 : '100%',
          alignSelf: 'center',
        }}
      >
        <Pressable
          onPress={onLoginPress}
          className="justify-between w-full rounded-2xl p-4 flex-row items-center gap-2 bg-[#1C4D8D] hover:bg-[#18437b] transition-all duration-200 hover:scale-[1.02] "
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="person" size={20} color="#F5FBFF" />
            <Text className="text-[16px] text-white">Iniciar sesión</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#F5FBFF" />
        </Pressable>

        <Pressable
          onPress={onGuestPress}
          disabled={guestLoading}
          className="justify-between w-full rounded-2xl p-4 flex-row items-center gap-2 bg-[#7942DFeB] hover:bg-[#6b3ac6eb] transition-all duration-200 hover:scale-[1.02] "
          style={({ pressed }) => ({ opacity: guestLoading ? 0.7 : pressed ? 0.86 : 1 })}
        >
          <View className="flex-row items-center gap-3">
            {guestLoading ? <ActivityIndicator color="#F5FBFF" /> : <Ionicons name="glasses" size={20} color="#F5FBFF" />}
            <Text className="text-[16px] text-white">{guestLoading ? 'Entrando...' : 'Entrar como Invitado'}</Text>
          </View>
          {!guestLoading ? <Ionicons name="arrow-forward" size={18} color="#F5FBFF" /> : null}
        </Pressable>
      </View>
      <View className="mt-6 border-t border-[#17365F] bg-[#06162F] px-5 py-5">
        <View className="flex-row flex-wrap items-center justify-center gap-1">
          <Text className="text-[13px] text-[#AFCBE3]">¿No tienes cuenta?</Text>
          <Link href="/register" asChild>
            <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
              <Text className="text-[13px] font-bold text-[#4FB8FF]">
                Regístrate aquí.
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  )
}

function FeatureCard({
  feature,
}: {
  feature: Feature
}) {
  return (
    <View
      className="items-center rounded-[24px] border border-[#35557C] bg-[#102548]/88"
      style={{
        width: 280,
        minHeight: 208,
        paddingHorizontal: 18,
        paddingVertical: 20,
        shadowColor: '#0C1F45',
        shadowOpacity: 0.26,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      }}
    >
      <View
        className="items-center justify-center rounded-full border"
        style={{
          width: 62,
          height: 62,
          backgroundColor: feature.iconBackground,
          borderColor: feature.iconBorder,
        }}
      >
        <Ionicons name={feature.icon} size={28} color={feature.iconColor} />
      </View>

      <Text className="mt-2 text-[18px] font-bold text-white">{feature.title}</Text>
      <Text className="mt-2 text-[14px] leading-6 text-center text-[#D8E7F6]">
        {feature.description}
      </Text>
    </View>
  )
}
