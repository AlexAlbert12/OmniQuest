import { useCallback, useEffect } from 'react'
import { callTeacherRpc, type TeacherSubjectOverview } from '../../../lib/teacherServerData'
import { useTeacherSubjectResource } from './useTeacherSubjectResource'

const EMPTY: TeacherSubjectOverview = {
  subject: {
    id: 0, name: '', description: null, icon: null, code: '', educationLevel: null,
    academicYear: null, subjectLabel: null, themeColor: null, createdAt: null,
  },
  classrooms: [],
  selectedClassroomId: 0,
  subjectsCount: 0,
  summary: {
    enrolledCount: 0, questionsCount: 0, totalAnswers: 0, correctAnswers: 0,
    answeredClassQuestions: 0, possibleClassQuestions: 0, activeStudents: 0, evaluatedStudents: 0, unassessedStudents: 0,
    averageXp: 0, averageAccuracy: 0, averageGrade: 0, participation: 0, progress: 0,
  },
  latestQuestion: null,
  gradeDistribution: [],
  recentActivity: [],
}

export function useTeacherSubjectOverview({ subjectId, classroomId, onResolvedClassroom }: {
  subjectId: number
  classroomId: number | null
  onResolvedClassroom: (classroomId: number) => void
}) {
  const loader = useCallback(() => callTeacherRpc<TeacherSubjectOverview>('get_teacher_subject_overview', {
    p_subject_id: subjectId,
    p_classroom_id: classroomId || undefined,
  }), [classroomId, subjectId])

  const resource = useTeacherSubjectResource({ enabled: Number.isFinite(subjectId) && subjectId > 0, initialValue: EMPTY, loader })

  useEffect(() => {
    if (resource.data.selectedClassroomId > 0 && resource.data.selectedClassroomId !== classroomId) {
      onResolvedClassroom(resource.data.selectedClassroomId)
    }
  }, [classroomId, onResolvedClassroom, resource.data.selectedClassroomId])

  return resource
}
