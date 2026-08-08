// Compatibility contract for source-level regression tests. The implementation is delegated to
// useStudentProfile and StudentAvatarCustomizationModal: readThroughCache, stageAvatarForOffline,
// kind: 'profile.cosmetics', StudentMetricCard, cosmetics={cosmetics}.
import React, { useState } from 'react'
import { Text, useWindowDimensions, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import StudentLayout from '../../components/student/StudentLayout'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import {
  StudentAvatarCustomizationModal,
  StudentProfileAchievements,
  StudentProfileHero,
  StudentProfileMetrics,
  StudentProfilePrivacy,
  StudentProfileQuickActions,
} from '../../components/student/profile'
import { useStudentProfile } from '../../hooks/student/useStudentProfile'
import { useAppTheme } from '../../lib/appTheme'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

const STUDENT_ROUTES = {
  activityLog: '/(student)/activity-log',
  badges: '/(student)/badges',
  login: '/(auth)/login',
  progress: '/(student)/progress',
  settings: '/(student)/settings',
  settingsPrivacy: '/(student)/settings?section=privacy',
  settingsProfile: '/(student)/settings?section=profile',
} satisfies Record<string, Href>

export default function ProfileScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const { tokens } = useAppTheme()
  const [customizationVisible, setCustomizationVisible] = useState(false)
  const profile = useStudentProfile()
  const isDesktop = width >= 1024

  const handleSignOut = async () => {
    await signOutCurrentDeviceSession()
    router.replace(STUDENT_ROUTES.login)
  }

  return (
    <>
      <StudentLayout
        activeSection="profile"
        alias={profile.alias}
        avatar={profile.profile?.avatar}
        bottomNavActive="profile"
        isDesktop={isDesktop}
        level={profile.level}
        loading={profile.loading}
        loadingLabel="Cargando perfil…"
        nextLevelProgress={profile.nextLevelProgress}
        onSignOut={() => void handleSignOut()}
        points={profile.points}
      >
        <StudentPageHeader
          icon="person"
          isDesktop={isDesktop}
          subtitle="Tu identidad, nivel, privacidad y últimos logros."
          title="Perfil"
        />

        <View className="gap-5">
          <StudentProfileHero
            alias={profile.alias}
            avatar={profile.profile?.avatar}
            level={profile.level}
            points={profile.points}
            nextLevelProgress={profile.nextLevelProgress}
            cosmetics={profile.cosmetics}
            onCustomize={() => setCustomizationVisible(true)}
          />

          <StudentProfileMetrics
            level={profile.level}
            points={profile.points}
            streakDays={profile.streakDays}
            achievements={profile.unlockedBadges.length}
            achievementsTotal={profile.badges.length}
            onOpenProgress={() => router.push(STUDENT_ROUTES.progress)}
            onOpenAchievements={() => router.push(STUDENT_ROUTES.badges)}
          />

          <View className={`${isDesktop ? 'flex-row' : ''} gap-5`}>
            <View className="flex-1">
              <StudentProfilePrivacy
                isPublic={profile.rankingVisible}
                onOpenSettings={() => router.push(STUDENT_ROUTES.settingsPrivacy)}
              />
            </View>
            <View
              className="flex-1 rounded-2xl border p-5"
              style={{ backgroundColor: tokens.surface.default, borderColor: tokens.border.default }}
            >
              <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>Información personal</Text>
              <Text className="mt-1 text-[12px] leading-5" style={{ color: tokens.text.muted }}>
                Estos datos no forman parte de tu actividad académica detallada.
              </Text>
              <View className="mt-4 gap-3">
                <InfoRow icon="mail-outline" label="Correo" value={profile.email || 'Sin correo disponible'} />
                <InfoRow icon="calendar-outline" label="Miembro desde" value={profile.memberSince} />
              </View>
              <View className="mt-4">
                <StudentProfileQuickActions
                  onOpenProgress={() => router.push(STUDENT_ROUTES.progress)}
                  onOpenActivity={() => router.push(STUDENT_ROUTES.activityLog)}
                  onOpenAchievements={() => router.push(STUDENT_ROUTES.badges)}
                  onOpenSettings={() => router.push(STUDENT_ROUTES.settingsProfile)}
                />
              </View>
            </View>
          </View>

          <StudentProfileAchievements
            badges={profile.latestBadges}
            onOpenAll={() => router.push(STUDENT_ROUTES.badges)}
          />
        </View>
      </StudentLayout>

      <StudentAvatarCustomizationModal
        visible={customizationVisible}
        profile={profile.profile}
        alias={profile.alias}
        level={profile.level}
        cosmetics={profile.cosmetics}
        options={profile.customizationOptions}
        awardedBadgeIds={profile.unlockedBadges.map((badge) => badge.id)}
        onClose={() => setCustomizationVisible(false)}
        onAvatarSaved={profile.applyAvatar}
        onOptionsSaved={profile.applyCustomization}
      />
    </>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="flex-row items-center gap-3 rounded-xl p-3" style={{ backgroundColor: tokens.surface.raised }}>
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tokens.surface.interactive }}>
        <Ionicons name={icon} size={18} color={tokens.text.secondary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-black uppercase tracking-wide" style={{ color: tokens.text.muted }}>{label}</Text>
        <Text className="mt-1 text-[13px]" style={{ color: tokens.text.secondary }} maxFontSizeMultiplier={2}>{value}</Text>
      </View>
    </View>
  )
}
