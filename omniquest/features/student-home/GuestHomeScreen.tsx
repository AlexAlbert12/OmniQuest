import { useCallback, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import StudentLayout from '../../components/student/StudentLayout'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import AppButton from '../../components/ui/AppButton'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import { useAppModal } from '../../components/AppModalProvider'
import { useAppTheme } from '../../lib/appTheme'
import { normalizeInviteCode } from '../../lib/classCode'
import { joinClassByInviteCode } from '../../lib/studentClassJoin'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'
import { useResponsiveLayout } from '../../lib/responsive'
import { useI18n } from '../../lib/i18n'

export default function GuestHomeScreen({ alias }: { alias: string }) {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const leaveGuestMode = useCallback(async () => {
    await signOutCurrentDeviceSession()
    router.replace('/')
  }, [router])

  const requestLeaveGuestMode = useCallback(() => {
    showModal({
      title: t('guest.home.leaveTitle'),
      message: t('guest.home.leaveMessage'),
      variant: 'warning',
      buttons: [
        { label: t('common.cancel'), role: 'cancel' },
        { label: t('guest.exit'), role: 'danger', onPress: leaveGuestMode },
      ],
    })
  }, [leaveGuestMode, showModal, t])

  const joinGame = useCallback(async () => {
    if (joining) return
    setJoining(true)
    setError(null)
    try {
      const result = await joinClassByInviteCode(code)
      setCode('')
      router.push({
        pathname: '/(student)/class/[id]',
        params: {
          id: String(result.subjectId),
          ...(result.classroomId ? { classroomId: String(result.classroomId) } : {}),
        },
      } as any)
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : t('guest.home.openErrorFallback'))
    } finally {
      setJoining(false)
    }
  }, [code, joining, router, t])

  return (
    <StudentLayout
      activeSection="home"
      alias={alias}
      bottomNavActive="home"
      guestMode
      isDesktop={responsive.isDesktop}
      level={1}
      nextLevelProgress={0}
      onSignOut={requestLeaveGuestMode}
      points={0}
    >
      <StudentPageHeader
        compactMobileTitle
        icon="game-controller"
        isDesktop={responsive.isDesktop}
        showAvatar={false}
        showNotifications={false}
        title={t('guest.home.title')}
        titleNumberOfLines={1}
      />

      {error ? (
        <AppStatusBanner
          variant="danger"
          title={t('guest.home.openErrorTitle')}
          message={error}
        />
      ) : null}

      <View
        className={`${error ? 'mt-5' : ''} w-full overflow-hidden rounded-[24px] border border-border-default bg-surface-default p-5`}
        style={responsive.isDesktop ? { maxWidth: 760, alignSelf: 'center', padding: 28 } : undefined}
      >
        <View className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-semantic-surface-info">
            <Ionicons name="keypad-outline" size={28} color={tokens.brand.student} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[22px] font-black text-text-primary">{t('guest.home.codeTitle')}</Text>
            <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
              {t('guest.home.codeDescription')}
            </Text>
          </View>
        </View>

        <TextInput
          testID="guest-game-code"
          accessibilityLabel={t('guest.home.codeA11y')}
          autoCapitalize="characters"
          autoCorrect={false}
          enterKeyHint="go"
          maxLength={6}
          onChangeText={(value) => {
            setCode(normalizeInviteCode(value))
            if (error) setError(null)
          }}
          onSubmitEditing={() => { void joinGame() }}
          placeholder="ABC123"
          placeholderTextColor={tokens.text.muted}
          returnKeyType="go"
          value={code}
          className="mt-6 min-h-16 rounded-2xl border border-border-active bg-background-primary px-5 text-center text-[26px] font-black tracking-[4px] text-text-primary"
        />

        <AppButton
          accessibilityHint={t('guest.home.codeHint')}
          disabled={code.length !== 6}
          fullWidth
          icon="play"
          label={t('guest.home.join')}
          loading={joining}
          onPress={() => { void joinGame() }}
          role="student"
          size="lg"
          style={{ marginTop: 16 }}
          variant="primary"
        />
      </View>

      <View className="mt-5 flex-row items-start justify-center gap-2 px-3">
        <Ionicons name="time-outline" size={18} color={tokens.text.secondary} />
        <Text className="max-w-[620px] text-center text-[12px] leading-5 text-text-secondary">
          {t('guest.home.footer', { alias })}
        </Text>
      </View>
    </StudentLayout>
  )
}
