import type { TeacherClassroomRow, TeacherCourseRow } from '../../lib/teacherServerData'
import type { TeacherCatalogItem } from './types'

export function buildTeacherCourseItems(rows: TeacherCourseRow[]): TeacherCatalogItem[] {
  return rows.map((row) => ({
    kind: 'course',
    value: {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      code: row.code,
      theme_color: row.themeColor,
      created_at: row.createdAt,
      analytics: row.analytics,
    },
  }))
}

export function buildTeacherClassroomItems(rows: TeacherClassroomRow[]): TeacherCatalogItem[] {
  return rows.map((row) => ({
    kind: 'classroom',
    value: {
      id: row.classroom.id,
      subject_id: row.classroom.subjectId,
      name: row.classroom.name,
      code: row.classroom.code,
      academic_year: row.classroom.academicYear,
      created_at: row.classroom.createdAt,
      active: row.classroom.active,
      analytics: row.analytics,
      course: {
        id: row.course.id,
        name: row.course.name,
        description: row.course.description,
        icon: row.course.icon,
        code: row.course.code,
        theme_color: row.course.themeColor,
        created_at: row.course.createdAt,
      },
    },
  }))
}
