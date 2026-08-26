import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import OmniLoadingScreen from '../../components/ui/OmniLoadingScreen'
import StudentLayout from '../../components/student/StudentLayout'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import {
  StudentContinueCourse,
  StudentDailyMission,
  StudentHomeAchievements,
  StudentHomeRankingPreview,
  StudentHomeSummary,
  StudentRecommendedAction,
} from '../../components/student/home'
import { useStudentHome, buildStudentClassHref } from './useStudentHome'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { signOutStudent } from './api'
import { useResponsiveLayout } from '../../lib/responsive'

export default function StudentHome() {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const home = useStudentHome()

  if (home.loading) return <OmniLoadingScreen />

  const points = home.profile?.points ?? 0
  const alias = home.profile?.alias || 'Alumno'
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)
  const continueHref = home.continueRow ? buildStudentClassHref(home.continueRow.subject) : '/(student)/classes'
  const greetingName = getCompactGreetingName(alias)

  return (
    <StudentLayout
      activeSection="home"
      alias={alias}
      avatar={home.profile?.avatar}
      bottomNavActive="home"
      isDesktop={responsive.isDesktop}
      level={level}
      nextLevelProgress={nextLevelProgress}
      onSignOut={() => { void signOutStudent() }}
      points={points}
    >
      <StudentPageHeader
        className={!responsive.isDesktop ? 'mb-5' : undefined}
        compactMobileTitle
        icon="home"
        isDesktop={responsive.isDesktop}
        title={responsive.isDesktop ? `¡Hola, ${alias}!` : greetingName ? `¡Hola, ${greetingName}!` : '¡Hola!'}
        titleNumberOfLines={responsive.isDesktop ? 2 : 1}
        subtitle="Tu siguiente paso está preparado. Empieza por la acción recomendada."
      />

      {home.error ? (
        <AppStatusBanner
          variant="warning"
          title="No se pudo actualizar toda la información"
          message={home.error}
          actionLabel="Reintentar"
          onAction={home.refresh}
        />
      ) : null}

      <View className={home.error ? 'mt-5' : ''}>
        <StudentRecommendedAction
          action={home.recommendedAction}
          compact={!responsive.isDesktop}
          onPress={() => router.push(home.recommendedAction.href as any)}
        />
      </View>

      <View className={responsive.isDesktop ? 'mt-5 flex-row items-stretch gap-5' : 'mt-3 gap-3'}>
        <View className={responsive.isDesktop ? 'flex-1' : ''}>
          <StudentContinueCourse
            compact={!responsive.isDesktop}
            row={home.continueRow}
            onPress={() => router.push(continueHref as any)}
          />
        </View>
        <View className={responsive.isDesktop ? 'flex-1' : ''}>
          <StudentDailyMission
            compact={!responsive.isDesktop}
            count={home.todayAttemptCount}
            target={home.dailyMissionTarget}
            streakDays={home.streakDays}
            onPress={() => router.push(continueHref as any)}
          />
        </View>
      </View>

      <View className={responsive.isDesktop ? 'mt-6' : 'mt-4'}>
        <StudentHomeSummary
          progressPercent={home.progressSummary?.overallPercent ?? 0}
          attemptCount={home.attemptCount}
          failedQuestions={home.failedQuestions}
          accuracyPercent={home.progressSummary?.accuracyPercent ?? 0}
          isDesktop={responsive.isDesktop}
          onOpenProgress={() => router.push('/(student)/progress' as any)}
        />
      </View>

      <View className={responsive.isDesktop ? 'mt-6 flex-row items-start gap-5' : 'mt-5 gap-4'}>
        <View className={responsive.isDesktop ? 'flex-1' : ''}>
          <StudentHomeAchievements
            achievements={home.achievements}
            onOpen={() => router.push('/(student)/badges' as any)}
          />
        </View>
        <View className={responsive.isDesktop ? 'flex-1' : ''}>
          <StudentHomeRankingPreview
            rows={home.rankingPreview}
            summary={home.rankingSummary}
            currentUserId={home.rankingSummary ? home.currentUserId : null}
            emptyTitle="Aún no hay clasificación"
            emptyMessage="Completa una actividad para aparecer en el ranking"
            onOpen={() => router.push('/(student)/ranking' as any)}
          />
        </View>
      </View>
    </StudentLayout>
  )
}

function getCompactGreetingName(alias: string) {
  const firstName = alias.trim().split(/\s+/)[0] || ''
  return firstName.length <= 18 ? firstName : ''
}
