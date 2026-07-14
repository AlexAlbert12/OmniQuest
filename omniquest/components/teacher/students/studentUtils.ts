import { answersToAccuracyPercent, scoreToGrade } from '../../../lib/grades';
import type {
  AttemptHistoryRow,
  Classroom,
  Enrollment,
  StudentCourseContext,
  StudentRecentAttempt,
  StudentRow,
  StudentSortKey,
  StudentStatus,
  StudentWeakArea,
  SubjectScore,
} from './types';

export function isMissingSchemaError(errorCode?: string) {
  return errorCode === '42P01' || errorCode === '42703' || errorCode === 'PGRST204';
}

export function getStatusMeta(status: StudentStatus) {
  if (status === 'excellent') {
    return {
      label: 'Excelente',
      color: '#38BDF8',
      description: 'Alto rendimiento y buena precisión. Puede avanzar o recibir retos extra.',
    };
  }
  if (status === 'active') {
    return {
      label: 'Activo',
      color: '#58E28B',
      description: 'Tiene actividad reciente y un rendimiento estable.',
    };
  }
  if (status === 'needs_help') {
    return {
      label: 'Necesita apoyo',
      color: '#F59E0B',
      description: 'Tiene actividad, pero su precisión o nota media indican que conviene reforzar.',
    };
  }
  if (status === 'no_activity') {
    return {
      label: 'Sin actividad',
      color: '#8FA7C7',
      description: 'Está inscrito o importado, pero todavía no ha respondido preguntas.',
    };
  }
  return {
    label: 'Inactivo',
    color: '#94A3B8',
    description: 'Tiene algo de actividad, pero su participación es baja.',
  };
}

export function getStudentStatus({
  hasActivity,
  averageScore,
  accuracyPercent,
  progress,
}: {
  hasActivity: boolean
  averageScore: number
  accuracyPercent: number
  progress: number
}): StudentStatus {
  if (!hasActivity) return 'no_activity';
  if (averageScore >= 8.5 && accuracyPercent >= 85) return 'excellent';
  if (averageScore < 5 || accuracyPercent < 40) return 'needs_help';
  if (progress < 35) return 'inactive';
  return 'active';
}

export function compareStudents(a: StudentRow, b: StudentRow, sort: StudentSortKey) {
  if (sort === 'name') return a.alias.localeCompare(b.alias);
  if (sort === 'accuracy') return b.accuracyPercent - a.accuracyPercent || a.alias.localeCompare(b.alias);
  if (sort === 'xp') return b.subjectScore - a.subjectScore || b.globalPoints - a.globalPoints;
  if (sort === 'last_activity') return getTimeValue(b.lastActivityAt) - getTimeValue(a.lastActivityAt);

  const priority: Record<StudentStatus, number> = {
    needs_help: 5,
    inactive: 4,
    no_activity: 3,
    active: 2,
    excellent: 1,
  };

  return priority[b.status] - priority[a.status]
    || a.accuracyPercent - b.accuracyPercent
    || getTimeValue(a.lastActivityAt) - getTimeValue(b.lastActivityAt)
    || a.alias.localeCompare(b.alias);
}

export function buildCourseContexts(
  enrollments: Enrollment[],
  subjectMap: Map<number, string>,
  classroomMap: Map<number, Classroom>
): StudentCourseContext[] {
  const seen = new Set<string>();

  return enrollments.reduce<StudentCourseContext[]>((items, enrollment) => {
    const key = `${enrollment.subject_id}:${enrollment.classroom_id ?? 'general'}`;
    if (seen.has(key)) return items;
    seen.add(key);

    const classroom = typeof enrollment.classroom_id === 'number' ? classroomMap.get(enrollment.classroom_id) : null;
    items.push({
      subjectId: enrollment.subject_id,
      subjectName: subjectMap.get(enrollment.subject_id) || 'Curso',
      classroomId: enrollment.classroom_id ?? null,
      classroomName: classroom?.name || 'Clase principal',
      joinedAt: enrollment.joined_at || null,
    });
    return items;
  }, []);
}

export function buildRecentAttempts(attempts: AttemptHistoryRow[], subjectMap: Map<number, string>): StudentRecentAttempt[] {
  return attempts
    .slice()
    .sort((a, b) => getTimeValue(b.attempted_at || b.created_at || null) - getTimeValue(a.attempted_at || a.created_at || null))
    .slice(0, 8)
    .map((attempt) => {
      const question = attempt.questions;
      return {
        id: attempt.id,
        questionText: question?.text || 'Pregunta sin texto',
        topicTitle: question?.subject_topics?.title || 'Práctica general',
        subjectName: typeof question?.subject_id === 'number' ? subjectMap.get(question.subject_id) || 'Curso' : 'Curso',
        isCorrect: attempt.is_correct,
        attemptedAt: attempt.attempted_at || attempt.created_at || null,
        earnedPoints: attempt.earned_points ?? 0,
      };
    });
}

export function buildWeakAreas(
  scores: SubjectScore[],
  attempts: AttemptHistoryRow[],
  subjectMap: Map<number, string>,
  questionsCountBySubject: Map<number, number>
): StudentWeakArea[] {
  const mistakesByTopic = new Map<string, { title: string; detail: string; mistakes: number }>();

  attempts.forEach((attempt) => {
    if (attempt.is_correct) return;
    const question = attempt.questions;
    const subjectName = typeof question?.subject_id === 'number' ? subjectMap.get(question.subject_id) || 'Curso' : 'Curso';
    const topicTitle = question?.subject_topics?.title || 'Práctica general';
    const key = `${subjectName}:${topicTitle}`;
    const previous = mistakesByTopic.get(key) || { title: topicTitle, detail: subjectName, mistakes: 0 };
    mistakesByTopic.set(key, { ...previous, mistakes: previous.mistakes + 1 });
  });

  const areasFromAttempts: StudentWeakArea[] = Array.from(mistakesByTopic.values())
    .sort((a, b) => b.mistakes - a.mistakes)
    .slice(0, 4)
    .map((area): StudentWeakArea => ({
      ...area,
      accuracyPercent: null,
    }));

  if (areasFromAttempts.length > 0) return areasFromAttempts;

  const areasFromScores = scores
    .map<StudentWeakArea | null>((score) => {
      const questionsCount = questionsCountBySubject.get(score.subject_id) || 0;
      const playedSessions = getPlayedSessions(score, questionsCount);
      const totalAnswers = questionsCount > 0 ? playedSessions * questionsCount : 0;
      if (totalAnswers <= 0 || typeof score.correct_answers !== 'number') return null;

      const correctAnswers = Math.min(Math.max(0, score.correct_answers), totalAnswers);
      const accuracyPercent = answersToAccuracyPercent(correctAnswers, totalAnswers);
      const mistakes = Math.max(0, totalAnswers - correctAnswers);

      if (mistakes <= 0 || accuracyPercent >= 65) return null;

      return {
        title: subjectMap.get(score.subject_id) || 'Curso',
        detail: 'Curso con errores acumulados',
        mistakes,
        accuracyPercent,
      };
    })
    .filter((area): area is StudentWeakArea => area !== null)
    .sort((a, b) => b.mistakes - a.mistakes)
    .slice(0, 4);

  return areasFromScores;
}

export function getAnswerTotals(scores: SubjectScore[], questionsCountBySubject: Map<number, number>) {
  return scores.reduce(
    (totals, score) => {
      if (typeof score.correct_answers !== 'number') {
        return totals;
      }

      const questionsCount = questionsCountBySubject.get(score.subject_id) || 0;
      const playedSessions = getPlayedSessions(score, questionsCount);
      const totalAnswers = questionsCount > 0 ? playedSessions * questionsCount : 0;

      if (totalAnswers <= 0) {
        return totals;
      }

      totals.correctAnswers += Math.min(Math.max(0, score.correct_answers), totalAnswers);
      totals.totalAnswers += totalAnswers;
      return totals;
    },
    { correctAnswers: 0, totalAnswers: 0 }
  );
}

export function getFallbackScoreGrade(scores: SubjectScore[], questionsCountBySubject: Map<number, number>) {
  const grades = scores
    .filter((score) => typeof score.max_score === 'number' && (score.max_score ?? 0) > 0)
    .map((score) => {
      const questionsCount = questionsCountBySubject.get(score.subject_id) || 1;
      return scoreToGrade(score.max_score ?? 0, Math.max(160, questionsCount * 160));
    });

  if (grades.length === 0) {
    return 0;
  }

  return Number((grades.reduce((total, grade) => total + grade, 0) / grades.length).toFixed(1));
}

export function getPlayedSessions(score: SubjectScore, questionsCount: number) {
  const playedDays = Array.isArray(score.played_days) ? score.played_days.filter(Boolean).length : 0;
  const sessionsFromCorrectAnswers = questionsCount > 0 && typeof score.correct_answers === 'number'
    ? Math.ceil(score.correct_answers / questionsCount)
    : 0;
  return Math.max(score.played_at ? 1 : 0, playedDays, sessionsFromCorrectAnswers);
}

export function hasSubjectScoreActivity(score: SubjectScore) {
  return Boolean(score.played_at)
    || (score.max_score ?? 0) > 0
    || (score.correct_answers ?? 0) > 0
    || (Array.isArray(score.played_days) && score.played_days.length > 0);
}

export function hasScoreForEnrollment(enrollment: Enrollment, scores: SubjectScore[]) {
  return scores.some((score) => {
    const sameSubject = score.subject_id === enrollment.subject_id;
    const sameClassroom = typeof enrollment.classroom_id === 'number'
      ? score.classroom_id === enrollment.classroom_id || score.classroom_id === null || typeof score.classroom_id === 'undefined'
      : true;
    return sameSubject && sameClassroom && hasSubjectScoreActivity(score);
  });
}

export function getLastActivityDate(scores: SubjectScore[], attempts: AttemptHistoryRow[]) {
  const dates = [
    ...scores.map((score) => score.played_at || null),
    ...attempts.map((attempt) => attempt.attempted_at || attempt.created_at || null),
  ].filter((value): value is string => Boolean(value));

  if (dates.length === 0) return null;
  return dates.sort((a, b) => getTimeValue(b) - getTimeValue(a))[0];
}

export function getFirstEnrollmentDate(enrollments: Enrollment[]) {
  const dates = enrollments.map((enrollment) => enrollment.joined_at || null).filter((value): value is string => Boolean(value));
  if (dates.length === 0) return null;
  return dates.sort((a, b) => getTimeValue(a) - getTimeValue(b))[0];
}

export function getTimeValue(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function formatNullablePercent(value: number | null) {
  return value === null ? 'Sin datos' : `${value}%`;
}

export function formatNullableGrade(value: number | null) {
  return value === null ? 'Sin datos' : `${value.toFixed(1)} /10`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin registro';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeDate(value: string | null | undefined) {
  if (!value) return 'Sin actividad';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin actividad';

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatDate(value);
}

export function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'AL';
}

export function groupBy<T extends Record<string, any>>(items: T[], key: keyof T) {
  const map = new Map<string, T[]>();

  items.forEach((item) => {
    const value = String(item[key]);
    const group = map.get(value) || [];
    group.push(item);
    map.set(value, group);
  });

  return map;
}
