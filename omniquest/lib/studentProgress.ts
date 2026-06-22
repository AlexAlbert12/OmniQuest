import { supabase } from './supabase'

export type StudentProgressSubject = {
  id: number
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
  name: string
  description: string | null
  icon: string | null
  theme_color: string | null
}

type TopicRow = {
  id: number
  subject_id: number | null
  active?: boolean | null
}

type QuestionRow = {
  id: number
  subject_id: number | null
  topic_id?: number | null
  active?: boolean | null
}

type AttemptRow = {
  question_id: number | null
  is_correct?: boolean | null
  questions?: QuestionRow | QuestionRow[] | null
}

export async function fetchStudentProgressSummary(userId: string): Promise<StudentProgressSummary> {
  const { data: enrollmentsData, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('subjects(id, name, description, icon, theme_color)')
    .eq('student_id', userId)

  if (enrollmentsError) throw enrollmentsError

  const subjects = ((enrollmentsData || []) as { subjects?: EnrolledSubject | EnrolledSubject[] | null }[])
    .map((enrollment) => normalizeRelation(enrollment.subjects))
    .filter((subject): subject is EnrolledSubject => Boolean(subject?.id))

  const subjectIds = subjects.map((subject) => subject.id)
  if (subjectIds.length === 0) {
    return emptyStudentProgressSummary()
  }

  const [topicsResult, questionsResult, attemptsResult] = await Promise.all([
    supabase
      .from('subject_topics')
      .select('id, subject_id, active')
      .in('subject_id', subjectIds),
    supabase
      .from('questions')
      .select('id, subject_id, topic_id, active')
      .in('subject_id', subjectIds),
    supabase
      .from('attempt_history')
      .select('question_id, is_correct, questions(id, subject_id, topic_id, active)')
      .eq('student_id', userId),
  ])

  if (topicsResult.error) throw topicsResult.error
  if (questionsResult.error) throw questionsResult.error
  if (attemptsResult.error) throw attemptsResult.error

  const topics = ((topicsResult.data || []) as TopicRow[]).filter((topic) => topic.active !== false)
  const questions = ((questionsResult.data || []) as QuestionRow[]).filter((question) => question.active !== false)
  const attempts = (attemptsResult.data || []) as AttemptRow[]
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
  const totalAttempts = attempts.length
  const correctAttempts = attempts.filter((attempt) => attempt.is_correct === true).length
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
  const subjectTopics = topics.filter((topic) => topic.subject_id === subject.id)
  const subjectQuestions = questions.filter((question) => question.subject_id === subject.id)
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
