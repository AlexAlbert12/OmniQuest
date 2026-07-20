import { supabase } from './supabase'
import { fetchStudentAttemptHistory, fetchStudentQuestionCatalog } from './studentSecureData'

export type StudentProgressSubject = {
  id: number
  classroomId: number | null
  classroomName: string | null
  classroomCode: string | null
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
  totalTopics: number
  completedTopics: number
  totalQuestions: number
  answeredQuestions: number
  pendingQuestions: number
  failedQuestions: number
  percent: number
  isCompleted: boolean
}

export type StudentProgressSummary = {
  subjects: StudentProgressSubject[]
  totalClasses: number
  completedClasses: number
  totalQuestions: number
  answeredQuestions: number
  totalAttempts: number
  correctAttempts: number
  accuracyPercent: number
  overallPercent: number
}

type EnrolledSubject = {
  id: number
  classroomId: number | null
  classroomName: string | null
  classroomCode: string | null
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

type SubjectRelation = {
  id: number
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

type ClassroomRelation = {
  id: number
  name: string
  code: string | null
}

type TopicRow = {
  id: number
  subject_id: number | null
  classroom_id?: number | null
  active?: boolean | null
}

type QuestionRow = {
  id: number
  subject_id: number | null
  classroom_id?: number | null
  topic_id?: number | null
  active?: boolean | null
}

export async function fetchStudentProgressSummary(userId: string): Promise<StudentProgressSummary> {
  const { data: enrollmentsData, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('classroom_id, subjects(id, name, description, icon, theme_color), classrooms(id, name, code)')
    .eq('student_id', userId)

  if (enrollmentsError) throw enrollmentsError

  const subjects = ((enrollmentsData || []) as unknown as {
    classroom_id?: number | null
    subjects?: SubjectRelation | SubjectRelation[] | null
    classrooms?: ClassroomRelation | ClassroomRelation[] | null
  }[])
    .map((enrollment) => {
      const subject = normalizeRelation(enrollment.subjects)
      if (!subject?.id) return null
      const classroom = normalizeRelation(enrollment.classrooms)
      return {
        id: subject.id,
        classroomId: Number(enrollment.classroom_id ?? classroom?.id ?? 0) || null,
        classroomName: classroom?.name ?? null,
        classroomCode: classroom?.code ?? null,
        name: subject.name,
        description: subject.description,
        icon: subject.icon,
        theme_color: subject.theme_color,
      } satisfies EnrolledSubject
    })
    .filter((subject): subject is EnrolledSubject => Boolean(subject?.id))

  const subjectIds = Array.from(new Set(subjects.map((subject) => subject.id)))
  if (subjectIds.length === 0) {
    return emptyStudentProgressSummary()
  }

  const [topicsResult, questionsData, attempts] = await Promise.all([
    supabase
      .from('subject_topics')
      .select('id, subject_id, classroom_id, active')
      .in('subject_id', subjectIds),
    fetchStudentQuestionCatalog(),
    fetchStudentAttemptHistory({ limit: 5000 }),
  ])

  if (topicsResult.error) throw topicsResult.error

  const topics = ((topicsResult.data || []) as TopicRow[]).filter((topic) => topic.active !== false)
  const questions = (questionsData as QuestionRow[]).filter((question) => question.active !== false)
  const answeredQuestionIds = new Set(
    attempts
      .map((attempt) => attempt.question_id ?? normalizeRelation(attempt.questions)?.id ?? null)
      .filter((questionId): questionId is number => typeof questionId === 'number')
  )
  const failedQuestionIds = new Set(
    attempts
      .filter((attempt) => attempt.is_correct === false)
      .map((attempt) => attempt.question_id ?? normalizeRelation(attempt.questions)?.id ?? null)
      .filter((questionId): questionId is number => typeof questionId === 'number')
  )

  const progressSubjects = subjects.map((subject) =>
    buildSubjectProgress(subject, topics, questions, answeredQuestionIds, failedQuestionIds)
  )
  const totalQuestions = progressSubjects.reduce((total, subject) => total + subject.totalQuestions, 0)
  const answeredQuestions = progressSubjects.reduce((total, subject) => total + subject.answeredQuestions, 0)
  const relevantQuestionIds = new Set(
    questions
      .filter((question) => subjects.some((subject) => question.subject_id === subject.id && matchesClassroom(question.classroom_id, subject.classroomId)))
      .map((question) => question.id)
  )
  const relevantAttempts = attempts.filter((attempt) => {
    const questionId = attempt.question_id ?? normalizeRelation(attempt.questions)?.id ?? null
    return typeof questionId === 'number' && relevantQuestionIds.has(questionId)
  })
  const totalAttempts = relevantAttempts.length
  const correctAttempts = relevantAttempts.filter((attempt) => attempt.is_correct === true).length
  const completedClasses = progressSubjects.filter((subject) => subject.isCompleted).length

  return {
    subjects: progressSubjects,
    totalClasses: progressSubjects.length,
    completedClasses,
    totalQuestions,
    answeredQuestions,
    totalAttempts,
    correctAttempts,
    accuracyPercent: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
    overallPercent: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0,
  }
}

function buildSubjectProgress(
  subject: EnrolledSubject,
  topics: TopicRow[],
  questions: QuestionRow[],
  answeredQuestionIds: Set<number>,
  failedQuestionIds: Set<number>
): StudentProgressSubject {
  const subjectTopics = topics.filter((topic) =>
    topic.subject_id === subject.id && matchesClassroom(topic.classroom_id, subject.classroomId)
  )
  const subjectQuestions = questions.filter((question) =>
    question.subject_id === subject.id && matchesClassroom(question.classroom_id, subject.classroomId)
  )
  const answeredQuestions = subjectQuestions.filter((question) => answeredQuestionIds.has(question.id)).length
  const pendingQuestions = Math.max(0, subjectQuestions.length - answeredQuestions)
  const failedQuestions = subjectQuestions.filter((question) => failedQuestionIds.has(question.id)).length
  const completedTopics = subjectTopics.filter((topic) => {
    const topicQuestions = subjectQuestions.filter((question) => question.topic_id === topic.id)
    return topicQuestions.length > 0 && topicQuestions.every((question) => answeredQuestionIds.has(question.id))
  }).length
  const questionPercent = subjectQuestions.length > 0
    ? Math.round((answeredQuestions / subjectQuestions.length) * 100)
    : 0
  const isCompleted = subjectQuestions.length > 0 && answeredQuestions >= subjectQuestions.length
  const percent = isCompleted ? 100 : questionPercent

  return {
    id: subject.id,
    classroomId: subject.classroomId,
    classroomName: subject.classroomName,
    classroomCode: subject.classroomCode,
    name: subject.name,
    description: subject.description,
    icon: subject.icon,
    theme_color: subject.theme_color,
    totalTopics: subjectTopics.length,
    completedTopics,
    totalQuestions: subjectQuestions.length,
    answeredQuestions,
    pendingQuestions,
    failedQuestions,
    percent,
    isCompleted,
  }
}

function matchesClassroom(rowClassroomId: number | null | undefined, classroomId: number | null) {
  if (!classroomId) return true
  return Number(rowClassroomId) === Number(classroomId)
}

function emptyStudentProgressSummary(): StudentProgressSummary {
  return {
    subjects: [],
    totalClasses: 0,
    completedClasses: 0,
    totalQuestions: 0,
    answeredQuestions: 0,
    totalAttempts: 0,
    correctAttempts: 0,
    accuracyPercent: 0,
    overallPercent: 0,
  }
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}
