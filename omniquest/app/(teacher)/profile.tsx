import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { withAlpha } from '../../lib/color'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import BrandLogo from '../../components/BrandLogo'
import NotificationBadge from '../../components/NotificationBadge'
import TeacherHeaderAvatar from '../../components/teacher/TeacherHeaderAvatar'
import { formatLongDate, formatRelativeDate } from '../../lib/dateFormat'

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

export default function TeacherProfileScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()

  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [email, setEmail] = useState('')
  const [subjects, setSubjects] = useState<TeacherSubject[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [scores, setScores] = useState<SubjectScore[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const isDesktop = width >= 1024

  const stats = useMemo(() => {
    const uniqueStudents = new Set(
      enrollments
        .map((enrollment) => enrollment.student_id)
        .filter((value): value is string => Boolean(value))
    )

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

    const participation = enrollmentPairs.size > 0
      ? Math.round((scorePairs.size / enrollmentPairs.size) * 100)
      : 0

    return {
      activeClasses: subjects.length,
      uniqueStudents: uniqueStudents.size,
      questionsCreated: questions.length,
      averageParticipation: participation,
    }
  }, [subjects, enrollments, scores, questions])

  const recentSubjects = subjects.slice(0, 4)
  const recentQuestions = questions.slice(0, 5)
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
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir una foto de perfil.')
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

      if (Platform.OS === 'web') {
        window.alert('Foto de perfil actualizada.')
      } else {
        Alert.alert('Éxito', 'Foto de perfil actualizada.')
      }
    } catch (error: any) {
      console.error('Error subiendo avatar:', error.message)

      if (Platform.OS === 'web') {
        window.alert('No se pudo subir la imagen.')
      } else {
        Alert.alert('Error', 'No se pudo subir la imagen.')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando perfil del profesor...</Text>
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
        onNotifications={() => router.push('/(teacher)/notifications' as any)}
        onEditProfile={() => router.push('/(teacher)/settings?section=profile' as any)}
        onSecurity={() => router.push('/(teacher)/security' as any)}
        onClasses={() => router.push('/(teacher)/classes' as any)}
        onStudents={() => router.push('/(teacher)/students' as any)}
        onQuestions={() => router.push('/(teacher)/classes' as any)}
        onOpenSubject={(subjectId) => router.push(`/(teacher)/subject/${subjectId}` as any)}
      />
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            activeSection="profile"
            subjectsCount={stats.activeClasses}
            alias={profile?.alias}
            avatar={profile?.avatar}
            onSignOut={handleSignOut}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 22 : 18,
            paddingBottom: isDesktop ? 36 : 112,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              {!isDesktop ? (
                <BrandLogo size={30} style={{ marginBottom: 12 }} />
              ) : null}

              <View className="flex-row items-center gap-3">
                <Ionicons name="person" size={40} color="#9FD6FF" />
                <Text className="text-[40px] font-black text-white">Perfil</Text>
              </View>

              <Text className="mt-1 text-[13px] text-[#9BAEC9]">
                Gestiona tu información docente y revisa tu actividad de clases.
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <NotificationBadge audience="teacher" />
            </View>
          </View>

          <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
            <TeacherHero
              alias={alias}
              email={email}
              avatar={profile?.avatar}
              uploading={uploading}
              onPickImage={pickImage}
            />

            <View className={isDesktop ? 'flex-[1.5] flex-row gap-4' : 'flex-row flex-wrap gap-4'}>
              <MetricTile
                title="Cursos activos"
                value={String(stats.activeClasses)}
                icon="book"
                color="#8B5CF6"
                onPress={() => router.push('/(teacher)/classes' as any)}
              />

              <MetricTile
                title="Estudiantes únicos"
                value={String(stats.uniqueStudents)}
                icon="people"
                color="#43D991"
                onPress={() => router.push('/(teacher)/students' as any)}
              />

              <MetricTile
                title="Preguntas creadas"
                value={String(stats.questionsCreated)}
                icon="clipboard"
                color="#3B82F6"
                onPress={() => router.push('/(teacher)/classes' as any)}
              />

              <MetricTile
                title="Participación media"
                value={`${stats.averageParticipation}%`}
                icon="analytics"
                color="#F6A64A"
                onPress={() => router.push('/(teacher)/students' as any)}
              />
            </View>
          </View>

          <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
            <ProfileCard title="Información del profesor" className={isDesktop ? 'flex-1' : ''}>
              <InfoRow icon="mail-outline" label="Correo electrónico" value={email || 'Sin correo'} />
              <InfoRow icon="shield-checkmark-outline" label="Rol" value="Profesor" />
              <InfoRow icon="calendar-outline" label="Miembro desde" value={memberSince} />

              <Pressable
                onPress={() => router.push('/(teacher)/settings?section=profile' as any)}
                className="mt-4 flex-row items-center gap-2 border-t border-[#172A4A] pt-4"
              >
                <Ionicons name="create-outline" size={18} color="#9B6CFF" />
                <Text className="font-bold text-[#9B6CFF]">Editar perfil</Text>
                <Ionicons name="arrow-forward" size={16} color="#9B6CFF" />
              </Pressable>

              <Pressable
                onPress={() => router.push('/(teacher)/security' as any)}
                className="mt-3 flex-row items-center gap-2"
              >
                <Ionicons name="lock-closed-outline" size={18} color="#9B6CFF" />
                <Text className="font-bold text-[#9B6CFF]">Gestionar seguridad</Text>
                <Ionicons name="arrow-forward" size={16} color="#9B6CFF" />
              </Pressable>
            </ProfileCard>

            <ProfileCard title="Últimas clases creadas" className={isDesktop ? 'flex-1' : ''}>
              <View style={{ gap: 12 }}>
                {recentSubjects.length > 0 ? (
                  recentSubjects.map((subject) => (
                    <Pressable
                      key={subject.id}
                      onPress={() => router.push(`/(teacher)/subject/${subject.id}` as any)}
                      className="flex-row items-center gap-3 rounded-xl bg-[#0D1D3B] p-3"
                    >
                      <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#1B2460]">
                        <Text className="text-[24px]">{subject.icon || '📘'}</Text>
                      </View>

                      <View className="min-w-0 flex-1">
                        <Text className="font-black text-white" numberOfLines={1}>
                          {subject.name}
                        </Text>
                        <Text className="mt-1 text-[12px] text-[#8FA7C7]">
                          Código: {subject.code}
                        </Text>
                      </View>

                      <Text className="text-[12px] text-[#8FA7C7]">
                        {formatRelativeDate(subject.created_at)}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <EmptyState icon="book-outline" message="Todavía no has creado ninguna clase." />
                )}
              </View>
            </ProfileCard>

            <ProfileCard title="Últimas preguntas creadas" className={isDesktop ? 'flex-1' : ''}>
              <View style={{ gap: 12 }}>
                {recentQuestions.length > 0 ? (
                  recentQuestions.map((question) => (
                    <View key={question.id} className="flex-row items-center gap-3 rounded-xl bg-[#0D1D3B] p-3">
                      <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#162B50]">
                        <Ionicons name="help-circle-outline" size={22} color="#9B6CFF" />
                      </View>

                      <View className="min-w-0 flex-1">
                        <Text className="font-bold text-white" numberOfLines={1}>
                          {question.text}
                        </Text>
                        <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>
                          {getSubjectName(question.subjects)}
                        </Text>
                      </View>

                      <Text className="text-[12px] text-[#8FA7C7]">
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
        </ScrollView>
      </View>
      {!isDesktop ? <TeacherBottomNav active="profile" /> : null}
    </View>
  )
}

type TeacherProfileStats = {
  activeClasses: number
  uniqueStudents: number
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
  onOpenSubject,
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
  onOpenSubject: (subjectId: number) => void
}) {
  return (
    <View className="flex-1 bg-[#020B1B]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 22, paddingBottom: 124 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-7 flex-row items-center justify-between">
          <BrandLogo size={32} />
          <View className="flex-row items-center gap-3">
            <NotificationBadge audience="teacher" onPress={onNotifications} />
            <TeacherHeaderAvatar />
          </View>
        </View>

        <View className="mb-7">
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#6D47F6] shadow-lg shadow-[#6D47F6]/30">
              <Ionicons name="person" size={32} color="#F4F0FF" />
            </View>
            <Text className="min-w-0 flex-1 text-[42px] font-black leading-[48px] text-white" numberOfLines={1}>
              Mi Perfil
            </Text>
          </View>
          <Text className="mt-4 max-w-[390px] text-[17px] leading-7 text-[#C2D0E5]">
            Gestiona tu información docente y revisa tu actividad en la plataforma.
          </Text>
        </View>

        <MobileTeacherProfileHero
          alias={alias}
          email={email}
          avatar={avatar}
          uploading={uploading}
          onPickImage={onPickImage}
        />

        <View className="mt-5 flex-row flex-wrap gap-3">
          <MobileTeacherProfileMetric
            title="Cursos activos"
            value={String(stats.activeClasses)}
            detail="Cursos en marcha"
            icon="book"
            color="#8B5CF6"
            onPress={onClasses}
          />
          <MobileTeacherProfileMetric
            title="Estudiantes únicos"
            value={String(stats.uniqueStudents)}
            detail="Total en tus clases"
            icon="people"
            color="#43D991"
            onPress={onStudents}
          />
          <MobileTeacherProfileMetric
            title="Preguntas creadas"
            value={String(stats.questionsCreated)}
            detail="En todos tus cursos"
            icon="clipboard"
            color="#3B82F6"
            onPress={onQuestions}
          />
          <MobileTeacherProfileMetric
            title="Participación media"
            value={`${stats.averageParticipation}%`}
            detail="Promedio general"
            icon="analytics"
            color="#F6A64A"
            onPress={onStudents}
          />
        </View>

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
  return (
    <LinearGradient
      colors={['#1F1A68', '#0B1D46']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="overflow-hidden rounded-2xl border border-[#2F47A0] p-6"
    >
      <View className="absolute right-[-30px] top-[-34px] h-40 w-44 rotate-12 rounded-[36px] bg-[#6D47F6]/35" />
      <View className="absolute bottom-[-46px] left-[-24px] h-28 w-52 -rotate-12 rounded-[28px] bg-[#061B43]/70" />

      <View className="relative flex-row items-center gap-5">
        <Pressable
          onPress={onPickImage}
          disabled={uploading}
          className="h-36 w-36 items-center justify-center rounded-full border-[6px] border-[#7C5CFF] bg-white"
          style={({ pressed }) => ({ opacity: uploading ? 0.7 : pressed ? 0.86 : 1 })}
        >
          <View className="h-[118px] w-[118px] overflow-hidden rounded-full bg-[#EDF4FF]">
            {avatar && avatar.startsWith('http') ? (
              <Image source={{ uri: avatar }} className="h-full w-full" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-[38px] font-black text-[#061126]">{getInitials(alias)}</Text>
              </View>
            )}
          </View>

          <View className="absolute bottom-2 right-0 h-12 w-12 items-center justify-center rounded-full bg-[#8B5CF6]">
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="camera" size={22} color="#FFFFFF" />
            )}
          </View>
        </Pressable>

        <View className="min-w-0 flex-1">
          <Text className="text-[31px] font-black text-white" numberOfLines={1}>{alias}</Text>
          <Text className="mt-2 text-[18px] font-black text-[#B175FF]">Profesor</Text>
          <Text className="mt-2 text-[16px] leading-6 text-[#D7E3F7]" numberOfLines={2}>{email || 'Sin correo'}</Text>

          <View className="mt-5 self-start flex-row items-center gap-2 rounded-xl bg-[#8B5CF6] px-4 py-3">
            <Ionicons name="shield-checkmark-outline" size={19} color="#FFFFFF" />
            <Text className="text-[16px] font-black text-white">Docente</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  )
}

function MobileTeacherProfileMetric({
  title,
  value,
  detail,
  icon,
  color,
  onPress,
}: {
  title: string
  value: string
  detail: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[132px] flex-1 basis-[47%] rounded-2xl border p-4"
      style={({ pressed }) => ({
        opacity: pressed ? 0.84 : 1,
        borderColor: withAlpha(color, '66'),
        backgroundColor: '#07162C',
      })}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(color, '30') }}>
          <Ionicons name={icon} size={29} color={color} />
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, '26') }}>
          <Ionicons name="arrow-forward" size={21} color={color} />
        </View>
      </View>
      <Text className="mt-4 text-[16px] leading-5 text-[#DDE7F4]" numberOfLines={2}>{title}</Text>
      <Text className="mt-2 text-[34px] font-black text-white">{value}</Text>
      <Text className="mt-1 text-[14px] text-[#B8C6DC]" numberOfLines={1}>{detail}</Text>
    </Pressable>
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
  return (
    <View className="mt-5 rounded-2xl border border-[#1D3760] bg-[#07162C] p-5">
      <View className="mb-4 flex-row items-center gap-3">
        <Ionicons name="person-outline" size={28} color="#9B6CFF" />
        <Text className="text-[22px] font-black text-white">Información del profesor</Text>
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
  return (
    <View className="flex-row items-center gap-4 border-t border-[#17345C] px-2 py-4">
      <Ionicons name={icon} size={24} color="#C4D2E8" />
      <Text className="min-w-0 flex-1 text-[16px] text-[#DDE7F4]">{label}</Text>
      <Text className="max-w-[52%] text-right text-[16px] text-white" numberOfLines={1}>{value}</Text>
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
  return (
    <Pressable
      onPress={onPress}
      className="h-16 min-w-0 flex-1 flex-row items-center rounded-2xl border border-[#25446F] bg-[#07162C] px-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <Ionicons name={icon} size={25} color="#9B6CFF" />
      <Text className="ml-3 min-w-0 flex-1 text-[16px] font-black text-white" numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-forward" size={22} color="#C4D2E8" />
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
  return (
    <MobileProfileSection
      icon="school-outline"
      title="Últimas clases creadas"
      actionLabel="Ver todas"
      onAction={onViewAll}
    >
      <View style={{ gap: 8 }}>
        {subjects.length > 0 ? (
          subjects.slice(0, 3).map((subject) => (
            <Pressable
              key={subject.id}
              onPress={() => onOpenSubject(subject.id)}
              className="h-20 flex-row items-center rounded-2xl bg-[#0A1D37] px-4"
              style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
            >
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#102B53]">
                <Text className="text-[27px]">{subject.icon || '📘'}</Text>
              </View>
              <View className="ml-4 min-w-0 flex-1">
                <Text className="text-[17px] font-black text-white" numberOfLines={1}>{subject.name}</Text>
                <Text className="mt-1 text-[15px] text-[#B8C6DC]" numberOfLines={1}>Código: {subject.code}</Text>
              </View>
              <Text className="mr-3 text-[14px] text-[#C4D2E8]">{formatRelativeDate(subject.created_at)}</Text>
              <Ionicons name="chevron-forward" size={22} color="#C4D2E8" />
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
  return (
    <MobileProfileSection
      icon="help-circle-outline"
      title="Últimas preguntas creadas"
      actionLabel="Ver todas"
      onAction={onViewAll}
    >
      <View style={{ gap: 8 }}>
        {questions.length > 0 ? (
          questions.slice(0, 3).map((question) => (
            <View key={question.id} className="h-20 flex-row items-center rounded-2xl bg-[#0A1D37] px-4">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#2B1F62]">
                <Ionicons name="help-circle-outline" size={28} color="#9B6CFF" />
              </View>
              <View className="ml-4 min-w-0 flex-1">
                <Text className="text-[17px] font-black text-white" numberOfLines={1}>{question.text}</Text>
                <Text className="mt-1 text-[15px] text-[#B8C6DC]" numberOfLines={1}>{getSubjectName(question.subjects)}</Text>
              </View>
              <Text className="mr-3 text-[14px] text-[#C4D2E8]">{formatRelativeDate(question.created_at)}</Text>
              <Ionicons name="chevron-forward" size={22} color="#C4D2E8" />
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
  return (
    <View className="mt-5 rounded-2xl border border-[#1D3760] bg-[#07162C] p-5">
      <View className="mb-4 flex-row items-center gap-3">
        <Ionicons name={icon} size={29} color="#9B6CFF" />
        <Text className="min-w-0 flex-1 text-[22px] font-black text-white">{title}</Text>
        <Pressable
          onPress={onAction}
          className="flex-row items-center gap-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
        >
          <Text className="text-[16px] font-black text-[#B175FF]">{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={21} color="#B175FF" />
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
  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-[#1C3762] bg-[#0B1B48] p-7">
      <View className="absolute inset-0 bg-[#0D1C55]" />
      <View className="absolute bottom-[-28px] left-0 h-28 w-44 rounded-full bg-[#061B43]" />
      <View className="absolute right-6 top-6 h-20 w-20 rounded-full bg-[#5135D8]/50" />
      <View
        className="absolute right-2 top-10 h-8 w-28 rounded-full border border-[#7B68FF]/45"
        style={{ transform: [{ rotate: '-18deg' }] }}
      />

      <View className="relative flex-row items-center gap-6">
        <Pressable
          onPress={onPickImage}
          disabled={uploading}
          className="h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-[#91B8FF] bg-[#192C62]"
        >
          {avatar && avatar.startsWith('http') ? (
            <Image source={{ uri: avatar }} className="h-full w-full" />
          ) : (
            <Text className="text-[34px] font-black text-white">{getInitials(alias)}</Text>
          )}

          <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full bg-[#7C5CFF]">
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            )}
          </View>
        </Pressable>

        <View className="min-w-0 flex-1">
          <Text className="text-[28px] font-black text-white" numberOfLines={1}>
            {alias}
          </Text>

          <Text className="mt-1 text-[14px] text-[#D4E2F6]">
            Profesor
          </Text>

          <Text className="mt-2 text-[13px] text-[#9BAEC9]" numberOfLines={1}>
            {email}
          </Text>

          <View className="mt-4 w-[112px] flex-row items-center justify-center gap-1 rounded-md bg-[#6D4DDB] px-3 py-1.5">
            <Ionicons name="school-outline" size={13} color="#FFFFFF" />
            <Text className="text-[13px] font-bold text-white">Docente</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function MetricTile({
  title,
  value,
  icon,
  color,
  onPress,
}: {
  title: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  onPress?: () => void
}) {
  const Container = onPress ? Pressable : View

  return (
    <Container
      onPress={onPress}
      className="min-w-[135px] flex-1 items-center border-r border-[#172A4A] bg-[#09162C] px-3 py-5 first:rounded-l-2xl last:rounded-r-2xl"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${color}24` }}>
        <Ionicons name={icon} size={28} color={color} />
      </View>

      <Text className="mt-3 text-center text-[13px] text-[#AFC2DB]">
        {title}
      </Text>

      <Text className="mt-2 text-[28px] font-black text-white">
        {value}
      </Text>
    </Container>
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
  return (
    <View className={`rounded-2xl border border-[#1C3762] bg-[#08182F] p-5 ${className}`}>
      <Text className="mb-4 text-[17px] font-black text-white">
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
  return (
    <View className="flex-row items-center gap-4 border-b border-[#172A4A] py-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#10213E]">
        <Ionicons name={icon} size={18} color="#9BAEC9" />
      </View>

      <View className="min-w-0 flex-1">
        <Text className="text-[13px] text-[#8FA7C7]">
          {label}
        </Text>

        <Text className="mt-1 text-[13px] text-[#DDE7F4]" numberOfLines={1}>
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
  return (
    <View className="items-center rounded-xl border border-dashed border-[#1A3155] bg-[#0D1D3B] px-4 py-6">
      <Ionicons name={icon} size={24} color="#8FA7C7" />
      <Text className="mt-2 text-center text-[13px] text-[#8FA7C7]">
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
