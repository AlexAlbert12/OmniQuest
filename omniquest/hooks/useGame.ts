import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';

type StructuredAnswerPayload = {
  answerText?: string;
  payload?: Json;
};

type SubmitAnswerResult = {
  is_correct?: boolean;
  earned_points?: number;
  attempt_score?: number;
  correct_answer_id?: number | null;
  correct_answer_text?: string | null;
  explanation?: string | null;
};

function asSubmitAnswerResult(value: unknown): SubmitAnswerResult {
  return value && typeof value === 'object' ? (value as SubmitAnswerResult) : {};
}

type QuestionFeedback = {
  status: 'correct' | 'incorrect';
  earnedPoints: number;
  correctAnswerText: string | null;
  explanation: string | null;
};

export function useGame(subjectId: string, topicId?: string, reviewMode?: string) {
  const numericSubjectId = Number(subjectId);
  const numericTopicId = topicId && topicId !== 'general' ? Number(topicId) : null;
  const isGeneralTopic = topicId === 'general';
  const isFailedReview = reviewMode === 'failed';

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const attemptIdRef = useRef<string | null>(null);
  const hintUsedRef = useRef(false);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'gameOver' | 'finished' | 'empty'>('loading');
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [correctAnswerId, setCorrectAnswerId] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | null>(null);
  const [hintedAnswerId, setHintedAnswerId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<QuestionFeedback | null>(null);
  const [feedbackNextStatus, setFeedbackNextStatus] = useState<'gameOver' | 'finished' | null>(null);

  const loadGame = useCallback(async () => {
    try {
      const { data: questionsData, error: questionsError } = await supabase.rpc('get_game_questions', {
        p_subject_id: numericSubjectId,
        p_topic_id: numericTopicId,
        p_general_topic: isGeneralTopic,
      });

      if (questionsError) throw questionsError;

      let safeQuestions = Array.isArray(questionsData) ? (questionsData as any[]) : [];

      if (isFailedReview && safeQuestions.length > 0) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const studentId = sessionData.session?.user?.id;
        if (!studentId) throw new Error('No authenticated user');

        const { data: attemptsData, error: attemptsError } = await supabase
          .from('attempt_history')
          .select('question_id,is_correct,attempted_at,questions!inner(id,subject_id,topic_id)')
          .eq('student_id', studentId)
          .eq('questions.subject_id', numericSubjectId)
          .order('attempted_at', { ascending: false });

        if (attemptsError) throw attemptsError;

        const latestByQuestion = new Map<number, { is_correct: boolean | null }>();
        (attemptsData || []).forEach((attempt: any) => {
          const questionId = Number(attempt.question_id);
          const relation = Array.isArray(attempt.questions) ? attempt.questions[0] : attempt.questions;
          const relationTopicId = relation?.topic_id == null ? null : Number(relation.topic_id);
          const matchesTopic = isGeneralTopic
            ? relationTopicId === null
            : numericTopicId === null || relationTopicId === numericTopicId;

          if (Number.isFinite(questionId) && matchesTopic && !latestByQuestion.has(questionId)) {
            latestByQuestion.set(questionId, { is_correct: attempt.is_correct ?? null });
          }
        });

        const failedQuestionIds = new Set(
          Array.from(latestByQuestion.entries())
            .filter(([, attempt]) => attempt.is_correct === false)
            .map(([questionId]) => questionId),
        );

        safeQuestions = safeQuestions.filter((question) => failedQuestionIds.has(Number(question.id)));
      }

      if (safeQuestions.length === 0) {
        setStatus('empty');
        return;
      }

      const { data: attemptId, error: attemptError } = await supabase.rpc('start_game_attempt', {
        p_subject_id: numericSubjectId,
        p_topic_id: numericTopicId,
        p_general_topic: isGeneralTopic,
      });

      if (attemptError) throw attemptError;

      attemptIdRef.current = attemptId ?? null;
      scoreRef.current = 0;
      hintUsedRef.current = false;
      setScore(0);
      setCurrentIndex(0);
      setLives(3);
      setStreak(0);
      setSelectedAnswerId(null);
      setCorrectAnswerId(null);
      setHasAnswered(false);
      setAnswerStatus(null);
      setHintedAnswerId(null);
      setFeedback(null);
      setFeedbackNextStatus(null);
      setQuestions(safeQuestions);
      setTimeLeft(safeQuestions[0].time_limit_seconds ?? 30);
      setStatus('playing');
    } catch (error: any) {
      console.error(error);
      Platform.OS === 'web' ? window.alert(error.message) : Alert.alert('Error', error.message);
    }
  }, [isFailedReview, isGeneralTopic, numericSubjectId, numericTopicId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const finishGame = useCallback((nextStatus: 'gameOver' | 'finished') => {
    setStatus(nextStatus);
  }, []);

  const nextQuestion = useCallback(() => {
    setSelectedAnswerId(null);
    setCorrectAnswerId(null);
    setHasAnswered(false);
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
    if (hasAnswered || status !== 'playing') return;

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setHasAnswered(true);
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
      const isCorrect = Boolean(result.is_correct);
      const earned = Math.max(0, Number(result.earned_points ?? 0));
      const nextScore = Number(result.attempt_score ?? scoreRef.current + earned);
      const nextTerminalStatus = currentIndex + 1 >= questions.length ? 'finished' : null;
      const correctAnswerText = result.correct_answer_text ?? getCorrectAnswerText(currentQ, result.correct_answer_id);
      const explanation = result.explanation || currentQ.explanation || null;

      scoreRef.current = nextScore;
      setScore(nextScore);
      setCorrectAnswerId(result.correct_answer_id ?? null);
      setFeedback({
        status: isCorrect ? 'correct' : 'incorrect',
        earnedPoints: earned,
        correctAnswerText,
        explanation,
      });

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
      setFeedback(null);
      setFeedbackNextStatus(null);
      Platform.OS === 'web' ? window.alert(error.message) : Alert.alert('Error', error.message);
    }
  }, [currentIndex, hasAnswered, questions, status, timeLeft]);

  const handleTimeOut = useCallback(() => {
    void completeAnswer({ skipped: true, timedOut: true });
  }, [completeAnswer]);

  useEffect(() => {
    if (status !== 'playing' || hasAnswered) return;

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
  }, [status, hasAnswered, currentIndex, handleTimeOut]);

  const submitAnswer = (answerId: number) => {
    void completeAnswer({ answerId });
  };

  const submitStructuredAnswer = ({ answerText, payload }: StructuredAnswerPayload) => {
    void completeAnswer({ answerText, payload });
  };

  const useHint = () => {
    if (hasAnswered || status !== 'playing' || hintUsedRef.current) return false;

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
    answerStatus,
    hintedAnswerId,
    feedback,
    submitAnswer,
    submitStructuredAnswer,
    useHint,
    skipQuestion,
    continueAfterFeedback,
  };
}

function getCorrectAnswerText(question: any, correctAnswerId?: number | null) {
  if (!question || !correctAnswerId || !Array.isArray(question.answers)) return null;
  const answer = question.answers.find((item: any) => Number(item.id) === Number(correctAnswerId));
  return typeof answer?.text === 'string' ? answer.text : null;
}
