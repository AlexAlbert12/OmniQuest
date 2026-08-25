import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Link, useRouter } from 'expo-router'
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import HomeVisualBackground from '../components/HomeVisualBackground'
import LandingInfoSections from '../components/public/LandingInfoSections'
import { supabase } from '../lib/supabase'
import { createShadowStyle } from '../lib/platformShadow'
import { useResponsiveLayout } from '../lib/responsive'
import { useAppModal } from '../components/AppModalProvider'
import { useI18n } from '../lib/i18n'
import { checkAuthAttempt, formatRetryDelay } from '../lib/authSecurity'
import { getOrCreateDeviceId } from '../lib/sessionSecurity'

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
  kind: PathKind
  roleNoticeKey: 'auth.roles.student' | 'auth.roles.staff'
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
    roleNoticeKey: 'auth.roles.student',
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
    roleNoticeKey: 'auth.roles.staff',
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
]

export default function IndexScreen() {
  const responsive = useResponsiveLayout()
  const { width, height } = responsive
  const router = useRouter()
  const { showModal } = useAppModal()
  const { locale, t } = useI18n()
  const [guestLoading, setGuestLoading] = useState(false)

  const isDesktop = responsive.isDesktop
  const isTablet = responsive.isTablet || responsive.isDesktop
  const isWeb = Platform.OS === 'web'
  const useDesktopFeatureLayout = !responsive.isMobile || (isWeb && responsive.isTablet)
  const availableFeatureWidth = Math.min(1120, width - (isDesktop ? 104 : 36))
  const featureCardWidth = useDesktopFeatureLayout
    ? Math.min(isDesktop ? 430 : 320, Math.floor((availableFeatureWidth - 18) / 2))
    : undefined

  const enterAsGuest = async () => {
    setGuestLoading(true)
    try {
      const deviceId = await getOrCreateDeviceId()
      const gate = await checkAuthAttempt('anonymous_sign_in', deviceId)
      if (!gate.allowed) {
        showModal({
          title: t('landing.guestErrorTitle'),
          message: t('landing.guestRateLimited', { delay: formatRetryDelay(gate.retryAfterSeconds, locale) }),
          variant: 'warning',
        })
        return
      }

      const guestAlias = `${t('landing.guestAliasPrefix')}${Math.floor(1000 + Math.random() * 9000)}`
      const { data, error } = await supabase.auth.signInAnonymously({
        options: { data: { alias: guestAlias } },
      })
      if (error || !data.user) throw error || new Error(t('landing.guestErrorTitle'))

      const { error: profileError } = await supabase.rpc('initialize_guest_profile', {
        p_alias: guestAlias,
      })
      if (profileError) {
        await supabase.auth.signOut({ scope: 'local' })
        throw profileError
      }

      router.replace('/(student)/homeStudent' as any)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('landing.guestErrorTitle')
      showModal({ title: t('landing.guestErrorTitle'), message, variant: 'error' })
    } finally {
      setGuestLoading(false)
    }
  }

  const requestGuestEntry = () => {
    showModal({
      title: t('landing.guestNoticeTitle'),
      message: `${t('landing.guestTemporary')}\n\n${t('landing.guestPrivacy')}`,
      variant: 'warning',
      buttons: [
        { label: t('common.cancel'), role: 'cancel' },
        {
          label: t('landing.guestAccept'),
          role: 'primary',
          onPress: () => void enterAsGuest(),
        },
      ],
    })
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
            paddingTop: isDesktop ? 44 : 30,
          }}
        >
          <LandingPanel
            isDesktop={isDesktop}
            isTablet={isTablet}
            useDesktopFeatureLayout={useDesktopFeatureLayout}
            featureCardWidth={featureCardWidth}
            onLoginPress={() => router.push('/login')}
            onGuestPress={requestGuestEntry}
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
  const { t } = useI18n()
  const [selectedPath, setSelectedPath] = useState<PathKind>('student')
  const activePath = features.find((feature) => feature.kind === selectedPath) ?? features[0]
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
      <BrandLogo center size={isDesktop ? 92 : isTablet ? 76 : 60} />
      <View
        className="flex-row items-center gap-3"
        style={{ marginTop: isDesktop || isTablet ? 8 : 4 }}
      >
        <Text
          maxFontSizeMultiplier={2}
          style={{
            fontFamily: 'Pacifico_400Regular',
            fontSize: isDesktop ? 28 : isTablet ? 24 : 19,
            marginTop: isDesktop || isTablet ? 16 : 10,
          }}
          className="text-center text-semantic-info">
          {t('landing.journey')}
        </Text>
      </View>

      <View
        style={{
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: isDesktop ? 28 : 32,
          flexDirection: isTablet ? 'row' : 'column',
          gap: isMobile ? 14 : 18,
          maxWidth: 820,
          width: isTablet ? 'auto' : '100%',
        }}
      >
        <LandingAction
          icon="person-outline"
          title={t('landing.login')}
          subtitle={t('landing.loginSubtitle')}
          onPress={onLoginPress}
          variant="primary"
          isTablet={isTablet}
          testID="landing-login"
        />

        <LandingAction
          icon="glasses-outline"
          title={guestLoading ? t('landing.guestLoading') : isTablet ? t('landing.guest') : t('landing.guestMobile')}
          subtitle={t('landing.guestSubtitle')}
          onPress={onGuestPress}
          variant="secondary"
          isTablet={isTablet}
          loading={guestLoading}
        />
      </View>

      <View className="mt-6 mb-6 flex-row flex-wrap items-center justify-center gap-2">
        <Text maxFontSizeMultiplier={2} className="text-[16px] font-semibold text-text-secondary">{t('landing.noAccount')}</Text>
        <Link href="/register" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('landing.register')}
            accessibilityHint={t('landing.registerHint')}
            hitSlop={12}
            className="flex-row items-center gap-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.74 : 1 })}
          >
            <Text maxFontSizeMultiplier={2} className="text-[16px] font-extrabold text-semantic-info">{t('landing.register')}</Text>
            <Ionicons name="arrow-forward" size={18} color="#42B9FF" />
          </Pressable>
        </Link>
      </View>

      <SectionDivider isMobile={isMobile} />

      {isMobile ? (
        <>
          <PathSelector selectedPath={selectedPath} onSelect={setSelectedPath} />
          <PathFeatureCard feature={activePath} featured />
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

      <LandingInfoSections isDesktop={isDesktop} />
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
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap
  isTablet: boolean
  loading?: boolean
  onPress: () => void
  subtitle: string
  title: string
  variant: 'primary' | 'secondary'
  testID?: string
}) {
  const isPrimary = variant === 'primary'
  const isMobile = !isTablet
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
      testID={testID}
      style={({ pressed }) => ({
        opacity: loading ? 0.72 : pressed ? 0.9 : 1,
        width: isTablet ? 450 : '100%',
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
          minHeight: isMobile ? 80 : 78,
          paddingHorizontal: isMobile ? 18 : 22,
          paddingVertical: isMobile ? 14 : 16,
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
        <View
          className="flex-1 flex-row items-center"
          style={{ gap: isMobile ? 12 : 16 }}
        >
          <View
            className="items-center justify-center"
            style={{
              backgroundColor: isPrimary ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)',
              borderColor: isPrimary ? 'transparent' : 'rgba(148, 163, 184, 0.14)',
              borderRadius: isMobile ? 19 : 22,
              borderWidth: isPrimary ? 0 : 1,
              height: isMobile ? 52 : 58,
              width: isMobile ? 52 : 58,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name={icon} size={isMobile ? 27 : 30} color={isPrimary ? '#FFFFFF' : '#C8D2E8'} />
            )}
          </View>
          <View className="flex-1">
            <Text
              adjustsFontSizeToFit={isMobile}
              className="font-extrabold text-white"
              minimumFontScale={0.9}
              numberOfLines={2}
              style={{ fontSize: isMobile ? 18 : 20 }}
            >
              {title}
            </Text>
            <Text
              className="mt-1 font-medium text-text-secondary"
              numberOfLines={2}
              style={{ fontSize: isMobile ? 15 : 17 }}
            >
              {subtitle}
            </Text>
          </View>
        </View>
        {!loading ? (
          <View
            className="items-center justify-center rounded-full"
            style={{
              backgroundColor: isPrimary ? 'rgba(255,255,255,0.18)' : 'rgba(148, 163, 184, 0.08)',
              borderColor: isPrimary ? 'transparent' : 'rgba(148, 163, 184, 0.15)',
              borderWidth: isPrimary ? 0 : 1,
              height: isMobile ? 46 : 50,
              marginLeft: isMobile ? 10 : 12,
              width: isMobile ? 46 : 50,
            }}
          >
            <Ionicons name="arrow-forward" size={isMobile ? 25 : 28} color={isPrimary ? '#FFFFFF' : '#C8D2E8'} />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  )
}

function SectionDivider({ isMobile }: { isMobile: boolean }) {
  const { t } = useI18n()
  return (
    <View
      className="w-full flex-row items-center gap-4"
      style={{ marginTop: isMobile ? 24 : 32 }}
    >
      <View className="h-px flex-1 bg-brand-teacher" />
      <Text
        className="text-center text-[14px] font-extrabold text-white"
        style={{ letterSpacing: 5 }}
      >
        {t('landing.choosePath')}
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
      className="mt-6 w-full flex-row border p-1.5"
      style={{
        backgroundColor: 'rgba(16, 42, 82, 0.72)',
        borderColor: 'rgba(99, 177, 235, 0.22)',
        borderRadius: 28,
        minHeight: 60,
      }}
    >
      {options.map((option) => {
        const isSelected = selectedPath === option.kind
        const content = (
          <View className="flex-row items-center justify-center" style={{ gap: 10 }}>
            <Ionicons
              name={option.icon}
              size={21}
              color={isSelected ? '#FFFFFF' : '#AEBBDD'}
            />
            <Text
              className={isSelected ? 'text-[17px] font-extrabold' : 'text-[17px] font-semibold'}
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
                style={{ alignItems: 'center', borderRadius: 21, justifyContent: 'center', minHeight: 48 }}
              >
                {content}
              </LinearGradient>
            ) : (
              <View className="items-center justify-center" style={{ minHeight: 48 }}>
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
  const mobileCardGradient = feature.kind === 'student'
    ? ['rgba(18, 34, 66, 0.98)', 'rgba(38, 29, 70, 0.96)'] as const
    : ['rgba(16, 38, 68, 0.98)', 'rgba(12, 54, 70, 0.96)'] as const

  return (
    <LinearGradient
      colors={mobileCardGradient}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{
        borderColor: featured ? `${feature.accent}52` : `${feature.accent}40`,
        borderRadius: 26,
        borderWidth: 1,
        marginTop: featured ? 22 : 24,
        padding: 20,
        width: '100%',
        ...createShadowStyle({
          color: feature.accent,
          opacity: featured ? 0.1 : 0.08,
          radius: 20,
          offsetY: 10,
          web: `0 14px 28px ${feature.accent}18`,
        }),
      }}
    >
      <View className="flex-row items-start gap-4">
        <View
          className="items-center justify-center"
          style={{
            backgroundColor: feature.accent,
            borderRadius: 19,
            height: 58,
            width: 58,
          }}
        >
          <Ionicons name={feature.icon} size={28} color="#FFFFFF" />
        </View>

        <View className="flex-1">
          <Text className="text-[23px] font-extrabold text-white">
            {feature.title} <Text style={{ color: feature.accent }}>{feature.titleAccent}</Text>
          </Text>
          <Text className="mt-1.5 text-[16px] font-medium leading-6 text-text-secondary">{feature.description}</Text>
        </View>
      </View>

      <View className="mt-5">
        {feature.bullets.map((bullet, index) => (
          <View
            key={bullet.label}
            className="flex-row items-center"
            style={{
              borderBottomColor: 'rgba(148, 163, 184, 0.12)',
              borderBottomWidth: index < feature.bullets.length - 1 ? 1 : 0,
              gap: 12,
              minHeight: 60,
              paddingHorizontal: 4,
              paddingVertical: 10,
            }}
          >
            <View
              className="items-center justify-center"
              style={{
                height: 36,
                width: 36,
              }}
            >
              <Ionicons name={bullet.icon} size={22} color={feature.accent} />
            </View>
            <Text className="flex-1 text-[16px] font-semibold leading-[22px] text-text-primary">{bullet.label}</Text>
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
        <>
          <View className="mt-6 w-full gap-3">
            {feature.bullets.map((bullet) => (
              <View key={bullet.label} className="flex-row items-center gap-4">
                <Ionicons name={bullet.icon} size={18} color={feature.accent} />
                <Text className="flex-1 text-[15px] text-text-primary">{bullet.label}</Text>
              </View>
            ))}
          </View>
        </>
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
  const { t } = useI18n()
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
          <Link href="/privacy" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={t('landing.privacy')} accessibilityHint={t('landing.privacyHint')} hitSlop={6}>
              <Text maxFontSizeMultiplier={2} className="font-extrabold text-semantic-info">{t('landing.privacy')}</Text>
            </Pressable>
          </Link>
          <Link href="/terms" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={t('landing.terms')} accessibilityHint={t('landing.termsHint')} hitSlop={6}>
              <Text maxFontSizeMultiplier={2} className="font-extrabold text-semantic-info">{t('landing.terms')}</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  )
}