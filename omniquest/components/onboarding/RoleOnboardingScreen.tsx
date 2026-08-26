import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import OmniGuide, { type OmniState } from '../OmniGuide'
import AppButton from '../ui/AppButton'
import { useAppModal } from '../AppModalProvider'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import { completeCurrentUserOnboarding, getHelpRouteForOnboardingRole, getHomeRouteForOnboardingRole, type OnboardingRole } from '../../lib/onboarding'
import { withAlpha } from '../../lib/color'
import { useResponsiveLayout } from '../../lib/responsive'

type IconName = keyof typeof Ionicons.glyphMap

type StepDefinition = {
  key: string
  icon: IconName
  omniState: OmniState
  bullets: number
}

const STUDENT_STEPS: StepDefinition[] = [
  { key: 'welcome', icon: 'sparkles-outline', omniState: 'happy', bullets: 2 },
  { key: 'join', icon: 'people-outline', omniState: 'normal', bullets: 3 },
  { key: 'practice', icon: 'game-controller-outline', omniState: 'thinking', bullets: 3 },
  { key: 'progress', icon: 'trending-up-outline', omniState: 'happy', bullets: 3 },
]

const TEACHER_STEPS: StepDefinition[] = [
  { key: 'welcome', icon: 'school-outline', omniState: 'happy', bullets: 2 },
  { key: 'organize', icon: 'albums-outline', omniState: 'normal', bullets: 3 },
  { key: 'content', icon: 'create-outline', omniState: 'thinking', bullets: 3 },
  { key: 'followup', icon: 'analytics-outline', omniState: 'happy', bullets: 3 },
]

export default function RoleOnboardingScreen({ role }: { role: OnboardingRole }) {
  const router = useRouter()
  const params = useLocalSearchParams<{ replay?: string | string[] }>()
  const { width } = useResponsiveLayout()
  const { colors, tokens } = useAppTheme()
  const { t } = useI18n()
  const { showModal } = useAppModal()
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const replayValue = Array.isArray(params.replay) ? params.replay[0] : params.replay
  const replay = replayValue === '1'
  const steps = role === 'teacher' ? TEACHER_STEPS : STUDENT_STEPS
  const step = steps[stepIndex]
  const total = steps.length
  const isLastStep = stepIndex === total - 1
  const roleColor = tokens.brand[role]
  const contentWidth = Math.min(width - 32, 760)
  const translationPrefix = `onboarding.${role}.${step.key}`
  const bullets = useMemo(() => Array.from({ length: step.bullets }, (_, index) => t(`${translationPrefix}.bullet${index + 1}`)), [step.bullets, t, translationPrefix])

  const leaveReplay = () => router.replace(getHelpRouteForOnboardingRole(role) as never)

  const finishRequiredOnboarding = async () => {
    setSaving(true)
    try {
      await completeCurrentUserOnboarding()
      router.replace(getHomeRouteForOnboardingRole(role) as never)
    } catch (error) {
      console.error('[onboarding] failed to complete onboarding', error)
      showModal({ title: t('onboarding.common.errorTitle'), message: t('onboarding.common.errorMessage'), variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handlePrimary = () => {
    if (!isLastStep) {
      setStepIndex((current) => Math.min(current + 1, total - 1))
      return
    }
    if (replay) {
      leaveReplay()
      return
    }
    void finishRequiredOnboarding()
  }

  const handleSkipOrClose = () => {
    if (replay) {
      leaveReplay()
      return
    }
    void finishRequiredOnboarding()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingVertical: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: contentWidth, maxWidth: '100%', alignSelf: 'center', flexGrow: 1, justifyContent: 'center' }}>
          <View style={{ borderRadius: 24, borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.surface.default, padding: width >= 700 ? 32 : 22 }}>
            <View style={{ alignItems: 'center' }}>
              <OmniGuide state={step.omniState} size={width >= 700 ? 132 : 108} autoBlink={step.omniState === 'normal'} />
              <Text accessibilityRole="header" style={{ marginTop: 10, color: roleColor, fontSize: 12, fontWeight: '900', letterSpacing: 1.4 }}>{t(`onboarding.${role}.eyebrow`)}</Text>
              <Text style={{ marginTop: 7, color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{t('onboarding.common.step', { current: stepIndex + 1, total })}</Text>
            </View>

            <View accessibilityLabel={t('onboarding.common.progress', { current: stepIndex + 1, total })} accessibilityRole="progressbar" style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
              {steps.map((item, index) => <View key={item.key} style={{ flex: 1, height: 5, borderRadius: 999, backgroundColor: index <= stepIndex ? roleColor : tokens.border.subtle }} />)}
            </View>

            <View style={{ marginTop: 28, alignItems: 'center' }}>
              <View style={{ width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(roleColor, '1F'), borderWidth: 1, borderColor: withAlpha(roleColor, '70') }}>
                <Ionicons name={step.icon} size={28} color={roleColor} />
              </View>
              <Text style={{ marginTop: 16, color: colors.text, fontSize: width >= 700 ? 28 : 24, lineHeight: width >= 700 ? 35 : 31, fontWeight: '900', textAlign: 'center' }}>{t(`${translationPrefix}.title`)}</Text>
              <Text style={{ marginTop: 10, color: colors.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 610 }}>{t(`${translationPrefix}.description`)}</Text>
            </View>

            <View style={{ marginTop: 24, gap: 12 }}>
              {bullets.map((bullet, index) => (
                <View key={`${step.key}-${index}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: tokens.border.subtle, backgroundColor: tokens.surface.raised, padding: 14 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(roleColor, '1F') }}>
                    <Ionicons name="checkmark" size={16} color={roleColor} />
                  </View>
                  <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>{bullet}</Text>
                </View>
              ))}
            </View>

            <View style={{ marginTop: 28, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                {stepIndex > 0 ? <AppButton label={t('common.previous')} icon="arrow-back-outline" variant="secondary" role={role} onPress={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={saving} style={{ flex: 1 }} /> : <View style={{ flex: 1 }} />}
                <AppButton label={isLastStep ? (replay ? t('onboarding.common.backToHelp') : t('onboarding.common.start')) : t('common.next')} icon={isLastStep ? (replay ? 'help-circle-outline' : 'rocket-outline') : 'arrow-forward-outline'} iconPosition="right" role={role} onPress={handlePrimary} loading={saving} style={{ flex: 1 }} />
              </View>
              <AppButton label={replay ? t('onboarding.common.close') : t('onboarding.common.skip')} variant="ghost" role={role} onPress={handleSkipOrClose} disabled={saving} fullWidth />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
