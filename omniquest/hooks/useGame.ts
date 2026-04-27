import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Alert, Platform } from 'react-native';

export function useGame(subjectId: string) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'gameOver' | 'finished' | 'empty'>('loading');
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | null>(null);

  const loadGame = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*, answers(*)')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        setStatus('empty');
        return;
      }

      scoreRef.current = 0;
      setScore(0);
      setCurrentIndex(0);
      setLives(3);
      setStreak(0);
      setQuestions(data);
      setTimeLeft(data[0].time_limit_seconds ?? 30);
      setStatus('playing');
    } catch (error: any) {
      console.error(error);
      Platform.OS === 'web' ? window.alert(error.message) : Alert.alert('Error', error.message);
    }
  }, [subjectId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (status !== 'playing' || selectedAnswerId !== null) return;

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
  }, [status, selectedAnswerId, currentIndex]);

  const handleTimeOut = () => {
    setAnswerStatus('incorrect');
    setStreak(0);
    setLives((prev) => {
      const newLives = prev - 1;
      if (newLives <= 0) setTimeout(() => setStatus('gameOver'), 1500);
      else setTimeout(nextQuestion, 1500);
      return newLives;
    });
  };

  const submitAnswer = (answerId: number) => {
    if (selectedAnswerId !== null || status !== 'playing') return;

    setSelectedAnswerId(answerId);
    const currentQ = questions[currentIndex];
    const isCorrect = currentQ.answers.find((a: any) => a.id === answerId)?.is_correct;

    if (isCorrect) {
      setAnswerStatus('correct');
      const timeBonus = Math.floor(timeLeft / 2);
      const streakMultiplier = 1 + (streak * 0.1);
      const earned = Math.floor(((currentQ.points_base ?? 10) + timeBonus) * streakMultiplier);

      setScore((prev) => {
        const nextScore = prev + earned;
        scoreRef.current = nextScore;
        return nextScore;
      });
      setStreak((prev) => prev + 1);
    } else {
      setAnswerStatus('incorrect');
      setStreak(0);
      setLives((prev) => {
        const newLives = prev - 1;
        if (newLives <= 0) setTimeout(() => setStatus('gameOver'), 1500);
        return newLives;
      });
    }

    if (lives > 1 || isCorrect) {
      setTimeout(nextQuestion, 1500);
    }
  };

  const nextQuestion = () => {
    setSelectedAnswerId(null);
    setAnswerStatus(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(questions[currentIndex + 1].time_limit_seconds ?? 30);
    } else {
      setStatus('finished');
      saveScore(scoreRef.current);
    }
  };

  const saveScore = async (finalScore: number) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user.id) return;
    const userId = session.session.user.id;

    try {
      const { data: existingScore, error: scoreError } = await supabase
        .from('subject_scores')
        .select('id, max_score')
        .eq('student_id', userId)
        .eq('subject_id', subjectId)
        .maybeSingle();

      if (scoreError) throw scoreError;

      let pointsToAdd = 0;

      if (!existingScore) {
        pointsToAdd = finalScore;
        await supabase.from('subject_scores').insert([
          { student_id: userId, subject_id: subjectId, max_score: finalScore }
        ]);
      } else {
        const previousBest = existingScore.max_score ?? 0;

        if (finalScore > previousBest) {
          await supabase
            .from('subject_scores')
            .update({ max_score: finalScore, played_at: new Date() })
            .eq('id', existingScore.id);
        }
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
    answerStatus,
    submitAnswer
  };
}
