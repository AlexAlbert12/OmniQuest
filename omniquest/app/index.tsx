import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Link, useRouter } from 'expo-router'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import OmniGuide from '../components/OmniGuide'
import HomeVisualBackground from '../components/HomeVisualBackground'
import { supabase } from '../lib/supabase'
import { createShadowStyle } from '../lib/platformShadow'
import { useResponsiveLayout } from '../lib/responsive'

type PathKind = 'student' | 'teacher'

type Feature = {
  accent: string
  accentSoft: string
  bullets: {
    icon: keyof typeof Ionicons.glyphMap
    label: string
  }[]
  description: string
  gradient: readonly [string, string]
  icon: keyof typeof Ionicons.glyphMap
  kind: PathKind | 'progress'
  tabLabel?: string
  title: string
  titleAccent: string
}

const features: Feature[] = [
  {
    accent: '#A56BFF',
    accentSoft: '#2A1D49',
    gradient: ['rgba(145, 73, 246, 0.38)', 'rgba(34, 28, 78, 0.94)'],
    icon: 'game-controller-outline',
    kind: 'student',
    tabLabel: 'Alumnos',
    title: 'Para',
    titleAccent: 'alumnos',
    description: 'Retos interactivos, revisa tus fallos y gana experiencia.',
    bullets: [
      { icon: 'extension-puzzle-outline', label: 'Resuelve preguntas y desafíos' },
      { icon: 'star-outline', label: 'Consigue XP y sube de nivel' },
      { icon: 'ribbon-outline', label: 'Desbloquea logros e insignias' },
    ],
  },
  {
    accent: '#38BDF8',
    accentSoft: '#12314C',
    gradient: ['rgba(56, 189, 248, 0.32)', 'rgba(18, 58, 92, 0.94)'],
    icon: 'school-outline',
    kind: 'teacher',
    tabLabel: 'Profesores',
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
    accent: '#14D7C8',
    accentSoft: '#0B373B',
    gradient: ['rgba(20, 215, 200, 0.28)', 'rgba(12, 61, 70, 0.94)'],
    icon: 'stats-chart-outline',
    kind: 'progress',
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
  const responsive = useResponsiveLayout()
  const { width, height } = responsive
  const router = useRouter()
  const [guestLoading, setGuestLoading] = useState(false)

  const isDesktop = responsive.isDesktop
  const isTablet = responsive.isTablet || responsive.isDesktop
  const isWeb = Platform.OS === 'web'
  const useDesktopFeatureLayout = !responsive.isMobile || (isWeb && responsive.isTablet)
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
      className="flex-1 bg-background-secondary"
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        className="overflow-hidden bg-background-secondary"
        style={{
          minHeight: isDesktop ? Math.max(height, 900) : Math.max(height, 980),
          borderRadius: isWeb ? 0 : 34,
        }}
      >
        <HomeVisualBackground isDesktop={isDesktop} />

        <View
          className="z-10 flex-1"
          style={{
            paddingHorizontal: isDesktop ? 52 : 22,
            paddingTop: isDesktop ? 44 : 34,
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

        {isDesktop ? <LandingFooter isDesktop={isDesktop} /> : null}
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
  const [selectedPath, setSelectedPath] = useState<PathKind>('student')
  const activePath = features.find((feature) => feature.kind === selectedPath) ?? features[0]
  const progressFeature = features.find((feature) => feature.kind === 'progress')
  const isMobile = !useDesktopFeatureLayout

  return (
    <View
      className="items-center"
      style={{
        alignSelf: 'center',
        maxWidth: 1120,
        paddingBottom: isDesktop ? 36 : 32,
        width: '100%',
      }}
    >
      <BrandLogo center size={isDesktop ? 92 : isTablet ? 76 : 66} />
      <Text
        maxFontSizeMultiplier={2}
        style={{ fontFamily: 'Pacifico_400Regular', fontSize: isDesktop ? 28 : isTablet ? 24 : 20 }}
        className="text-center mt-4 text-semantic-info">
        Tu viaje de aprendizaje comienza aquí.
      </Text>

      <View className="mt-2 flex-row items-center gap-3">
        <View className="h-px w-10 bg-brand-student" />
        <OmniGuide state="normal" autoBlink size={isDesktop ? 80 : isTablet ? 80 : 40} />
        <View className="h-px w-10 bg-brand-student" />
      </View>

      <View
        style={{
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: isDesktop ? 28 : 22,
          flexDirection: isTablet ? 'row' : 'column',
          gap: isMobile ? 14 : 18,
          maxWidth: 820,
          width: isTablet ? 'auto' : '100%',
        }}
      >
        <LandingAction
          icon="person-outline"
          title="Iniciar sesión"
          subtitle="Accede a tu cuenta"
          onPress={onLoginPress}
          variant="primary"
          isTablet={isTablet}
        />

        <LandingAction
          icon="glasses-outline"
          title={guestLoading ? 'Entrando...' : 'Continuar como invitado'}
          subtitle="Explora sin registrarte"
          onPress={onGuestPress}
          variant="secondary"
          isTablet={isTablet}
          loading={guestLoading}
        />
      </View>

      <View className="mt-6 flex-row flex-wrap items-center justify-center gap-2">
        <Text className="text-[16px] font-semibold text-text-secondary">¿No tienes cuenta?</Text>
        <Link href="/register" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Crear una cuenta"
            accessibilityHint="Abre el formulario de registro"
            className="flex-row items-center gap-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.74 : 1 })}
          >
            <Text className="text-[16px] font-extrabold text-semantic-info">Regístrate aquí</Text>
            <Ionicons name="arrow-forward" size={18} color="#42B9FF" />
          </Pressable>
        </Link>
      </View>

      <SectionDivider />

      {isMobile ? (
        <>
          <PathSelector selectedPath={selectedPath} onSelect={setSelectedPath} />
          <PathFeatureCard feature={activePath} featured />
          {progressFeature ? <PathFeatureCard feature={progressFeature} /> : null}
        </>
      ) : null}

      {!isMobile ? (
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
      ) : null}
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
  const borderColor = isPrimary ? 'transparent' : 'rgba(148, 163, 184, 0.18)'
  const shadowColor = isPrimary ? '#7C66FF' : '#0F766E'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled: loading, busy: loading }}
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        opacity: loading ? 0.72 : pressed ? 0.9 : 1,
        width: isTablet ? 400 : '100%',
        alignSelf: 'center',
      })}
    >
      <LinearGradient
        colors={isPrimary ? ['#3479F4', '#8D63F7'] : ['rgba(8, 14, 28, 0.94)', 'rgba(9, 31, 38, 0.82)']}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 1, y: 0.9 }}
        style={{
          alignItems: 'center',
          borderColor,
          borderRadius: 28,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          minHeight: 78,
          paddingHorizontal: 22,
          paddingVertical: 16,
          width: '100%',
          ...createShadowStyle({
            color: shadowColor,
            opacity: isPrimary ? 0.34 : 0.14,
            radius: isPrimary ? 24 : 18,
            offsetY: isPrimary ? 12 : 8,
            web: isPrimary ? `0 16px 32px ${shadowColor}2F` : `0 12px 22px ${shadowColor}1F`,
          }),
        }}
      >
        <View className="flex-1 flex-row items-center gap-4">
          <View
            className="items-center justify-center"
            style={{
              backgroundColor: isPrimary ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)',
              borderColor: isPrimary ? 'transparent' : 'rgba(148, 163, 184, 0.14)',
              borderRadius: 22,
              borderWidth: isPrimary ? 0 : 1,
              height: 58,
              width: 58,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name={icon} size={30} color={isPrimary ? '#FFFFFF' : '#C8D2E8'} />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-[20px] font-extrabold text-white">{title}</Text>
            <Text className="mt-1 text-[17px] font-medium text-text-secondary">{subtitle}</Text>
          </View>
        </View>
        {!loading ? (
          <View
            className="ml-3 items-center justify-center rounded-full"
            style={{
              backgroundColor: isPrimary ? 'rgba(255,255,255,0.18)' : 'rgba(148, 163, 184, 0.08)',
              borderColor: isPrimary ? 'transparent' : 'rgba(148, 163, 184, 0.15)',
              borderWidth: isPrimary ? 0 : 1,
              height: 50,
              width: 50,
            }}
          >
            <Ionicons name="arrow-forward" size={28} color={isPrimary ? '#FFFFFF' : '#C8D2E8'} />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  )
}

function SectionDivider() {
  return (
    <View className="mt-8 w-full flex-row items-center gap-4">
      <View className="h-px flex-1 bg-brand-teacher" />
      <Text
        className="text-center text-[14px] font-extrabold text-white"
        style={{ letterSpacing: 5 }}
      >
        ELIGE TU CAMINO
      </Text>
      <View className="h-px flex-1 bg-brand-teacher" />
    </View>
  )
}

function PathSelector({
  onSelect,
  selectedPath,
}: {
  onSelect: (path: PathKind) => void
  selectedPath: PathKind
}) {
  const options = features.filter(
    (feature): feature is Feature & { kind: PathKind; tabLabel: string } =>
      (feature.kind === 'student' || feature.kind === 'teacher') && Boolean(feature.tabLabel),
  )

  return (
    <View
      className="mt-8 w-full flex-row border p-1.5"
      style={{
        backgroundColor: 'rgba(16, 42, 82, 0.72)',
        borderColor: 'rgba(99, 177, 235, 0.22)',
        borderRadius: 28,
        minHeight: 66,
      }}
    >
      {options.map((option) => {
        const isSelected = selectedPath === option.kind
        const content = (
          <View className="flex-row items-center justify-center gap-3">
            <Ionicons
              name={option.icon}
              size={23}
              color={isSelected ? '#FFFFFF' : '#AEBBDD'}
            />
            <Text
              className="text-[18px] font-extrabold"
              style={{ color: isSelected ? '#FFFFFF' : '#AEBBDD' }}
            >
              {option.tabLabel}
            </Text>
          </View>
        )

        return (
          <Pressable
            key={option.kind}
            accessibilityRole="tab"
            accessibilityLabel={option.tabLabel}
            accessibilityHint={`Muestra las funciones para ${option.tabLabel?.toLowerCase()}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option.kind)}
            style={({ pressed }) => ({
              flex: 1,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            {isSelected ? (
              <LinearGradient
                colors={option.kind === 'teacher' ? ['#38BDF8', '#2F9FEA'] : ['#883AF1', '#B775FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ alignItems: 'center', borderRadius: 21, justifyContent: 'center', minHeight: 54 }}
              >
                {content}
              </LinearGradient>
            ) : (
              <View className="items-center justify-center" style={{ minHeight: 54 }}>
                {content}
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

function PathFeatureCard({ feature, featured = false }: { feature: Feature; featured?: boolean }) {
  return (
    <LinearGradient
      colors={feature.gradient}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{
        borderColor: featured ? 'rgba(148, 163, 184, 0.18)' : `${feature.accent}40`,
        borderRadius: 32,
        borderWidth: 1,
        marginTop: featured ? 26 : 28,
        padding: 24,
        width: '100%',
        ...createShadowStyle({
          color: feature.accent,
          opacity: featured ? 0.14 : 0.1,
          radius: 24,
          offsetY: 12,
          web: `0 18px 34px ${feature.accent}1F`,
        }),
      }}
    >
      <View className="flex-row items-start gap-5">
        <View
          className="items-center justify-center"
          style={{
            backgroundColor: feature.accent,
            borderRadius: 22,
            height: 68,
            width: 68,
          }}
        >
          <Ionicons name={feature.icon} size={32} color="#FFFFFF" />
        </View>

        <View className="flex-1">
          <Text className="text-[26px] font-extrabold text-white">
            {feature.title} <Text style={{ color: feature.accent }}>{feature.titleAccent}</Text>
          </Text>
          <Text className="mt-2 text-[18px] leading-7 text-text-secondary">{feature.description}</Text>
        </View>
      </View>

      <View className="mt-7 gap-4">
        {feature.bullets.map((bullet) => (
          <View
            key={bullet.label}
            className="flex-row items-center gap-4 border"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.035)',
              borderColor: 'rgba(148, 163, 184, 0.10)',
              borderRadius: 22,
              minHeight: 74,
              paddingHorizontal: 18,
              paddingVertical: 14,
            }}
          >
            <View
              className="items-center justify-center"
              style={{
                borderRadius: 15,
                height: 44,
                width: 44,
              }}
            >
              <Ionicons name={bullet.icon} size={26} color={feature.accent} />
            </View>
            <Text className="flex-1 text-[18px] font-bold leading-6 text-text-primary">{bullet.label}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
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
      className="items-center rounded-[22px] border bg-surface-raised"
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

      <Text className="mt-3 text-center text-[14px] leading-6 text-text-secondary">
        {isCompact && !expanded ? previewText : feature.description}
      </Text>

      {showDetails && (
        <View className="mt-6 w-full gap-3">
          {feature.bullets.map((bullet) => (
            <View key={bullet.label} className="flex-row items-center gap-4">
              <Ionicons name={bullet.icon} size={18} color={feature.accent} />
              <Text className="flex-1 text-[15px] text-text-primary">{bullet.label}</Text>
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
          <Text className="text-[14px] font-medium text-text-secondary">
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
      accessibilityRole="button"
      accessibilityLabel={`${feature.title} ${feature.titleAccent}`}
      accessibilityHint={expanded ? 'Oculta los detalles de esta función' : 'Muestra los detalles de esta función'}
      accessibilityState={{ expanded }}
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
      className="z-10 border-t border-border-default bg-background-secondary"
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
          <View className="h-6 w-px bg-surface-selected" />
          <Text className="text-[15px] text-text-muted">© 2026 TFM</Text>
        </View>

        <View className="flex-row items-center gap-8">
          <View accessibilityRole="image" accessibilityLabel="Proyecto alojado en GitHub">
            <Ionicons name="logo-github" size={25} color="#8BA6D3" />
          </View>
          <View accessibilityRole="image" accessibilityLabel="Trabajo Fin de Máster universitario">
            <Ionicons name="school-outline" size={27} color="#8BA6D3" />
          </View>
          <View accessibilityRole="image" accessibilityLabel="Contacto del proyecto">
            <Ionicons name="mail-outline" size={27} color="#8BA6D3" />
          </View>
        </View>
      </View>
    </View>
  )
}
