import React, { useCallback } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import { useResponsiveLayout } from '../../lib/responsive'
import StudentLayout from '../../components/student/StudentLayout'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import StudentDashboardCard from '../../components/student/StudentDashboardCard'
import AppPressable from '../../components/ui/AppPressable'
import { AppStatusBanner } from '../../components/ui'
import DailyPracticeRecommendation from '../../components/student/progress/DailyPracticeRecommendation'
import ProgressOverview from '../../components/student/progress/ProgressOverview'
import PracticeOpportunityList from '../../components/student/progress/PracticeOpportunityList'
import CourseProgressList from '../../components/student/progress/CourseProgressList'
import LatestResults from '../../components/student/progress/LatestResults'
import { useStudentProgress, type PracticeOpportunity, type StudentCourseProgress } from '../../hooks/student/useStudentProgress'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

export default function ProgressScreen() {
  const responsive = useResponsiveLayout()
  const router = useRouter()
  const { accentColor } = useAppTheme()
  const progress = useStudentProgress()
  const isDesktop = responsive.isDesktop
  const secondaryOpportunities = progress.recommendation ? progress.opportunities.filter((item) => item.id !== progress.recommendation?.id) : progress.opportunities

  const handlePractice = useCallback((opportunity: PracticeOpportunity) => {
    if (opportunity.subjectId) {
      router.push({
        pathname: '/(student)/review/[attemptId]',
        params: {
          attemptId: 'latest',
          subjectId: String(opportunity.subjectId),
          topicId: opportunity.topicId === null || opportunity.topicId === undefined ? 'general' : String(opportunity.topicId),
          topicName: opportunity.topicName || opportunity.title,
        },
      } as any)
      return
    }
    router.push('/(student)/activity-log' as any)
  }, [router])

  const handleOpenCourse = useCallback((course: StudentCourseProgress) => {
    router.push({
      pathname: '/(student)/class/[id]',
      params: {
        id: String(course.id),
        ...(course.classroomId ? { classroomId: String(course.classroomId) } : {}),
      },
    } as any)
  }, [router])

  const secondarySections = (
    <View className="gap-5">
      <LatestResults results={progress.latestResults} onSeeAll={() => router.push('/(student)/activity-log' as any)} />
      <CourseProgressList courses={progress.courseProgress} onOpenCourse={handleOpenCourse} onSeeAll={() => router.push('/(student)/classes' as any)} />
      <StudentDashboardCard title="Logros recientes" actionLabel="Ver todos" onAction={() => router.push('/(student)/badges' as any)}>
        <View className="gap-2">
          {progress.badges.slice(0, 4).map((badge) => (
            <AppPressable
              key={badge.id}
              accessibilityLabel={`${badge.title}. ${badge.statusLabel}`}
              onPress={() => router.push('/(student)/badges' as any)}
              className="flex-row items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised p-3"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${accentColor}20` }}>
                <Ionicons name={badge.icon} size={20} color={accentColor} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-black text-text-primary">{badge.title}</Text>
                <Text className="mt-1 text-[12px] text-text-secondary">{badge.requirement}</Text>
              </View>
              <Text className="text-[12px] font-black text-gamification-xp">{badge.xp}</Text>
            </AppPressable>
          ))}
        </View>
      </StudentDashboardCard>
    </View>
  )

  return (
    <StudentLayout
      activeSection="progress"
      bottomNavActive="progress"
      alias={progress.alias}
      avatar={progress.profile?.avatar}
      level={progress.level}
      points={progress.points}
      nextLevelProgress={progress.nextLevelProgress}
      isDesktop={isDesktop}
      loading={progress.loading}
      loadingLabel="Analizando tu progreso..."
      onSignOut={() => { void signOutCurrentDeviceSession() }}
    >
      <StudentPageHeader icon="stats-chart" isDesktop={isDesktop} title="Progreso" subtitle="Entiende qué practicar, por qué se recomienda y qué puedes ganar." />

      {progress.error ? (
        <View className="mb-4">
          <AppStatusBanner variant="danger" icon="warning-outline" title="No se pudo actualizar el progreso" message={progress.error} actionLabel="Reintentar" onAction={() => { void progress.reload() }} />
        </View>
      ) : null}

      <DailyPracticeRecommendation recommendation={progress.recommendation} coursesCount={progress.courseProgress.length} accentColor={accentColor} onPractice={handlePractice} onBrowseCourses={() => router.push('/(student)/classes' as any)} />

      <ProgressOverview progressPercent={progress.progressPercent} accuracyPercent={progress.accuracyPercent} answeredQuestions={progress.answeredQuestions} failedQuestions={progress.failedQuestions} weeklyAttemptsCount={progress.weeklyAttemptsCount} streakDays={progress.streakDays} />

      <View className={`${isDesktop ? 'flex-row items-start' : ''} mt-5 gap-5`}>
        <View className={isDesktop ? 'min-w-0 flex-[1.4]' : ''}>
          <PracticeOpportunityList opportunities={secondaryOpportunities} primaryRecommendationShown={Boolean(progress.recommendation)} onPractice={handlePractice} onSeeAll={() => router.push('/(student)/activity-log' as any)} />
        </View>
        <View className={isDesktop ? 'min-w-[320px] flex-1' : ''}>{secondarySections}</View>
      </View>
    </StudentLayout>
  )
}
