import React, { useCallback } from 'react'
import { RefreshControl, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import TeacherScreenLayout from '../../components/layouts/TeacherScreenLayout'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import {
  TeacherProfileHero,
  TeacherProfileLazyResources,
  TeacherProfileMetrics,
} from '../../components/teacher/profile'
import AppButton from '../../components/ui/AppButton'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import { useTeacherProfile, type TeacherRecentQuestion } from '../../hooks/teacher/useTeacherProfile'
import { useAppTheme } from '../../lib/appTheme'
import { useResponsiveLayout } from '../../lib/responsive'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

const ROUTES = {
  classes: '/(teacher)/classes',
  notifications: '/(teacher)/notifications',
  security: '/(teacher)/security',
  settings: '/(teacher)/settings?section=personal',
  students: '/(teacher)/students',
  reviews: '/(teacher)/reviews',
  audit: '/(teacher)/audit',
  login: '/(auth)/login',
} satisfies Record<string, Href>

function subjectRoute(subjectId: number) {
  return `/(teacher)/subject/${subjectId}` as Href
}

function questionRoute(question: TeacherRecentQuestion) {
  return `/(teacher)/subject/${question.subjectId}?tab=questions&question=${question.id}` as Href
}

export default function TeacherProfileScreen() {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const profile = useTeacherProfile()
  const { summary } = profile

  const handleSignOut = useCallback(async () => {
    await signOutCurrentDeviceSession()
    router.replace(ROUTES.login)
  }, [router])

  return (
    <TeacherScreenLayout
      isDesktop={responsive.isDesktop}
      loading={profile.loading}
      loadingLabel="Cargando perfil docente…"
      refreshControl={(
        <RefreshControl
          refreshing={profile.refreshing}
          onRefresh={() => void profile.refresh()}
        />
      )}
      desktopSidebar={(
        <TeacherSidebar
          activeSection="profile"
          subjectsCount={summary.metrics.activeCourses}
          alias={summary.identity.alias}
          avatar={summary.identity.avatar}
          onSignOut={() => void handleSignOut()}
        />
      )}
      mobileBottomNavigation={<TeacherBottomNav active="profile" />}
    >
      <TeacherPageHeader
        icon="person"
        isDesktop={responsive.isDesktop}
        title="Perfil docente"
        mobileTitle="Mi perfil"
        subtitle="Tu identidad profesional y el impacto generado en el periodo seleccionado"
        notificationOnPress={() => router.push(ROUTES.notifications)}
      />

      {profile.error ? (
        <AppStatusBanner
          style={{ marginBottom: 16 }}
          variant="warning"
          title="No se pudo actualizar todo el perfil"
          message={profile.error}
          actionLabel="Reintentar"
          onAction={() => void profile.refresh()}
        />
      ) : null}

      <TeacherProfileHero
        alias={summary.identity.alias}
        email={summary.identity.email}
        avatar={summary.identity.avatar}
        createdAt={summary.identity.createdAt}
        uploadingAvatar={profile.uploadingAvatar}
        onAvatarPress={() => void profile.chooseProfessionalAvatar()}
        onEditProfile={() => router.push(ROUTES.settings)}
        onSecurity={() => router.push(ROUTES.security)}
      />

      <TeacherProfileMetrics
        metrics={summary.metrics}
        period={profile.period}
        periodLabel={profile.periodLabel}
        participationDescription={summary.participationDescription}
        participationNumerator={summary.participationNumerator}
        participationDenominator={summary.participationDenominator}
        onPeriodChange={profile.setPeriod}
      />

      <View style={{ marginTop: 18 }}>
        <Text style={{ color: tokens.text.primary, fontSize: 17, fontWeight: '900' }}>Accesos docentes</Text>
        <Text style={{ color: tokens.text.secondary, marginTop: 3, fontSize: 11 }}>Accede rápidamente a las tareas habituales.</Text>
        <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <AppButton
            label="Crear pregunta"
            icon="add-circle-outline"
            role="teacher"
            disabled={!summary.primarySubjectId}
            onPress={() => summary.primarySubjectId && router.push(`/(teacher)/subject/add-question?subjectId=${summary.primarySubjectId}` as Href)}
          />
          <AppButton label="Importar alumnos" icon="cloud-upload-outline" role="teacher" variant="secondary" onPress={() => router.push('/(teacher)/students?import=1' as Href)} />
          <AppButton label="Revisar respuestas" icon="create-outline" role="teacher" variant="secondary" onPress={() => router.push(ROUTES.reviews)} />
          <AppButton label="Revisar alumnos" icon="people-outline" role="teacher" variant="secondary" onPress={() => router.push(ROUTES.students)} />
          <AppButton label="Auditoría" icon="shield-checkmark-outline" role="teacher" variant="secondary" onPress={() => router.push(ROUTES.audit)} />
        </View>
      </View>

      <TeacherProfileLazyResources
        subjects={profile.subjects}
        questions={profile.questions}
        onLoadSubjects={() => void profile.loadRecentSubjects()}
        onLoadQuestions={() => void profile.loadRecentQuestions()}
        onOpenSubject={(subjectId) => router.push(subjectRoute(subjectId))}
        onOpenQuestion={(question) => router.push(questionRoute(question))}
        onViewCourses={() => router.push(ROUTES.classes)}
      />
    </TeacherScreenLayout>
  )
}
