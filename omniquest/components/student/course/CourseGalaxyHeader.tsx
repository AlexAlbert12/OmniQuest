import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import StudentPageHeader from '../StudentPageHeader'
import { withAlpha } from '../../../lib/color'
import { useAppTheme } from '../../../lib/appTheme'
import type { StudentCourseClassroom, StudentCourseSubject, StudentCourseTotals } from './types'

export default function CourseGalaxyHeader({
  subject,
  classroom,
  totals,
  isDesktop,
  onBack,
}: {
  subject: StudentCourseSubject
  classroom: StudentCourseClassroom | null
  totals: StudentCourseTotals
  isDesktop: boolean
  onBack: () => void
}) {
  const { tokens } = useAppTheme()
  const color = subject.theme_color || tokens.brand.student
  const iconName = getValidIoniconName(subject.icon)

  return (
    <StudentPageHeader
      backAction={{ label: 'Mis cursos', onPress: onBack }}
      isDesktop={isDesktop}
      title={subject.name}
      subtitle={`${totals.progress}% avance  ·  ${totals.failed} ${totals.failed === 1 ? 'fallo pendiente' : 'fallos pendientes'}${classroom ? `  ·  ${classroom.name}` : ''}`}
      titleNumberOfLines={2}
      showNotifications={isDesktop}
      showAvatar={isDesktop}
      leading={(
        <View className={isDesktop ? 'h-20 w-20' : 'h-16 w-16'}>
          <View className="absolute -inset-1 rounded-full bg-surface-disabled" />
          <LinearGradient
            colors={[withAlpha(color, 'FF'), tokens.gamification.xp, withAlpha(color, '99')]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="h-full w-full items-center justify-center rounded-full border-4"
            style={{ borderColor: withAlpha(color, 'CC') }}
          >
            {subject.icon ? (
              iconName ? (
                <Ionicons name={iconName} size={isDesktop ? 34 : 28} color={tokens.text.inverse} />
              ) : (
                <Text className={isDesktop ? 'text-[32px]' : 'text-[26px]'}>{subject.icon}</Text>
              )
            ) : (
              <Ionicons name="book" size={isDesktop ? 34 : 28} color={tokens.text.inverse} />
            )}
          </LinearGradient>
        </View>
      )}
    />
  )
}

function getValidIoniconName(icon: string | null | undefined): keyof typeof Ionicons.glyphMap | null {
  if (!icon) return null
  return icon in Ionicons.glyphMap ? icon as keyof typeof Ionicons.glyphMap : null
}
