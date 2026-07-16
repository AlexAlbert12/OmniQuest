import { Ionicons } from '@expo/vector-icons'
import { Link, useRouter } from 'expo-router'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import SpaceBackground from '../components/SpaceBackground'
import { supabase } from '../lib/supabase'
import { createShadowStyle } from '../lib/platformShadow'

type Feature = {
  accent: string
  bullets: {
    icon: keyof typeof Ionicons.glyphMap
    label: string
  }[]
  description: string
  icon: keyof typeof Ionicons.glyphMap
  title: string
  titleAccent: string
}

const features: Feature[] = [
  {
    accent: '#38BDF8',
    icon: 'school',
    title: 'Para',
    titleAccent: 'profesores',
    description: 'Crea clases, temas y preguntas personalizadas para guiar el aprendizaje.',
    bullets: [
      { icon: 'people-outline', label: 'Gestiona tus clases y alumnos' },
      { icon: 'create-outline', label: 'Crea preguntas interactivas' },
      { icon: 'bar-chart-outline', label: 'Analiza el progreso de tu clase' },
    ],
  },
  {
    accent: '#A855F7',
    icon: 'game-controller',
    title: 'Para',
    titleAccent: 'alumnos',
    description: 'Practica con retos interactivos, revisa tus fallos y gana experiencia.',
    bullets: [
      { icon: 'extension-puzzle-outline', label: 'Resuelve preguntas y desafíos' },
      { icon: 'star-outline', label: 'Consigue XP y sube de nivel' },
      { icon: 'ribbon-outline', label: 'Desbloquea logros e insignias' },
    ],
  },
  {
    accent: '#14D7C8',
    icon: 'stats-chart',
    title: 'Progreso y',
    titleAccent: 'ranking',
    description: 'Consulta estadísticas, rachas, insignias y preguntas que necesitan refuerzo.',
    bullets: [
      { icon: 'stats-chart-outline', label: 'Estadísticas detalladas' },
      { icon: 'shield-checkmark-outline', label: 'Mantén tu racha diaria' },
      { icon: 'trophy-outline', label: 'Compite en el ranking' },
    ],
  },
]

export default function IndexScreen() {
  const { width, height } = useWindowDimensions()
  const router = useRouter()
  const [guestLoading, setGuestLoading] = useState(false)

  const isDesktop = width >= 1100
  const isTablet = width >= 760
  const isWeb = Platform.OS === 'web'
  const useDesktopFeatureLayout = isDesktop || (isWeb && width >= 700)
  const availableFeatureWidth = Math.min(1120, width - (isDesktop ? 104 : 36))
  const featureCardWidth = useDesktopFeatureLayout
    ? Math.min(isDesktop ? 350 : 220, Math.floor((availableFeatureWidth - 36) / 3))
    : undefined

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
      className="flex-1 bg-[#020D22]"
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View
        className="overflow-hidden bg-[#020D22]"
        style={{
          minHeight: isDesktop ? Math.max(height, 900) : Math.max(height - 28, 820),
          borderRadius: isWeb ? 0 : 34,
        }}
      >
        <SpaceBackground isDesktop={isDesktop} />

        <View
          className="z-10 flex-1"
          style={{
            paddingHorizontal: isDesktop ? 52 : 18,
            paddingTop: isDesktop ? 44 : 32,
          }}
        >
          <LandingPanel
            isDesktop={isDesktop}
            isTablet={isTablet}
            useDesktopFeatureLayout={useDesktopFeatureLayout}
            featureCardWidth={featureCardWidth}
            onLoginPress={() => router.push('/login')}
            onGuestPress={enterAsGuest}
            guestLoading={guestLoading}
          />
        </View>

        <LandingFooter isDesktop={isDesktop} />
      </View>
    </ScrollView>
  )
}

function LandingPanel({
  isDesktop,
  isTablet,
  useDesktopFeatureLayout,
  featureCardWidth,
  onLoginPress,
  onGuestPress,
  guestLoading,
}: {
  isDesktop: boolean
  isTablet: boolean
  useDesktopFeatureLayout: boolean
  featureCardWidth?: number
  onLoginPress: () => void
  onGuestPress: () => void
  guestLoading: boolean
}) {
  return (
    <View
      className="items-center"
      style={{
        alignSelf: 'center',
        maxWidth: 1120,
        paddingBottom: isDesktop ? 36 : 28,
        width: '100%',
      }}
    >
      <BrandLogo center size={isDesktop ? 92 : 58} />

      <Text
        style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 28 : 16 }}
        className="text-center mt-4 text-[#4FB8FF]">
        Tu viaje de aprendizaje comienza aquí.
      </Text>

      <View className="mt-4 mb-2 flex-row items-center gap-3">
        <View className="h-px w-10 bg-[#3B6FA5]" />
        <Ionicons name="rocket" size={18} color="#8CD5FF" />
        <View className="h-px w-10 bg-[#3B6FA5]" />
      </View>

      <View
        style={{
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: isDesktop ? 22 : 20,
          flexDirection: isTablet ? 'row' : 'column',
          gap: 18,
          maxWidth: 820,
          width: isTablet ? 'auto' : '100%',
        }}
      >
        <LandingAction
          icon="person"
          title="Iniciar sesión"
          subtitle="Accede a tu cuenta"
          onPress={onLoginPress}
          variant="primary"
          isTablet={isTablet}
        />

        <LandingAction
          icon="glasses"
          title={guestLoading ? 'Entrando...' : 'Probar como invitado'}
          subtitle="Explora sin registrarte"
          onPress={onGuestPress}
          variant="secondary"
          isTablet={isTablet}
          loading={guestLoading}
        />
      </View>

      <View className="mt-5 flex-row flex-wrap items-center justify-center gap-2">
        <Ionicons name="star-outline" size={19} color="#42B9FF" />
        <Text className="text-[16px] text-[#C5D7EE]">¿No tienes cuenta?</Text>
        <Link href="/register" asChild>
          <Pressable className="flex-row items-center gap-2" style={({ pressed }) => ({ opacity: pressed ? 0.74 : 1 })}>
            <Text className="text-[16px] font-bold text-[#42B9FF]">Regístrate aquí</Text>
            <Ionicons name="arrow-forward" size={18} color="#42B9FF" />
          </Pressable>
        </Link>
      </View>

      <View
        style={{
          marginTop: isDesktop ? 32 : 26,
          flexDirection: 'row',
          flexWrap: useDesktopFeatureLayout ? 'nowrap' : 'wrap',
          justifyContent: 'center',
          gap: useDesktopFeatureLayout ? 18 : 16,
          width: '100%',
        }}
      >
        {features.map((feature) => (
          <FeatureCard
            key={feature.titleAccent}
            feature={feature}
            featureCardWidth={featureCardWidth}
            isDesktop={isDesktop}
            isMobile={!useDesktopFeatureLayout}
          />
        ))}
      </View>
    </View>
  )
}

function LandingAction({
  icon,
  isTablet,
  loading = false,
  onPress,
  subtitle,
  title,
  variant,
}: {
  icon: keyof typeof Ionicons.glyphMap
  isTablet: boolean
  loading?: boolean
  onPress: () => void
  subtitle: string
  title: string
  variant: 'primary' | 'secondary'
}) {
  const isPrimary = variant === 'primary'
  const backgroundColor = isPrimary ? '#0F172A' : '#2E1065'
  const borderColor = isPrimary ? '#38BDF8' : '#A855F7'
  const shadowColor = isPrimary ? '#38BDF8' : '#A855F7'

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        opacity: loading ? 0.72 : pressed ? 0.9 : 1,
        width: isTablet ? 340 : '100%',
        alignSelf: 'center',
      })}
    >
      <View
        className="flex-row items-center justify-between rounded-3xl border px-5 py-4"
        style={{
          backgroundColor,
          borderColor,
          minHeight: 52,
          ...createShadowStyle({
            color: shadowColor,
            opacity: 0.2,
            radius: 18,
            offsetY: 10,
            web: `0 10px 22px ${shadowColor}22`,
          }),
          width: '100%',
        }}
      >
        <View className="flex-row items-center gap-4">
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name={icon} size={28} color="#FFFFFF" />
          )}
          <View>
            <Text className="text-[17px] font-extrabold text-white">{title}</Text>
            <Text className="mt-1 text-[14px] text-[#EAF2FF]">{subtitle}</Text>
          </View>
        </View>
        {!loading ? <Ionicons name="arrow-forward" size={26} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  )
}

function FeatureCard({
  feature,
  featureCardWidth,
  isDesktop,
  isMobile,
}: {
  feature: Feature
  featureCardWidth?: number
  isDesktop: boolean
  isMobile: boolean
}) {
  const [expanded, setExpanded] = useState(isDesktop)
  const isCompact = isMobile
  const showDetails = !isCompact || expanded
  const previewText = feature.description.length > 60 ? `${feature.description.slice(0, 60)}...` : feature.description
  const cardWidth = isMobile ? '100%' : featureCardWidth ?? (isDesktop ? 350 : 220)

  const card = (
      <View
        className="items-center rounded-[22px] border bg-[#071B3A]/72"
        style={{
          borderColor: 'rgba(74, 129, 198, 0.42)',
          maxWidth: isMobile ? 340 : undefined,
          minHeight: isMobile ? undefined : isDesktop ? 320 : 300,
          paddingHorizontal: isMobile ? 24 : 18,
          paddingVertical: isMobile ? 22 : 20,
          ...createShadowStyle({
            color: feature.accent,
            opacity: 0.12,
            radius: 24,
            offsetY: 12,
            web: `0 12px 24px ${feature.accent}24`,
          }),
          width: cardWidth,
        }}
      >
        <View
          className="items-center justify-center rounded-full border"
          style={{
            backgroundColor: `${feature.accent}18`,
            borderColor: `${feature.accent}72`,
            height: 72,
            width: 72,
          }}
        >
          <Ionicons name={feature.icon} size={34} color={feature.accent} />
        </View>

        <Text className="mt-5 text-center text-[22px] font-extrabold text-white">
          {feature.title} <Text style={{ color: feature.accent }}>{feature.titleAccent}</Text>
        </Text>

        <Text className="mt-3 text-center text-[14px] leading-6 text-[#DCE9F7]">
          {isCompact && !expanded ? previewText : feature.description}
        </Text>

        {showDetails && (
          <View className="mt-6 w-full gap-3">
            {feature.bullets.map((bullet) => (
              <View key={bullet.label} className="flex-row items-center gap-4">
                <Ionicons name={bullet.icon} size={18} color={feature.accent} />
                <Text className="flex-1 text-[15px] text-[#EDF6FF]">{bullet.label}</Text>
              </View>
            ))}
          </View>
        )}

        {isCompact && (
          <View className="mt-5 flex-row items-center gap-2">
            <Ionicons
              name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={18}
              color={feature.accent}
            />
            <Text className="text-[14px] font-medium text-[#B8C9E9]">
              {expanded ? 'Ocultar detalles' : 'Toca para ver más'}
            </Text>
          </View>
        )}
      </View>
  )

  if (!isCompact) {
    return card
  }

  return (
    <Pressable
      onPress={() => setExpanded((current) => !current)}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, width: '100%' })}
    >
      {card}
    </Pressable>
  )
}

function LandingFooter({ isDesktop }: { isDesktop: boolean }) {
  return (
    <View
      className="z-10 border-t border-[#16345E] bg-[#020A19]/80"
      style={{
        paddingHorizontal: isDesktop ? 36 : 22,
        paddingVertical: isDesktop ? 24 : 22,
      }}
    >
      <View
        className="items-center justify-between gap-6"
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
        }}
      >
        <View className="flex-row items-center gap-5">
          <BrandLogo size={24} />
          <View className="h-6 w-px bg-[#254A78]" />
          <Text className="text-[15px] text-[#8398BD]">© 2026 TFM</Text>
        </View>

        <View className="flex-row items-center gap-8">
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="logo-github" size={25} color="#8BA6D3" />
          </Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="school-outline" size={27} color="#8BA6D3" />
          </Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="mail-outline" size={27} color="#8BA6D3" />
          </Pressable>
        </View>
      </View>
    </View>
  )
}
