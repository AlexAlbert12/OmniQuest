import React from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import StudentPageHeader from '../StudentPageHeader'
import { withAlpha } from '../../../lib/color'
import { useAppTheme } from '../../../lib/appTheme'
import type { StudentCourseClassroom, StudentCourseSubject, StudentCourseTotals } from './types'
import { normalizeAcademicIcon } from '../../../lib/academicIcons'

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
  const iconName = normalizeAcademicIcon(subject.icon, 'book-outline')

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
        <View
          className={`${isDesktop ? 'h-14 w-14' : 'h-12 w-12'} items-center justify-center rounded-2xl`}
          style={{ backgroundColor: withAlpha(color, '24') }}
        >
          <Ionicons name={iconName} size={isDesktop ? 27 : 23} color={color} />
        </View>
      )}
    />
  )
}
