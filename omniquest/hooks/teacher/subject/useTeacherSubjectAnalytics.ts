import { useCallback } from 'react'
import { callTeacherRpc, type TeacherSubjectAnalyticsPayload } from '../../../lib/teacherServerData'
import { useTeacherSubjectResource } from './useTeacherSubjectResource'

const EMPTY: TeacherSubjectAnalyticsPayload = {
  items: [], total: 0, limit: 200, offset: 0,
  summary: {
    enrolled: 0, answered: 0, participation: 0, averageGrade: 0, averageAccuracy: 0,
    failedAnswers: 0, correctAnswers: 0, averageXp: 0, questionsCount: 0, activeThisWeek: 0, unassessed: 0, generatedXp: 0, playedSessionsTotal: 0, bestStudent: null, attention: [],
  },
  gradeDistribution: [],
  failedQuestions: [],
  temporalEvolution: [],
}

export function useTeacherSubjectAnalytics({ subjectId, classroomId, enabled }: {
  subjectId: number
  classroomId: number | null
  enabled: boolean
}) {
  const loader = useCallback(() => callTeacherRpc<TeacherSubjectAnalyticsPayload>('get_teacher_subject_analytics', {
    p_subject_id: subjectId,
    p_classroom_id: classroomId,
  }), [classroomId, subjectId])

  return useTeacherSubjectResource({ enabled: enabled && Boolean(classroomId), initialValue: EMPTY, loader })
}
