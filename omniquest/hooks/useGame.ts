import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeDifficulty } from '../lib/difficulty';
import type { Json } from '../types/database.types';
import { fetchAttemptFeedback, type AttemptFeedback } from '../lib/studentSecureData';
import { measureRpc, toSafeAnalyticsError, trackUsageEvent } from '../lib/analytics';
import { useAppHaptics } from '../lib/haptics';
import { getStudentBadgePresentation, type StudentBadge } from '../lib/studentBadges';
import { isQuestionVersionConflict, withQuestionVersionMetadata } from '../lib/gameQuestionLogic';
import type { GameQuestionConflict, GameSyncState } from '../components/student/game/types';
import {
  buildGameSnapshotKey,
  clearGameSnapshot,
  createSubmissionId,
  getNetworkAvailability,
  loadGameSnapshot,
  saveGameSnapshot,
  subscribeToNetworkAvailability,
  type PendingGameAnswer,
} from '../lib/gameOffline';

type StructuredAnswerPayload = {
  answerText?: string;
  payload?: Json;
};

type BadgeAwardResult = {
  badge_id?: string;
  awarded_at?: string | null;
  reward_xp?: number | null;
};

type FinishGameResult = {
  badge_sync?: {
    new_awards?: BadgeAwardResult[];
  };
};

type SubmitAnswerResult = {
  is_correct?: boolean;
  requires_manual_review?: boolean;
  manual_review_status?: string | null;
  earned_points?: number;
  attempt_score?: number;
  attempt_history_id?: number;
  correct_answer_id?: number | null;
  correct_answer_text?: string | null;
  explanation?: string | null;
};

function asSubmitAnswerResult(value: unknown): SubmitAnswerResult {
  return value && typeof value === 'object' ? (value as SubmitAnswerResult) : {};
}

type QuestionFeedback = {
  status: 'correct' | 'incorrect' | 'pending';
  earnedPoints: number;
  correctAnswerText: string | null;
  explanation: string | null;
};

type GameSummary = {
  questionsTotal: number;
  answered: number;
  correct: number;
  incorrect: number;
  pending: number;
  xp: number;
  timeSeconds: number;
  reviewQuestions: { id: number; text: string }[];
};

const emptySummary: GameSummary = {
  questionsTotal: 0,
  answered: 0,
  correct: 0,
  incorrect: 0,
  pending: 0,
  xp: 0,
  timeSeconds: 0,
  reviewQuestions: [],
};

export function useGame(subjectId: string, topicId?: string, classroomId?: string | null, difficulty?: string | null) {
  const numericSubjectId = Number(subjectId);
  const numericClassroomId = classroomId && classroomId !== 'null' && classroomId !== 'undefined' ? Number(classroomId) : null;
  const numericTopicId = topicId && topicId !== 'general' ? Number(topicId) : null;
  const numericDifficulty = normalizeDifficulty(difficulty);
  const isGeneralTopic = topicId === 'general';
  const gameSnapshotKey = buildGameSnapshotKey([numericSubjectId, numericClassroomId, numericTopicId, isGeneralTopic, numericDifficulty]);
  const haptics = useAppHaptics();

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const attemptIdRef = useRef<string | null>(null);
  const finalizedAttemptIdsRef = useRef(new Set<string>());
  const viewedQuestionsRef = useRef(new Set<string>());
  const hintUsedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const snapshotPersistenceBlockedRef = useRef(false);
  const snapshotWritesRef = useRef(new Set<Promise<void>>());
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'gameOver' | 'finished' | 'empty' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [correctAnswerId, setCorrectAnswerId] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | null>(null);
  const [hintedAnswerId, setHintedAnswerId] = useState<number | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [feedback, setFeedback] = useState<QuestionFeedback | null>(null);
  const [feedbackNextStatus, setFeedbackNextStatus] = useState<'gameOver' | 'finished' | null>(null);
  const [summary, setSummary] = useState<GameSummary>(emptySummary);
  const [isOffline, setIsOffline] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [resumedFromSnapshot, setResumedFromSnapshot] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<PendingGameAnswer | null>(null);
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<StudentBadge[]>([]);
  const [syncState, setSyncState] = useState<GameSyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [questionConflict, setQuestionConflict] = useState<GameQuestionConflict | null>(null);

  const discardGameSnapshot = useCallback(async () => {
    snapshotPersistenceBlockedRef.current = true;
    const pendingWrites = [...snapshotWritesRef.current];
    if (pendingWrites.length > 0) await Promise.allSettled(pendingWrites);
    await clearGameSnapshot(gameSnapshotKey);
  }, [gameSnapshotKey]);

  const loadGame = useCallback(async () => {
    snapshotPersistenceBlockedRef.current = false;
    setStatus('loading');
    setLoadError(null);
    setSyncError(null);
    setQuestionConflict(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const guestSession = Boolean(sessionData.session?.user.is_anonymous);
      setIsGuest(guestSession);
      if (guestSession) await clearGameSnapshot(gameSnapshotKey);
      const snapshot = userId && !guestSession ? await loadGameSnapshot(gameSnapshotKey) : null;

      if (snapshot && snapshot.userId === userId && snapshot.questions.length > 0) {
        const restoredQuestions = snapshot.questions as any[];
        attemptIdRef.current = snapshot.attemptId;
        scoreRef.current = snapshot.score;
        hintUsedRef.current = snapshot.hintUsed;
        const restoredIndex = Math.min(snapshot.currentIndex, restoredQuestions.length - 1);
        setQuestions(restoredQuestions);
        setCurrentIndex(restoredIndex);
        setHintVisible(Boolean(snapshot.hintUsed && restoredQuestions[restoredIndex]?.hint?.trim()));
        setScore(snapshot.score);
        setLives(snapshot.lives);
        setStreak(snapshot.streak);
        setTimeLeft(Math.max(0, snapshot.timeLeft));
        const restoredSummary = snapshot.summary as Partial<GameSummary> | null;
        setSummary({
          ...emptySummary,
          ...(restoredSummary || {}),
          pending: Math.max(0, Number(restoredSummary?.pending ?? Math.max(0, Number(restoredSummary?.answered || 0) - Number(restoredSummary?.correct || 0) - Number(restoredSummary?.incorrect || 0)))),
        });
        setPendingAnswer(snapshot.pendingAnswer);
        setHasAnswered(snapshot.hasAnswered);
        setSelectedAnswerId(snapshot.selectedAnswerId);
        setCorrectAnswerId(snapshot.correctAnswerId);
        setAnswerStatus(snapshot.answerStatus);
        setFeedback(snapshot.feedback as QuestionFeedback | null);
        setFeedbackNextStatus(snapshot.feedbackNextStatus);
        setResumedFromSnapshot(true);
        setSyncState(snapshot.pendingAnswer ? 'offline' : 'synced');
        setStatus('playing');
        void trackUsageEvent('game_resumed', {
          subjectId: numericSubjectId,
          classroomId: numericClassroomId,
          topicId: numericTopicId,
          attemptId: snapshot.attemptId,
          properties: {
            question_index: snapshot.currentIndex,
            score: snapshot.score,
            pending_answer: Boolean(snapshot.pendingAnswer),
          },
        });
        return;
      }

      const { data: questionsData, error: questionsError } = await measureRpc(
        'get_safe_game_questions_v2',
        async () => supabase.rpc('get_safe_game_questions_v2', {
          p_subject_id: numericSubjectId,
          p_classroom_id: numericClassroomId ?? undefined,
          p_topic_id: numericTopicId ?? undefined,
          p_general_topic: isGeneralTopic,
          p_difficulty: numericDifficulty ?? undefined,
        }),
        { subjectId: numericSubjectId, classroomId: numericClassroomId, topicId: numericTopicId },
      );

      if (questionsError) throw questionsError;

      const safeQuestions = Array.isArray(questionsData) ? (questionsData as any[]) : [];

      if (safeQuestions.length === 0) {
        await clearGameSnapshot(gameSnapshotKey);
        setStatus('empty');
        return;
      }

      const { data: attemptId, error: attemptError } = await measureRpc(
        'start_game_attempt',
        async () => supabase.rpc('start_game_attempt', {
          p_subject_id: numericSubjectId,
          p_classroom_id: numericClassroomId ?? undefined,
          p_topic_id: numericTopicId ?? undefined,
          p_general_topic: isGeneralTopic,
          p_difficulty: numericDifficulty ?? undefined,
        }),
        { subjectId: numericSubjectId, classroomId: numericClassroomId, topicId: numericTopicId },
      );

      if (attemptError) throw attemptError;

      attemptIdRef.current = attemptId ?? null;
      finalizedAttemptIdsRef.current.clear();
      viewedQuestionsRef.current.clear();
      scoreRef.current = 0;
      hintUsedRef.current = false;
      setScore(0);
      setCurrentIndex(0);
      setLives(3);
      setStreak(0);
      setSelectedAnswerId(null);
      setCorrectAnswerId(null);
      setHasAnswered(false);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setAnswerStatus(null);
      setHintedAnswerId(null);
      setHintVisible(false);
      setFeedback(null);
      setFeedbackNextStatus(null);
      setSummary({ ...emptySummary, questionsTotal: safeQuestions.length });
      setPendingAnswer(null);
      setNewlyUnlockedBadges([]);
      setResumedFromSnapshot(false);
      setSyncState('idle');
      setQuestions(safeQuestions);
      setTimeLeft(safeQuestions[0].time_limit_seconds ?? 30);
      setStatus('playing');
    } catch (error: any) {
      console.error(error);
      const message = error?.message || 'No se pudo preparar la partida.';
      void trackUsageEvent('game_error', {
        subjectId: numericSubjectId,
        classroomId: numericClassroomId,
        topicId: numericTopicId,
        attemptId: attemptIdRef.current,
        properties: { stage: 'load', message: toSafeAnalyticsError(error) },
      });
      setLoadError(message);
      setStatus('error');
    }
  }, [gameSnapshotKey, isGeneralTopic, numericClassroomId, numericDifficulty, numericSubjectId, numericTopicId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const finalizeGameAttempt = useCallback(async (nextStatus: 'gameOver' | 'finished') => {
    const attemptId = attemptIdRef.current;
    if (!attemptId || finalizedAttemptIdsRef.current.has(attemptId)) return;

    finalizedAttemptIdsRef.current.add(attemptId);

    try {
      const { data, error } = await measureRpc(
        'finish_game_attempt',
        async () => supabase.rpc('finish_game_attempt', {
          p_attempt_id: attemptId,
          p_status: nextStatus === 'gameOver' ? 'abandoned' : 'finished',
        }),
        {
          subjectId: numericSubjectId,
          classroomId: numericClassroomId,
          topicId: numericTopicId,
          attemptId,
        },
      );

      if (error) throw error;

      const finishResult = data && typeof data === 'object' && !Array.isArray(data)
        ? data as FinishGameResult
        : {};
      const newAwards = Array.isArray(finishResult.badge_sync?.new_awards)
        ? finishResult.badge_sync?.new_awards || []
        : [];
      const unlocked = newAwards.flatMap((award) => {
        if (!award.badge_id) return [];
        const badge = getStudentBadgePresentation(award.badge_id);
        if (!badge) return [];
        return [{
          ...badge,
          unlocked: true,
          statusLabel: 'Conseguida',
          awardedAt: award.awarded_at ?? new Date().toISOString(),
          rewardXp: Number(award.reward_xp ?? badge.rewardXp),
          xp: `+${Number(award.reward_xp ?? badge.rewardXp)} XP`,
        } satisfies StudentBadge];
      });
      if (unlocked.length > 0) {
        setNewlyUnlockedBadges((current) => {
          const existing = new Set(current.map((badge) => badge.id));
          return [...current, ...unlocked.filter((badge) => !existing.has(badge.id))];
        });
      }
    } catch (error) {
      finalizedAttemptIdsRef.current.delete(attemptId);
      console.error('Error finalizing game attempt:', error);
      void trackUsageEvent('game_error', {
        subjectId: numericSubjectId,
        classroomId: numericClassroomId,
        topicId: numericTopicId,
        attemptId,
        properties: {
          stage: 'finish_attempt',
          requested_status: nextStatus === 'gameOver' ? 'abandoned' : 'finished',
          message: toSafeAnalyticsError(error),
        },
      });
    }
  }, [numericClassroomId, numericSubjectId, numericTopicId]);

  const finishGame = useCallback((nextStatus: 'gameOver' | 'finished') => {
    setStatus(nextStatus);
    setPendingAnswer(null);
    void discardGameSnapshot();
    void finalizeGameAttempt(nextStatus);
  }, [discardGameSnapshot, finalizeGameAttempt]);

  useEffect(() => {
    if (status !== 'playing') return
    const question = questions[currentIndex]
    if (!question?.id) return

    const viewKey = `${attemptIdRef.current || 'pending'}:${currentIndex}:${question.id}`
    if (viewedQuestionsRef.current.has(viewKey)) return
    viewedQuestionsRef.current.add(viewKey)

    void trackUsageEvent('question_viewed', {
      subjectId: numericSubjectId,
      classroomId: numericClassroomId,
      topicId: numericTopicId,
      attemptId: attemptIdRef.current,
      properties: {
        question_type: String(question.type || 'unknown'),
        question_index: currentIndex,
      },
    })
  }, [currentIndex, numericClassroomId, numericSubjectId, numericTopicId, questions, status])

  const abandonGame = useCallback(async () => {
    setPendingAnswer(null);
    await discardGameSnapshot();
    await finalizeGameAttempt('gameOver');
  }, [discardGameSnapshot, finalizeGameAttempt]);

  const nextQuestion = useCallback(() => {
    setSelectedAnswerId(null);
    setCorrectAnswerId(null);
    setHasAnswered(false);
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    setAnswerStatus(null);
    setHintedAnswerId(null);
    setHintVisible(false);
    setFeedback(null);
    setFeedbackNextStatus(null);
    hintUsedRef.current = false;

    if (currentIndex + 1 < questions.length) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setTimeLeft(questions[nextIndex].time_limit_seconds ?? 30);
    } else {
      finishGame('finished');
    }
  }, [currentIndex, finishGame, questions]);

  const completeAnswer = useCallback(async ({
    answerId,
    answerText,
    payload,
    skipped = false,
    timedOut = false,
    submissionId,
    retry = false,
  }: {
    answerId?: number;
    answerText?: string;
    payload?: Json;
    skipped?: boolean;
    timedOut?: boolean;
    submissionId?: string;
    retry?: boolean;
  }) => {
    if ((!retry && hasAnswered) || isSubmittingRef.current || status !== 'playing') return;

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const pendingSubmission: PendingGameAnswer = {
      submissionId: submissionId ?? createSubmissionId(),
      questionIndex: currentIndex,
      answerId,
      answerText,
      payload,
      skipped,
      timedOut,
      questionUpdatedAt: typeof currentQ.question_updated_at === 'string' ? currentQ.question_updated_at : null,
    };
    setPendingAnswer(pendingSubmission);

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSelectedAnswerId(answerId ?? null);
    setCorrectAnswerId(null);
    setSyncError(null);
    setQuestionConflict(null);
    setSyncState(retry ? 'retrying' : 'saving');

    try {
      const timeLimit = currentQ.time_limit_seconds ?? 30;
      const timeTaken = timedOut ? timeLimit : Math.max(0, timeLimit - timeLeft);
      const { data, error } = await measureRpc(
        'submit_answer_resumable',
        async () => supabase.rpc('submit_answer_resumable', {
          p_submission_id: pendingSubmission.submissionId,
          p_question_id: currentQ.id,
          p_answer_id: answerId ?? undefined,
          p_answer_text: answerText ?? undefined,
          p_answer_payload: withQuestionVersionMetadata(payload, pendingSubmission.questionUpdatedAt),
          p_time_taken_seconds: timeTaken,
          p_hint_used: hintUsedRef.current,
          p_skipped: skipped,
          p_attempt_id: attemptIdRef.current ?? undefined,
        }),
        {
          subjectId: numericSubjectId,
          classroomId: numericClassroomId,
          topicId: numericTopicId,
          attemptId: attemptIdRef.current,
          properties: { question_type: String(currentQ.type || 'unknown') },
        },
      );

      if (error) throw error;
      setPendingAnswer(null);
      setIsOffline(false);
      setSyncState('synced');

      const result = asSubmitAnswerResult(data);
      let secureFeedback: AttemptFeedback = result;

      if (typeof result.attempt_history_id === 'number') {
        try {
          secureFeedback = await fetchAttemptFeedback(result.attempt_history_id);
        } catch (feedbackError) {
          console.warn('La respuesta se guardó, pero no se pudo cargar el feedback seguro:', feedbackError);
        }
      }

      const requiresManualReview = Boolean(result.requires_manual_review ?? secureFeedback.requires_manual_review);
      const isCorrect = Boolean(result.is_correct ?? secureFeedback.is_correct);
      const earned = Math.max(0, Number(result.earned_points ?? secureFeedback.earned_points ?? 0));
      const nextScore = Number(result.attempt_score ?? scoreRef.current + earned);
      const nextTerminalStatus = currentIndex + 1 >= questions.length ? 'finished' : null;
      const correctAnswerText = secureFeedback.correct_answer_text ?? null;
      const explanation = secureFeedback.explanation ?? null;

      scoreRef.current = nextScore;
      setScore(nextScore);
      setCorrectAnswerId(secureFeedback.correct_answer_id ?? null);
      setHasAnswered(true);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setSummary((current) => {
        const reviewQuestions = isCorrect || requiresManualReview
          ? current.reviewQuestions
          : appendReviewQuestion(current.reviewQuestions, currentQ);

        return {
          questionsTotal: questions.length,
          answered: current.answered + 1,
          correct: current.correct + (isCorrect ? 1 : 0),
          incorrect: current.incorrect + (!isCorrect && !requiresManualReview ? 1 : 0),
          pending: current.pending + (requiresManualReview ? 1 : 0),
          xp: nextScore,
          timeSeconds: current.timeSeconds + timeTaken,
          reviewQuestions,
        };
      });
      setFeedback({
        status: requiresManualReview ? 'pending' : isCorrect ? 'correct' : 'incorrect',
        earnedPoints: earned,
        correctAnswerText,
        explanation,
      });

      if (requiresManualReview) {
        setAnswerStatus(null);
        void haptics.success();
        setFeedbackNextStatus(nextTerminalStatus);
        return;
      }

      if (isCorrect) {
        setAnswerStatus('correct');
        void haptics.success();
        setStreak((prev) => prev + 1);
        setFeedbackNextStatus(nextTerminalStatus);
        return;
      }

      setAnswerStatus('incorrect');
      void haptics.error();
      setStreak(0);
      setLives((prev) => {
        const newLives = prev - 1;
        setFeedbackNextStatus(newLives <= 0 ? 'gameOver' : nextTerminalStatus);
        return newLives;
      });
    } catch (error: any) {
      console.error('Error submitting answer:', error);
      if (isQuestionVersionConflict(error)) {
        setPendingAnswer(null);
        setHasAnswered(false);
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        setFeedback(null);
        setFeedbackNextStatus(null);
        setSyncState('conflict');
        setQuestionConflict({
          questionId: Number(currentQ.id),
          questionText: String(currentQ.text || 'Pregunta actual'),
          expectedVersion: typeof currentQ.question_updated_at === 'string' ? currentQ.question_updated_at : null,
          message: 'El profesor modificó esta pregunta mientras la partida estaba sin conexión. Tu respuesta no se ha enviado para evitar corregirla contra una versión distinta.',
        });
        void trackUsageEvent('game_error', {
          subjectId: numericSubjectId,
          classroomId: numericClassroomId,
          topicId: numericTopicId,
          attemptId: attemptIdRef.current,
          properties: { stage: 'question_version_conflict', question_id: Number(currentQ.id), error_code: 'QUESTION_VERSION_CONFLICT' },
        });
        return;
      }
      const online = await getNetworkAvailability().catch(() => false);
      void trackUsageEvent('game_error', {
        subjectId: numericSubjectId,
        classroomId: numericClassroomId,
        topicId: numericTopicId,
        attemptId: attemptIdRef.current,
        properties: {
          stage: 'submit_answer',
          question_id: Number(currentQ.id),
          question_index: currentIndex,
          online,
          message: toSafeAnalyticsError(error),
        },
      });
      setIsOffline(!online);
      setHasAnswered(false);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setFeedback(null);
      setFeedbackNextStatus(null);
      setSyncError(error?.message || 'No se pudo sincronizar la respuesta.');
      setSyncState(online ? 'error' : 'offline');
      if (online) setPendingAnswer(null);
    }
  }, [currentIndex, haptics, hasAnswered, numericClassroomId, numericSubjectId, numericTopicId, questions, status, timeLeft]);

  const handleTimeOut = useCallback(() => {
    void completeAnswer({ skipped: true, timedOut: true });
  }, [completeAnswer]);

  useEffect(() => {
    if (status !== 'playing' || hasAnswered || isSubmitting || pendingAnswer || isOffline) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, hasAnswered, isSubmitting, currentIndex, handleTimeOut, isOffline, pendingAnswer]);

  useEffect(() => {
    let cancelled = false;
    const updateAvailability = async () => {
      const online = await getNetworkAvailability().catch(() => false);
      if (!cancelled) { setIsOffline(!online); if (!online) setSyncState('offline'); }
    };
    void updateAvailability();
    const unsubscribe = subscribeToNetworkAvailability((online) => {
      if (!cancelled) { setIsOffline(!online); if (!online) setSyncState('offline'); }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!resumedFromSnapshot) return;
    const timer = setTimeout(() => setResumedFromSnapshot(false), 5000);
    return () => clearTimeout(timer);
  }, [resumedFromSnapshot]);

  useEffect(() => {
    if (status !== 'playing' || questions.length === 0 || snapshotPersistenceBlockedRef.current) return;
    let cancelled = false;
    const persist = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || cancelled || snapshotPersistenceBlockedRef.current) return;
      if (data.session?.user.is_anonymous) {
        await clearGameSnapshot(gameSnapshotKey);
        return;
      }
      const write = saveGameSnapshot(gameSnapshotKey, {
        userId,
        questions,
        currentIndex,
        score,
        lives,
        streak,
        timeLeft,
        attemptId: attemptIdRef.current,
        hintUsed: hintUsedRef.current,
        summary,
        pendingAnswer,
        hasAnswered,
        selectedAnswerId,
        correctAnswerId,
        answerStatus,
        feedback,
        feedbackNextStatus,
      });
      snapshotWritesRef.current.add(write);
      try {
        await write;
      } finally {
        snapshotWritesRef.current.delete(write);
      }
    };
    const timer = setTimeout(() => { void persist(); }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [answerStatus, correctAnswerId, currentIndex, feedback, feedbackNextStatus, gameSnapshotKey, hasAnswered, lives, pendingAnswer, questions, score, selectedAnswerId, status, streak, summary, timeLeft]);

  const retryPendingAnswer = useCallback(() => {
    if (!pendingAnswer || isSubmittingRef.current) return;
    if (pendingAnswer.questionIndex !== currentIndex) {
      setCurrentIndex(pendingAnswer.questionIndex);
      return;
    }
    setIsOffline(false);
    setSyncState('retrying');
    void completeAnswer({
      answerId: pendingAnswer.answerId,
      answerText: pendingAnswer.answerText,
      payload: pendingAnswer.payload,
      skipped: pendingAnswer.skipped,
      timedOut: pendingAnswer.timedOut,
      submissionId: pendingAnswer.submissionId,
      retry: true,
    });
  }, [completeAnswer, currentIndex, pendingAnswer]);

  useEffect(() => {
    if (!isOffline && pendingAnswer && !isSubmitting) {
      const timer = setTimeout(retryPendingAnswer, 500);
      return () => clearTimeout(timer);
    }
  }, [isOffline, isSubmitting, pendingAnswer, retryPendingAnswer]);

  const submitAnswer = (answerId: number) => {
    void completeAnswer({ answerId });
  };

  const submitStructuredAnswer = ({ answerText, payload }: StructuredAnswerPayload) => {
    void completeAnswer({ answerText, payload });
  };

  const useHint = () => {
    const question = questions[currentIndex];
    const hint = typeof question?.hint === 'string' ? question.hint.trim() : '';
    if (!hint || hasAnswered || isSubmitting || status !== 'playing' || hintUsedRef.current) return false;

    hintUsedRef.current = true;
    setHintedAnswerId(null);
    setHintVisible(true);
    void haptics.impact();
    return true;
  };

  const dismissUnlockedBadge = () => {
    setNewlyUnlockedBadges((current) => current.slice(1));
  };

  const skipQuestion = () => {
    void completeAnswer({ skipped: true });
  };

  const restartAfterConflict = useCallback(async () => {
    setQuestionConflict(null);
    setSyncError(null);
    setSyncState('idle');
    setStatus('loading');
    await discardGameSnapshot();
    await finalizeGameAttempt('gameOver');
    await loadGame();
  }, [discardGameSnapshot, finalizeGameAttempt, loadGame]);

  const dismissSyncError = useCallback(() => {
    setSyncError(null);
    setSyncState(isOffline ? 'offline' : 'idle');
  }, [isOffline]);

  const continueAfterFeedback = () => {
    if (!feedback) return;

    if (feedbackNextStatus) {
      finishGame(feedbackNextStatus);
      setFeedback(null);
      setFeedbackNextStatus(null);
      return;
    }

    nextQuestion();
  };

  return {
    attemptId: attemptIdRef.current,
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex],
    score,
    lives,
    streak,
    timeLeft,
    status,
    loadError,
    selectedAnswerId,
    correctAnswerId,
    hasAnswered,
    isSubmitting,
    answerStatus,
    hintedAnswerId,
    hintVisible,
    feedback,
    summary,
    isOffline,
    isGuest,
    resumedFromSnapshot,
    pendingAnswer,
    newlyUnlockedBadges,
    syncState,
    syncError,
    questionConflict,
    retryPendingAnswer,
    restartAfterConflict,
    dismissSyncError,
    dismissUnlockedBadge,
    retryLoadGame: loadGame,
    abandonGame,
    submitAnswer,
    submitStructuredAnswer,
    useHint,
    skipQuestion,
    continueAfterFeedback,
  };
}

function appendReviewQuestion(current: { id: number; text: string }[], question: any) {
  const questionId = Number(question?.id);
  if (!Number.isFinite(questionId) || current.some((item) => item.id === questionId)) return current;

  return [
    ...current,
    {
      id: questionId,
      text: typeof question?.text === 'string' && question.text.trim() ? question.text.trim() : 'Pregunta sin título',
    },
  ];
}
