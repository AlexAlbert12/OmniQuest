import type { Ionicons } from '@expo/vector-icons'
import type { TeacherClassroom, TeacherClassroomAnalytics, TeacherCourse, TeacherCourseAnalytics } from '../../components/teacher/classes/types'

export type TeacherCourseFilter = 'all' | 'unconfigured' | 'no_activity' | 'in_progress' | 'completed'
export type TeacherCourseSort = 'recent' | 'name' | 'participation'
export type TeacherCatalogTab = 'courses' | 'classrooms'

export type TeacherCatalogCourseItem = TeacherCourse & { analytics: TeacherCourseAnalytics }
export type TeacherCatalogClassroomItem = TeacherClassroom & { analytics: TeacherClassroomAnalytics; course?: TeacherCourse }
export type TeacherCatalogItem =
  | { kind: 'course'; value: TeacherCatalogCourseItem }
  | { kind: 'classroom'; value: TeacherCatalogClassroomItem }

export const teacherCourseFilters: { key: TeacherCourseFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todos', icon: 'apps-outline' },
  { key: 'unconfigured', label: 'Sin configurar', icon: 'construct-outline' },
  { key: 'no_activity', label: 'Sin actividad', icon: 'pause-circle-outline' },
  { key: 'in_progress', label: 'En curso', icon: 'time-outline' },
  { key: 'completed', label: 'Completadas', icon: 'checkmark-done-outline' },
]

export const teacherCourseSorts: { key: TeacherCourseSort; label: string }[] = [
  { key: 'recent', label: 'Reciente' },
  { key: 'name', label: 'Nombre' },
  { key: 'participation', label: 'Participación' },
]
