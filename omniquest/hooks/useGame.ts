import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Alert, Platform } from 'react-native';

export function useGame(subjectId: string) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
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

      setQuestions(data);
      setTimeLeft(data[0].time_limit_seconds);
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
      const earned = Math.floor((currentQ.points_base + timeBonus) * streakMultiplier);
      
      setScore((prev) => prev + earned);
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
      setTimeLeft(questions[currentIndex + 1].time_limit_seconds);
    } else {
      setStatus('finished');
      saveScore();
    }
  };

  const saveScore = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (session?.session?.user.id) {
      const { data: profile } = await supabase.from('profiles').select('points').eq('id', session.session.user.id).single();
      if (profile) {
        await supabase.from('profiles').update({ points: profile.points + score }).eq('id', session.session.user.id);
      }
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