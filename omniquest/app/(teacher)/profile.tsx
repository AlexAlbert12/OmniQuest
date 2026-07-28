import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../components/ui/mobile/MobileMetricCard'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import TeacherScreenLayout from '../../components/layouts/TeacherScreenLayout'
import { useResponsiveLayout } from '../../lib/responsive'
import { formatLongDate, formatRelativeDate } from '../../lib/dateFormat'
import { useAppTheme } from '../../lib/appTheme'
import { useAppModal } from '../../components/AppModalProvider'
import { AppIconButton, useAppToast } from '../../components/ui'

type TeacherProfile = {
  id: string
  alias: string
  avatar: string | null
  created_at: string
}

type TeacherSubject = {
  id: number
  name: string
  description: string | null
  icon: string | null
  code: string
  created_at: string
}

type Enrollment = {
  subject_id: number | null
  student_id: string | null
}

type SubjectScore = {
  subject_id: number | null
  student_id: string | null
  max_score: number | null
}

type Question = {
  id: number
  text: string
  subject_id: number | null
  created_at: string
  subjects?: { name: string } | { name: string }[] | null
}

const TEACHER_ROUTES = {
  classes: '/(teacher)/classes',
  login: '/(auth)/login',
  notifications: '/(teacher)/notifications',
  security: '/(teacher)/security',
  settingsProfile: '/(teacher)/settings?section=personal',
  students: '/(teacher)/students',
  settings: '/(teacher)/settings',
} satisfies Record<string, Href>

function teacherSubjectRoute(subjectId: number) {
  return `/(teacher)/subject/${subjectId}` as Href
}

export default function TeacherProfileScreen() {
  const responsive = useResponsiveLayout()
  const router = useRouter()
  const { tokens } = useAppTheme()
  const { showModal } = useAppModal()
  const { showToast } = useAppToast()

  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [email, setEmail] = useState('')
  const [subjects, setSubjects] = useState<TeacherSubject[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [scores, setScores] = useState<SubjectScore[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const isDesktop = responsive.isDesktop

  const stats = useMemo(() => {
    const enrollmentPairs = new Set(
      enrollments
        .filter((enrollment) => enrollment.subject_id && enrollment.student_id)
        .map((enrollment) => `${enrollment.subject_id}:${enrollment.student_id}`)
    )

    const scorePairs = new Set(
      scores
        .filter((score) => score.subject_id && score.student_id && (score.max_score ?? 0) > 0)
        .map((score) => `${score.subject_id}:${score.student_id}`)
        .filter((pair) => enrollmentPairs.has(pair))
    )

    const activeStudentIds = new Set(
      scores
        .filter((score) => score.student_id && (score.max_score ?? 0) > 0)
        .map((score) => score.student_id as string)
    )

    const participation = enrollmentPairs.size > 0
      ? Math.round((scorePairs.size / enrollmentPairs.size) * 100)
      : 0

    return {
      activeClasses: subjects.length,
      activeStudents: activeStudentIds.size,
      questionsCreated: questions.length,
      averageParticipation: participation,
    }
  }, [subjects, enrollments, scores, questions])

  const recentSubjects = subjects.slice(0, 4)
  const recentQuestions = questions.slice(0, 5)
  const primarySubjectId = subjects[0]?.id ?? null
  const alias = profile?.alias || 'Profesor'
  const memberSince = formatLongDate(profile?.created_at)

  const fetchProfile = useCallback(async () => {
    setLoading(true)

    try {
      const { data: sessionResult } = await supabase.auth.getSession()
      const session = sessionResult.session
      const userId = session?.user.id

      setEmail(session?.user.email || '')

      if (!userId) return

      const [profileResult, subjectsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, alias, avatar, created_at')
          .eq('id', userId)
          .single(),
        supabase
          .from('subjects')
          .select('id, name, description, icon, code, created_at')
          .eq('teacher_id', userId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false }),
      ])

      if (profileResult.error) throw profileResult.error
      if (subjectsResult.error) throw subjectsResult.error

      const nextSubjects = (subjectsResult.data || []) as TeacherSubject[]
      const subjectIds = nextSubjects.map((subject) => subject.id)

      setProfile(profileResult.data as TeacherProfile)
      setSubjects(nextSubjects)

      if (subjectIds.length === 0) {
        setEnrollments([])
        setScores([])
        setQuestions([])
        return
      }

      const [enrollmentsResult, scoresResult, questionsResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('subject_id, student_id')
          .in('subject_id', subjectIds),
        supabase
          .from('subject_scores')
          .select('subject_id, student_id, max_score')
          .in('subject_id', subjectIds),
        supabase
          .from('questions')
          .select('id, text, subject_id, created_at, subjects(name)')
          .in('subject_id', subjectIds)
          .order('created_at', { ascending: false }),
      ])

      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (scoresResult.error) throw scoresResult.error
      if (questionsResult.error) throw questionsResult.error

      setEnrollments((enrollmentsResult.data || []) as Enrollment[])
      setScores((scoresResult.data || []) as SubjectScore[])
      setQuestions((questionsResult.data || []) as Question[])
    } catch (error: any) {
      console.error('Error cargando perfil del profesor:', error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchProfile()
    }, [fetchProfile])
  )

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (status !== 'granted') {
      showModal({
        title: 'Permiso requerido',
        message: 'Necesitamos acceso a tu galería para subir una foto de perfil.',
        variant: 'warning',
      })
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled) {
      await uploadImage(result.assets[0].uri)
    }
  }

  const uploadImage = async (uri: string) => {
    if (!profile) return

    setUploading(true)

    try {
      const response = await fetch(uri)
      const blob = await response.blob()
      const fileName = `${profile.id}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true })

      if (uploadError) throw uploadError

      const { data, error: updateError } = await supabase.functions.invoke('profile-update-avatar', {
        body: { avatarPath: fileName },
      })

      if (updateError) throw updateError
      const result = (data || {}) as { avatar?: string | null; error?: string }
      if (result.error) throw new Error(result.error)

      setProfile({ ...profile, avatar: result.avatar || null })

      showToast({ title: 'Foto actualizada', message: 'Tu nueva imagen de perfil ya está disponible.', variant: 'success' })
    } catch (error: any) {
      console.error('Error subiendo avatar:', error.message)

      showToast({ title: 'No se pudo subir la imagen', message: 'Revisa el archivo e inténtalo de nuevo.', variant: 'danger' })
    } finally {
      setUploading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace(TEACHER_ROUTES.login)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-primary">
        <ActivityIndicator size="large" color={tokens.brand.teacher} />
        <Text className="mt-4 text-text-muted">Cargando perfil del profesor...</Text>
      </View>
    )
  }

  if (!isDesktop) {
    return (
      <MobileTeacherProfile
        alias={alias}
        email={email}
        avatar={profile?.avatar}
        uploading={uploading}
        stats={stats}
        memberSince={memberSince}
        recentSubjects={recentSubjects}
        recentQuestions={recentQuestions}
        onPickImage={pickImage}
        onNotifications={() => router.push(TEACHER_ROUTES.notifications)}
        onEditProfile={() => router.push(TEACHER_ROUTES.settingsProfile)}
        onSecurity={() => router.push(TEACHER_ROUTES.security)}
        onClasses={() => router.push(TEACHER_ROUTES.classes)}
        onStudents={() => router.push(TEACHER_ROUTES.students)}
        onQuestions={() => router.push(primarySubjectId ? (`/(teacher)/subject/${primarySubjectId}?tab=questions` as Href) : TEACHER_ROUTES.classes)}
        onCreateQuestion={() => router.push(primarySubjectId ? (`/(teacher)/subject/add-question?subjectId=${primarySubjectId}` as Href) : '/(teacher)/create-subject' as Href)}
        onImportStudents={() => router.push(primarySubjectId ? (`/(teacher)/subject/${primarySubjectId}?tab=students&importStudents=1` as Href) : TEACHER_ROUTES.classes)}
        onReviewStudents={() => router.push(TEACHER_ROUTES.students)}
        onConfigureProfile={() => router.push(TEACHER_ROUTES.settingsProfile)}
        onOpenSubject={(subjectId) => router.push(teacherSubjectRoute(subjectId))}
        onOpenSettings={() => router.push(TEACHER_ROUTES.settings)}

      />
    )
  }

  return (
    <TeacherScreenLayout
      contentLabel="Perfil del profesor"
      desktopSidebar={(
        <TeacherSidebar
          activeSection="profile"
          subjectsCount={stats.activeClasses}
          alias={profile?.alias}
          avatar={profile?.avatar}
          onSignOut={handleSignOut}
        />
      )}
      isDesktop={isDesktop}
    >
          <TeacherPageHeader
            icon="person"
            isDesktop={isDesktop}
            title="Perfil"
            subtitle="Tu perfil docente, impacto en el aula y accesos de trabajo."
            showAvatar={false}
          />

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <TeacherHero
              alias={alias}
              email={email}
              avatar={profile?.avatar}
              uploading={uploading}
              onPickImage={pickImage}
            />

            <TeacherImpactPanel
              stats={stats}
              onClasses={() => router.push(TEACHER_ROUTES.classes)}
              onStudents={() => router.push(TEACHER_ROUTES.students)}
              onQuestions={() => router.push(primarySubjectId ? (`/(teacher)/subject/${primarySubjectId}?tab=questions` as Href) : TEACHER_ROUTES.classes)}
            />
          </View>

          <TeacherQuickAccessPanel
            className="mt-5"
            onCreateQuestion={() => router.push(primarySubjectId ? (`/(teacher)/subject/add-question?subjectId=${primarySubjectId}` as Href) : '/(teacher)/create-subject' as Href)}
            onImportStudents={() => router.push(primarySubjectId ? (`/(teacher)/subject/${primarySubjectId}?tab=students&importStudents=1` as Href) : TEACHER_ROUTES.classes)}
            onReviewStudents={() => router.push(TEACHER_ROUTES.students)}
            onConfigureProfile={() => router.push(TEACHER_ROUTES.settingsProfile)}
          />

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <ProfileCard title="Información del profesor" className={isDesktop ? 'flex-1' : ''}>
              <InfoRow icon="mail-outline" label="Correo electrónico" value={email || 'Sin correo'} />
              <InfoRow icon="shield-checkmark-outline" label="Rol" value="Profesor" />
              <InfoRow icon="calendar-outline" label="Miembro desde" value={memberSince} />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar perfil"
                accessibilityHint="Abre la configuración de datos personales"
                onPress={() => router.push(TEACHER_ROUTES.settingsProfile)}
                className="mt-4 flex-row items-center gap-2 border-t border-border-subtle pt-4"
              >
                <Ionicons name="create-outline" size={18} color={tokens.brand.teacher} />
                <Text className="font-bold text-brand-teacher">Editar perfil</Text>
                <Ionicons name="arrow-forward" size={16} color={tokens.brand.teacher} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Gestionar seguridad"
                accessibilityHint="Abre las sesiones, contraseña y códigos de respaldo"
                onPress={() => router.push(TEACHER_ROUTES.security)}
                className="mt-3 flex-row items-center gap-2"
              >
                <Ionicons name="lock-closed-outline" size={18} color={tokens.brand.teacher} />
                <Text className="font-bold text-brand-teacher">Gestionar seguridad</Text>
                <Ionicons name="arrow-forward" size={16} color={tokens.brand.teacher} />
              </Pressable>
            </ProfileCard>

            <ProfileCard title="Clases recientes" className={isDesktop ? 'flex-1' : ''}>
              <View style={{ gap: 12 }}>
                {recentSubjects.length > 0 ? (
                  recentSubjects.map((subject) => (
                    <Pressable
                      key={subject.id}
                      accessibilityRole="link"
                      accessibilityLabel={`Abrir curso ${subject.name}`}
                      accessibilityHint={`Código ${subject.code}. Abre el detalle del curso`}
                      onPress={() => router.push(teacherSubjectRoute(subject.id))}
                      className="flex-row items-center gap-3 rounded-xl bg-surface-raised p-3"
                    >
                      <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface-selected">
                        <Text className="text-[24px]">{subject.icon || '📘'}</Text>
                      </View>

                      <View className="min-w-0 flex-1">
                        <Text className="font-black text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>
                          {subject.name}
                        </Text>
                        <Text className="mt-1 text-[12px] text-text-muted">
                          Código: {subject.code}
                        </Text>
                      </View>

                      <Text className="text-[12px] text-text-muted">
                        {formatRelativeDate(subject.created_at)}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <EmptyState icon="book-outline" message="Todavía no has creado ninguna clase." />
                )}
              </View>
            </ProfileCard>

            <ProfileCard title="Preguntas recientes" className={isDesktop ? 'flex-1' : ''}>
              <View style={{ gap: 12 }}>
                {recentQuestions.length > 0 ? (
                  recentQuestions.map((question) => (
                    <View key={question.id} className="flex-row items-center gap-3 rounded-xl bg-surface-raised p-3">
                      <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-interactive">
                        <Ionicons name="help-circle-outline" size={22} color={tokens.brand.teacher} />
                      </View>

                      <View className="min-w-0 flex-1">
                        <Text className="font-bold text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>
                          {question.text}
                        </Text>
                        <Text className="mt-1 text-[12px] text-text-muted" numberOfLines={2} maxFontSizeMultiplier={2}>
                          {getSubjectName(question.subjects)}
                        </Text>
                      </View>

                      <Text className="text-[12px] text-text-muted">
                        {formatRelativeDate(question.created_at)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <EmptyState icon="help-circle-outline" message="Todavía no has creado preguntas." />
                )}
              </View>
            </ProfileCard>
          </View>
    </TeacherScreenLayout>
  )
}

type TeacherProfileStats = {
  activeClasses: number
  activeStudents: number
  questionsCreated: number
  averageParticipation: number
}

function MobileTeacherProfile({
  alias,
  email,
  avatar,
  uploading,
  stats,
  memberSince,
  recentSubjects,
  recentQuestions,
  onPickImage,
  onNotifications,
  onEditProfile,
  onSecurity,
  onClasses,
  onStudents,
  onQuestions,
  onCreateQuestion,
  onImportStudents,
  onReviewStudents,
  onConfigureProfile,
  onOpenSubject,
  onOpenSettings
}: {
  alias: string
  email: string
  avatar?: string | null
  uploading: boolean
  stats: TeacherProfileStats
  memberSince: string
  recentSubjects: TeacherSubject[]
  recentQuestions: Question[]
  onPickImage: () => void
  onNotifications: () => void
  onEditProfile: () => void
  onSecurity: () => void
  onClasses: () => void
  onStudents: () => void
  onQuestions: () => void
  onCreateQuestion: () => void
  onImportStudents: () => void
  onReviewStudents: () => void
  onConfigureProfile: () => void
  onOpenSubject: (subjectId: number) => void
  onOpenSettings: () => void
}) {
  const { tokens } = useAppTheme()

  return (
    <View className="flex-1 bg-background-secondary">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 22, paddingBottom: MOBILE_BOTTOM_NAV_SPACER + 8 }}
        showsVerticalScrollIndicator={false}
      >
        <TeacherPageHeader
          icon="person"
          isDesktop={false}
          title="Mi perfil"
          subtitle="Gestiona tu información docente y tu actividad."
          notificationOnPress={onNotifications}
          showAvatar={false}
          actionsPosition="top"
          actions={(
            <AppIconButton
              accessibilityLabel="Abrir configuración"
              icon="settings-outline"
              role="teacher"
              variant="secondary"
              onPress={onOpenSettings}
            />
          )}
          className="mb-7"
        />

        <MobileTeacherProfileHero
          alias={alias}
          email={email}
          avatar={avatar}
          uploading={uploading}
          onPickImage={onPickImage}
        />

        <MobileTeacherImpactCard
          stats={stats}
          onClasses={onClasses}
          onStudents={onStudents}
          onQuestions={onQuestions}
        />

        <TeacherQuickAccessPanel
          className="mt-5"
          mobile
          onCreateQuestion={onCreateQuestion}
          onImportStudents={onImportStudents}
          onReviewStudents={onReviewStudents}
          onConfigureProfile={onConfigureProfile}
        />

        <MobileTeacherInfoCard
          email={email || 'Sin correo'}
          memberSince={memberSince}
          onEditProfile={onEditProfile}
          onSecurity={onSecurity}
        />

        <MobileRecentSubjectsCard
          subjects={recentSubjects}
          onOpenSubject={onOpenSubject}
          onViewAll={onClasses}
        />

        <MobileRecentQuestionsCard
          questions={recentQuestions}
          onViewAll={onQuestions}
        />
      </ScrollView>

      <TeacherBottomNav active="profile" />
    </View>
  )
}

function MobileTeacherProfileHero({
  alias,
  email,
  avatar,
  uploading,
  onPickImage,
}: {
  alias: string
  email: string
  avatar?: string | null
  uploading: boolean
  onPickImage: () => void
}) {
  const { tokens } = useAppTheme()

  return (
    <LinearGradient
      colors={[tokens.surface.selected, tokens.background.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="overflow-hidden rounded-2xl border border-border-active p-6"
    >
      <View className="absolute right-[-30px] top-[-34px] h-40 w-44 rotate-12 rounded-[36px] bg-surface-selected" />
      <View className="absolute bottom-[-46px] left-[-24px] h-28 w-52 -rotate-12 rounded-[28px] bg-background-secondary" />

      <View className="relative flex-row items-center gap-5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uploading ? 'Subiendo imagen de perfil' : 'Cambiar imagen de perfil'}
          accessibilityHint="Abre el selector de imágenes"
          accessibilityState={{ disabled: uploading, busy: uploading }}
          onPress={onPickImage}
          disabled={uploading}
          className="h-28 w-28 items-center justify-center rounded-full border-[6px] border-border-active bg-white"
          style={({ pressed }) => ({ opacity: uploading ? 0.7 : pressed ? 0.86 : 1 })}
        >
          <View className="h-[90px] w-[90px] overflow-hidden rounded-full bg-surface-raised">
            {avatar && avatar.startsWith('http') ? (
              <Image source={{ uri: avatar }} className="h-full w-full" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-[38px] font-black text-text-primary">{getInitials(alias)}</Text>
              </View>
            )}
          </View>
        </Pressable>

        <View className="min-w-0 flex-1">
          <Text className="text-[31px] font-black text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>{alias}</Text>
          <Text className="mt-2 text-[18px] font-black text-brand-teacher">Profesor</Text>
          <Text className="mt-2 text-[16px] leading-6 text-text-secondary" numberOfLines={2}>{email || 'Sin correo'}</Text>

          <View className="mt-5 self-start flex-row items-center gap-2 rounded-xl bg-brand-teacher px-4 py-3">
            <Ionicons name="shield-checkmark-outline" size={19} color={tokens.text.inverse} />
            <Text className="text-[16px] font-black text-text-inverse">Docente</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  )
}

function TeacherQuickAccessPanel({
  onCreateQuestion,
  onImportStudents,
  onReviewStudents,
  onConfigureProfile,
  className = '',
  mobile = false,
}: {
  onCreateQuestion: () => void
  onImportStudents: () => void
  onReviewStudents: () => void
  onConfigureProfile: () => void
  className?: string
  mobile?: boolean
}) {
  const { tokens } = useAppTheme()
  const actions = [
    { label: 'Crear pregunta', detail: 'Añade contenido al banco docente', icon: 'add-circle-outline' as const, color: tokens.brand.teacher, onPress: onCreateQuestion },
    { label: 'Importar alumnos', detail: 'Incorpora una clase desde CSV', icon: 'cloud-upload-outline' as const, color: tokens.semantic.info, onPress: onImportStudents },
    { label: 'Revisar alumnos', detail: 'Prioriza quién necesita apoyo', icon: 'people-outline' as const, color: tokens.semantic.success, onPress: onReviewStudents },
    { label: 'Configurar perfil', detail: 'Actualiza datos y preferencias', icon: 'settings-outline' as const, color: tokens.semantic.warning, onPress: onConfigureProfile },
  ]

  return (
    <View className={`rounded-2xl border border-border-default bg-surface-default ${mobile ? 'p-4' : 'p-5'} ${className}`}>
      <Text className={`${mobile ? 'text-[20px]' : 'text-[22px]'} font-black text-text-primary`}>Accesos docentes</Text>
      <Text className="mt-1 text-[13px] leading-5 text-text-muted">Acciones frecuentes para preparar contenido y acompañar al alumnado.</Text>
      <View className="mt-4 flex-row flex-wrap gap-3">
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={action.detail}
            onPress={action.onPress}
            className={`${mobile ? 'min-w-[145px]' : 'min-w-[220px]'} flex-1 flex-row items-center gap-3 rounded-xl border border-border-default bg-surface-raised p-3`}
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${action.color}24` }}>
              <Ionicons name={action.icon} size={21} color={action.color} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-black text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>{action.label}</Text>
              <Text className="mt-1 text-[11px] leading-4 text-text-muted" numberOfLines={2}>{action.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={tokens.text.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function TeacherImpactPanel({
  stats,
  onClasses,
  onStudents,
  onQuestions,
}: {
  stats: TeacherProfileStats
  onClasses: () => void
  onStudents: () => void
  onQuestions: () => void
}) {
  const { tokens } = useAppTheme()

  return (
    <View className="flex-[1.5] rounded-2xl border border-border-default bg-surface-default p-5">
      <View className="mb-4 flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <Text className="text-[22px] font-black text-text-primary">Impacto docente</Text>
          <Text className="mt-1 text-[13px] leading-5 text-text-muted">
            Indicadores clave sobre alcance, contenido y participación de tus clases.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver alumnos"
          accessibilityHint="Abre el listado de alumnos"
          onPress={onStudents}
          className="min-h-11 flex-row items-center gap-2 rounded-xl bg-brand-teacher px-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="people-outline" size={17} color={tokens.text.inverse} />
          <Text className="text-[13px] font-black text-text-inverse">Ver alumnos</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-4">
        <MetricTile
          label="Alumnos activos"
          value={String(stats.activeStudents)}
          detail="Con inscripción"
          icon="people"
          color={tokens.semantic.success}
          onPress={onStudents}
        />
        <MetricTile
          label="Cursos activos"
          value={String(stats.activeClasses)}
          detail="En marcha"
          icon="book"
          color={tokens.brand.teacher}
          onPress={onClasses}
        />
        <MetricTile
          label="Preguntas creadas"
          value={String(stats.questionsCreated)}
          detail="Banco docente"
          icon="clipboard"
          color={tokens.semantic.info}
          onPress={onQuestions}
        />
        <MetricTile
          label="Participación media"
          value={`${stats.averageParticipation}%`}
          detail="Alumnos con progreso"
          icon="analytics"
          color={tokens.gamification.xp}
          onPress={onStudents}
        />
      </View>
    </View>
  )
}

function MobileTeacherImpactCard({
  stats,
  onClasses,
  onStudents,
  onQuestions,
}: {
  stats: TeacherProfileStats
  onClasses: () => void
  onStudents: () => void
  onQuestions: () => void
}) {
  const { tokens } = useAppTheme()

  return (
    <View className="mt-5 rounded-2xl border border-border-default bg-surface-default p-5">
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-3">
            <Ionicons name="analytics-outline" size={27} color={tokens.brand.teacher} />
            <Text className="min-w-0 flex-1 text-[23px] font-black text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>Impacto docente</Text>
          </View>
          <Text className="mt-2 text-[14px] leading-5 text-text-secondary">
            Tus métricas principales como profesor.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver alumnos"
          accessibilityHint="Abre el listado de alumnos"
          onPress={onStudents}
          className="min-h-11 flex-row items-center rounded-2xl bg-brand-teacher px-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Text className="text-[13px] font-black text-text-inverse">Alumnos</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <MobileTeacherProfileMetric
          title="Alumnos activos"
          value={String(stats.activeStudents)}
          detail="Con inscripción"
          icon="people"
          color={tokens.semantic.success}
          onPress={onStudents}
        />
        <MobileTeacherProfileMetric
          title="Cursos activos"
          value={String(stats.activeClasses)}
          detail="En marcha"
          icon="book"
          color={tokens.brand.teacher}
          onPress={onClasses}
        />
        <MobileTeacherProfileMetric
          title="Preguntas"
          value={String(stats.questionsCreated)}
          detail="Creadas"
          icon="clipboard"
          color={tokens.semantic.info}
          onPress={onQuestions}
        />
        <MobileTeacherProfileMetric
          title="Participación"
          value={`${stats.averageParticipation}%`}
          detail="Media"
          icon="analytics"
          color={tokens.gamification.xp}
          onPress={onStudents}
        />
      </View>
    </View>
  )
}

function MobileTeacherProfileMetric({
  title,
  detail,
  color,
  icon,
  value,
  onPress
}: {
  title: string
  detail: string
  color: string
  icon: keyof typeof Ionicons.glyphMap
  value: string
  onPress: () => void
}) {
  return (
    <MobileMetricCard
      className="min-h-[116px] flex-1"
      title={title}
      detail={detail}
      color={color}
      compact
      icon={icon}
      value={value}
      onPress={onPress}
      style={{ minWidth: 138 }}
    />
  )
}

function MobileTeacherInfoCard({
  email,
  memberSince,
  onEditProfile,
  onSecurity,
}: {
  email: string
  memberSince: string
  onEditProfile: () => void
  onSecurity: () => void
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="mt-5 rounded-2xl border border-border-default bg-surface-default p-5">
      <View className="mb-4 flex-row items-center gap-3">
        <Ionicons name="person-outline" size={24} color={tokens.brand.teacher} />
        <Text className="text-[22px] font-black text-text-primary">Información del profesor</Text>
      </View>

      <View className="gap-0">
        <MobileInfoRow icon="mail-outline" label="Correo electrónico" value={email} />
        <MobileInfoRow icon="shield-checkmark-outline" label="Rol" value="Profesor" />
        <MobileInfoRow icon="calendar-outline" label="Miembro desde" value={memberSince} />
      </View>

      <View className="mt-4 flex-row gap-3">
        <MobileProfileAction icon="create-outline" label="Editar perfil" onPress={onEditProfile} />
        <MobileProfileAction icon="lock-closed-outline" label="Gestionar seguridad" onPress={onSecurity} />
      </View>
    </View>
  )
}

function MobileInfoRow({
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
    <View className="flex-row items-center gap-4 border-t border-border-default px-2 py-4">
      <Ionicons name={icon} size={24} color={tokens.text.secondary} />
      <Text className="min-w-0 flex-1 text-[16px] text-text-secondary">{label}</Text>
      <Text className="max-w-[52%] text-right text-[16px] text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>{value}</Text>
    </View>
  )
}

function MobileProfileAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  const { tokens } = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre esta acción del perfil"
      onPress={onPress}
      className="min-h-16 min-w-0 flex-1 flex-row items-center rounded-2xl border border-border-default bg-surface-default px-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <Ionicons name={icon} size={25} color={tokens.brand.teacher} />
      <Text className="ml-3 min-w-0 flex-1 text-[16px] font-black text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>{label}</Text>
      <Ionicons name="chevron-forward" size={22} color={tokens.text.secondary} />
    </Pressable>
  )
}

function MobileRecentSubjectsCard({
  subjects,
  onOpenSubject,
  onViewAll,
}: {
  subjects: TeacherSubject[]
  onOpenSubject: (subjectId: number) => void
  onViewAll: () => void
}) {
  const { tokens } = useAppTheme()
  return (
    <MobileProfileSection
      icon="school-outline"
      title="Clases recientes"
      actionLabel="Ver todas"
      onAction={onViewAll}
    >
      <View style={{ gap: 8 }}>
        {subjects.length > 0 ? (
          subjects.slice(0, 3).map((subject) => (
            <Pressable
              key={subject.id}
              accessibilityRole="link"
              accessibilityLabel={`Abrir curso ${subject.name}`}
              accessibilityHint={`Código ${subject.code}. Abre el detalle del curso`}
              onPress={() => onOpenSubject(subject.id)}
              className="min-h-[68px] flex-row items-center rounded-2xl bg-surface-raised px-3 py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
            >
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface-interactive">
                <Text className="text-[22px]">{subject.icon || '📘'}</Text>
              </View>
              <View className="ml-3 min-w-0 flex-1">
                <Text className="text-[15px] font-black text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>{subject.name}</Text>
                <Text className="mt-1 text-[13px] text-text-secondary" numberOfLines={2} maxFontSizeMultiplier={2}>Código: {subject.code}</Text>
              </View>
              <Text className="mr-2 text-[12px] text-text-secondary">{formatRelativeDate(subject.created_at)}</Text>
              <Ionicons name="chevron-forward" size={22} color={tokens.text.secondary} />
            </Pressable>
          ))
        ) : (
          <EmptyState icon="book-outline" message="Todavía no has creado ninguna clase." />
        )}
      </View>
    </MobileProfileSection>
  )
}

function MobileRecentQuestionsCard({
  questions,
  onViewAll,
}: {
  questions: Question[]
  onViewAll: () => void
}) {
  const { tokens } = useAppTheme()
  return (
    <MobileProfileSection
      icon="help-circle-outline"
      title="Preguntas recientes"
      actionLabel="Ver todas"
      onAction={onViewAll}
    >
      <View style={{ gap: 8 }}>
        {questions.length > 0 ? (
          questions.slice(0, 3).map((question) => (
            <View key={question.id} className="min-h-[68px] flex-row items-center rounded-2xl bg-surface-raised px-3 py-3">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface-selected">
                <Ionicons name="help-circle-outline" size={24} color={tokens.brand.teacher} />
              </View>
              <View className="ml-3 min-w-0 flex-1">
                <Text className="text-[15px] font-black text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>{question.text}</Text>
                <Text className="mt-1 text-[13px] text-text-secondary" numberOfLines={2} maxFontSizeMultiplier={2}>{getSubjectName(question.subjects)}</Text>
              </View>
              <Text className="mr-2 text-[12px] text-text-secondary">{formatRelativeDate(question.created_at)}</Text>
              <Ionicons name="chevron-forward" size={22} color={tokens.text.secondary} />
            </View>
          ))
        ) : (
          <EmptyState icon="help-circle-outline" message="Todavía no has creado preguntas." />
        )}
      </View>
    </MobileProfileSection>
  )
}

function MobileProfileSection({
  icon,
  title,
  actionLabel,
  onAction,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  actionLabel: string
  onAction: () => void
  children: React.ReactNode
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="mt-5 rounded-2xl border border-border-default bg-surface-default p-5">
      <View className="mb-4 flex-row items-center gap-3">
        <Ionicons name={icon} size={29} color={tokens.brand.teacher} />
        <Text className="min-w-0 flex-1 text-[22px] font-black text-text-primary">{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${title}`}
          accessibilityHint="Abre la lista completa"
          onPress={onAction}
          className="flex-row items-center gap-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
        >
          <Text className="text-[16px] font-black text-brand-teacher">{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={21} color={tokens.brand.teacher} />
        </Pressable>
      </View>
      {children}
    </View>
  )
}

function TeacherHero({
  alias,
  email,
  avatar,
  uploading,
  onPickImage,
}: {
  alias: string
  email: string
  avatar?: string | null
  uploading: boolean
  onPickImage: () => void
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-border-default bg-surface-default p-7">
      <View className="absolute inset-0 bg-surface-default" />
      <View className="absolute bottom-[-28px] left-0 h-28 w-44 rounded-full bg-background-secondary" />
      <View className="absolute right-6 top-6 h-20 w-20 rounded-full bg-surface-selected" />
      <View
        className="absolute right-2 top-10 h-8 w-28 rounded-full border border-border-active"
        style={{ transform: [{ rotate: '-18deg' }] }}
      />

      <View className="relative flex-row items-center gap-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uploading ? 'Subiendo imagen de perfil' : 'Cambiar imagen de perfil'}
          accessibilityHint="Abre el selector de imágenes"
          accessibilityState={{ disabled: uploading, busy: uploading }}
          onPress={onPickImage}
          disabled={uploading}
          className="h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-border-active bg-surface-selected"
        >
          {avatar && avatar.startsWith('http') ? (
            <Image source={{ uri: avatar }} className="h-full w-full" />
          ) : (
            <Text className="text-[34px] font-black text-text-primary">{getInitials(alias)}</Text>
          )}

          <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full bg-brand-teacher">
            {uploading ? (
              <ActivityIndicator size="small" color={tokens.text.inverse} />
            ) : (
              <Ionicons name="camera" size={16} color={tokens.text.inverse} />
            )}
          </View>
        </Pressable>

        <View className="min-w-0 flex-1">
          <Text className="text-[28px] font-black text-text-primary" numberOfLines={2} maxFontSizeMultiplier={2}>
            {alias}
          </Text>

          <Text className="mt-1 text-[14px] text-text-secondary">
            Profesor
          </Text>

          <Text className="mt-2 text-[13px] text-text-muted" numberOfLines={2} maxFontSizeMultiplier={2}>
            {email}
          </Text>

          <View className="mt-4 w-[112px] flex-row items-center justify-center gap-1 rounded-md bg-brand-teacher px-3 py-1.5">
            <Ionicons name="school-outline" size={13} color={tokens.text.inverse} />
            <Text className="text-[13px] font-bold text-text-inverse">Docente</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function MetricTile({
  icon,
  label,
  value,
  color,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  color: string
  detail?: string
  onPress?: () => void
}) {
  return (
    <MobileMetricCard
      className="min-w-[180px] flex-1"
      color={color}
      icon={icon}
      label={label}
      value={value}
      detail={detail}
      onPress={onPress}
    />
  )
}

function ProfileCard({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  const { tokens } = useAppTheme()
  return (
    <View className={`rounded-2xl border border-border-default bg-surface-default p-5 ${className}`}>
      <Text className="mb-4 text-[17px] font-black text-text-primary">
        {title}
      </Text>

      {children}
    </View>
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
    <View className="flex-row items-center gap-4 border-b border-border-subtle py-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-interactive">
        <Ionicons name={icon} size={18} color={tokens.text.muted} />
      </View>

      <View className="min-w-0 flex-1">
        <Text className="text-[13px] text-text-muted">
          {label}
        </Text>

        <Text className="mt-1 text-[13px] text-text-secondary" numberOfLines={2} maxFontSizeMultiplier={2}>
          {value}
        </Text>
      </View>
    </View>
  )
}

function EmptyState({
  icon,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap
  message: string
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="items-center rounded-xl border border-dashed border-border-default bg-surface-raised px-4 py-6">
      <Ionicons name={icon} size={24} color={tokens.text.muted} />
      <Text className="mt-2 text-center text-[13px] text-text-muted">
        {message}
      </Text>
    </View>
  )
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2)
  const initials = parts.map((part) => part[0]?.toUpperCase()).join('')

  return initials || 'P'
}

function getSubjectName(value: Question['subjects']) {
  if (Array.isArray(value)) {
    return value[0]?.name || 'Clase'
  }

  return value?.name || 'Clase'
}
