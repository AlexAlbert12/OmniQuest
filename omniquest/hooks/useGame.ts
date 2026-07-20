import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { normalizeDifficulty } from '../lib/difficulty';
import type { Json } from '../types/database.types';
import { fetchAttemptFeedback, type AttemptFeedback } from '../lib/studentSecureData';

type StructuredAnswerPayload = {
  answerText?: string;
  payload?: Json;
};

type SubmitAnswerResult = {
  is_correct?: boolean;
  requires_manual_review?: boolean;
  manual_review_status?: string | null;
  earned_points?: number;
  attempt_score?: number;
  attempt_history_id?: number;
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
  xp: number;
  timeSeconds: number;
  reviewQuestions: { id: number; text: string }[];
};

const emptySummary: GameSummary = {
  questionsTotal: 0,
  answered: 0,
  correct: 0,
  incorrect: 0,
  xp: 0,
  timeSeconds: 0,
  reviewQuestions: [],
};

export function useGame(subjectId: string, topicId?: string, reviewMode?: string, classroomId?: string | null, difficulty?: string | null) {
  const numericSubjectId = Number(subjectId);
  const numericClassroomId = classroomId && classroomId !== 'null' && classroomId !== 'undefined' ? Number(classroomId) : null;
  const numericTopicId = topicId && topicId !== 'general' ? Number(topicId) : null;
  const numericDifficulty = normalizeDifficulty(difficulty);
  const isGeneralTopic = topicId === 'general';
  const isFailedReview = reviewMode === 'failed';

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const attemptIdRef = useRef<string | null>(null);
  const finalizedAttemptIdsRef = useRef(new Set<string>());
  const hintUsedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'gameOver' | 'finished' | 'empty'>('loading');
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [correctAnswerId, setCorrectAnswerId] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | null>(null);
  const [hintedAnswerId, setHintedAnswerId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<QuestionFeedback | null>(null);
  const [feedbackNextStatus, setFeedbackNextStatus] = useState<'gameOver' | 'finished' | null>(null);
  const [summary, setSummary] = useState<GameSummary>(emptySummary);

  const loadGame = useCallback(async () => {
    try {
      const { data: questionsData, error: questionsError } = await supabase.rpc('get_safe_game_questions', {
        p_subject_id: numericSubjectId,
        p_classroom_id: numericClassroomId,
        p_topic_id: numericTopicId,
        p_general_topic: isGeneralTopic,
        p_difficulty: numericDifficulty,
        p_review_failed: isFailedReview,
      });

      if (questionsError) throw questionsError;

      const safeQuestions = Array.isArray(questionsData) ? (questionsData as any[]) : [];

      if (safeQuestions.length === 0) {
        setStatus('empty');
        return;
      }

      const { data: attemptId, error: attemptError } = await supabase.rpc('start_game_attempt', {
        p_subject_id: numericSubjectId,
        p_classroom_id: numericClassroomId,
        p_topic_id: numericTopicId,
        p_general_topic: isGeneralTopic,
        p_difficulty: numericDifficulty,
      });

      if (attemptError) throw attemptError;

      attemptIdRef.current = attemptId ?? null;
      finalizedAttemptIdsRef.current.clear();
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
      setFeedback(null);
      setFeedbackNextStatus(null);
      setSummary({ ...emptySummary, questionsTotal: safeQuestions.length });
      setQuestions(safeQuestions);
      setTimeLeft(safeQuestions[0].time_limit_seconds ?? 30);
      setStatus('playing');
    } catch (error: any) {
      console.error(error);
      Platform.OS === 'web' ? window.alert(error.message) : Alert.alert('Error', error.message);
    }
  }, [isFailedReview, isGeneralTopic, numericClassroomId, numericDifficulty, numericSubjectId, numericTopicId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const finalizeGameAttempt = useCallback(async (nextStatus: 'gameOver' | 'finished') => {
    const attemptId = attemptIdRef.current;
    if (!attemptId || finalizedAttemptIdsRef.current.has(attemptId)) return;

    finalizedAttemptIdsRef.current.add(attemptId);

    try {
      const { error } = await supabase.rpc('finish_game_attempt', {
        p_attempt_id: attemptId,
        p_status: nextStatus === 'gameOver' ? 'abandoned' : 'finished',
      });

      if (error) throw error;
    } catch (error) {
      finalizedAttemptIdsRef.current.delete(attemptId);
      console.error('Error finalizing game attempt:', error);
    }
  }, []);

  const finishGame = useCallback((nextStatus: 'gameOver' | 'finished') => {
    setStatus(nextStatus);
    void finalizeGameAttempt(nextStatus);
  }, [finalizeGameAttempt]);

  const nextQuestion = useCallback(() => {
    setSelectedAnswerId(null);
    setCorrectAnswerId(null);
    setHasAnswered(false);
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    setAnswerStatus(null);
    setHintedAnswerId(null);
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
  }: {
    answerId?: number;
    answerText?: string;
    payload?: Json;
    skipped?: boolean;
    timedOut?: boolean;
  }) => {
    if (hasAnswered || isSubmittingRef.current || status !== 'playing') return;

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSelectedAnswerId(answerId ?? null);
    setCorrectAnswerId(null);

    try {
      const timeLimit = currentQ.time_limit_seconds ?? 30;
      const timeTaken = timedOut ? timeLimit : Math.max(0, timeLimit - timeLeft);
      const { data, error } = await supabase.rpc('submit_answer', {
        p_question_id: currentQ.id,
        p_answer_id: answerId ?? null,
        p_answer_text: answerText ?? null,
        p_answer_payload: payload ?? null,
        p_time_taken_seconds: timeTaken,
        p_hint_used: hintUsedRef.current,
        p_skipped: skipped,
        p_attempt_id: attemptIdRef.current,
      });

      if (error) throw error;

      const result = asSubmitAnswerResult(data);
      let secureFeedback: AttemptFeedback = {};

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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFeedbackNextStatus(nextTerminalStatus);
        return;
      }

      if (isCorrect) {
        setAnswerStatus('correct');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStreak((prev) => prev + 1);
        setFeedbackNextStatus(nextTerminalStatus);
        return;
      }

      setAnswerStatus('incorrect');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      setLives((prev) => {
        const newLives = prev - 1;
        setFeedbackNextStatus(newLives <= 0 ? 'gameOver' : nextTerminalStatus);
        return newLives;
      });
    } catch (error: any) {
      console.error('Error submitting answer:', error);
      setHasAnswered(false);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setFeedback(null);
      setFeedbackNextStatus(null);
      Platform.OS === 'web' ? window.alert(error.message) : Alert.alert('Error', error.message);
    }
  }, [currentIndex, hasAnswered, questions, status, timeLeft]);

  const handleTimeOut = useCallback(() => {
    void completeAnswer({ skipped: true, timedOut: true });
  }, [completeAnswer]);

  useEffect(() => {
    if (status !== 'playing' || hasAnswered || isSubmitting) return;

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
  }, [status, hasAnswered, isSubmitting, currentIndex, handleTimeOut]);

  const submitAnswer = (answerId: number) => {
    void completeAnswer({ answerId });
  };

  const submitStructuredAnswer = ({ answerText, payload }: StructuredAnswerPayload) => {
    void completeAnswer({ answerText, payload });
  };

  const useHint = () => {
    if (hasAnswered || isSubmitting || status !== 'playing' || hintUsedRef.current) return false;

    hintUsedRef.current = true;
    setHintedAnswerId(-1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return true;
  };

  const skipQuestion = () => {
    void completeAnswer({ skipped: true });
  };

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
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex],
    score,
    lives,
    streak,
    timeLeft,
    status,
    selectedAnswerId,
    correctAnswerId,
    hasAnswered,
    isSubmitting,
    answerStatus,
    hintedAnswerId,
    feedback,
    summary,
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
