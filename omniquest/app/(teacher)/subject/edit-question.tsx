import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function EditQuestionScreen() {
  const { questionId, subjectId } = useLocalSearchParams();
  const router = useRouter();
  
  const [questionText, setQuestionText] = useState('');
  const [timeLimit, setTimeLimit] = useState('30');
  const [points, setPoints] = useState('10');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [answers, setAnswers] = useState<any[]>([
    { id: null, text: '', isCorrect: false },
    { id: null, text: '', isCorrect: false },
    { id: null, text: '', isCorrect: false },
    { id: null, text: '', isCorrect: false },
  ]);

  useEffect(() => {
    const fetchQuestionDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('questions')
          .select('*, answers(*)')
          .eq('id', questionId)
          .single();

        if (error) throw error;

        setQuestionText(data.text);
        setTimeLimit(data.time_limit_seconds.toString());
        setPoints(data.points_base.toString());
        
        if (data.answers) {
          const sortedAnswers = data.answers.sort((a: any, b: any) => a.sort_order - b.sort_order);
          setAnswers(sortedAnswers.map((a: any) => ({
            id: a.id,
            text: a.text,
            isCorrect: a.is_correct
          })));
        }
      } catch (error: any) {
        Alert.alert('Error', 'No se pudo cargar la pregunta');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionDetails();
  }, [questionId]);

  const updateAnswerText = (text: string, index: number) => {
    const newAnswers = [...answers];
    newAnswers[index].text = text;
    setAnswers(newAnswers);
  };

  const markAsCorrect = (indexToMark: number) => {
    const newAnswers = answers.map((ans, i) => ({
      ...ans,
      isCorrect: i === indexToMark,
    }));
    setAnswers(newAnswers);
  };

  const handleUpdate = async () => {
    if (!questionText.trim()) return Alert.alert('Error', 'La pregunta está vacía');
    
    setSaving(true);
    try {
      const { error: qError } = await supabase
        .from('questions')
        .update({
          text: questionText,
          points_base: parseInt(points),
          time_limit_seconds: parseInt(timeLimit),
        })
        .eq('id', questionId);

      if (qError) throw qError;

      for (const ans of answers) {
        const { error: aError } = await supabase
          .from('answers')
          .update({
            text: ans.text,
            is_correct: ans.isCorrect,
          })
          .eq('id', ans.id);
        
        if (aError) throw aError;
      }

      Alert.alert('Actualizado', 'Cambios guardados correctamente');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View className="flex-1 bg-slate-900 justify-center"><ActivityIndicator color="#6366f1" /></View>;

  return (
    <ScrollView className="flex-1 bg-slate-900 px-6 pt-12" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="flex-row items-center mb-6">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 bg-slate-800 rounded-full">
          <Ionicons name="close" size={24} color="#cbd5e1" />
        </Pressable>
        <Text className="text-2xl font-bold text-white">Editar Reto</Text>
      </View>

      <View className="mb-6">
        <Text className="text-slate-300 font-medium mb-2 ml-1">Pregunta</Text>
        <TextInput
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-lg"
          value={questionText}
          onChangeText={setQuestionText}
          multiline
        />
        <View className="flex-row mt-4">
            <View className="flex-1 mr-2">
                <Text className="text-slate-400 text-xs mb-1">Tiempo (s)</Text>
                <TextInput
                    className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white font-bold"
                    value={timeLimit}
                    onChangeText={setTimeLimit}
                    keyboardType="number-pad"
                />
            </View>
            <View className="flex-1 ml-2">
                <Text className="text-slate-400 text-xs mb-1">Puntos</Text>
                <TextInput
                    className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white font-bold color-indigo-400"
                    value={points}
                    onChangeText={setPoints}
                    keyboardType="number-pad"
                />
            </View>
        </View>
      </View>

      {answers.map((answer, index) => (
        <View key={index} className={`flex-row items-center mb-3 rounded-xl border ${answer.isCorrect ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 bg-slate-800'}`}>
          <Pressable onPress={() => markAsCorrect(index)} className="p-4">
            <Ionicons 
              name={answer.isCorrect ? "checkmark-circle" : "ellipse-outline"} 
              size={28} 
              color={answer.isCorrect ? "#10b981" : "#64748b"} 
            />
          </Pressable>
          <TextInput
            className="flex-1 py-4 pr-4 text-white"
            value={answer.text}
            onChangeText={(text) => updateAnswerText(text, index)}
          />
        </View>
      ))}

      <Pressable 
        onPress={handleUpdate}
        disabled={saving}
        className={`w-full bg-indigo-500 rounded-xl py-4 items-center mt-6 ${saving ? 'opacity-70' : ''}`}
      >
        <Text className="text-white font-bold text-lg">
          {saving ? 'Guardando cambios...' : 'Actualizar Pregunta'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}