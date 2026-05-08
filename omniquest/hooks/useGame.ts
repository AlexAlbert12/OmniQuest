import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Fisher-Yates shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export function useGame(subjectId: string, topicId?: string) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const correctAnswersRef = useRef(0);
  const hasSavedScoreRef = useRef(false);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'gameOver' | 'finished' | 'empty'>('loading');
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | null>(null);
  const [hintedAnswerId, setHintedAnswerId] = useState<number | null>(null);

  const loadGame = useCallback(async () => {
    try {
      let query = supabase
        .from('questions')
        .select('*, answers(*)')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: true });

      if (topicId && topicId !== 'general') {
        query = query.eq('topic_id', Number(topicId));
      } else if (topicId === 'general') {
        query = query.is('topic_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data || data.length === 0) {
        setStatus('empty');
        return;
      }

      const shuffledQuestions = shuffleArray(data);

      const questionsWithShuffledAnswers = shuffledQuestions.map((q) => ({
        ...q,
        answers: shuffleArray(q.answers || []),
      }));

      scoreRef.current = 0;
      correctAnswersRef.current = 0;
      hasSavedScoreRef.current = false;
      setScore(0);
      setCurrentIndex(0);
      setLives(3);
      setStreak(0);
      setHasAnswered(false);
      setHintedAnswerId(null);
      setQuestions(questionsWithShuffledAnswers);
      setTimeLeft(questionsWithShuffledAnswers[0].time_limit_seconds ?? 30);
      setStatus('playing');
    } catch (error: any) {
      console.error(error);
      Platform.OS === 'web' ? window.alert(error.message) : Alert.alert('Error', error.message);
    }
  }, [subjectId, topicId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

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
  }, [status, hasAnswered, currentIndex]);

  const handleTimeOut = () => {
    const currentQ = questions[currentIndex];
    const correctAnswer = currentQ.answers.find((a: any) => a.is_correct);

    setHasAnswered(true);
    setSelectedAnswerId(correctAnswer?.id ?? null);
    setAnswerStatus('incorrect');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setStreak(0);

    setLives((prev) => {
      const newLives = prev - 1;
      if (newLives <= 0) setTimeout(() => finishGame('gameOver'), 1500);
      else setTimeout(nextQuestion, 1500);
      return newLives;
    });
  };

  const submitAnswer = (answerId: number) => {
    const currentQ = questions[currentIndex];
    const isCorrect = currentQ.answers.find((a: any) => a.id === answerId)?.is_correct;
    completeAnswer(Boolean(isCorrect), answerId);
  };

  const submitStructuredAnswer = (isCorrect: boolean) => {
    completeAnswer(isCorrect);
  };

  const completeAnswer = (isCorrect: boolean, answerId?: number) => {
    if (hasAnswered || status !== 'playing') return;

    const currentQ = questions[currentIndex];
    setHasAnswered(true);
    setSelectedAnswerId(answerId ?? null);
    
    // Guardar el intento en el historial
    saveAttempt(currentQ.id, answerId ?? null, isCorrect);
    
    if (isCorrect) {
      setAnswerStatus('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const timeBonus = Math.floor(timeLeft / 2);
      const streakMultiplier = 1 + (streak * 0.1);
      const earned = Math.floor(((currentQ.points_base ?? 10) + timeBonus) * streakMultiplier);

      setScore((prev) => {
        const nextScore = prev + earned;
        scoreRef.current = nextScore;
        return nextScore;
      });
      correctAnswersRef.current += 1;
      setStreak((prev) => prev + 1);
    } else {
      setAnswerStatus('incorrect');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      setLives((prev) => {
        const newLives = prev - 1;
        if (newLives <= 0) setTimeout(() => finishGame('gameOver'), 1500);
        return newLives;
      });
    }

    if (lives > 1 || isCorrect) {
      setTimeout(nextQuestion, 1500);
    }
  };

  const nextQuestion = () => {
    setSelectedAnswerId(null);
    setHasAnswered(false);
    setAnswerStatus(null);
    setHintedAnswerId(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(questions[currentIndex + 1].time_limit_seconds ?? 30);
    } else {
      finishGame('finished');
    }
  };

  const saveAttempt = async (questionId: number, answerId: number | null, isCorrect: boolean) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user.id) return;

      await supabase.from('attempt_history').insert([
        {
          student_id: session.session.user.id,
          question_id: questionId,
          answer_id: answerId,
          is_correct: isCorrect,
          time_taken_seconds: 30 - timeLeft,
        },
      ]);
    } catch (error: any) {
      console.error('Error saving attempt:', error);
      // No mostrar alerta, solo registrar el error
    }
  };

  const useHint = () => {
    if (hasAnswered || status !== 'playing') return false;

    const currentQ = questions[currentIndex];
    const correctAnswer = currentQ?.answers.find((a: any) => a.is_correct);
    if (!correctAnswer) return false;

    setHintedAnswerId(correctAnswer.id);
    setScore((prev) => {
      const nextScore = Math.max(0, prev - 10);
      scoreRef.current = nextScore;
      return nextScore;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return true;
  };

  const skipQuestion = () => {
    if (hasAnswered || status !== 'playing') return;

    setScore((prev) => {
      const nextScore = Math.max(0, prev - 20);
      scoreRef.current = nextScore;
      return nextScore;
    });
    setStreak(0);
    setHintedAnswerId(null);

    if (currentIndex + 1 < questions.length) {
      setSelectedAnswerId(null);
      setHasAnswered(false);
      setAnswerStatus(null);
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(questions[currentIndex + 1]?.time_limit_seconds ?? 30);
    } else {
      finishGame('finished');
    }
  };

  const finishGame = (nextStatus: 'gameOver' | 'finished') => {
    setStatus(nextStatus);

    if (hasSavedScoreRef.current) return;

    hasSavedScoreRef.current = true;
    saveScore(scoreRef.current, correctAnswersRef.current);
  };

  const saveScore = async (finalScore: number, correctAnswers: number) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user.id) return;
    const userId = session.session.user.id;

    try {
      let pointsToAdd = 0;

      if (topicId && topicId !== 'general') {
        const { data: existingTopicScore, error: topicScoreError } = await supabase
          .from('topic_scores')
          .select('id, max_score')
          .eq('student_id', userId)
          .eq('topic_id', Number(topicId))
          .maybeSingle();

        if (topicScoreError) throw topicScoreError;

        if (!existingTopicScore) {
          pointsToAdd = finalScore;
          await supabase.from('topic_scores').insert([
            { student_id: userId, subject_id: subjectId, topic_id: Number(topicId), max_score: finalScore }
          ]);
        } else {
          const previousBest = existingTopicScore.max_score ?? 0;

          if (finalScore > previousBest) {
            pointsToAdd = finalScore - previousBest;
            await supabase
              .from('topic_scores')
              .update({ max_score: finalScore, played_at: new Date() })
              .eq('id', existingTopicScore.id);
          }
        }
      }

      const { data: existingScore, error: scoreError } = await supabase
        .from('subject_scores')
        .select('id, max_score, correct_answers, played_days')
        .eq('student_id', userId)
        .eq('subject_id', subjectId)
        .maybeSingle();

      if (scoreError) throw scoreError;

      if (!existingScore) {
        if (!pointsToAdd) pointsToAdd = finalScore;
        const todayKey = getLocalDateKey(new Date());

        await supabase.from('subject_scores').insert([
          {
            student_id: userId,
            subject_id: subjectId,
            max_score: finalScore,
            correct_answers: correctAnswers,
            played_days: [todayKey],
            played_at: new Date(),
          }
        ]);
      } else {
        const previousBest = existingScore.max_score ?? 0;
        const nextBest = Math.max(previousBest, finalScore);
        const todayKey = getLocalDateKey(new Date());
        const playedDays = Array.isArray(existingScore.played_days) ? existingScore.played_days : [];
        const nextPlayedDays = Array.from(new Set([...playedDays, todayKey])).sort();

        if (finalScore > previousBest) {
          if (!pointsToAdd) pointsToAdd = finalScore - previousBest;
        }

        await supabase
          .from('subject_scores')
          .update({
            max_score: nextBest,
            correct_answers: (existingScore.correct_answers ?? 0) + correctAnswers,
            played_days: nextPlayedDays,
            played_at: new Date(),
          })
          .eq('id', existingScore.id);
      }

      if (pointsToAdd > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', userId)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ points: (profile.points ?? 0) + pointsToAdd })
            .eq('id', userId);
        }
      }
    } catch (e) {
      console.error("Error guardando score:", e);
    }
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
    hasAnswered,
    answerStatus,
    hintedAnswerId,
    submitAnswer,
    submitStructuredAnswer,
    useHint,
    skipQuestion,
  };
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
